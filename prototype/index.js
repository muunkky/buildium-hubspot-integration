const axios = require('axios');
require('dotenv').config();

/**
 * Simple Buildium to HubSpot Integration Prototype
 * 
 * This prototype demonstrates the basic flow:
 * 1. Fetch a tenant from Buildium API
 * 2. Transform the data to HubSpot format
 * 3. Create a contact in HubSpot
 * 
 * Rate Limiting & Error Handling:
 * - Implements exponential backoff for 429 (Too Many Requests) errors
 * - Buildium API limit: 10 concurrent requests per second (~100ms between requests)
 * - HubSpot API limits: 9 req/sec standard (111ms), 1.8 req/sec search (550ms)
 * - Retry strategy: 200ms→400ms→800ms for standard ops, 550ms→1100ms→2200ms for search
 * - Also handles 5xx server errors with slower backoff (1.5x multiplier)
 * - Both Buildium and HubSpot clients use retry mechanisms
 * - Pagination operations properly handle rate limiting across multiple requests
 */

class BuildiumClient {
    constructor() {
        this.baseURL = process.env.BUILDIUM_BASE_URL;
        this.clientId = process.env.BUILDIUM_CLIENT_ID;
        this.clientSecret = process.env.BUILDIUM_CLIENT_SECRET;
    }

    /**
     * Custom parameter serializer to handle array parameters per OpenAPI specification
     * Buildium API expects arrays to be exploded: ?propertyids=123&propertyids=456
     */
    buildParamsSerializer(params) {
        const searchParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
            if (Array.isArray(params[key])) {
                // Explode array parameters per OpenAPI spec (explode: true, collectionFormat: "multi")
                params[key].forEach(value => {
                    searchParams.append(key, value);
                });
            } else {
                searchParams.append(key, params[key]);
            }
        });
        return searchParams.toString();
    }

    /**
     * Make API request with exponential backoff for rate limiting
     * Implements Buildium's recommended retry strategy for 429 errors
     */
    async makeRequestWithRetry(requestFn, maxRetries = 3, initialDelay = 200) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                // Check if this is a rate limit error (429)
                if (error.response?.status === 429 && attempt < maxRetries) {
                    // Exponential backoff: 200ms, 400ms, 800ms, 1600ms
                    const delay = initialDelay * Math.pow(2, attempt);
                    console.log(`⏳ Rate limited (429). Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                // Check for other server errors that might benefit from retry
                if (error.response?.status >= 500 && attempt < maxRetries) {
                    const delay = initialDelay * Math.pow(1.5, attempt); // Slower backoff for server errors
                    console.log(`🔄 Server error (${error.response.status}). Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                // If not a retryable error or max retries exceeded, throw the error
                throw error;
            }
        }
    }

    /**
     * Get a specific tenant by ID from Buildium
     */
    async getTenant(tenantId) {
        try {
            console.log(`🔍 Fetching tenant ${tenantId} from Buildium...`);
            
            const response = await this.makeRequestWithRetry(() => 
                axios.get(`${this.baseURL}/leases/tenants/${tenantId}`, {
                    headers: {
                        'x-buildium-client-id': this.clientId,
                        'x-buildium-client-secret': this.clientSecret,
                        'Content-Type': 'application/json'
                    }
                })
            );

            console.log('✅ Successfully fetched tenant from Buildium');
            return response.data;
        } catch (error) {
            console.error('❌ Error fetching tenant from Buildium:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Test API connectivity with different endpoints
     */
    async testConnectivity() {
        const testEndpoints = [
            '/tenants',
            '/rentals', 
            '/properties',
            '/units'
        ];
        
        console.log('🧪 Testing Buildium API connectivity...');
        
        for (const endpoint of testEndpoints) {
            try {
                const url = `${this.baseURL}${endpoint}`;
                console.log(`\n🔍 Testing: ${url}`);
                
                const response = await this.makeRequestWithRetry(() =>
                    axios.get(url, {
                        headers: {
                            'x-buildium-client-id': this.clientId,
                            'x-buildium-client-secret': this.clientSecret,
                            'Content-Type': 'application/json'
                        },
                        params: { limit: 1 },
                        timeout: 10000
                    })
                );
                
                console.log(`✅ ${endpoint}: Success (${response.status})`);
                if (response.data && Array.isArray(response.data)) {
                    console.log(`   Found ${response.data.length} records`);
                }
            } catch (error) {
                console.log(`❌ ${endpoint}: Failed (${error.response?.status || 'Network Error'})`);
                if (error.response?.data) {
                    console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
                }
            }
        }
    }

    /**
     * Get all tenants (for testing/selection purposes)
     */
    async getAllTenants(limit = 10, offset = 0) {
        try {
            console.log(`🔍 Fetching ${limit} tenants from Buildium (offset: ${offset})...`);
            
            // Try the correct endpoint from the API documentation
            const url = `${this.baseURL}/leases/tenants`;
            const headers = {
                'x-buildium-client-id': this.clientId,
                'x-buildium-client-secret': this.clientSecret,
                'Content-Type': 'application/json'
            };
            const params = { limit: limit, offset: offset };
            
            console.log('🔧 Debug Info:');
            console.log(`   URL: ${url}`);
            console.log(`   Headers: ${JSON.stringify(headers, null, 2)}`);
            console.log(`   Params: ${JSON.stringify(params, null, 2)}`);
            
            const response = await this.makeRequestWithRetry(() =>
                axios.get(url, {
                    headers: headers,
                    params: params
                })
            );

            console.log(`✅ Successfully fetched ${response.data.length} tenants from Buildium`);
            return response.data;
        } catch (error) {
            console.error('❌ Error fetching tenants from Buildium:');
            console.error('   Status:', error.response?.status);
            console.error('   Status Text:', error.response?.statusText);
            console.error('   Headers:', error.response?.headers);
            console.error('   Data:', error.response?.data);
            console.error('   Full Error:', error.message);
            throw error;
        }
    }

    /**
     * Get a specific property by ID from Buildium
     */
    async getProperty(propertyId) {
        try {
            console.log(`🔍 Fetching property ${propertyId} from Buildium...`);
            
            const response = await this.makeRequestWithRetry(() =>
                axios.get(`${this.baseURL}/rentals/${propertyId}`, {
                    headers: {
                        'x-buildium-client-id': this.clientId,
                        'x-buildium-client-secret': this.clientSecret,
                        'Content-Type': 'application/json'
                    }
                })
            );

            console.log('✅ Successfully fetched property from Buildium');
            return response.data;
        } catch (error) {
            console.error('❌ Error fetching property from Buildium:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get all rental units from Buildium
     */
    async getAllUnits(limit = 50, offset = 0, propertyIds = null) {
        try {
            console.log(`🔍 Fetching ${limit} units from Buildium (offset: ${offset})...`);
            
            const params = { limit, offset };
            
            // Add property filter if specified
            if (propertyIds && propertyIds.length > 0) {
                params.propertyids = propertyIds;
                console.log(`   🏢 Filtering by properties: ${propertyIds.join(', ')}`);
            }
            
            const response = await this.makeRequestWithRetry(() =>
                axios.get(`${this.baseURL}/rentals/units`, {
                    headers: {
                        'x-buildium-client-id': this.clientId,
                        'x-buildium-client-secret': this.clientSecret,
                        'Content-Type': 'application/json'
                    },
                    params,
                    paramsSerializer: function(params) {
                        const searchParams = new URLSearchParams();
                        for (const key in params) {
                            if (Array.isArray(params[key])) {
                                // Handle array parameters with explode=true (repeat parameter name)
                                params[key].forEach(value => {
                                    searchParams.append(key, value);
                                });
                            } else {
                                searchParams.append(key, params[key]);
                            }
                        }
                        return searchParams.toString();
                    }
                })
            );

            console.log(`✅ Successfully fetched ${response.data.length} units from Buildium`);
            return response.data;
        } catch (error) {
            console.error('❌ Error fetching units from Buildium:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get all units for a specific property
     */
    async getUnitsForProperty(propertyId) {
        try {
            console.log(`🏢 Fetching all units for property ${propertyId}...`);
            
            const allUnits = [];
            let offset = 0;
            const batchSize = 100;
            
            while (true) {
                const units = await this.getAllUnits(batchSize, offset, [propertyId]);
                
                if (units.length === 0) {
                    break;
                }
                
                allUnits.push(...units);
                
                if (units.length < batchSize) {
                    break; // We got fewer results than requested, so we're done
                }
                
                offset += batchSize;
            }
            
            console.log(`✅ Found ${allUnits.length} units for property ${propertyId}`);
            return allUnits;
        } catch (error) {
            console.error(`❌ Error fetching units for property ${propertyId}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get a specific unit by ID from Buildium
     */
    async getUnit(unitId) {
        try {
            console.log(`🔍 Fetching unit ${unitId} from Buildium...`);
            
            const response = await this.makeRequestWithRetry(() =>
                axios.get(`${this.baseURL}/rentals/units/${unitId}`, {
                    headers: {
                        'x-buildium-client-id': this.clientId,
                        'x-buildium-client-secret': this.clientSecret,
                        'Content-Type': 'application/json'
                    }
                })
            );

            console.log('✅ Successfully fetched unit from Buildium');
            return response.data;
        } catch (error) {
            console.error('❌ Error fetching unit from Buildium:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get active lease for a unit
     * Uses the corrected approach: get all leases for unit, then filter for active
     */
    async getActiveLeaseForUnit(unitId) {
        try {
            console.log(`🔍 Fetching active lease for unit ${unitId}...`);
            
            // Get all leases for this unit using our corrected method
            const allLeasesForUnit = await this.getAllLeasesForUnit(unitId);
            
            // Filter for active leases
            const activeLeases = allLeasesForUnit.filter(lease => lease.LeaseStatus === 'Active');
            
            console.log(`✅ Found ${activeLeases.length} active lease(s) for unit ${unitId} (from ${allLeasesForUnit.length} total leases)`);
            return activeLeases.length > 0 ? activeLeases[0] : null;
        } catch (error) {
            console.error('❌ Error fetching active lease for unit:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get all leases for a unit (including past leases)
     * Uses a two-step approach: get lease IDs, then fetch each lease individually
     */
    /**
     * Get all leases for a unit (including past leases)
     * Uses both propertyids and unitnumber filters for safety and efficiency
     */
    async getAllLeasesForUnit(unitId) {
        try {
            console.log(`🔍 Fetching leases for unit ${unitId}...`);
            
            // First, get the unit to find its property ID and unit number
            console.log(`🏠 Getting unit details for unit ${unitId}`);
            const unitData = await this.getUnit(unitId);
            const propertyId = unitData.PropertyId;
            const unitNumber = unitData.UnitNumber;
            
            if (!propertyId) {
                throw new Error(`No property ID found for unit ${unitId}`);
            }
            if (!unitNumber) {
                throw new Error(`No unit number found for unit ${unitId}`);
            }
            
            console.log(`🏢 Unit ${unitId} (Property: ${propertyId}) has unit number: "${unitNumber}"`);
            
            // Use BOTH propertyids and unitnumber filters for maximum efficiency and safety
            console.log(`📋 Fetching leases using combined property + unitnumber filters...`);
            
            // Fetch all leases with pagination support
            let candidateLeases = [];
            let offset = 0;
            const limit = 100;
            let hasMoreData = true;
            
            while (hasMoreData) {
                const response = await this.makeRequestWithRetry(() =>
                    axios.get(`${this.baseURL}/leases`, {
                        headers: {
                            'x-buildium-client-id': this.clientId,
                            'x-buildium-client-secret': this.clientSecret,
                            'Content-Type': 'application/json'
                        },
                        params: {
                            propertyids: [propertyId],  // Restrict to specific property
                            unitnumber: unitNumber,     // Further filter by unit number
                            limit: limit,
                            offset: offset
                        },
                        timeout: 30000 // 30 second timeout
                    })
                );

                const pageData = response.data;
                candidateLeases = candidateLeases.concat(pageData);
                
                console.log(`📊 Page ${Math.floor(offset/limit) + 1}: Found ${pageData.length} lease(s) (total: ${candidateLeases.length})`);
                
                // Check if we have more data
                hasMoreData = pageData.length === limit;
                offset += limit;
                
                // Safety break to prevent infinite loops
                if (offset > 10000) {
                    console.warn(`⚠️  Stopping pagination at ${offset} leases to prevent infinite loop`);
                    break;
                }
            }
            
            console.log(`📊 Found ${candidateLeases.length} candidate lease(s) from API filters`);
            
            // If no results with unitnumber filter, try fallback with property filter only
            let allPropertyLeases = candidateLeases;
            if (candidateLeases.length === 0) {
                console.log(`🔄 No results with unitnumber filter, trying fallback with property filter only...`);
                
                // Fallback also needs pagination support
                allPropertyLeases = [];
                offset = 0;
                hasMoreData = true;
                
                while (hasMoreData) {
                    const fallbackResponse = await this.makeRequestWithRetry(() =>
                        axios.get(`${this.baseURL}/leases`, {
                            headers: {
                                'x-buildium-client-id': this.clientId,
                                'x-buildium-client-secret': this.clientSecret,
                                'Content-Type': 'application/json'
                            },
                            params: {
                                propertyids: [propertyId],  // Only property filter
                                limit: limit,
                                offset: offset
                            },
                            timeout: 30000
                        })
                    );
                    
                    const pageData = fallbackResponse.data;
                    allPropertyLeases = allPropertyLeases.concat(pageData);
                    
                    console.log(`📊 Fallback page ${Math.floor(offset/limit) + 1}: Found ${pageData.length} lease(s) (total: ${allPropertyLeases.length})`);
                    
                    // Check if we have more data
                    hasMoreData = pageData.length === limit;
                    offset += limit;
                    
                    // Safety break to prevent infinite loops
                    if (offset > 10000) {
                        console.warn(`⚠️  Stopping fallback pagination at ${offset} leases to prevent infinite loop`);
                        break;
                    }
                }
                
                console.log(`📊 Fallback found ${allPropertyLeases.length} lease(s) for property ${propertyId}`);
            }
            
            // Filter by exact unit ID to handle any edge cases
            const exactLeases = allPropertyLeases.filter(lease => 
                lease.UnitId == unitId || lease.Unit?.Id == unitId
            );
            
            console.log(`✅ Confirmed ${exactLeases.length} exact lease(s) for unit ${unitId}`);
            
            // Log lease details for debugging
            exactLeases.forEach((lease, index) => {
                console.log(`   Lease ${index + 1}: ID ${lease.Id}, Status: ${lease.LeaseStatus}, Tenants: ${lease.Tenants?.length || 0}`);
            });
            
            // Warn if we had to filter out results (indicates potential unitnumber ambiguity)
            if (allPropertyLeases.length > exactLeases.length) {
                const filterReason = candidateLeases.length === 0 ? 'unitnumber filter returned no results' : 'unit ID mismatch';
                console.warn(`⚠️  Filtered out ${allPropertyLeases.length - exactLeases.length} lease(s) due to ${filterReason}`);
            }
            
            // Success message with method used
            const method = candidateLeases.length > 0 ? 'property + unitnumber filters' : 'property filter (fallback)';
            console.log(`🎯 Retrieved leases using: ${method}`);
            
            return exactLeases;
            
        } catch (error) {
            console.error(`❌ Error fetching leases for unit ${unitId}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get a specific lease by ID with complete details
     * This method is kept for potential future use cases
     */
    async getLeaseById(leaseId) {
        try {
            const response = await this.makeRequestWithRetry(() =>
                axios.get(`${this.baseURL}/leases/${leaseId}`, {
                    headers: {
                        'x-buildium-client-id': this.clientId,
                        'x-buildium-client-secret': this.clientSecret,
                        'Content-Type': 'application/json'
                    }
                })
            );

            return response.data;
        } catch (error) {
            console.error(`❌ Error fetching lease ${leaseId}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get all leases from Buildium with pagination support
     */
    async getAllLeases(limit = null) {
        try {
            console.log(`🔍 Fetching ${limit ? `up to ${limit}` : 'ALL'} leases from Buildium...`);
            
            const allLeases = [];
            let offset = 0;
            const batchSize = 500; // API limit per request
            let hasMore = true;

            while (hasMore && (limit === null || allLeases.length < limit)) {
                console.log(`📋 Fetching lease batch: offset ${offset}, size ${batchSize}...`);
                
                const params = {
                    limit: batchSize,
                    offset: offset
                };
                
                const response = await this.makeRequestWithRetry(() =>
                    axios.get(`${this.baseURL}/leases`, {
                        headers: {
                            'x-buildium-client-id': this.clientId,
                            'x-buildium-client-secret': this.clientSecret,
                            'Content-Type': 'application/json'
                        },
                        params: params,
                        timeout: 30000 // 30 second timeout
                    })
                );

                const batch = response.data;
                allLeases.push(...batch);
                
                console.log(`   Retrieved ${batch.length} leases (total so far: ${allLeases.length})`);
                
                // Check if we got fewer results than requested (indicates end)
                hasMore = batch.length === batchSize;
                offset += batchSize;

                // Stop if we've reached the limit
                if (limit !== null && allLeases.length >= limit) {
                    console.log(`🛑 Reached limit of ${limit} leases`);
                    break;
                }

                // Safety break to avoid infinite loops
                if (offset > 50000) {
                    console.log(`⚠️ Safety limit reached at ${offset} offset. Breaking pagination.`);
                    break;
                }
            }

            const finalCount = limit !== null ? Math.min(allLeases.length, limit) : allLeases.length;
            const result = limit !== null ? allLeases.slice(0, limit) : allLeases;
            
            console.log(`✅ Retrieved ${finalCount} total leases`);
            return result;
        } catch (error) {
            console.error('❌ Error fetching all leases:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Batch fetch leases for multiple units by grouping requests per property.
     */
    async getLeasesByUnitIds(unitIdentifiers, options = {}) {
        try {
            const normalizedUnits = [];
            const seenUnitIds = new Set();

            (unitIdentifiers || []).forEach(item => {
                if (!item) {
                    return;
                }

                if (typeof item === 'string' || typeof item === 'number') {
                    const unitId = item.toString();
                    if (!seenUnitIds.has(unitId)) {
                        normalizedUnits.push({ unitId });
                        seenUnitIds.add(unitId);
                    }
                    return;
                }

                if (typeof item === 'object') {
                    const rawUnitId = item.unitId ?? item.UnitId ?? item.id ?? item.Id;
                    if (!rawUnitId) {
                        return;
                    }

                    const unitId = rawUnitId.toString();
                    const normalizedEntry = {
                        unitId,
                        propertyId: item.propertyId ?? item.PropertyId ?? item.property_id ?? null,
                        unitNumber: item.unitNumber ?? item.UnitNumber ?? item.unit_number ?? null
                    };

                    if (!seenUnitIds.has(unitId)) {
                        normalizedUnits.push(normalizedEntry);
                        seenUnitIds.add(unitId);
                    } else {
                        const existing = normalizedUnits.find(entry => entry.unitId === unitId);
                        if (existing) {
                            if (!existing.propertyId && normalizedEntry.propertyId) {
                                existing.propertyId = normalizedEntry.propertyId;
                            }
                            if (!existing.unitNumber && normalizedEntry.unitNumber) {
                                existing.unitNumber = normalizedEntry.unitNumber;
                            }
                        }
                    }
                }
            });

            if (normalizedUnits.length === 0) {
                console.log('No unit identifiers provided for batch lease fetch.');
                return [];
            }

            const {
                propertyChunkSize = 5,
                limitPerRequest = 200,
                maxOffset = 50000
            } = options;

            const propertyToUnits = new Map();
            const unitsMissingProperty = [];

            normalizedUnits.forEach(info => {
                if (info.propertyId) {
                    const propertyKey = info.propertyId.toString();
                    if (!propertyToUnits.has(propertyKey)) {
                        propertyToUnits.set(propertyKey, { unitIds: new Set(), unitNumbers: new Set() });
                    }
                    propertyToUnits.get(propertyKey).unitIds.add(info.unitId);
                    if (info.unitNumber) {
                        propertyToUnits.get(propertyKey).unitNumbers.add(info.unitNumber.toString());
                    }
                } else {
                    unitsMissingProperty.push(info);
                }
            });

            const leasesById = new Map();
            const propertyIds = Array.from(propertyToUnits.keys());

            const chunk = (array, size) => {
                const chunks = [];
                for (let i = 0; i < array.length; i += size) {
                    chunks.push(array.slice(i, i + size));
                }
                return chunks;
            };

            for (const propertyChunk of chunk(propertyIds, propertyChunkSize)) {
                console.log(`Fetching leases for property chunk (${propertyChunk.join(', ')})...`);
                let offset = 0;
                let hasMore = true;
                while (hasMore) {
                    const response = await this.makeRequestWithRetry(() =>
                        axios.get(`${this.baseURL}/leases`, {
                            headers: {
                                'x-buildium-client-id': this.clientId,
                                'x-buildium-client-secret': this.clientSecret,
                                'Content-Type': 'application/json'
                            },
                            params: {
                                propertyids: propertyChunk,
                                limit: limitPerRequest,
                                offset: offset
                            },
                            paramsSerializer: params => this.buildParamsSerializer(params),
                            timeout: 30000
                        })
                    );

                    const pageData = Array.isArray(response.data) ? response.data : [];
                    pageData.forEach(lease => {
                        const unitId = lease?.UnitId != null ? lease.UnitId.toString() : null;
                        if (unitId && seenUnitIds.has(unitId)) {
                            leasesById.set(lease.Id ?? `${unitId}-${lease.LeaseFromDate ?? lease.LeaseToDate ?? leasesById.size}`, lease);
                        }
                    });

                    console.log(`   Retrieved ${pageData.length} lease(s) at offset ${offset}.`);
                    hasMore = pageData.length === limitPerRequest;
                    offset += limitPerRequest;

                    if (offset >= maxOffset) {
                        console.warn(`Reached max offset ${offset} for property chunk; stopping pagination.`);
                        break;
                    }
                }
            }

            if (unitsMissingProperty.length > 0) {
                console.log(`Fetching leases individually for ${unitsMissingProperty.length} unit(s) lacking property metadata...`);
                for (const info of unitsMissingProperty) {
                    const fallbackLeases = await this.getAllLeasesForUnit(info.unitId);
                    fallbackLeases.forEach(lease => {
                        leasesById.set(lease.Id ?? `${info.unitId}-${lease.LeaseFromDate ?? leasesById.size}`, lease);
                    });
                }
            }

            const leases = Array.from(leasesById.values()).filter(lease => seenUnitIds.has(lease?.UnitId?.toString?.()));
            console.log(`Batch lease fetch retrieved ${leases.length} lease(s) across ${normalizedUnits.length} unit(s).`);
            return leases;
        } catch (error) {
            console.error('Error fetching leases by unit IDs:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get leases updated since a specific date (for lease-centric sync)
     * This is the core method for efficient incremental synchronization
     * Uses Buildium's lastupdatedfrom filter to fetch only changed leases
     */
    async getLeasesUpdatedSince(lastUpdated, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;
            
            // Format date for Buildium API (expects ISO string)
            const formattedDate = lastUpdated instanceof Date ? lastUpdated.toISOString() : lastUpdated;
            
            console.log(`🔍 Fetching leases updated since ${formattedDate}...`);
            
            const params = {
                limit,
                offset,
                lastupdatedfrom: formattedDate
            };
            
            const response = await this.makeRequestWithRetry(() =>
                axios.get(`${this.baseURL}/leases`, {
                    headers: {
                        'x-buildium-client-id': this.clientId,
                        'x-buildium-client-secret': this.clientSecret,
                        'Content-Type': 'application/json'
                    },
                    params,
                    timeout: 30000 // 30 second timeout
                })
            );

            console.log(`✅ Retrieved ${response.data.length} leases updated since ${formattedDate}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Error fetching leases updated since ${lastUpdated}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get rental owners from Buildium
     * Supports filtering by property IDs and status
     */
    async getRentalOwners(options = {}) {
        try {
            const { propertyIds, status, limit = 100, offset = 0 } = options;
            console.log(`🔍 Fetching rental owners from Buildium...`);
            
            const params = { limit, offset };
            
            if (propertyIds && propertyIds.length > 0) {
                // Keep as array - we'll use custom paramsSerializer to handle it properly
                params.propertyids = propertyIds;
            }
            
            if (status) {
                params.status = status; // 'Active' or 'Inactive'
            }
            
            const response = await this.makeRequestWithRetry(() =>
                axios.get(`${this.baseURL}/rentals/owners`, {
                    headers: {
                        'x-buildium-client-id': this.clientId,
                        'x-buildium-client-secret': this.clientSecret,
                        'Content-Type': 'application/json'
                    },
                    params,
                    // Custom parameter serializer to handle array parameters per OpenAPI spec
                    paramsSerializer: this.buildParamsSerializer,
                    timeout: 30000
                })
            );

            console.log(`✅ Retrieved ${response.data.length} rental owners`);
            return response.data;
        } catch (error) {
            console.error('❌ Error fetching rental owners:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get association owners from Buildium
     * Supports filtering by association IDs
     */
    async getAssociationOwners(options = {}) {
        try {
            const { associationIds, limit = 100, offset = 0 } = options;
            console.log(`🔍 Fetching association owners from Buildium...`);
            
            const params = { limit, offset };
            
            if (associationIds && associationIds.length > 0) {
                // Keep as array - we'll use custom paramsSerializer to handle it properly
                params.associationids = associationIds;
            }
            
            const response = await this.makeRequestWithRetry(() =>
                axios.get(`${this.baseURL}/associations/owners`, {
                    headers: {
                        'x-buildium-client-id': this.clientId,
                        'x-buildium-client-secret': this.clientSecret,
                        'Content-Type': 'application/json'
                    },
                    params,
                    // Custom parameter serializer to handle array parameters per OpenAPI spec
                    paramsSerializer: this.buildParamsSerializer,
                    timeout: 30000
                })
            );

            console.log(`✅ Retrieved ${response.data.length} association owners`);
            return response.data;
        } catch (error) {
            console.error('❌ Error fetching association owners:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get all owners (both rental and association) with unified interface
     */
    async getAllOwners(options = {}) {
        try {
            const { propertyIds, status, ownerType = 'both', limit } = options;
            const allOwners = [];
            
            console.log(`🔍 Fetching all owners (type: ${ownerType})...`);
            
            // Fetch rental owners if requested
            if (ownerType === 'rental' || ownerType === 'both') {
                try {
                    console.log('🔍 Fetching rental owners from Buildium...');
                    let offset = 0;
                    let hasMore = true;
                    let totalRentalOwners = 0;
                    
                    while (hasMore) {
                        const rentalOwners = await this.getRentalOwners({ 
                            propertyIds, 
                            status, 
                            limit: 100, // Fetch in batches of 100
                            offset 
                        });
                        
                        if (rentalOwners.length === 0) {
                            hasMore = false;
                        } else {
                            // Add owner type metadata
                            rentalOwners.forEach(owner => {
                                owner._ownerType = 'rental';
                                owner._isCompany = owner.IsCompany || false;
                            });
                            allOwners.push(...rentalOwners);
                            totalRentalOwners += rentalOwners.length;
                            offset += rentalOwners.length;
                            
                            // If we got less than 100, we've reached the end
                            if (rentalOwners.length < 100) {
                                hasMore = false;
                            }
                        }
                    }
                    
                    console.log(`✅ Retrieved ${totalRentalOwners} rental owners`);
                } catch (error) {
                    console.warn('⚠️ Failed to fetch rental owners:', error.message);
                }
            }
            
            // Fetch association owners if requested
            if (ownerType === 'association' || ownerType === 'both') {
                try {
                    console.log('🔍 Fetching association owners from Buildium...');
                    let offset = 0;
                    let hasMore = true;
                    let totalAssociationOwners = 0;
                    
                    while (hasMore) {
                        const associationOwners = await this.getAssociationOwners({ 
                            associationIds: propertyIds, // Map property IDs to association IDs
                            limit: 100, // Fetch in batches of 100
                            offset
                        });
                        
                        if (associationOwners.length === 0) {
                            hasMore = false;
                        } else {
                            // Add owner type metadata
                            associationOwners.forEach(owner => {
                                owner._ownerType = 'association';
                                owner._isCompany = false; // Association owners are typically individuals
                            });
                            allOwners.push(...associationOwners);
                            totalAssociationOwners += associationOwners.length;
                            offset += associationOwners.length;
                            
                            // If we got less than 100, we've reached the end
                            if (associationOwners.length < 100) {
                                hasMore = false;
                            }
                        }
                    }
                    
                    console.log(`✅ Retrieved ${totalAssociationOwners} association owners`);
                } catch (error) {
                    console.warn('⚠️ Failed to fetch association owners:', error.message);
                }
            }
            
            // Apply global limit if specified
            let finalOwners = allOwners;
            if (limit && allOwners.length > limit) {
                finalOwners = allOwners.slice(0, limit);
                console.log(`🔢 Applied global limit: showing ${finalOwners.length} of ${allOwners.length} owners`);
            }
            
            console.log(`✅ Retrieved ${finalOwners.length} total owners (${finalOwners.filter(o => o._ownerType === 'rental').length} rental, ${finalOwners.filter(o => o._ownerType === 'association').length} association)`);
            return finalOwners;
        } catch (error) {
            console.error('❌ Error fetching all owners:', error.response?.data || error.message);
            throw error;
        }
    }
}

class HubSpotClient {
    constructor() {
        this.baseURL = process.env.HUBSPOT_BASE_URL;
        this.accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
    }

    /**
     * Make API request with exponential backoff for rate limiting
     * HubSpot has different rate limits:
     * - Standard API: 9 req/sec (111ms between requests)
     * - Search API: ~1.8 req/sec (550ms between requests)
     * - Max concurrent: 6 requests
     */
    async makeRequestWithRetry(requestFn, maxRetries = 3, initialDelay = 200, isSearchOperation = false) {
        // Use longer delays for search operations (550ms vs 200ms)
        const baseDelay = isSearchOperation ? 550 : initialDelay;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                // Check if this is a rate limit error (429)
                if (error.response?.status === 429 && attempt < maxRetries) {
                    // Exponential backoff: baseDelay, baseDelay*2, baseDelay*4
                    const delay = baseDelay * Math.pow(2, attempt);
                    console.log(`⏳ HubSpot rate limited (429). Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                // Check for other server errors that might benefit from retry
                if (error.response?.status >= 500 && attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(1.5, attempt); // Slower backoff for server errors
                    console.log(`🔄 HubSpot server error (${error.response.status}). Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                // If not a retryable error or max retries exceeded, throw the error
                throw error;
            }
        }
    }

    /**
     * Create a contact in HubSpot
     */
    async createContact(contactData) {
        try {
            console.log('📝 Creating contact in HubSpot...');
            
            if (process.env.DRY_RUN === 'true') {
                console.log('🔄 DRY RUN MODE - Would create contact:', contactData.properties?.email || 'No email');
                return { id: 'dry-run-id', properties: contactData.properties };
            }

            const response = await this.makeRequestWithRetry(() =>
                axios.post(`${this.baseURL}/crm/v3/objects/contacts`, contactData, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                })
            );

            console.log('✅ Successfully created contact in HubSpot');
            return response.data;
        } catch (error) {
            console.error('❌ Error creating contact in HubSpot:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Update an existing contact in HubSpot
     */
    async updateContact(contactId, contactData) {
        try {
            console.log(`📝 Updating contact ${contactId} in HubSpot...`);
            
            if (process.env.DRY_RUN === 'true') {
                console.log('🔄 DRY RUN MODE - Would update contact with data:', JSON.stringify(contactData, null, 2));
                return { id: contactId, properties: contactData.properties };
            }

            const response = await axios.patch(`${this.baseURL}/crm/v3/objects/contacts/${contactId}`, contactData, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Successfully updated contact in HubSpot');
            return response.data;
        } catch (error) {
            console.error('❌ Error updating contact in HubSpot:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create required custom properties for listings if they don't exist
     */
    async createListingCustomProperties() {
        try {
            console.log('🔧 Creating custom properties for listings...');
            
            const properties = [
                {
                    name: 'buildium_property_id',
                    label: 'Buildium Property ID',
                    type: 'string',  // Changed from number to string
                    description: 'The Buildium Property ID this unit belongs to'
                },
                {
                    name: 'buildium_unit_url',
                    label: 'Buildium Unit URL',
                    type: 'string',
                    fieldType: 'text',
                    description: 'Direct link to manage this unit in Buildium (clickable URL)'
                },
                {
                    name: 'buildium_unit_number',
                    label: 'Buildium Unit Number',
                    type: 'string',
                    description: 'The unit number as defined in Buildium'
                },
                {
                    name: 'buildium_unit_type',
                    label: 'Buildium Unit Type',
                    type: 'string',
                    description: 'The type of unit (e.g., Apartment, House, etc.)'
                },
                {
                    name: 'buildium_is_occupied',
                    label: 'Is Unit Occupied',
                    type: 'string',
                    description: 'Whether the unit is currently occupied (Yes/No)'
                },
                {
                    name: 'buildium_floor_number',
                    label: 'Floor Number',
                    type: 'string',
                    description: 'The floor number where this unit is located'
                },
                {
                    name: 'buildium_market_rent',
                    label: 'Market Rent',
                    type: 'number',
                    description: 'The market rent for this unit'
                },
                {
                    name: 'buildium_unit_status',
                    label: 'Unit Status',
                    type: 'string',
                    description: 'Current status of the unit (Occupied/Vacant)'
                },
                {
                    name: 'buildium_description',
                    label: 'Buildium Description',
                    type: 'string',
                    description: 'Description of the unit from Buildium'
                },
                {
                    name: 'buildium_created_date',
                    label: 'Buildium Created Date',
                    type: 'datetime',
                    description: 'When this unit was created in Buildium'
                },
                {
                    name: 'buildium_last_modified',
                    label: 'Buildium Last Modified',
                    type: 'datetime',
                    description: 'When this unit was last modified in Buildium'
                },
                {
                    name: 'hubspot_property_id',
                    label: 'HubSpot Property ID',
                    type: 'string',
                    description: 'HubSpot Contact/Company ID representing the property'
                },
                {
                    name: 'hubspot_unit_id',
                    label: 'HubSpot Unit ID',
                    type: 'string',
                    description: 'HubSpot Contact/Company ID representing this specific unit'
                },
                {
                    name: 'current_tenant_contact_id',
                    label: 'Current Tenant Contact ID',
                    type: 'string', 
                    description: 'HubSpot Contact ID of the current active tenant'
                },
                {
                    name: 'previous_tenant_contact_ids',
                    label: 'Previous Tenant Contact IDs',
                    type: 'string',
                    description: 'Comma-separated list of HubSpot Contact IDs for previous tenants'
                }
            ];

            for (const property of properties) {
                try {
                    // Check if property already exists
                    const existingResponse = await axios.get(`${this.baseURL}/crm/v3/properties/0-420/${property.name}`, {
                        headers: this.getHeaders()
                    });
                    
                    console.log(`✅ Property '${property.name}' already exists`);
                } catch (error) {
                    if (error.response?.status === 404) {
                        // Property doesn't exist, create it
                        console.log(`🔧 Creating property '${property.name}'...`);
                        
                        const createResponse = await axios.post(`${this.baseURL}/crm/v3/properties/0-420`, {
                            name: property.name,
                            label: property.label,
                            type: property.type,
                            fieldType: property.fieldType || (property.type === 'number' ? 'number' : 'text'),
                            groupName: 'listing_information',
                            description: property.description
                        }, {
                            headers: this.getHeaders()
                        });
                        
                        console.log(`✅ Created property '${property.name}'`);
                    } else {
                        console.error(`❌ Error checking property '${property.name}':`, error.message);
                    }
                }
            }
            
            console.log('✅ All custom properties ready');
            return true;
        } catch (error) {
            console.error('❌ Failed to create custom properties:', error.message);
            return false;
        }
    }

    /**
     * Create required custom properties for contacts if they don't exist
     */
    async createContactCustomProperties() {
        try {
            console.log('🔧 Creating custom properties for contacts...');
            
            const properties = [
                {
                    name: 'buildium_tenant_id',
                    label: 'Buildium Tenant ID',
                    type: 'string',
                    description: 'The unique tenant ID from Buildium'
                },
                {
                    name: 'buildium_notes',
                    label: 'Buildium Notes',
                    type: 'string',
                    description: 'Notes and additional information from Buildium including emergency contacts, driver license, tax ID, etc.'
                }
            ];

            for (const property of properties) {
                try {
                    // Check if property already exists
                    const existingResponse = await axios.get(`${this.baseURL}/crm/v3/properties/0-1/${property.name}`, {
                        headers: this.getHeaders()
                    });
                    console.log(`✅ Contact property '${property.name}' already exists`);
                } catch (error) {
                    if (error.response && error.response.status === 404) {
                        // Property doesn't exist, create it
                        console.log(`🔨 Creating contact property: ${property.name}`);
                        
                        const response = await axios.post(`${this.baseURL}/crm/v3/properties/0-1`, {
                            name: property.name,
                            label: property.label,
                            type: property.type,
                            fieldType: property.type === 'number' ? 'number' : 'text',
                            description: property.description
                        }, {
                            headers: this.getHeaders()
                        });
                        
                        console.log(`✅ Successfully created contact property: ${property.name}`);
                    } else {
                        console.error(`❌ Error checking/creating contact property ${property.name}:`, error.response?.data || error.message);
                    }
                }
            }
            
            console.log('✅ Contact custom properties setup complete');
            return true;
        } catch (error) {
            console.error('❌ Failed to create contact custom properties:', error.message);
            return false;
        }
    }

    /**
     * Create required custom properties for companies if they don't exist
     */
    async createCompanyCustomProperties() {
        try {
            console.log('🔧 Creating custom properties for companies...');
            
            const properties = [
                {
                    name: 'buildium_owner_id',
                    label: 'Buildium Owner ID',
                    type: 'string',
                    description: 'The unique owner ID from Buildium'
                },
                {
                    name: 'buildium_owner_type',
                    label: 'Buildium Owner Type',
                    type: 'string',
                    description: 'The type of owner (rental, association, etc.) from Buildium'
                },
                {
                    name: 'buildium_property_ids',
                    label: 'Buildium Property IDs',
                    type: 'string',
                    description: 'Comma-separated list of property IDs owned in Buildium'
                }
            ];

            for (const property of properties) {
                try {
                    // Check if property already exists
                    const existingResponse = await axios.get(`${this.baseURL}/crm/v3/properties/0-2/${property.name}`, {
                        headers: this.getHeaders()
                    });
                    console.log(`✅ Company property '${property.name}' already exists`);
                } catch (error) {
                    if (error.response && error.response.status === 404) {
                        // Property doesn't exist, create it
                        console.log(`🔨 Creating company property: ${property.name}`);
                        
                        const response = await axios.post(`${this.baseURL}/crm/v3/properties/0-2`, {
                            name: property.name,
                            label: property.label,
                            type: property.type,
                            fieldType: property.type === 'number' ? 'number' : 'text',
                            groupName: 'companyinformation',
                            description: property.description
                        }, {
                            headers: this.getHeaders()
                        });
                        
                        console.log(`✅ Successfully created company property: ${property.name}`);
                    } else {
                        console.error(`❌ Error checking/creating company property ${property.name}:`, error.response?.data || error.message);
                        // Don't fail the entire process for individual property errors
                    }
                }
            }
            
            console.log('✅ Company custom properties setup complete');
            return true;
        } catch (error) {
            console.error('❌ Failed to create company custom properties:', error.response?.data || error.message);
            // Don't fail the sync process even if custom properties fail
            return true;
        }
    }

    /**
     * Get headers for API requests
     */
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Search for existing contact by email
     */
    async searchContactByEmail(email) {
        try {
            console.log(`🔍 Searching for existing contact with email: ${email}`);
            
            // Use longer delay for search operations (550ms vs 200ms)
            const response = await this.makeRequestWithRetry(() =>
                axios.post(`${this.baseURL}/crm/v3/objects/contacts/search`, {
                    filterGroups: [{
                        filters: [{
                            propertyName: 'email',
                            operator: 'EQ',
                            value: email
                        }]
                    }]
                }, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }), 3, 200, true // isSearchOperation = true
            );

            if (response.data.results.length > 0) {
                console.log('✅ Found existing contact');
                return response.data.results[0];
            } else {
                console.log('ℹ️ No existing contact found');
                return null;
            }
        } catch (error) {
            console.error('❌ Error searching for contact:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Create a listing in HubSpot using the native Listings object (0-420)
     */
    async createListing(listingData) {
        try {
            console.log('🏠 Creating listing in HubSpot...');
            
            if (process.env.DRY_RUN === 'true') {
                console.log('🔄 DRY RUN MODE - Would create listing:', listingData.properties?.buildium_unit_id || 'Unknown unit');
                return { id: 'dry-run-listing-id', properties: listingData.properties };
            }

            const response = await this.makeRequestWithRetry(() =>
                axios.post(`${this.baseURL}/crm/v3/objects/0-420`, listingData, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                })
            );

            console.log('✅ Successfully created listing in HubSpot');
            return response.data;
        } catch (error) {
            console.error('❌ Error creating listing in HubSpot:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Update an existing listing in HubSpot
     */
    async updateListing(listingId, listingData) {
        try {
            console.log(`🏠 Updating listing ${listingId} in HubSpot...`);
            
            if (process.env.DRY_RUN === 'true') {
                console.log('🔄 DRY RUN MODE - Would update listing with data:', JSON.stringify(listingData, null, 2));
                return { id: listingId, properties: listingData.properties };
            }

            const response = await axios.patch(`${this.baseURL}/crm/v3/objects/0-420/${listingId}`, listingData, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Successfully updated listing in HubSpot');
            return response.data;
        } catch (error) {
            console.error('❌ Error updating listing in HubSpot:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create multiple listings in HubSpot in batch for efficiency
     * Uses HubSpot's batch API to create up to 100 listings at once
     * Includes duplicate detection by buildium_unit_id
     */
    async createListingsBatch(listings, dryRun = false, force = false, limit = null, existingListingsByUnitId = null) {
        try {
            if (!Array.isArray(listings) || listings.length === 0) {
                throw new Error('listings must be a non-empty array');
            }

            console.log(`🏠 Creating ${listings.length} listing(s) in HubSpot batch...`);
            if (limit) {
                console.log(`🔢 Limit: Will stop after ${limit} successful operations (created + updated)`);
            }
            
            if (dryRun) {
                console.log(`🔄 DRY RUN MODE - Would create batch of ${listings.length} listings`);
                return listings.map((listing, index) => ({ 
                    id: `dry-run-listing-${index}`, 
                    properties: listing.properties 
                }));
            }

            // Check for existing listings and handle based on force flag
            console.log('🔍 Checking for existing listings...');
            const newListings = [];
            const skippedListings = [];
            const updatedListings = [];
            let successfulOperations = 0; // Track created + updated for limit

            for (let i = 0; i < listings.length; i++) {
                // Check limit before processing
                if (limit && successfulOperations >= limit) {
                    console.log(`🔢 Reached limit of ${limit} successful operations. Stopping processing.`);
                    break;
                }
                
                const listing = listings[i];
                const unitId = listing.properties?.buildium_unit_id;
                
                if (unitId) {
                    let existing = null;
                    let cacheHasEntry = false;
                    if (existingListingsByUnitId && Object.prototype.hasOwnProperty.call(existingListingsByUnitId, unitId)) {
                        existing = existingListingsByUnitId[unitId] || null;
                        cacheHasEntry = true;
                    }

                    if (!cacheHasEntry) {
                        existing = await this.searchListingByUnitId(unitId);
                        if (existingListingsByUnitId) {
                            existingListingsByUnitId[unitId] = existing || null;
                        }
                    }

                    if (existing) {
                        if (force) {
                            // FORCE MODE: Always update existing listings
                            console.log(`🔄 Force updating existing listing: ${existing.id} (Unit: ${unitId})`);
                            try {
                                const updateData = {
                                    properties: listing.properties
                                };
                                const updateResponse = await this.updateListing(existing.id, updateData);
                                updatedListings.push({ unitId, listingId: existing.id, updated: updateResponse });
                                if (existingListingsByUnitId) {
                                    existingListingsByUnitId[unitId] = updateResponse;
                                }
                                console.log(`✅ Force updated listing: ${existing.id} for unit ${unitId}`);
                                successfulOperations++; // Count updates toward limit
                            } catch (error) {
                                console.error(`❌ Failed to force update listing for unit ${unitId}:`, error.message);
                            }
                        } else {
                            // SMART MODE: Check if lease data actually changed
                            const leaseId = listing.properties?.buildium_lease_id;
                            const leaseLastUpdated = listing.properties?.lease_last_updated;
                            
                            // Check if we should update lease-related fields
                            let shouldUpdateLease = false;
                            if (leaseId && leaseLastUpdated) {
                                // Compare key lease data fields and last updated timestamp
                                const existingRent = existing.properties?.buildium_market_rent || '';
                                const newRent = listing.properties?.buildium_market_rent || '';
                                const existingStatus = existing.properties?.lease_status || '';
                                const newStatus = listing.properties?.lease_status || '';
                                const existingTenant = existing.properties?.primary_tenant || '';
                                const newTenant = listing.properties?.primary_tenant || '';
                                const existingLastUpdated = existing.properties?.lease_last_updated || '';
                                const newLastUpdated = listing.properties?.lease_last_updated || '';

                                // If last_updated is newer OR any key field differs, update
                                let lastUpdatedIsNewer = false;
                                if (existingLastUpdated && newLastUpdated) {
                                    // Compare ISO strings
                                    lastUpdatedIsNewer = new Date(newLastUpdated) > new Date(existingLastUpdated);
                                }

                                shouldUpdateLease = lastUpdatedIsNewer ||
                                    (existingRent !== newRent) ||
                                    (existingStatus !== newStatus) ||
                                    (existingTenant !== newTenant);
                            }
                            
                            if (shouldUpdateLease) {
                                console.log(`🔄 Updating lease data for existing listing: ${existing.id} (Unit: ${unitId})`);
                                console.log(`📋 Lease changes detected - updating lease-related fields only`);
                                
                                try {
                                    // Update only lease-related fields
                                    const leaseUpdateData = {
                                        properties: {
                                            buildium_market_rent: listing.properties?.buildium_market_rent,
                                            lease_status: listing.properties?.lease_status,
                                            lease_start_date: listing.properties?.lease_start_date,
                                            lease_end_date: listing.properties?.lease_end_date,
                                            primary_tenant: listing.properties?.primary_tenant,
                                            buildium_lease_id: listing.properties?.buildium_lease_id,
                                            lease_last_updated: listing.properties?.lease_last_updated,
                                            next_lease_start: listing.properties?.next_lease_start,
                                            next_lease_tenant: listing.properties?.next_lease_tenant
                                        }
                                    };
                                    
                                    const updateResponse = await this.updateListing(existing.id, leaseUpdateData);
                                    updatedListings.push({ unitId, listingId: existing.id, updated: updateResponse, reason: 'lease_data_changed' });
                                    if (existingListingsByUnitId) {
                                        existingListingsByUnitId[unitId] = updateResponse;
                                    }
                                    console.log(`✅ Updated lease data for listing: ${existing.id}`);
                                    successfulOperations++; // Count updates toward limit
                                } catch (error) {
                                    console.error(`❌ Failed to update lease data for unit ${unitId}:`, error.message);
                                }
                            } else {
                                console.log(`⏭️  Skipping: Unit ID ${unitId} exists with current lease data (Listing ID: ${existing.id})`);
                                skippedListings.push({ unitId, existingId: existing.id, reason: 'no_lease_changes' });
                            }
                        }
                    } else {
                        newListings.push(listing);
                    }
                } else {
                    // No unit ID to check - include it (might be intentional)
                    newListings.push(listing);
                }
            }

            console.log(`📊 Processing results: ${newListings.length} new, ${updatedListings.length} updated, ${skippedListings.length} skipped`);

            if (newListings.length === 0) {
                console.log('ℹ️  No new listings to create');
                return { created: [], updated: updatedListings, skipped: skippedListings };
            }

            // HubSpot batch API can handle up to 100 objects at once
            const batchSize = 100;
            const createdResults = [];

            for (let i = 0; i < newListings.length; i += batchSize) {
                const batch = newListings.slice(i, i + batchSize);
                
                console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1} (${batch.length} listings)`);
                
                const batchRequest = {
                    inputs: batch
                };

                const response = await this.makeRequestWithRetry(() =>
                    axios.post(`${this.baseURL}/crm/v3/objects/0-420/batch/create`, batchRequest, {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    })
                );

                const createdBatchResults = response.data.results || [];
                createdResults.push(...createdBatchResults);

                if (existingListingsByUnitId) {
                    createdBatchResults.forEach(created => {
                        const createdUnitId = created?.properties?.buildium_unit_id;
                        if (createdUnitId) {
                            existingListingsByUnitId[createdUnitId] = created;
                        }
                    });
                }
                console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} completed: ${response.data.results.length} listings created`);
            }

            console.log(`✅ Final results: ${createdResults.length} created, ${updatedListings.length} updated, ${skippedListings.length} skipped`);
            return { created: createdResults, updated: updatedListings, skipped: skippedListings };
        } catch (error) {
            console.error('❌ Error creating listings batch in HubSpot:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Batch read listings by Buildium unit IDs using HubSpot's batch endpoint.
     */
    async getListingsByUnitIds(unitIds, options = {}) {
        try {
            const uniqueUnitIds = Array.from(new Set((unitIds || []).map(id => id?.toString()).filter(Boolean)));
            if (uniqueUnitIds.length === 0) {
                console.log('[HubSpotClient] No unit IDs provided for batch read.');
                return [];
            }

            const {
                properties = [
                    'buildium_unit_id',
                    'buildium_lease_id',
                    'buildium_property_id',
                    'buildium_lease_last_updated',
                    'hs_lastmodifieddate'
                ],
                chunkSize = 100
            } = options;

            const listings = [];

            for (let index = 0; index < uniqueUnitIds.length; index += chunkSize) {
                const chunk = uniqueUnitIds.slice(index, index + chunkSize);
                console.log(`[HubSpotClient] Batch reading ${chunk.length} listing(s) by unit ID (chunk ${Math.floor(index / chunkSize) + 1}).`);

                const requestBody = {
                    idProperty: 'buildium_unit_id',
                    properties,
                    inputs: chunk.map(id => ({ id }))
                };

                const response = await this.makeRequestWithRetry(() =>
                    axios.post(`${this.baseURL}/crm/v3/objects/0-420/batch/read`, requestBody, {
                        headers: this.getHeaders()
                    })
                );

                const batchResults = response.data?.results || [];
                listings.push(...batchResults);
                console.log(`[HubSpotClient] Retrieved ${batchResults.length} listing(s) in current chunk.`);
            }

            console.log(`[HubSpotClient] Batch read fetched ${listings.length} listing(s) total.`);
            return listings;
        } catch (error) {
            console.error('[HubSpotClient] Batch read failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get all listings from HubSpot
     */
    async getAllListings() {
        try {
            const response = await axios.get(`${this.baseURL}/crm/v3/objects/0-420`, {
                headers: this.getHeaders(),
                params: {
                    limit: 100,
                    properties: 'buildium_unit_id,hs_listing_price,hs_city,hs_state_region'
                }
            });
            
            return response.data.results || [];
        } catch (error) {
            console.error('❌ Failed to get all listings:', error.message);
            throw error;
        }
    }

    /**
     * Delete a listing from HubSpot
     */
    async deleteListing(listingId) {
        try {
            const response = await axios.delete(`${this.baseURL}/crm/v3/objects/0-420/${listingId}`, {
                headers: this.getHeaders()
            });
            
            return response.data;
        } catch (error) {
            console.error(`❌ Failed to delete listing ${listingId}:`, error.message);
            throw error;
        }
    }

    /**
     * Search for existing listing by Buildium Unit ID (guaranteed unique!)
     */
    async searchListingByUnitId(unitId) {
        try {
            console.log(`🔍 Searching for existing listing with Buildium Unit ID: ${unitId}`);
            
            const response = await this.makeRequestWithRetry(() =>
                axios.post(`${this.baseURL}/crm/v3/objects/0-420/search`, {
                    filterGroups: [{
                        filters: [{
                            propertyName: 'buildium_unit_id',
                            operator: 'EQ',
                            value: unitId
                        }]
                    }],
                    properties: ['hs_name', 'hs_address_1', 'hs_city', 'buildium_unit_id']
                }, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }),
                3, // maxRetries
                200, // initialDelay
                true // isSearchOperation - uses 550ms base delay and proper exponential backoff
            );

            if (response.data.results.length > 0) {
                console.log('✅ Found existing listing with matching Buildium Unit ID');
                return response.data.results[0];
            }
            
            console.log('ℹ️ No existing listing found with this Buildium Unit ID');
            return null;
        } catch (error) {
            console.error('❌ Error searching for listing by Unit ID:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Alias method for consistency with test expectations
     */
    async findListingByUnitId(unitId) {
        const listing = await this.searchListingByUnitId(unitId);
        return listing ? listing.id : null;
    }

    /**
     * Search for all listings with a specific Buildium Property ID
     */
    async searchListingsByPropertyId(propertyId) {
        try {
            console.log(`🔍 Searching for listings with Buildium Property ID: ${propertyId}`);
            
            const response = await axios.post(`${this.baseURL}/crm/v3/objects/0-420/search`, {
                filterGroups: [{
                    filters: [{
                        propertyName: 'buildium_property_id',
                        operator: 'EQ',
                        value: propertyId
                    }]
                }],
                properties: ['hs_name', 'hs_address_1', 'hs_city', 'buildium_unit_id', 'buildium_property_id'],
                limit: 100 // Get up to 100 listings for this property
            }, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`✅ Found ${response.data.results.length} listing(s) for property ${propertyId}`);
            return response.data.results;
        } catch (error) {
            console.error(`❌ Error searching for listings by Property ID ${propertyId}:`, error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Create association between contact and listing with specified association type
     */
    async createContactListingAssociation(contactId, listingId, associationTypeId = 2) {
        try {
            const typeName = associationTypeId === 13 ? 'Association Owner' : associationTypeId === 4 ? 'Property Owner' : associationTypeId === 2 ? 'Active Tenant' : associationTypeId === 6 ? 'Inactive Tenant' : associationTypeId === 11 ? 'Future Tenant' : `Type ${associationTypeId}`;
            console.log(`🔗 Creating ${typeName} association between Contact ${contactId} and Listing ${listingId}...`);
            
            if (process.env.DRY_RUN === 'true') {
                console.log('🔄 DRY RUN MODE - Would create association');
                return { success: true };
            }

            // Use the V4 API with the specified association type ID
            const associationData = {
                inputs: [{
                    from: { id: contactId },
                    to: { id: listingId },
                    types: [{
                        associationCategory: "USER_DEFINED",
                        associationTypeId: associationTypeId
                    }]
                }]
            };

            const response = await axios.post(
                `${this.baseURL}/crm/v4/associations/contacts/0-420/batch/create`,
                associationData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('✅ Successfully created contact-listing association');
            return response.data;
        } catch (error) {
            console.error('❌ Error creating association:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Create associations between an owner and all unit listings for their properties (with --force sync)
     */
    async createOwnerPropertyAssociations(hubspotRecordId, owner, recordType, associationTypeId = 4) {
        try {
            const typeName = associationTypeId === 13 ? 'Association Owner' : associationTypeId === 4 ? 'Property Owner' : `Type ${associationTypeId}`;
            console.log(`🔗 Creating ${typeName} associations for ${recordType} ${hubspotRecordId}...`);
            console.log(`   Owner has ${owner.PropertyIds?.length || 0} properties: ${owner.PropertyIds?.join(', ') || 'none'}`);
            
            if (!owner.PropertyIds || owner.PropertyIds.length === 0) {
                console.log('⚠️ Owner has no PropertyIds - no associations to create');
                return { status: 'skipped', reason: 'no_properties', associations: 0 };
            }
            
            const results = {
                status: 'success',
                propertiesProcessed: 0,
                listingsFound: 0,
                associationsCreated: 0,
                errors: 0,
                details: []
            };
            
            // Process each property owned by this owner
            for (const propertyId of owner.PropertyIds) {
                console.log(`\n🏢 Processing property ${propertyId}...`);
                
                try {
                    // Step 1: Look for existing unit listings for this property
                    let listings = await this.searchListingsByPropertyId(propertyId);
                    results.propertiesProcessed++;
                    
                    // Step 2: If no listings found, sync the property's units first
                    if (listings.length === 0) {
                        console.log(`⚡ No listings found for property ${propertyId}, syncing units first...`);
                        
                        // Use the integration reference to sync property units
                        if (this.integration) {
                            const syncResult = await this.integration.syncPropertyUnits(propertyId, { force: true });
                            console.log(`   Sync result: ${syncResult.success || 0} units synced`);
                            
                            // Search again after syncing
                            listings = await this.searchListingsByPropertyId(propertyId);
                        } else {
                            console.log('⚠️ Cannot sync units - integration instance not available');
                            results.details.push({
                                propertyId,
                                status: 'error',
                                error: 'Integration instance not available for force sync'
                            });
                            results.errors++;
                            continue;
                        }
                    }
                    
                    console.log(`   Found ${listings.length} listing(s) for property ${propertyId}`);
                    results.listingsFound += listings.length;
                    
                    // Step 3: Associate owner with all found listings
                    for (const listing of listings) {
                        try {
                            await this.createContactListingAssociation(
                                hubspotRecordId, 
                                listing.id, 
                                associationTypeId
                            );
                            results.associationsCreated++;
                            console.log(`   ✅ Associated with listing ${listing.id} (Unit: ${listing.properties?.buildium_unit_id || 'N/A'})`);
                        } catch (error) {
                            console.error(`   ❌ Failed to associate with listing ${listing.id}:`, error.message);
                            results.errors++;
                        }
                    }
                    
                    results.details.push({
                        propertyId,
                        status: 'success',
                        listingsFound: listings.length,
                        associationsCreated: listings.length
                    });
                    
                } catch (error) {
                    console.error(`❌ Error processing property ${propertyId}:`, error.message);
                    results.errors++;
                    results.details.push({
                        propertyId,
                        status: 'error',
                        error: error.message
                    });
                }
            }
            
            // Summary
            console.log(`\n🏆 Owner Association Complete!`);
            console.log(`   Properties Processed: ${results.propertiesProcessed}`);
            console.log(`   Listings Found: ${results.listingsFound}`);
            console.log(`   ✅ Associations Created: ${results.associationsCreated}`);
            console.log(`   ❌ Errors: ${results.errors}`);
            
            return results;
            
        } catch (error) {
            console.error(`❌ Error creating owner property associations:`, error.message);
            return { status: 'error', error: error.message, associations: 0 };
        }
    }

    /**
     * Get all associations for a listing
     */
    async getListingAssociations(listingId) {
        try {
            console.log(`🔗 Getting associations for listing ${listingId}...`);
            
            const response = await axios.get(
                `${this.baseURL}/crm/v4/objects/0-420/${listingId}/associations/contacts`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Found ${response.data.results?.length || 0} associations`);
            return response.data.results || [];
        } catch (error) {
            console.error('❌ Error getting listing associations:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Get all associations for a contact
     */
    async getContactAssociations(contactId) {
        try {
            console.log(`🔗 Getting associations for contact ${contactId}...`);
            
            const response = await axios.get(
                `${this.baseURL}/crm/v4/objects/contacts/${contactId}/associations/0-420`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Found ${response.data.results?.length || 0} associations`);
            return response.data.results || [];
        } catch (error) {
            console.error('❌ Error getting contact associations:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Get associations between a specific contact and listing
     */
    async getContactListingAssociations(contactId, listingId) {
        try {
            // Get all contact associations
            const contactAssociations = await this.getContactAssociations(contactId);
            
            // Filter for associations with the specific listing
            const listingAssociations = contactAssociations.filter(assoc => 
                assoc.toObjectId === listingId.toString()
            );
            
            return listingAssociations;
        } catch (error) {
            console.error('❌ Error getting contact-listing associations:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Get available association types between two object types
     */
    async getAssociationTypes(fromObjectType, toObjectType) {
        try {
            console.log(`🔍 Getting association types from ${fromObjectType} to ${toObjectType}...`);
            
            const response = await axios.get(
                `${this.baseURL}/crm/v4/associations/${fromObjectType}/${toObjectType}/labels`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Found ${response.data.results?.length || 0} association types`);
            return response.data.results || [];
        } catch (error) {
            console.error('❌ Error getting association types:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Delete a contact (for testing purposes)
     */
    async deleteContact(contactId) {
        try {
            console.log(`🗑️ Deleting contact ${contactId}...`);
            
            await axios.delete(
                `${this.baseURL}/crm/v3/objects/contacts/${contactId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('✅ Successfully deleted contact');
        } catch (error) {
            console.error('❌ Error deleting contact:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Delete a listing (for testing purposes)
     */
    async deleteListing(listingId) {
        try {
            console.log(`🗑️ Deleting listing ${listingId}...`);
            
            await axios.delete(
                `${this.baseURL}/crm/v3/objects/0-420/${listingId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('✅ Successfully deleted listing');
        } catch (error) {
            console.error('❌ Error deleting listing:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create or update a contact (for individual owners)
     */
    async createOrUpdateContact(contactData, buildiumOwnerId) {
        try {
            // First, try to find existing contact by email
            const email = contactData.properties.email;
            const existingContact = await this.findContactByEmail(email);
            
            if (existingContact) {
                console.log(`📝 Updating existing contact ${existingContact.id} for owner ${buildiumOwnerId}`);
                return await this.updateContact(existingContact.id, contactData);
            } else {
                console.log(`➕ Creating new contact for owner ${buildiumOwnerId}`);
                return await this.createContact(contactData);
            }
        } catch (error) {
            console.error('❌ Error creating/updating contact:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create a new contact
     */
    async createContact(contactData) {
        try {
            const response = await this.makeRequestWithRetry(() =>
                axios.post(
                    `${this.baseURL}/crm/v3/objects/contacts`,
                    contactData,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                )
            );

            return response.data;
        } catch (error) {
            console.error('❌ Error creating contact:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Update an existing contact
     */
    async updateContact(contactId, contactData) {
        try {
            const response = await this.makeRequestWithRetry(() =>
                axios.patch(
                    `${this.baseURL}/crm/v3/objects/contacts/${contactId}`,
                    contactData,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                )
            );

            return response.data;
        } catch (error) {
            console.error('❌ Error updating contact:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create or update a company (for company owners)
     */
    async createOrUpdateCompany(companyData, buildiumOwnerId) {
        try {
            // First, try to find existing company by Buildium Owner ID
            const existingCompany = await this.findCompanyByBuildiumId(buildiumOwnerId);
            
            if (existingCompany) {
                console.log(`📝 Updating existing company ${existingCompany.id} for owner ${buildiumOwnerId}`);
                return await this.updateCompany(existingCompany.id, companyData);
            } else {
                console.log(`➕ Creating new company for owner ${buildiumOwnerId}`);
                return await this.createCompany(companyData);
            }
        } catch (error) {
            console.error('❌ Error creating/updating company:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create a new company
     */
    async createCompany(companyData) {
        try {
            const response = await this.makeRequestWithRetry(() =>
                axios.post(
                    `${this.baseURL}/crm/v3/objects/companies`,
                    companyData,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                )
            );

            return response.data;
        } catch (error) {
            console.error('❌ Error creating company:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Update an existing company
     */
    async updateCompany(companyId, companyData) {
        try {
            const response = await this.makeRequestWithRetry(() =>
                axios.patch(
                    `${this.baseURL}/crm/v3/objects/companies/${companyId}`,
                    companyData,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                )
            );

            return response.data;
        } catch (error) {
            console.error('❌ Error updating company:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Find contact by Buildium Owner ID
     */
    async findContactByEmail(email) {
        try {
            if (!email) {
                console.log(`⚠️ No email provided, cannot search for existing contact`);
                return null;
            }

            console.log(`🔍 Searching for existing contact by email: ${email}...`);
            const response = await this.makeRequestWithRetry(() =>
                axios.post(
                    `${this.baseURL}/crm/v3/objects/contacts/search`,
                    {
                        filterGroups: [{
                            filters: [{
                                propertyName: 'email',
                                operator: 'EQ',
                                value: email
                            }]
                        }],
                        limit: 1
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                ), true // isSearchOperation = true for proper rate limiting
            );

            const existingContact = response.data.results.length > 0 ? response.data.results[0] : null;
            if (existingContact) {
                console.log(`✅ Found existing contact ${existingContact.id} for email ${email}`);
            } else {
                console.log(`ℹ️ No existing contact found for email ${email}`);
            }
            return existingContact;
        } catch (error) {
            console.error('❌ Error finding contact by email:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Find company by Buildium Owner ID
     */
    async findCompanyByBuildiumId(buildiumOwnerId) {
        try {
            const response = await this.makeRequestWithRetry(() =>
                axios.post(
                    `${this.baseURL}/crm/v3/objects/companies/search`,
                    {
                        filterGroups: [{
                            filters: [{
                                propertyName: 'buildium_owner_id',
                                operator: 'EQ',
                                value: buildiumOwnerId.toString()
                            }]
                        }],
                        limit: 1
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                ), true // isSearchOperation = true for proper rate limiting
            );

            return response.data.results.length > 0 ? response.data.results[0] : null;
        } catch (error) {
            console.error('❌ Error finding company by Buildium ID:', error.response?.data || error.message);
            return null;
        }
    }
}

class DataTransformer {
    /**
     * Transform Buildium tenant data to HubSpot contact format
     */
    transformTenantToContact(tenant) {
        console.log('🔄 Transforming tenant data to HubSpot format...');
        
        // Extract primary phone number
        const primaryPhone = tenant.PhoneNumbers && tenant.PhoneNumbers.length > 0 
            ? tenant.PhoneNumbers[0].Number 
            : null;
        
        // Extract alternative phone numbers
        const alternatePhones = tenant.PhoneNumbers && tenant.PhoneNumbers.length > 1
            ? tenant.PhoneNumbers.slice(1).map(p => p.Number).join(', ')
            : null;

        // Build address string
        const address = tenant.Address 
            ? `${tenant.Address.AddressLine1 || ''} ${tenant.Address.AddressLine2 || ''}`.trim()
            : null;

        // Format creation and modification dates
        const createdDate = tenant.CreatedDateTime ? new Date(tenant.CreatedDateTime).toISOString() : null;
        const lastModifiedDate = tenant.LastModifiedDateTime ? new Date(tenant.LastModifiedDateTime).toISOString() : null;

        const hubspotContact = {
            properties: {
                // Required fields
                firstname: tenant.FirstName || '',
                lastname: tenant.LastName || '',
                email: tenant.Email || '',
                
                // Contact information
                phone: primaryPhone,
                mobilephone: alternatePhones,
                address: address,
                city: tenant.Address?.City,
                state: tenant.Address?.State,
                zip: tenant.Address?.PostalCode,
                country: tenant.Address?.Country,
                
                // Business/Company info
                company: tenant.CompanyName || 'Buildium Tenant',
                jobtitle: tenant.ContactType || 'Tenant',
                
                // Additional contact fields
                hs_additional_emails: tenant.AlternateEmail,
                fax: tenant.FaxNumber,
                website: tenant.Website,
                
                // Tenant-specific information
                date_of_birth: tenant.DateOfBirth ? new Date(tenant.DateOfBirth).toISOString().split('T')[0] : null,
                
                // Buildium metadata - store in description field for now
                hs_content_membership_notes: [
                    `Buildium Tenant ID: ${tenant.Id}`,
                    tenant.Comment ? `Notes: ${tenant.Comment}` : null,
                    tenant.EmergencyContact ? `Emergency Contact: ${tenant.EmergencyContact.FirstName} ${tenant.EmergencyContact.LastName} - ${tenant.EmergencyContact.PhoneNumber}` : null,
                    tenant.DriverLicenseNumber ? `Driver License: ${tenant.DriverLicenseNumber} (${tenant.DriverLicenseState})` : null,
                    tenant.TaxId ? `Tax ID: ${tenant.TaxId}` : null
                ].filter(Boolean).join('\n'),
                
                // HubSpot metadata
                lastmodifieddate: lastModifiedDate,
                hs_lead_status: 'NEW', // Valid options: NEW, OPEN, IN_PROGRESS, OPEN_DEAL, UNQUALIFIED, ATTEMPTED_TO_CONTACT, CONNECTED, BAD_TIMING
                lifecyclestage: 'customer', // Since they're already tenants
                
                // Marketing contact prevention - avoid billing charges
                hs_marketable_status: 'NON_MARKETABLE'
            }
        };

        // Log marketing status decision for audit trail
        console.log(`📊 MARKETING STATUS AUDIT: Tenant ${tenant.Id} (${tenant.Email}) set to NON_MARKETABLE to prevent billing charges`);
        
        // Remove empty/null properties
        Object.keys(hubspotContact.properties).forEach(key => {
            if (hubspotContact.properties[key] === null || hubspotContact.properties[key] === undefined || hubspotContact.properties[key] === '') {
                delete hubspotContact.properties[key];
            }
        });

        console.log('✅ Successfully transformed tenant data');
        return hubspotContact;
    }

    /**
     * Transform Buildium tenant data to HubSpot contact format for SAFE UPDATES ONLY
     * Only includes fields that have actual data from Buildium to avoid overwriting existing HubSpot data
     */
    transformTenantToContactSafeUpdate(tenant) {
        console.log('🔄 Transforming tenant data for SAFE UPDATE (non-empty fields only)...');
        
        // Extract primary phone number
        const primaryPhone = tenant.PhoneNumbers && tenant.PhoneNumbers.length > 0 
            ? tenant.PhoneNumbers[0].Number 
            : null;
        
        // Extract alternative phone numbers
        const alternatePhones = tenant.PhoneNumbers && tenant.PhoneNumbers.length > 1
            ? tenant.PhoneNumbers.slice(1).map(p => p.Number).join(', ')
            : null;

        // Build address string
        const address = tenant.Address 
            ? `${tenant.Address.AddressLine1 || ''} ${tenant.Address.AddressLine2 || ''}`.trim()
            : null;

        // Format creation and modification dates
        const lastModifiedDate = tenant.LastModifiedDateTime ? new Date(tenant.LastModifiedDateTime).toISOString() : null;

        const safeUpdateFields = {};

        // Only add fields that have actual data from Buildium
        if (tenant.FirstName) safeUpdateFields.firstname = tenant.FirstName;
        if (tenant.LastName) safeUpdateFields.lastname = tenant.LastName;
        if (tenant.Email) safeUpdateFields.email = tenant.Email;
        
        // Contact information - only if we have data
        if (primaryPhone) safeUpdateFields.phone = primaryPhone;
        if (alternatePhones) safeUpdateFields.mobilephone = alternatePhones;
        if (address && address.length > 0) safeUpdateFields.address = address;
        if (tenant.Address?.City) safeUpdateFields.city = tenant.Address.City;
        if (tenant.Address?.State) safeUpdateFields.state = tenant.Address.State;
        if (tenant.Address?.PostalCode) safeUpdateFields.zip = tenant.Address.PostalCode;
        if (tenant.Address?.Country) safeUpdateFields.country = tenant.Address.Country;
        
        // Business/Company info - only if we have data
        if (tenant.CompanyName) safeUpdateFields.company = tenant.CompanyName;
        if (tenant.ContactType) safeUpdateFields.jobtitle = tenant.ContactType;
        
        // Additional contact fields - only if we have data
        if (tenant.AlternateEmail) safeUpdateFields.hs_additional_emails = tenant.AlternateEmail;
        if (tenant.FaxNumber) safeUpdateFields.fax = tenant.FaxNumber;
        if (tenant.Website) safeUpdateFields.website = tenant.Website;
        if (tenant.DateOfBirth) safeUpdateFields.date_of_birth = new Date(tenant.DateOfBirth).toISOString().split('T')[0];
        
        // Buildium metadata - always include this since it's our tracking info
        const buildiumNotes = [
            `Buildium Tenant ID: ${tenant.Id}`,
            tenant.Comment ? `Notes: ${tenant.Comment}` : null,
            tenant.EmergencyContact ? `Emergency Contact: ${tenant.EmergencyContact.FirstName} ${tenant.EmergencyContact.LastName} - ${tenant.EmergencyContact.PhoneNumber}` : null,
            tenant.DriverLicenseNumber ? `Driver License: ${tenant.DriverLicenseNumber} (${tenant.DriverLicenseState})` : null,
            tenant.TaxId ? `Tax ID: ${tenant.TaxId}` : null
        ].filter(Boolean).join('\n');
        
        if (buildiumNotes) safeUpdateFields.hs_content_membership_notes = buildiumNotes;
        if (lastModifiedDate) safeUpdateFields.lastmodifieddate = lastModifiedDate;
        
        // Marketing contact prevention - avoid billing charges
        safeUpdateFields.hs_marketable_status = 'NON_MARKETABLE';

        // Log marketing status decision for audit trail
        console.log(`📊 MARKETING STATUS AUDIT: Tenant ${tenant.Id} (${tenant.Email}) safe update - set to NON_MARKETABLE to prevent billing charges`);

        const hubspotContact = {
            properties: safeUpdateFields
        };

        console.log(`✅ Safe update transformation complete - ${Object.keys(safeUpdateFields).length} fields with data`);
        return hubspotContact;
    }

    /**
     * Transform Buildium property data to HubSpot native Listings object format
     */
    transformPropertyToListing(property, unitId = null) {
        console.log('🔄 Transforming property data to HubSpot Listings format...');
        
        // Build full address string
        const fullAddress = property.Address 
            ? `${property.Address.AddressLine1 || ''} ${property.Address.AddressLine2 || ''}, ${property.Address.City || ''}, ${property.Address.State || ''} ${property.Address.PostalCode || ''}`.trim()
            : '';

        // Format dates
        const createdDate = property.CreatedDateTime ? new Date(property.CreatedDateTime).toISOString() : null;
        const lastModifiedDate = property.LastModifiedDateTime ? new Date(property.LastModifiedDateTime).toISOString() : null;

        const hubspotListing = {
            properties: {
                // Core listing fields (using actual HubSpot Listings properties)
                hs_name: property.Name || `Property ${property.Id}`,
                hs_address_1: property.Address?.AddressLine1 || '',
                hs_address_2: property.Address?.AddressLine2 || '',
                hs_city: property.Address?.City || '',
                hs_state_region: property.Address?.State || '',
                hs_country_region: property.Address?.Country || '',
                
                // Handle postal codes properly - only US ZIP codes go in hs_zip (numbers only)
                ...(property.Address?.PostalCode && /^\d{5}(-\d{4})?$/.test(property.Address.PostalCode) ? 
                    { hs_zip: property.Address.PostalCode } :  // US ZIP codes only
                    {}), // Canadian postal codes will be in the description or address line 2
                
                // Property details - include more comprehensive information
                ...(property.NumberOfBedrooms && {
                    hs_bedrooms: parseInt(property.NumberOfBedrooms)
                }),
                ...(property.NumberOfBathrooms && {
                    hs_bathrooms: parseInt(property.NumberOfBathrooms)
                }),
                ...(property.SquareFeet && {
                    hs_square_footage: parseInt(property.SquareFeet)
                }),
                ...(property.MarketRent && {
                    hs_price: parseFloat(property.MarketRent)
                }),
                ...(property.LotSize && {
                    hs_lot_size: parseFloat(property.LotSize)
                }),
                
                // Property type and classification
                hs_listing_type: 'apartments',  // Default to apartments for rental properties
                hs_property_type: property.PropertyType || 'Rental',
                
                // Property description and features
                hs_description: [
                    property.Description,
                    property.Address?.PostalCode && !/^\d{5}(-\d{4})?$/.test(property.Address.PostalCode) ? `Postal Code: ${property.Address.PostalCode}` : null,
                    property.PropertyManagerNotes ? `Manager Notes: ${property.PropertyManagerNotes}` : null,
                    property.RentalOwnerNotes ? `Owner Notes: ${property.RentalOwnerNotes}` : null
                ].filter(Boolean).join('\n\n'),
                
                // Financial information
                hs_year_built: property.YearBuilt ? parseInt(property.YearBuilt) : null,
                
                // Buildium-specific identifiers (as strings to avoid HubSpot comma formatting)
                buildium_unit_id: String(unitId || property.Id),  // Keep as string
                buildium_property_id: String(property.Id),        // Keep as string
                buildium_property_type: property.PropertyType,
                buildium_rental_sub_type: property.RentalSubType,
                
                // Property management info
                buildium_is_active: property.IsActive ? 'Yes' : 'No',
                buildium_reserve_account: property.ReserveAccount || '',
                
                // Timestamps - removed createdate as it's read-only
                hs_lastmodifieddate: lastModifiedDate,
                
                // Contact information
                hs_listing_agent_name: property.PropertyManagerName || '',
                hs_listing_agent_email: property.PropertyManagerEmail || '',
                hs_listing_agent_phone: property.PropertyManagerPhone || ''
            }
        };

        // Remove empty/null properties
        Object.keys(hubspotListing.properties).forEach(key => {
            if (hubspotListing.properties[key] === null || 
                hubspotListing.properties[key] === undefined || 
                hubspotListing.properties[key] === '') {
                delete hubspotListing.properties[key];
            }
        });

        console.log('✅ Successfully transformed property data to listing');
        return hubspotListing;
    }

    /**
     * Transform Buildium owner data to HubSpot contact format (for individual owners)
     */
    transformOwnerToContact(owner) {
        console.log(`🔄 Transforming owner ${owner.Id} to HubSpot contact format...`);
        
        // Extract primary phone number
        const primaryPhone = owner.PhoneNumbers && owner.PhoneNumbers.length > 0 
            ? owner.PhoneNumbers[0].Number 
            : null;

        // Build primary address string
        const primaryAddress = owner.Address || owner.PrimaryAddress;
        const address = primaryAddress 
            ? `${primaryAddress.AddressLine1 || ''} ${primaryAddress.AddressLine2 || ''}`.trim()
            : null;

        // Use ONLY standard HubSpot contact fields to avoid validation errors
        const hubspotContact = {
            properties: {
                // Standard HubSpot contact fields (guaranteed to work)
                firstname: owner.FirstName || '',
                lastname: owner.LastName || `Owner ${owner.Id}`,
                email: owner.Email || null,
                phone: primaryPhone,
                
                // Standard address fields
                address: address,
                city: primaryAddress?.City,
                state: primaryAddress?.State,
                zip: primaryAddress?.PostalCode,
                country: primaryAddress?.Country,
                
                // Standard business fields
                company: owner.CompanyName || null,
                
                // Standard HubSpot lifecycle
                lifecyclestage: 'customer',
                
                // Explicitly set as non-marketing contact to avoid marketing contact charges
                hs_marketable_status: 'NON_MARKETABLE'
                
                // NOTE: All Buildium custom fields removed to avoid validation errors
                // We can create these custom properties in HubSpot later if needed:
                // buildium_owner_id, buildium_property_ids, buildium_management_dates, etc.
            }
        };

        // Clean up null/undefined values
        Object.keys(hubspotContact.properties).forEach(key => {
            if (hubspotContact.properties[key] === null || hubspotContact.properties[key] === undefined) {
                delete hubspotContact.properties[key];
            }
        });

        // Log marketing status decision for audit trail
        console.log(`📊 MARKETING STATUS AUDIT: Owner ${owner.Id} (${owner.Email || 'no email'}) set to NON_MARKETABLE to prevent billing charges`);
        console.log(`✅ Transformed contact: ${owner.FirstName} ${owner.LastName} (${owner.Email || 'no email'})`);
        return hubspotContact;
    }

    /**
     * Transform Buildium owner data to HubSpot company format (for company owners)
     */
    transformOwnerToCompany(owner) {
        console.log(`🔄 Transforming company owner ${owner.Id} to HubSpot company format...`);
        
        // Extract primary phone number
        const primaryPhone = owner.PhoneNumbers && owner.PhoneNumbers.length > 0 
            ? owner.PhoneNumbers[0].Number 
            : null;

        // Build address string
        const primaryAddress = owner.Address || owner.PrimaryAddress;
        const address = primaryAddress 
            ? `${primaryAddress.AddressLine1 || ''} ${primaryAddress.AddressLine2 || ''}`.trim()
            : null;

        // Try to extract domain from email
        const domain = owner.Email ? owner.Email.split('@')[1] : null;

        // Use ONLY standard HubSpot company fields to avoid validation errors
        const hubspotCompany = {
            properties: {
                // Standard HubSpot company fields (guaranteed to work)
                name: owner.CompanyName || `Owner ${owner.Id}`,
                domain: domain,
                phone: primaryPhone,
                
                // Standard address fields
                address: address,
                city: primaryAddress?.City,
                state: primaryAddress?.State,
                zip: primaryAddress?.PostalCode,
                country: primaryAddress?.Country,
                
                // Standard business fields
                industry: 'REAL_ESTATE',  // Using valid HubSpot industry code
                description: owner.Comment || null
                
                // NOTE: All Buildium custom fields removed to avoid validation errors
                // We can create these custom properties in HubSpot later if needed:
                // buildium_owner_id, buildium_property_ids, buildium_management_dates, etc.
            }
        };

        // Clean up null/undefined values
        Object.keys(hubspotCompany.properties).forEach(key => {
            if (hubspotCompany.properties[key] === null || hubspotCompany.properties[key] === undefined) {
                delete hubspotCompany.properties[key];
            }
        });

        console.log(`✅ Transformed company: ${owner.CompanyName || `Owner ${owner.Id}`}`);
        return hubspotCompany;
    }
}

class IntegrationPrototype {
    constructor() {
        this.buildiumClient = new BuildiumClient();
        this.hubspotClient = new HubSpotClient();
        this.transformer = new DataTransformer();
        
        // Set integration reference on HubSpot client for force sync capability
        this.hubspotClient.integration = this;
    }

    /**
     * Main integration flow: Buildium Tenant -> HubSpot Contact
     */
    async syncTenantToContact(tenantId) {
        try {
            console.log('🚀 Starting Buildium to HubSpot sync...');
            console.log('=' .repeat(50));
            
            // Step 1: Fetch tenant from Buildium
            const tenant = await this.buildiumClient.getTenant(tenantId);
            
            console.log('📋 Tenant Data:');
            console.log(`   Name: ${tenant.FirstName} ${tenant.LastName}`);
            console.log(`   Email: ${tenant.Email}`);
            console.log(`   ID: ${tenant.Id}`);
            console.log('');

            // Step 2: Check if contact already exists in HubSpot
            if (tenant.Email) {
                const existingContact = await this.hubspotClient.searchContactByEmail(tenant.Email);
                if (existingContact) {
                    if (this.forceUpdate) {
                        console.log('⚡ Contact exists but FORCE UPDATE enabled:');
                        console.log(`   HubSpot ID: ${existingContact.id}`);
                        console.log('   Updating with latest Buildium data (safe mode - only non-empty fields)...');
                        
                        // Transform the data with latest info using safe update
                        const hubspotContactData = this.transformer.transformTenantToContactSafeUpdate(tenant);
                        
                        // Update the existing contact
                        const updatedContact = await this.hubspotClient.updateContact(existingContact.id, hubspotContactData);
                        
                        console.log('✅ Contact updated successfully!');
                        console.log(`   HubSpot Contact ID: ${updatedContact.id}`);
                        
                        return { status: 'updated', reason: 'force_update', hubspotContact: updatedContact };
                    } else {
                        console.log('⚠️ Contact already exists in HubSpot:');
                        console.log(`   HubSpot ID: ${existingContact.id}`);
                        console.log('   Skipping creation... (use --force to update)');
                        return { status: 'skipped', reason: 'already_exists', hubspotContact: existingContact };
                    }
                }
            }

            // Step 3: Transform data
            const hubspotContactData = this.transformer.transformTenantToContact(tenant);

            // Step 4: Create contact in HubSpot
            const hubspotContact = await this.hubspotClient.createContact(hubspotContactData);

            console.log('✅ Contact created successfully!');
            console.log(`   HubSpot Contact ID: ${hubspotContact.id}`);

            // Step 5: Check if tenant has lease information with property details
            let hubspotListing = null;
            if (tenant.Leases && tenant.Leases.length > 0) {
                const activeLease = tenant.Leases[0]; // Get the first/active lease
                
                if (activeLease.PropertyId) {
                    console.log('� Tenant has lease with property info, creating/finding listing...');
                    
                    try {
                        // Fetch the property details from Buildium
                        const property = await this.buildiumClient.getProperty(activeLease.PropertyId);
                        
                        // Use the Unit ID from the lease for unique identification
                        const unitId = activeLease.UnitId;
                        console.log(`🏠 Unit ID from lease: ${unitId}`);
                        
                        // Check if listing already exists (search by Buildium Unit ID - guaranteed unique!)
                        const existingListing = await this.hubspotClient.searchListingByUnitId(unitId);
                        
                        if (existingListing) {
                            console.log(`✅ Found existing listing: ${existingListing.id}`);
                            hubspotListing = existingListing;
                        } else {
                            // Create new listing with Unit ID
                            console.log('🏗️ Creating new listing for property...');
                            const listingData = this.transformer.transformPropertyToListing(property, unitId);
                            
                            try {
                                hubspotListing = await this.hubspotClient.createListing(listingData);
                                console.log(`✅ Created new listing: ${hubspotListing.id}`);
                            } catch (createError) {
                                // If creation fails due to duplicate Unit ID, search for the existing listing
                                if (createError.message.includes('already has that value') || 
                                    createError.message.includes('buildium_unit_id') ||
                                    createError.response?.data?.message?.includes('already has that value')) {
                                    console.log('⚠️ Listing with this Unit ID already exists, finding it...');
                                    hubspotListing = await this.hubspotClient.searchListingByUnitId(unitId);
                                    if (hubspotListing) {
                                        console.log(`✅ Found existing listing: ${hubspotListing.id}`);
                                    } else {
                                        throw new Error('Could not find existing listing after duplicate error');
                                    }
                                } else {
                                    throw createError;
                                }
                            }
                        }
                        
                        // Step 6: Create association between contact and listing
                        if (hubspotListing) {
                            // Default to Active Tenant association (ID=2) for this legacy method
                            await this.hubspotClient.createContactListingAssociation(
                                hubspotContact.id, 
                                hubspotListing.id,
                                2  // Active Tenant association type ID
                            );
                            console.log('✅ Created "Active Tenant" association');
                        }
                        
                    } catch (propertyError) {
                        console.log('⚠️ Could not create listing for property:', propertyError.message);
                    }
                }
            }

            console.log('�🎉 Sync completed successfully!');
            console.log(`   HubSpot Contact ID: ${hubspotContact.id}`);
            if (hubspotListing) {
                console.log(`   HubSpot Listing ID: ${hubspotListing.id}`);
                console.log('   Association: Contact ↔ Listing (Active Tenant)');
            }
            
            return { 
                status: 'success', 
                buildiumTenant: tenant, 
                hubspotContact: hubspotContact,
                hubspotListing: hubspotListing
            };

        } catch (error) {
            console.error('💥 Sync failed:', error.message);
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Sync a future tenant to HubSpot contact and create Future Tenant association
     * Similar to syncTenantToContact but uses Future Tenant association type (ID: 11)
     */
    async syncFutureTenantToContact(tenantId, unitId) {
        try {
            console.log('🔮 Starting Future Tenant sync...');
            console.log('=' .repeat(50));
            
            // Step 1: Fetch tenant from Buildium
            const tenant = await this.buildiumClient.getTenant(tenantId);
            
            console.log('📋 Future Tenant Data:');
            console.log(`   Name: ${tenant.FirstName} ${tenant.LastName}`);
            console.log(`   Email: ${tenant.Email}`);
            console.log(`   ID: ${tenant.Id}`);
            console.log('');

            // Step 2: Check if contact already exists in HubSpot
            let hubspotContact = null;
            if (tenant.Email) {
                const existingContact = await this.hubspotClient.searchContactByEmail(tenant.Email);
                if (existingContact) {
                    console.log('✅ Contact already exists in HubSpot:');
                    console.log(`   HubSpot ID: ${existingContact.id}`);
                    hubspotContact = existingContact;
                    
                    if (this.forceUpdate) {
                        console.log('⚡ Force update enabled, updating with latest data...');
                        const hubspotContactData = this.transformer.transformTenantToContactSafeUpdate(tenant);
                        hubspotContact = await this.hubspotClient.updateContact(existingContact.id, hubspotContactData);
                        console.log('✅ Contact updated successfully!');
                    }
                } else {
                    // Create new contact
                    console.log('🆕 Creating new contact for future tenant...');
                    const hubspotContactData = this.transformer.transformTenantToContact(tenant);
                    hubspotContact = await this.hubspotClient.createContact(hubspotContactData);
                    console.log('✅ Contact created successfully!');
                    console.log(`   HubSpot Contact ID: ${hubspotContact.id}`);
                }
            } else {
                console.log('⚠️ No email found for tenant, skipping contact creation');
                return { status: 'skipped', reason: 'no_email' };
            }

            // Step 3: Find the listing by Unit ID
            const hubspotListing = await this.hubspotClient.searchListingByUnitId(unitId);
            if (!hubspotListing) {
                console.log('⚠️ No listing found for unit ID:', unitId);
                return { status: 'error', error: 'listing_not_found' };
            }

            console.log(`✅ Found listing: ${hubspotListing.id} for unit ${unitId}`);

            // Step 4: Create Future Tenant association between contact and listing
            await this.hubspotClient.createContactListingAssociation(
                hubspotContact.id, 
                hubspotListing.id,
                11  // Future Tenant association type ID
            );
            console.log('✅ Created "Future Tenant" association');

            console.log('🎉 Future Tenant sync completed successfully!');
            console.log(`   HubSpot Contact ID: ${hubspotContact.id}`);
            console.log(`   HubSpot Listing ID: ${hubspotListing.id}`);
            console.log('   Association: Contact ↔ Listing (Future Tenant)');
            
            return { 
                status: 'success', 
                buildiumTenant: tenant, 
                hubspotContact: hubspotContact,
                hubspotListing: hubspotListing
            };

        } catch (error) {
            console.error('💥 Future Tenant sync failed:', error.message);
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Sync property data from Buildium to HubSpot Listings object
     */
    async syncPropertyToListing(propertyId) {
        try {
            console.log('🏠 Starting Buildium Property to HubSpot Listing sync...');
            console.log('=' .repeat(50));
            
            // Step 1: Fetch property from Buildium (using rental properties endpoint)
            const property = await this.buildiumClient.getProperty(propertyId);
            
            console.log('🏢 Property Data:');
            console.log(`   Name: ${property.Name}`);
            console.log(`   Address: ${property.Address?.AddressLine1}, ${property.Address?.City}, ${property.Address?.State}`);
            console.log(`   ID: ${property.Id}`);
            console.log('');

            // Step 2: Check if listing already exists in HubSpot (search by Unit ID if this is a unit-based property)
            // For the standalone sync-property command, we'll use the property ID as the unit ID
            const unitId = property.Id; // Use property ID as unit identifier for standalone syncs
            const existingListing = await this.hubspotClient.searchListingByUnitId(unitId);
            if (existingListing) {
                console.log('⚠️ Listing already exists in HubSpot:');
                console.log(`   HubSpot Listing ID: ${existingListing.id}`);
                console.log('   Skipping creation...');
                return { status: 'skipped', reason: 'already_exists', hubspotListing: existingListing };
            }

            // Step 3: Transform data with Unit ID
            const hubspotListingData = this.transformer.transformPropertyToListing(property, unitId);

            // Step 4: Create listing in HubSpot
            const hubspotListing = await this.hubspotClient.createListing(hubspotListingData);

            console.log('🎉 Property sync completed successfully!');
            console.log(`   HubSpot Listing ID: ${hubspotListing.id}`);
            
            return { 
                status: 'success', 
                buildiumProperty: property, 
                hubspotListing: hubspotListing 
            };

        } catch (error) {
            console.error('💥 Property sync failed:', error.message);
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Sync all units for a specific property to HubSpot listings (with force option)
     */
    async syncPropertyUnits(propertyId, options = {}) {
        try {
            const { force = false, limit } = options;
            
            console.log(`🏢 Starting sync of all units for property ${propertyId}...`);
            console.log('=' .repeat(50));
            
            // Step 1: Get all units for this property
            const units = await this.buildiumClient.getUnitsForProperty(propertyId);
            
            if (units.length === 0) {
                console.log(`⚠️ No units found for property ${propertyId}`);
                return { status: 'skipped', reason: 'no_units', propertyId, unitsProcessed: 0 };
            }
            
            console.log(`📋 Found ${units.length} units to sync for property ${propertyId}`);
            
            const results = {
                propertyId,
                totalUnits: units.length,
                success: 0,
                skipped: 0,
                errors: 0,
                details: []
            };
            
            // Step 2: Sync each unit
            for (let i = 0; i < units.length; i++) {
                const unit = units[i];
                console.log(`\n[${i + 1}/${units.length}] Processing Unit: ${unit.UnitNumber || unit.Id}`);
                console.log('-'.repeat(40));
                
                try {
                    // Skip if listing already exists (unless force is true)
                    if (!force) {
                        const existingListing = await this.hubspotClient.searchListingByUnitId(unit.Id);
                        if (existingListing) {
                            results.skipped++;
                            results.details.push({
                                unit: unit.UnitNumber || unit.Id,
                                status: 'skipped',
                                reason: 'already_exists',
                                listingId: existingListing.id
                            });
                            console.log(`⚠️ Listing already exists (ID: ${existingListing.id}) - skipping...`);
                            continue;
                        }
                    }
                    
                    // Sync the unit
                    const syncResult = await this.syncUnitToListing(unit);
                    
                    if (syncResult.status === 'success') {
                        results.success++;
                        results.details.push({
                            unit: unit.UnitNumber || unit.Id,
                            status: 'success',
                            listingId: syncResult.hubspotListing.id
                        });
                        console.log(`✅ Success: Listing ${syncResult.hubspotListing.id}`);
                    } else if (syncResult.status === 'skipped') {
                        results.skipped++;
                        results.details.push({
                            unit: unit.UnitNumber || unit.Id,
                            status: 'skipped',
                            reason: syncResult.reason
                        });
                        console.log(`⚠️ Skipped (${syncResult.reason})`);
                    } else {
                        results.errors++;
                        results.details.push({
                            unit: unit.UnitNumber || unit.Id,
                            status: 'error',
                            error: syncResult.error
                        });
                        console.log(`❌ Error: ${syncResult.error}`);
                    }
                    
                } catch (error) {
                    results.errors++;
                    results.details.push({
                        unit: unit.UnitNumber || unit.Id,
                        status: 'error',
                        error: error.message
                    });
                    console.error(`❌ Error syncing unit ${unit.UnitNumber || unit.Id}:`, error.message);
                }
            }
            
            // Step 3: Automatic tenant associations lifecycle management
            console.log('\n🔄 Updating tenant association lifecycle (automatic)...');
            // Import TenantLifecycleManager here
            const TenantLifecycleManager = require('./TenantLifecycleManager.js');
            const lifecycleManager = new TenantLifecycleManager(this.hubspotClient, this.buildiumClient);
            // For property sync, check all leases (use a date far in the past)
            const allLeasesDate = new Date('2020-01-01');
            const lifecycleStats = await lifecycleManager.updateTenantAssociations(false, limit, allLeasesDate, null); // null = process all leases
            const totalLifecycleUpdates = lifecycleStats.futureToActive + lifecycleStats.activeToInactive + lifecycleStats.futureToInactive;
            console.log(`✅ Lifecycle updates: ${totalLifecycleUpdates}`);
            if (totalLifecycleUpdates === 0) {
                console.log('   ✨ All tenant associations are up to date!');
            }
            
            // Step 4: Summary
            console.log('\n🏆 Property Units Sync Complete!');
            console.log('=' .repeat(50));
            console.log(`   Property ID: ${propertyId}`);
            console.log(`   Total Units: ${results.totalUnits}`);
            console.log(`   ✅ Success: ${results.success}`);
            console.log(`   ⚠️ Skipped: ${results.skipped}`);
            console.log(`   ❌ Errors: ${results.errors}`);
            
            return { status: 'completed', ...results };
            
        } catch (error) {
            console.error(`💥 Property units sync failed for property ${propertyId}:`, error.message);
            return { status: 'error', propertyId, error: error.message };
        }
    }

    /**
     * Batch sync multiple tenants with optional limit
     */
    async batchSyncTenants(options = {}) {
        try {
            const { limit = 10 } = options;
            
            console.log('🔄 Starting Batch Tenant Sync...');
            console.log('=' .repeat(50));
            console.log(`   Target: ${limit} successful syncs (skips don't count)`);
            console.log('');

            const results = {
                target: limit,
                success: 0,
                skipped: 0,
                errors: 0,
                details: []
            };

            let offset = 0;
            let totalProcessed = 0;
            const batchSize = Math.max(limit * 2, 20); // Fetch more than needed to account for skips

            // Keep processing until we hit our success target or run out of tenants
            while (results.success < limit) {
                // Step 1: Fetch a batch of tenants from Buildium
                console.log(`📋 Fetching batch of tenants (offset: ${offset})...`);
                const tenants = await this.buildiumClient.getAllTenants(batchSize, offset);
                
                if (tenants.length === 0) {
                    console.log('ℹ️ No more tenants available');
                    break;
                }
                
                console.log(`   Found ${tenants.length} tenants in this batch`);

                // Step 2: Process each tenant until we hit our success target
                for (let i = 0; i < tenants.length && results.success < limit; i++) {
                    const tenant = tenants[i];
                    totalProcessed++;
                    const successCount = results.success + 1; // What this would be if successful
                    
                    console.log(`\n[${successCount}/${limit}] Processing: ${tenant.FirstName} ${tenant.LastName} (ID: ${tenant.Id})`);
                    console.log('-'.repeat(60));
                    
                    try {
                        const syncResult = await this.syncTenantToContact(tenant.Id);
                        
                        if (syncResult.status === 'success') {
                            results.success++;
                            console.log(`✅ [${results.success}/${limit}] Success: Contact ${syncResult.hubspotContact.id}${syncResult.hubspotListing ? `, Listing ${syncResult.hubspotListing.id}` : ''}`);
                        } else if (syncResult.status === 'skipped') {
                            results.skipped++;
                            console.log(`⚠️ Skipped (${syncResult.reason}) - continuing to next tenant...`);
                        } else {
                            results.errors++;
                            console.log(`❌ Error: ${syncResult.error}`);
                        }
                        
                        results.details.push({
                            tenant: `${tenant.FirstName} ${tenant.LastName}`,
                            tenantId: tenant.Id,
                            email: tenant.Email,
                            result: syncResult
                        });
                        
                        // Add a small delay to avoid rate limiting
                        if (results.success < limit) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                        
                    } catch (error) {
                        results.errors++;
                        console.log(`❌ Error: ${error.message}`);
                        
                        results.details.push({
                            tenant: `${tenant.FirstName} ${tenant.LastName}`,
                            tenantId: tenant.Id,
                            email: tenant.Email,
                            result: { status: 'error', error: error.message }
                        });
                    }
                }

                // If we haven't reached our target, prepare for next batch
                if (results.success < limit) {
                    offset += tenants.length;
                    console.log(`\n🔄 Need ${limit - results.success} more successes, fetching next batch...`);
                }
            }

            // Update the results total to reflect actual processed count
            results.total = totalProcessed;

            // Step 3: Summary
            console.log('\n🎉 Batch Sync Complete!');
            console.log('=' .repeat(50));
            console.log(`   Target: ${limit} successful syncs`);
            console.log(`   ✅ Successful: ${results.success}`);
            console.log(`   ⚠️ Skipped: ${results.skipped}`);
            console.log(`   ❌ Errors: ${results.errors}`);
            console.log(`   📊 Total Processed: ${results.total}`);
            console.log('');

            return results;

        } catch (error) {
            console.error('💥 Batch sync failed:', error.message);
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Sync units to listings with tenant associations
     * This is the new unit-centric approach
     */
    async syncUnitsToListings(options = {}) {
        try {
            const { limit = null, propertyIds = null } = options; // Default to unlimited
            
            console.log('🏠 Starting Unit-to-Listing Sync...');
            console.log('=' .repeat(50));
            console.log(`   Target: ${limit || 'ALL'} units to process`);
            if (propertyIds) {
                console.log(`   Property Filter: ${propertyIds.join(', ')}`);
            }
            console.log('');

            // Ensure listing custom properties exist
            await this.hubspotClient.createListingCustomProperties();

            const results = {
                target: limit,
                success: 0,
                skipped: 0,
                errors: 0,
                details: []
            };

            let offset = 0;
            let totalProcessed = 0;
            const batchSize = limit ? Math.max(limit * 2, 20) : 100; // Use reasonable batch size for unlimited

            // Keep processing until we hit our success target or run out of units
            while (limit === null || results.success < limit) {
                // Step 1: Fetch a batch of units from Buildium
                console.log(`📋 Fetching batch of units (offset: ${offset})...`);
                const units = await this.buildiumClient.getAllUnits(batchSize, offset, propertyIds);
                
                if (units.length === 0) {
                    console.log('ℹ️ No more units available');
                    break;
                }
                
                console.log(`   Found ${units.length} units in this batch`);

                // Step 2: Process each unit
                for (let i = 0; i < units.length && (limit === null || results.success < limit); i++) {
                    const unit = units[i];
                    totalProcessed++;
                    const successCount = results.success + 1;
                    
                    console.log(`\n[${successCount}/${limit}] Processing Unit: ${unit.UnitNumber || unit.Id} (Property: ${unit.PropertyId})`);
                    console.log('-'.repeat(60));
                    
                    try {
                        const syncResult = await this.syncUnitToListing(unit);
                        
                        if (syncResult.status === 'success') {
                            results.success++;
                            console.log(`✅ [${results.success}/${limit}] Success: Listing ${syncResult.hubspotListing.id}`);
                        } else if (syncResult.status === 'updated') {
                            results.success++;
                            console.log(`✅ [${results.success}/${limit}] Updated: Listing ${syncResult.hubspotListing.id}`);
                        } else if (syncResult.status === 'skipped') {
                            results.skipped++;
                            console.log(`⚠️ Skipped (${syncResult.reason}) - continuing to next unit...`);
                        } else {
                            results.errors++;
                            console.log(`❌ Error: ${syncResult.error}`);
                        }
                        
                        results.details.push({
                            unit: `Unit ${unit.UnitNumber || unit.Id}`,
                            unitId: unit.Id,
                            propertyId: unit.PropertyId,
                            result: syncResult
                        });
                        
                        // Small delay to avoid rate limiting
                        if (results.success < limit) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                        
                    } catch (error) {
                        results.errors++;
                        console.log(`❌ Error: ${error.message}`);
                        
                        results.details.push({
                            unit: `Unit ${unit.UnitNumber || unit.Id}`,
                            unitId: unit.Id,
                            propertyId: unit.PropertyId,
                            result: { status: 'error', error: error.message }
                        });
                    }
                }

                // If we haven't reached our target, prepare for next batch
                if (results.success < limit) {
                    offset += units.length;
                    console.log(`\n🔄 Need ${limit - results.success} more successes, fetching next batch...`);
                }
            }

            results.total = totalProcessed;

            // Step: Automatic tenant associations lifecycle management
            console.log('\n🔄 Updating tenant association lifecycle (automatic)...');
            // Import TenantLifecycleManager here
            const TenantLifecycleManager = require('./TenantLifecycleManager.js');
            const lifecycleManager = new TenantLifecycleManager(this.hubspotClient, this.buildiumClient);
            // For units sync, check all leases (use a date far in the past)
            const allLeasesDate = new Date('2020-01-01');
            const lifecycleStats = await lifecycleManager.updateTenantAssociations(false, limit, allLeasesDate, null); // null = process all leases
            const totalLifecycleUpdates = lifecycleStats.futureToActive + lifecycleStats.activeToInactive + lifecycleStats.futureToInactive;
            console.log(`✅ Lifecycle updates: ${totalLifecycleUpdates}`);
            if (totalLifecycleUpdates === 0) {
                console.log('   ✨ All tenant associations are up to date!');
            }

            // Summary
            console.log('\n🎉 Unit Sync Complete!');
            console.log('=' .repeat(50));
            console.log(`   Target: ${limit || 'ALL'} units`);
            console.log(`   ✅ Successful: ${results.success}`);
            console.log(`   ⚠️ Skipped: ${results.skipped}`);
            console.log(`   ❌ Errors: ${results.errors}`);
            console.log(`   📊 Total Processed: ${results.total}`);
            
            // Detailed breakdown
            if (results.success > 0) {
                console.log('\n🎉 Successfully Processed Units:');
                results.details
                    .filter(d => d.result.status === 'success' || d.result.status === 'updated')
                    .forEach((detail, index) => {
                        const status = detail.result.status === 'updated' ? 'Updated' : 'Created';
                        console.log(`  ${index + 1}. ${detail.unit} → ${status} HubSpot ID: ${detail.result.hubspotListing.id}`);
                    });
            }
            
            if (results.errors > 0) {
                console.log('\n❌ Errors Encountered:');
                results.details
                    .filter(d => d.result.status === 'error')
                    .forEach((detail, index) => {
                        console.log(`  ${index + 1}. ${detail.unit}: ${detail.result.error}`);
                    });
            }
            
            console.log('');

            return results;

        } catch (error) {
            console.error('💥 Unit sync failed:', error.message);
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Sync a single unit to a HubSpot listing
     */
    async syncUnitToListing(unit) {
        try {
            console.log(`🏠 Processing Unit ${unit.UnitNumber || unit.Id} (Property: ${unit.PropertyId})`);
            
            // Step 1: Check if listing already exists
            const existingListing = await this.hubspotClient.searchListingByUnitId(unit.Id);
            
            if (existingListing) {
                if (this.forceUpdate) {
                    console.log(`⚡ Listing exists for unit ${unit.Id}: ${existingListing.id} - FORCE UPDATING...`);
                    
                    // Step 2: Get property details for update
                    const property = await this.buildiumClient.getProperty(unit.PropertyId);
                    
                    // Step 3: Get lease information for update
                    const activeLeases = await this.buildiumClient.getActiveLeaseForUnit(unit.Id);
                    const allLeases = await this.buildiumClient.getAllLeasesForUnit(unit.Id);
                    
                    // Step 4: Transform to listing format with updated data using SAFE UPDATE
                    const buildiumUnitUrl = `https://ripple.managebuilding.com/manager/app/properties/${unit.PropertyId}/units/${unit.Id}/summary`;
                    const listingData = this.transformUnitToListingSafeUpdate(unit, property, activeLeases, allLeases, buildiumUnitUrl);
                    
                    // Step 5: Update the existing listing
                    const updatedListing = await this.hubspotClient.updateListing(existingListing.id, listingData);
                    
                    console.log('✅ Listing updated successfully!');
                    console.log(`   HubSpot Listing ID: ${updatedListing.id}`);
                    
                    // Step 6: Process contacts for this updated listing
                    await this.processContactsForListing(unit, activeLeases, allLeases, updatedListing);
                    
                    return { 
                        status: 'updated', 
                        reason: 'force_update',
                        hubspotListing: updatedListing
                    };
                } else {
                    console.log(`⚠️ Listing already exists for unit ${unit.Id}: ${existingListing.id} (use --force to update)`);
                    return { 
                        status: 'skipped', 
                        reason: 'already_exists',
                        hubspotListing: existingListing
                    };
                }
            }

            // Step 2: Get property details
            const property = await this.buildiumClient.getProperty(unit.PropertyId);
            
            // Step 3: Get lease information
            const activeLease = await this.buildiumClient.getActiveLeaseForUnit(unit.Id);
            const allLeases = await this.buildiumClient.getAllLeasesForUnit(unit.Id);
            
            // Step 4: Build the Buildium Unit URL
            const buildiumUnitUrl = `https://ripple.managebuilding.com/manager/app/properties/${unit.PropertyId}/units/${unit.Id}/summary`;
            
            // Step 5: Transform unit data to listing format
            const listingData = this.transformUnitToListing(unit, property, activeLease, allLeases, buildiumUnitUrl);
            
            // Step 6: Create listing in HubSpot
            const hubspotListing = await this.hubspotClient.createListing(listingData);
            console.log(`✅ Created listing: ${hubspotListing.id}`);
            
            // Step 7: Handle tenant associations for both active and inactive tenants
            const { currentTenantAssociations, previousTenantAssociations } = await this.processContactsForListing(unit, [activeLease], allLeases, hubspotListing);

            console.log(`🎉 Unit sync completed successfully!`);
            console.log(`   HubSpot Listing ID: ${hubspotListing.id}`);
            console.log(`   Buildium Unit URL: ${buildiumUnitUrl}`);

            return {
                status: 'success',
                hubspotListing,
                buildiumUnitUrl,
                currentTenantAssociations,
                previousTenantAssociations,
                activeLease,
                allLeases
            };

        } catch (error) {
            console.error('💥 Unit sync failed:', error.message);
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Transform unit data to HubSpot listing format
     */
    transformUnitToListing(unit, property, activeLease, allLeases, buildiumUnitUrl) {
        // Get current and previous tenant contact IDs based on lease status
        let currentTenantContactIds = [];
        let previousTenantContactIds = [];
        
        // Process all leases and categorize tenants by lease status
        for (const lease of allLeases) {
            if (lease.Tenants && lease.Tenants.length > 0) {
                if (lease.LeaseStatus === 'Active') {
                    // Add to current tenants
                    currentTenantContactIds.push(...lease.Tenants.map(t => t.Id));
                } else if (lease.LeaseStatus === 'Past' || lease.LeaseStatus === 'Expired') {
                    // Add to previous tenants
                    previousTenantContactIds.push(...lease.Tenants.map(t => t.Id));
                }
            }
        }

        // Remove duplicates
        currentTenantContactIds = [...new Set(currentTenantContactIds)];
        previousTenantContactIds = [...new Set(previousTenantContactIds)];

        const listingData = {
            properties: {
                // Basic listing info
                hs_name: `${property.Name} - Unit ${unit.UnitNumber || unit.Id}`,
                hs_price: unit.MarketRent || 0,
                
                // Address information
                hs_address_1: property.Address?.AddressLine1 || '',
                hs_address_2: property.Address?.AddressLine2 || '',
                hs_city: property.Address?.City || '',
                hs_state_province: property.Address?.State || '',
                
                // Handle postal codes properly - HubSpot hs_zip expects numbers only, so put postal codes in address_2 for Canadian addresses
                ...(property.Address?.PostalCode && /^\d{5}(-\d{4})?$/.test(property.Address.PostalCode) ? 
                    { hs_zip: property.Address.PostalCode } :  // US ZIP codes only
                    { hs_address_2: `${property.Address?.AddressLine2 || ''} ${property.Address?.PostalCode || ''}`.trim() }), // Canadian postal codes go in address_2
                
                // Buildium identifiers (keep as strings to avoid HubSpot comma formatting)
                buildium_unit_id: String(unit.Id),
                buildium_property_id: String(unit.PropertyId),
                buildium_unit_url: buildiumUnitUrl,
                
                // Unit-specific details
                buildium_unit_number: unit.UnitNumber || '',
                buildium_unit_type: unit.UnitType || '',
                buildium_is_occupied: unit.IsOccupied ? 'Yes' : 'No',
                
                // HubSpot identifiers (to be populated when we create/find corresponding records)
                hubspot_property_id: '', // Will be populated if we create property records
                hubspot_unit_id: '',     // Will be populated if we create unit records
                
                // Tenant tracking based on lease status (convert IDs to strings)
                current_tenant_contact_id: currentTenantContactIds.map(id => String(id)).join(','),
                previous_tenant_contact_ids: previousTenantContactIds.map(id => String(id)).join(','),
                
                // Unit details
                hs_bedrooms: unit.BedCount || 0,
                hs_bathrooms: unit.BathCount || 0,
                hs_square_footage: unit.SquareFeet || 0,
                
                // Additional unit information
                buildium_floor_number: unit.FloorNumber || '',
                buildium_description: unit.Description || '',
                
                // Property details
                hs_listing_type: 'apartments',
                hs_year_built: property.YearBuilt || '',
                hs_property_type: property.PropertyType || '',
                
                // Financial information
                buildium_market_rent: unit.MarketRent || 0,
                buildium_property_reserve_account: property.ReserveAccount || '',
                
                // Status and metadata
                buildium_unit_status: unit.IsOccupied ? 'Occupied' : 'Vacant',
                buildium_created_date: unit.CreatedDateTime ? new Date(unit.CreatedDateTime).toISOString() : '',
                    buildium_last_modified: unit.LastModifiedDateTime ? new Date(unit.LastModifiedDateTime).toISOString() : '',
                    buildium_lease_last_updated: unit.LastUpdatedDateTime ? new Date(unit.LastUpdatedDateTime).toISOString() : ''
            }
        };

        // Remove empty/null properties (same cleanup as existing code)
        Object.keys(listingData.properties).forEach(key => {
            if (listingData.properties[key] === null || 
                listingData.properties[key] === undefined || 
                listingData.properties[key] === '') {
                delete listingData.properties[key];
            }
        });

        console.log('🔄 Transformed unit to listing format');
        console.log(`   Current tenants: ${currentTenantContactIds.length}`);
        console.log(`   Previous tenants: ${previousTenantContactIds.length}`);
        return listingData;
    }

    /**
     * Transform unit data to HubSpot listing format for SAFE UPDATES ONLY
     * Only includes fields that have actual data from Buildium to avoid overwriting existing HubSpot data
     */
    transformUnitToListingSafeUpdate(unit, property, activeLease, allLeases, buildiumUnitUrl) {
        console.log('🔄 Transforming unit data for SAFE UPDATE (non-empty fields only)...');
        
        // Get current and previous tenant contact IDs based on lease status
        let currentTenantContactIds = [];
        let previousTenantContactIds = [];
        
        // Process all leases and categorize tenants by lease status
        for (const lease of allLeases) {
            if (lease.Tenants && lease.Tenants.length > 0) {
                if (lease.LeaseStatus === 'Active') {
                    currentTenantContactIds.push(...lease.Tenants.map(t => t.Id));
                } else if (lease.LeaseStatus === 'Past' || lease.LeaseStatus === 'Expired') {
                    previousTenantContactIds.push(...lease.Tenants.map(t => t.Id));
                }
            }
        }

        // Remove duplicates
        currentTenantContactIds = [...new Set(currentTenantContactIds)];
        previousTenantContactIds = [...new Set(previousTenantContactIds)];

        const safeUpdateFields = {};

        // Only add fields that have actual data from Buildium
        
        // Basic listing info - only if we have data
        if (property.Name && unit.UnitNumber) {
            safeUpdateFields.hs_name = `${property.Name} - Unit ${unit.UnitNumber}`;
        } else if (property.Name && unit.Id) {
            safeUpdateFields.hs_name = `${property.Name} - Unit ${unit.Id}`;
        }
        
        if (unit.MarketRent && unit.MarketRent > 0) {
            safeUpdateFields.hs_price = unit.MarketRent;
        }
        
        // Address information - only if we have data
        if (property.Address?.AddressLine1) safeUpdateFields.hs_address_1 = property.Address.AddressLine1;
        if (property.Address?.AddressLine2) safeUpdateFields.hs_address_2 = property.Address.AddressLine2;
        if (property.Address?.City) safeUpdateFields.hs_city = property.Address.City;
        if (property.Address?.State) safeUpdateFields.hs_state_province = property.Address.State;
        
        // Handle postal codes properly - only if we have data
        if (property.Address?.PostalCode) {
            if (/^\d{5}(-\d{4})?$/.test(property.Address.PostalCode)) {
                safeUpdateFields.hs_zip = property.Address.PostalCode;  // US ZIP codes only
            } else {
                // Canadian postal codes - append to address_2 if it exists or create new
                const existingAddress2 = property.Address?.AddressLine2 || '';
                safeUpdateFields.hs_address_2 = `${existingAddress2} ${property.Address.PostalCode}`.trim();
            }
        }
        
        // Buildium identifiers - always include these for tracking
        safeUpdateFields.buildium_unit_id = String(unit.Id);
        safeUpdateFields.buildium_property_id = String(unit.PropertyId);
        safeUpdateFields.buildium_unit_url = buildiumUnitUrl;
        
        // Unit-specific details - only if we have data
        if (unit.UnitNumber) safeUpdateFields.buildium_unit_number = unit.UnitNumber;
        if (unit.UnitType) safeUpdateFields.buildium_unit_type = unit.UnitType;
        if (unit.IsOccupied !== undefined) safeUpdateFields.buildium_is_occupied = unit.IsOccupied ? 'Yes' : 'No';
        
        // Tenant tracking - always include for association management
        safeUpdateFields.current_tenant_contact_id = currentTenantContactIds.map(id => String(id)).join(',');
        safeUpdateFields.previous_tenant_contact_ids = previousTenantContactIds.map(id => String(id)).join(',');
        
        // Unit details - only if we have data
        if (unit.BedCount && unit.BedCount > 0) safeUpdateFields.hs_bedrooms = unit.BedCount;
        if (unit.BathCount && unit.BathCount > 0) safeUpdateFields.hs_bathrooms = unit.BathCount;
        if (unit.SquareFeet && unit.SquareFeet > 0) safeUpdateFields.hs_square_footage = unit.SquareFeet;
        
        // Additional unit information - only if we have data
        if (unit.FloorNumber) safeUpdateFields.buildium_floor_number = unit.FloorNumber;
        if (unit.Description) safeUpdateFields.buildium_description = unit.Description;
        
        // Property details - only if we have data
        if (property.YearBuilt) safeUpdateFields.hs_year_built = property.YearBuilt;
        if (property.PropertyType) safeUpdateFields.hs_property_type = property.PropertyType;
        
        // Financial information - only if we have data
        if (unit.MarketRent && unit.MarketRent > 0) safeUpdateFields.buildium_market_rent = unit.MarketRent;
        if (property.ReserveAccount) safeUpdateFields.buildium_property_reserve_account = property.ReserveAccount;
        
        // Status and metadata - only if we have data
        if (unit.IsOccupied !== undefined) safeUpdateFields.buildium_unit_status = unit.IsOccupied ? 'Occupied' : 'Vacant';
        if (unit.CreatedDateTime) safeUpdateFields.buildium_created_date = new Date(unit.CreatedDateTime).toISOString();
        if (unit.LastModifiedDateTime) safeUpdateFields.buildium_last_modified = new Date(unit.LastModifiedDateTime).toISOString();
        // Always set buildium_lease_last_updated if available
        if (unit.LastUpdatedDateTime) safeUpdateFields.buildium_lease_last_updated = new Date(unit.LastUpdatedDateTime).toISOString();

        const listingData = {
            properties: safeUpdateFields
        };

        console.log(`✅ Safe listing update transformation complete - ${Object.keys(safeUpdateFields).length} fields with data`);
        console.log(`   Current tenants: ${currentTenantContactIds.length}`);
        console.log(`   Previous tenants: ${previousTenantContactIds.length}`);
        return listingData;
    }

    /**
     * Process contacts and associations for a listing
     */
    async processContactsForListing(unit, activeLeases, allLeases, hubspotListing) {
        console.log(`🔄 Processing contacts for listing ${hubspotListing.id}...`);
        
        let currentTenantAssociations = [];
        let previousTenantAssociations = [];
        
        // Process all leases and create appropriate associations
        for (const lease of allLeases) {
            if (lease.Tenants && lease.Tenants.length > 0) {
                for (const tenantRef of lease.Tenants) {
                    try {
                        // Find or create contact for this tenant (will fetch full details)
                        const contact = await this.findOrCreateContactForTenant(tenantRef);
                        
                        if (contact) {
                            // Get the full tenant name for logging
                            const fullTenant = await this.buildiumClient.getTenant(tenantRef.Id);
                            const tenantName = `${fullTenant.FirstName} ${fullTenant.LastName}`;
                            
                            if (lease.LeaseStatus === 'Active') {
                                // Create Active Tenant association (type ID 2)
                                await this.hubspotClient.createContactListingAssociation(contact.id, hubspotListing.id, 2);
                                currentTenantAssociations.push(contact.id);
                                console.log(`✅ Associated ACTIVE tenant ${tenantName} (${contact.id}) with listing`);
                            } else if (lease.LeaseStatus === 'Past' || lease.LeaseStatus === 'Expired') {
                                // Create Inactive Tenant association (type ID 6)
                                await this.hubspotClient.createContactListingAssociation(contact.id, hubspotListing.id, 6);
                                previousTenantAssociations.push(contact.id);
                                console.log(`✅ Associated INACTIVE tenant ${tenantName} (${contact.id}) with listing`);
                            }
                        }
                    } catch (error) {
                        console.error(`❌ Failed to associate tenant ID ${tenantRef.Id}:`, error.message);
                    }
                }
            }
        }
        
        console.log(`   Active Tenant Associations: ${currentTenantAssociations.length}`);
        console.log(`   Previous Tenant Associations: ${previousTenantAssociations.length}`);
        
        return { currentTenantAssociations, previousTenantAssociations };
    }

    /**
     * Find existing contact or create new one for a tenant
     */
    async findOrCreateContactForTenant(tenantReference) {
        try {
            // First, get the full tenant details using the tenant ID
            // The tenantReference from lease data only has Id, Status, MoveInDate
            const fullTenant = await this.buildiumClient.getTenant(tenantReference.Id);
            
            console.log(`📋 Full tenant data: ${fullTenant.FirstName} ${fullTenant.LastName} (${fullTenant.Email || 'no email'})`);
            
            // Try to find existing contact by email
            if (fullTenant.Email) {
                const existingContact = await this.hubspotClient.searchContactByEmail(fullTenant.Email);
                if (existingContact) {
                    if (this.forceUpdate) {
                        console.log(`⚡ Found existing contact for ${fullTenant.FirstName} ${fullTenant.LastName}: ${existingContact.id} - FORCE UPDATING (safe mode)...`);
                        
                        const contactData = this.transformer.transformTenantToContactSafeUpdate(fullTenant);
                        const updatedContact = await this.hubspotClient.updateContact(existingContact.id, contactData);
                        
                        console.log(`✅ Updated contact: ${updatedContact.id}`);
                        return updatedContact;
                    } else {
                        console.log(`✅ Found existing contact for ${fullTenant.FirstName} ${fullTenant.LastName}: ${existingContact.id}`);
                        return existingContact;
                    }
                }
            }
            
            // If no existing contact found, create new one
            console.log(`📝 Creating new contact for ${fullTenant.FirstName} ${fullTenant.LastName}...`);
            
            const contactData = this.transformer.transformTenantToContact(fullTenant);
            const newContact = await this.hubspotClient.createContact(contactData);
            
            console.log(`✅ Created new contact: ${newContact.id}`);
            return newContact;
            
        } catch (error) {
            console.error(`❌ Failed to find/create contact for tenant ID ${tenantReference.Id}:`, error.message);
            return null;
        }
    }

    /**
     * Delete all listings in HubSpot
     */
    async deleteAllListings() {
        try {
            console.log('🗑️ Deleting All Listings in HubSpot...');
            console.log('=' .repeat(50));
            
            // Get all listings
            const listings = await this.hubspotClient.getAllListings();
            
            if (listings.length === 0) {
                console.log('ℹ️ No listings found to delete');
                return { deleted: 0 };
            }
            
            console.log(`📋 Found ${listings.length} listings to delete`);
            
            let deleted = 0;
            let errors = 0;
            
            for (const listing of listings) {
                try {
                    console.log(`🗑️ Deleting listing ${listing.id}...`);
                    await this.hubspotClient.deleteListing(listing.id);
                    deleted++;
                    console.log(`✅ Deleted listing ${listing.id}`);
                } catch (error) {
                    errors++;
                    console.log(`❌ Failed to delete listing ${listing.id}: ${error.message}`);
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log('\n🎉 Deletion Complete!');
            console.log(`   ✅ Deleted: ${deleted}`);
            console.log(`   ❌ Errors: ${errors}`);
            
            return { deleted, errors, total: listings.length };
            
        } catch (error) {
            console.error('💥 Failed to delete listings:', error.message);
            return { deleted: 0, errors: 1, total: 0 };
        }
    }

    /**
     * List available tenants for testing
     */
    async listTenants() {
        try {
            console.log('📋 Available Tenants:');
            console.log('=' .repeat(50));
            
            const tenants = await this.buildiumClient.getAllTenants();
            
            tenants.forEach((tenant, index) => {
                console.log(`${index + 1}. ${tenant.FirstName} ${tenant.LastName}`);
                console.log(`   ID: ${tenant.Id}`);
                console.log(`   Email: ${tenant.Email || 'No email'}`);
                console.log('');
            });

            return tenants;
        } catch (error) {
            console.error('❌ Failed to list tenants:', error.message);
            return [];
        }
    }

    /**
     * Debug configuration and connectivity
     */
    async debugConfiguration() {
        console.log('🔍 Environment Configuration:');
        console.log('=' .repeat(50));
        
        // Check environment variables
        const envVars = [
            'BUILDIUM_CLIENT_ID',
            'BUILDIUM_CLIENT_SECRET', 
            'BUILDIUM_BASE_URL',
            'HUBSPOT_ACCESS_TOKEN',
            'HUBSPOT_BASE_URL',
            'DRY_RUN'
        ];
        
        envVars.forEach(envVar => {
            const value = process.env[envVar];
            if (envVar.includes('SECRET') || envVar.includes('TOKEN')) {
                console.log(`   ${envVar}: ${value ? `[SET - ${value.length} chars]` : '[NOT SET]'}`);
            } else {
                console.log(`   ${envVar}: ${value || '[NOT SET]'}`);
            }
        });
        
        console.log('\n🔗 API Client Configuration:');
        console.log('   Buildium Base URL:', this.buildiumClient.baseURL);
        console.log('   HubSpot Base URL:', this.hubspotClient.baseURL);
        
        console.log('\n🧪 Testing Basic Connectivity:');
        try {
            // Test a simple HTTP request to each API base URL
            const axios = require('axios');
            
            console.log('   Testing Buildium API availability...');
            
            // Try different endpoints to see which ones work
            const testEndpoints = [
                '/rentals',  // Properties endpoint (might have different permissions)
                '/tenants',  // Our target endpoint
                '/leases/tenants', // Alternative tenant endpoint from docs
                '/users',    // User management endpoint
                '/administration/account'  // Account info endpoint
            ];
            
            for (const endpoint of testEndpoints) {
                try {
                    const buildiumTest = await axios.get(`${this.buildiumClient.baseURL}${endpoint}`, {
                        headers: {
                            'x-buildium-client-id': this.buildiumClient.clientId,
                            'x-buildium-client-secret': this.buildiumClient.clientSecret,
                            'Content-Type': 'application/json'
                        },
                        params: { limit: 1 },
                        timeout: 10000,
                        validateStatus: () => true // Accept any status code
                    });
                    
                    console.log(`   ✅ ${endpoint}: ${buildiumTest.status} ${buildiumTest.statusText}`);
                    if (buildiumTest.data && typeof buildiumTest.data === 'object') {
                        if (Array.isArray(buildiumTest.data)) {
                            console.log(`      Response: Array with ${buildiumTest.data.length} items`);
                            if (buildiumTest.data.length > 0 && endpoint.includes('tenant')) {
                                console.log(`      Sample tenant data keys: ${Object.keys(buildiumTest.data[0]).join(', ')}`);
                            }
                        } else if (buildiumTest.data.UserMessage) {
                            console.log(`      Error: ${buildiumTest.data.UserMessage}`);
                        } else {
                            console.log(`      Response: Object with keys: ${Object.keys(buildiumTest.data).join(', ')}`);
                        }
                    }
                } catch (error) {
                    console.log(`   ❌ ${endpoint}: ${error.message}`);
                }
            }
            
        } catch (error) {
            console.log(`   ❌ General connectivity error: ${error.message}`);
        }
        
        // Additional credential validation tips
        console.log('\n💡 Troubleshooting Tips:');
        console.log('   1. Verify your Buildium API is enabled in Settings > API Settings');
        console.log('   2. Check that your API key has "Read" permissions for Tenants');
        console.log('   3. Ensure you\'re using the production API keys (not sandbox)');
        console.log('   4. Try logging into Buildium web app with the same account');
        console.log('   5. Contact Buildium support if the credentials are definitely correct');
    }

    /**
     * Validate configuration
     */
    validateConfig() {
        const requiredEnvVars = [
            'BUILDIUM_CLIENT_ID',
            'BUILDIUM_CLIENT_SECRET',
            'HUBSPOT_ACCESS_TOKEN'
        ];

        const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
        
        if (missing.length > 0) {
            console.error('❌ Missing required environment variables:');
            missing.forEach(envVar => console.error(`   - ${envVar}`));
            console.error('\nPlease copy .env.example to .env and fill in your API credentials.');
            return false;
        }

        console.log('✅ Configuration validated');
        return true;
    }

    /**
     * Handle owners command with various options
     */
    async handleOwnersCommand(options = {}) {
        try {
            console.log('👥 Property Owners Sync Command');
            console.log('=' .repeat(50));
            
            const {
                syncAll = false,
                propertyIds = null,
                status = null,
                ownerType = 'both',
                dryRun = false,
                verify = false,
                createMissing = false,
                limit = null,
                force = false
            } = options;

            // Validate options
            if (!syncAll && !propertyIds && !verify) {
                console.error('❌ Please specify --sync-all, --property-ids, or --verify');
                return;
            }

            // Verification mode
            if (verify) {
                return await this.verifyOwnersData();
            }

            // Sync mode
            const syncOptions = {
                propertyIds,
                status,
                ownerType,
                dryRun,
                createMissing,
                limit,
                force
            };

            if (dryRun) {
                console.log('🔍 DRY RUN MODE - No changes will be made');
            }
            
            if (force) {
                console.log('💪 FORCE MODE - Will update existing owners');
            }

            console.log(`📊 Sync Configuration:`);
            console.log(`   Owner Type: ${ownerType}`);
            console.log(`   Status Filter: ${status || 'all'}`);
            console.log(`   Property IDs: ${propertyIds ? propertyIds.join(', ') : 'all'}`);
            console.log(`   Limit: ${limit || 'no limit'}`);
            console.log(`   Mode: ${dryRun ? 'dry-run' : (createMissing ? 'create-missing' : (force ? 'force-update' : 'create-only'))}`);
            console.log('');

            // Create required custom properties for companies
            await this.hubspotClient.createCompanyCustomProperties();

            const results = await this.syncOwners(syncOptions);

            // Print summary
            console.log('\n📈 Sync Summary');
            console.log('=' .repeat(30));
            console.log(`✅ Successfully synced: ${results.success}`);
            console.log(`🔄 Enriched existing: ${results.enriched}`);
            console.log(`⚠️ Skipped: ${results.skipped}`);
            console.log(`❌ Errors: ${results.errors}`);
            console.log(`📊 Total processed: ${results.total}`);

            if (results.errors > 0) {
                console.log('\n❌ Error Details:');
                results.errorDetails.forEach(error => {
                    console.log(`   - Owner ${error.ownerId}: ${error.message}`);
                });
            }

            return results;

        } catch (error) {
            console.error('❌ Owners command failed:', error.message);
            throw error;
        }
    }

    /**
     * Sync owners from Buildium to HubSpot
     */
    async syncOwners(options = {}) {
        const {
            propertyIds = null,
            status = null,
            ownerType = 'both',
            dryRun = false,
            createMissing = false,
            limit = null,
            force = false
        } = options;

        const results = {
            target: limit,
            success: 0,
            skipped: 0,
            enriched: 0,
            errors: 0,
            total: 0,
            errorDetails: []
        };

        try {
            if (limit) {
                console.log(`🎯 Target: ${limit} successful syncs (skips don't count)`);
                return await this._syncOwnersWithLimit(options, results);
            } else {
                // Original behavior: fetch all and process
                return await this._syncAllOwners(options, results);
            }
        } catch (error) {
            console.error('❌ Error in owners sync:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Sync all owners (original behavior when no limit specified)
     */
    async _syncAllOwners(options, results) {
        const {
            propertyIds = null,
            status = null,
            ownerType = 'both',
            dryRun = false,
            createMissing = false,
            force = false
        } = options;

        // Fetch owners from Buildium
        console.log('🔍 Fetching owners from Buildium...');
        const owners = await this.buildiumClient.getAllOwners({
            propertyIds,
            status,
            ownerType
        });

        results.total = owners.length;
        console.log(`📊 Found ${owners.length} owners to process`);

        if (owners.length === 0) {
            console.log('ℹ️ No owners found matching criteria');
            return results;
        }

        // Process each owner
        for (let i = 0; i < owners.length; i++) {
            const owner = owners[i];
            const progress = `[${i + 1}/${owners.length}]`;
            
            try {
                console.log(`\n${progress} Processing: ${this.getOwnerDisplayName(owner)} (ID: ${owner.Id}, Type: ${owner._ownerType})`);
                console.log('-'.repeat(60));

                if (dryRun) {
                    console.log('🔍 DRY RUN: Would sync this owner');
                    results.success++;
                    continue;
                }

                const syncResult = await this.syncOwnerToHubSpot(owner, { createMissing, force });
                
                if (syncResult.status === 'success') {
                    results.success++;
                    console.log(`✅ Success: ${syncResult.recordType} ${syncResult.recordId}`);
                } else if (syncResult.status === 'skipped') {
                    results.skipped++;
                    console.log(`⚠️ Skipped: ${syncResult.reason}`);
                } else if (syncResult.status === 'enriched') {
                    results.enriched++;
                    console.log(`🔄 Enriched: ${syncResult.recordType} ${syncResult.recordId}`);
                } else {
                    results.errors++;
                    console.log(`❌ Error: ${syncResult.error}`);
                    results.errorDetails.push({
                        ownerId: owner.Id,
                        message: syncResult.error
                    });
                }

                // Rate limiting delay
                if (i < owners.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

            } catch (error) {
                results.errors++;
                console.log(`❌ Error processing owner ${owner.Id}: ${error.message}`);
                results.errorDetails.push({
                    ownerId: owner.Id,
                    message: error.message
                });
            }
        }

        return results;
    }

    /**
     * Sync owners with limit (like units/tenants - successful syncs only)
     */
    async _syncOwnersWithLimit(options, results) {
        const {
            propertyIds = null,
            status = null,
            ownerType = 'both',
            dryRun = false,
            createMissing = false,
            force = false,
            limit = null
        } = options;

        let offset = 0;
        let totalProcessed = 0;
        const batchSize = Math.max(limit * 2, 20); // Fetch more than needed to account for skips

        // Keep processing until we hit our success target or run out of owners
        while ((results.success + results.enriched) < limit) {
            // Step 1: Fetch a batch of owners from Buildium
            console.log(`📋 Fetching batch of owners (offset: ${offset})...`);
            const owners = await this.buildiumClient.getAllOwners({
                propertyIds,
                status,
                ownerType,
                limit: batchSize,
                offset
            });
            
            if (owners.length === 0) {
                console.log('ℹ️ No more owners available');
                break;
            }
            
            console.log(`   Found ${owners.length} owners in this batch`);

            // Step 2: Process each owner until we hit our success target
            for (let i = 0; i < owners.length && (results.success + results.enriched) < limit; i++) {
                const owner = owners[i];
                totalProcessed++;
                const successCount = results.success + results.enriched + 1; // What this would be if successful
                
                console.log(`\n[${successCount}/${limit}] Processing: ${this.getOwnerDisplayName(owner)} (ID: ${owner.Id}, Type: ${owner._ownerType})`);
                console.log('-'.repeat(60));
                
                try {
                    if (dryRun) {
                        console.log('🔍 DRY RUN: Would sync this owner');
                        results.success++;
                        continue;
                    }

                    const syncResult = await this.syncOwnerToHubSpot(owner, { createMissing, force });
                    
                    if (syncResult.status === 'success') {
                        results.success++;
                        console.log(`✅ [${results.success + results.enriched}/${limit}] Success: ${syncResult.recordType} ${syncResult.recordId}`);
                    } else if (syncResult.status === 'enriched') {
                        results.enriched++;
                        console.log(`🔄 [${results.success + results.enriched}/${limit}] Enriched: ${syncResult.recordType} ${syncResult.recordId}`);
                    } else if (syncResult.status === 'skipped') {
                        results.skipped++;
                        console.log(`⚠️ Skipped (${syncResult.reason}) - continuing to next owner...`);
                    } else {
                        results.errors++;
                        console.log(`❌ Error: ${syncResult.error}`);
                        results.errorDetails.push({
                            ownerId: owner.Id,
                            message: syncResult.error
                        });
                    }
                    
                    // Small delay to avoid rate limiting
                    if ((results.success + results.enriched) < limit) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                    
                } catch (error) {
                    results.errors++;
                    console.log(`❌ Error: ${error.message}`);
                    results.errorDetails.push({
                        ownerId: owner.Id,
                        message: error.message
                    });
                }
            }

            // Move to next batch
            offset += owners.length;

            // Safety check to prevent infinite loops
            if (offset > 1000) {
                console.log('⚠️ Reached safety limit (1000 owners processed)');
                break;
            }
        }

        results.total = totalProcessed;
        console.log(`\n📊 Processed ${totalProcessed} total owners to achieve ${results.success + results.enriched} successes`);
        
        return results;
    }

    /**
     * Sync a single owner to HubSpot
     */
    async syncOwnerToHubSpot(owner, options = {}) {
        try {
            // Handle both old (boolean) and new (object) parameter formats
            let createMissingOnly, force;
            if (typeof options === 'boolean') {
                createMissingOnly = options;
                force = false;
            } else {
                createMissingOnly = options.createMissing || false;
                force = options.force || false;
            }
            
            const isCompany = owner._isCompany || owner.IsCompany || false;
            
            if (isCompany) {
                // Handle company owner
                const companyData = this.transformer.transformOwnerToCompany(owner);
                
                // Check if company already exists
                const existingCompany = await this.hubspotClient.findCompanyByBuildiumId(owner.Id);
                
                if (existingCompany) {
                    if (createMissingOnly && !force) {
                        return {
                            status: 'skipped',
                            reason: 'Company already exists (use --force to update)'
                        };
                    } else if (force) {
                        // Enrichment mode: update existing company
                        console.log(`🔄 Enriching existing company: ${existingCompany.properties.name || 'Unknown'}`);
                        const updatedCompany = await this.hubspotClient.updateCompany(existingCompany.id, companyData);
                        
                        // Create/update property associations with force sync capability
                        console.log('🔗 Creating/updating property associations for company...');
                        const associationTypeId = owner._ownerType === 'association' ? 8 : 4; // Association owners get different type
                        const associationResult = await this.hubspotClient.createOwnerPropertyAssociations(
                            updatedCompany.id, 
                            owner, 
                            'Company',
                            associationTypeId // Use 4 for rental owners, 8 for association owners
                        );
                        
                        return {
                            status: 'enriched',
                            recordType: 'Company',
                            recordId: updatedCompany.id,
                            hubspotCompany: updatedCompany,
                            associations: associationResult
                        };
                    }
                }
                
                // Create new company
                const hubspotCompany = await this.hubspotClient.createOrUpdateCompany(companyData, owner.Id);
                
                // Create property associations with force sync capability
                console.log('🔗 Creating property associations for company...');
                const associationTypeId = owner._ownerType === 'association' ? 13 : 4; // Association owners get different type
                const associationResult = await this.hubspotClient.createOwnerPropertyAssociations(
                    hubspotCompany.id, 
                    owner, 
                    'Company',
                    associationTypeId // Use 4 for rental owners, 13 for association owners
                );

                return {
                    status: 'created',
                    recordType: 'Company',
                    recordId: hubspotCompany.id,
                    hubspotCompany: hubspotCompany,
                    associations: associationResult
                };
                
                return {
                    status: 'success',
                    recordType: 'Company',
                    recordId: hubspotCompany.id,
                    hubspotCompany,
                    associations: associationResult
                };
                
            } else {
                // Handle individual owner
                const contactData = this.transformer.transformOwnerToContact(owner);
                
                // Check if contact already exists
                const existingContact = await this.hubspotClient.findContactByEmail(owner.Email);
                
                if (existingContact) {
                    if (createMissingOnly && !force) {
                        return {
                            status: 'skipped',
                            reason: 'Contact already exists (use --force to update)'
                        };
                    } else if (force) {
                        // Enrichment mode: update existing contact
                        console.log(`🔄 Enriching existing contact: ${existingContact.properties.firstname} ${existingContact.properties.lastname}`);
                        const updatedContact = await this.hubspotClient.updateContact(existingContact.id, contactData);
                        
                        // Create/update property associations with force sync capability
                        console.log('🔗 Creating/updating property associations for contact...');
                        const associationTypeId = owner._ownerType === 'association' ? 13 : 4; // Association owners get different type
                        const associationResult = await this.hubspotClient.createOwnerPropertyAssociations(
                            updatedContact.id, 
                            owner, 
                            'Contact',
                            associationTypeId // Use 4 for rental owners, 13 for association owners
                        );
                        
                        return {
                            status: 'enriched',
                            recordType: 'Contact',
                            recordId: updatedContact.id,
                            hubspotContact: updatedContact,
                            associations: associationResult
                        };
                    }
                }
                
                // Create new contact
                const hubspotContact = await this.hubspotClient.createOrUpdateContact(contactData, owner.Id);
                
                // Create property associations with force sync capability
                console.log('🔗 Creating property associations for contact...');
                const associationTypeId = owner._ownerType === 'association' ? 13 : 4; // Association owners get different type
                const associationResult = await this.hubspotClient.createOwnerPropertyAssociations(
                    hubspotContact.id, 
                    owner, 
                    'Contact',
                    associationTypeId // Use 4 for rental owners, 13 for association owners
                );
                
                return {
                    status: 'success',
                    recordType: 'Contact',
                    recordId: hubspotContact.id,
                    hubspotContact,
                    associations: associationResult
                };
            }

        } catch (error) {
            console.error(`❌ Error syncing owner ${owner.Id}:`, error.message);
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Verify owners data integrity
     */
    async verifyOwnersData() {
        try {
            console.log('🔍 Verifying owners data integrity...');
            
            // Get sample of owners from Buildium
            const sampleOwners = await this.buildiumClient.getAllOwners({ 
                ownerType: 'both' 
            });
            
            console.log(`📊 Found ${sampleOwners.length} total owners in Buildium`);
            
            const verificationResults = {
                buildiumOwners: sampleOwners.length,
                hubspotContacts: 0,
                hubspotCompanies: 0,
                missingInHubSpot: 0,
                dataIntegrityIssues: []
            };
            
            // Sample verification logic here
            // This would check for missing records, data inconsistencies, etc.
            
            console.log('\n📈 Verification Results');
            console.log('=' .repeat(30));
            console.log(`Buildium Owners: ${verificationResults.buildiumOwners}`);
            console.log(`HubSpot Contacts: ${verificationResults.hubspotContacts}`);
            console.log(`HubSpot Companies: ${verificationResults.hubspotCompanies}`);
            console.log(`Missing in HubSpot: ${verificationResults.missingInHubSpot}`);
            
            return verificationResults;
            
        } catch (error) {
            console.error('❌ Verification failed:', error.message);
            throw error;
        }
    }

    /**
     * Get display name for owner
     */
    getOwnerDisplayName(owner) {
        if (owner._isCompany || owner.IsCompany) {
            return owner.CompanyName || `Company ${owner.Id}`;
        } else {
            return `${owner.FirstName || ''} ${owner.LastName || ''}`.trim() || `Owner ${owner.Id}`;
        }
    }
}

// Main execution
async function main() {
    console.log('🏠➡️📞 Buildium to HubSpot Integration Prototype');
    console.log('=' .repeat(60));
    console.log('✨ Enhanced with exponential backoff for rate limiting');
    console.log('⚡ Buildium API: 10 req/sec | Retry: 200ms→400ms→800ms');
    console.log('=' .repeat(60));

    const integration = new IntegrationPrototype();

    // Validate configuration
    if (!integration.validateConfig()) {
        process.exit(1);
    }

    // Check command line arguments
    const args = process.argv.slice(2);
    const command = args[0];
    const tenantId = args[1];

    try {
        switch (command) {
            case 'debug':
                await integration.debugConfiguration();
                break;
                
            case 'test':
                await integration.buildiumClient.testConnectivity();
                break;
                
            case 'list':
                await integration.listTenants();
                break;

            case 'delete-listings':
                await integration.deleteAllListings();
                break;

            case 'units':
            case 'sync-units':
                // Parse optional --limit flag
                let unitsLimit = null; // Default to unlimited for comprehensive sync
                
                const unitsLimitIndex = args.indexOf('--limit');
                if (unitsLimitIndex !== -1 && args[unitsLimitIndex + 1]) {
                    unitsLimit = parseInt(args[unitsLimitIndex + 1]);
                    if (isNaN(unitsLimit) || unitsLimit < 1) {
                        console.error('❌ Invalid limit value. Must be a positive number.');
                        process.exit(1);
                    }
                }
                
                // Parse optional --property-ids flag
                let unitsPropertyIds = null;
                const unitsPropertyIdsIndex = args.indexOf('--property-ids');
                if (unitsPropertyIdsIndex !== -1 && args[unitsPropertyIdsIndex + 1]) {
                    const propertyIdsStr = args[unitsPropertyIdsIndex + 1];
                    unitsPropertyIds = propertyIdsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                    
                    if (unitsPropertyIds.length === 0) {
                        console.error('❌ Invalid property IDs. Please provide comma-separated numbers.');
                        process.exit(1);
                    }
                }
                
                // Check for --force flag
                const unitsForceUpdate = args.includes('--force');
                if (unitsForceUpdate) {
                    integration.forceUpdate = true;
                    console.log('⚡ FORCE MODE: Will update existing listings and contacts (safe mode - only non-empty fields)');
                }

                await integration.syncUnitsToListings({ 
                    limit: unitsLimit, 
                    propertyIds: unitsPropertyIds 
                });
                break;

            case 'leases':
                // Parse lease sync options
                const dryRun = args.includes('--dry-run') || process.env.DRY_RUN === 'true';
                const force = args.includes('--force');
                let leasesLimit = null;
                let leaseUnitId = null;

                const leasesLimitIndex = args.indexOf('--limit');
                if (leasesLimitIndex !== -1 && args[leasesLimitIndex + 1]) {
                    leasesLimit = parseInt(args[leasesLimitIndex + 1]);
                    if (isNaN(leasesLimit) || leasesLimit < 1) {
                        console.error('❌ Invalid limit value. Must be a positive number.');
                        process.exit(1);
                    }
                }

                const unitIdIndex = args.indexOf('--unit-id');
                if (unitIdIndex !== -1 && args[unitIdIndex + 1]) {
                    leaseUnitId = args[unitIdIndex + 1];
                }

                if (force) {
                    integration.forceUpdate = true;
                    console.log('⚡ FORCE MODE - Will update existing listings with new lease data');
                }

                console.log(`🔢 LIMIT MODE - Process until ${leasesLimit || 'unlimited'} successful operations`);
                console.log('🚀 STARTING LEASE-CENTRIC SYNC');
                console.log('==================================================');
                console.log(`📅 Sync mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
                
                // Import LeaseCentricSyncManager here
                const { LeaseCentricSyncManager } = require('./LeaseCentricSyncManager.js');
                const TenantLifecycleManager = require('./TenantLifecycleManager.js');
                const syncManager = new LeaseCentricSyncManager(integration);
                
                const result = await syncManager.syncLeases(dryRun, force, null, 500, leasesLimit, leaseUnitId); // null = ALL leases (no date filter)

                // Lifecycle management is now automatic - no separate flag needed
                console.log('\n🎉 LEASE-CENTRIC SYNC COMPLETE');
                console.log(`⏱️  Duration: ${result.duration}ms`);
                console.log(`📊 Stats: ${result.leasesChecked} leases → ${result.listingsCreated} created, ${result.listingsUpdated} updated, ${result.listingsSkipped} skipped`);
                
                if (dryRun) {
                    console.log('\n💡 This was a DRY RUN. Remove --dry-run to actually create/update listings.');
                }
                break;            case 'sync':
                if (!tenantId) {
                    console.error('❌ Please provide a tenant ID: npm start sync <tenant_id>');
                    process.exit(1);
                }
                await integration.syncTenantToContact(tenantId);
                break;

            case 'sync-unit':
                const unitId = args[1];
                if (!unitId) {
                    console.error('❌ Please provide a unit ID: npm start sync-unit <unit_id>');
                    process.exit(1);
                }
                
                // Check for --force flag
                const unitForceUpdate = args.includes('--force');
                if (unitForceUpdate) {
                    integration.forceUpdate = true;
                    console.log('⚡ FORCE MODE: Will update existing listing and contacts (safe mode - only non-empty fields)');
                }
                
                console.log(`🏠 Syncing Unit ${unitId} to HubSpot...`);
                console.log('=' .repeat(50));
                
                try {
                    // Get the unit details
                    const unit = await integration.buildiumClient.getUnit(unitId);
                    console.log(`📋 Unit: ${unit.UnitNumber || unit.Id} (Property: ${unit.PropertyId})`);
                    
                    // Ensure custom properties exist
                    await integration.hubspotClient.createListingCustomProperties();
                    
                    // Sync the unit
                    const result = await integration.syncUnitToListing(unit);
                    
                    if (result.status === 'success') {
                        console.log(`🎉 Successfully created listing: ${result.hubspotListing.id}`);
                    } else if (result.status === 'updated') {
                        console.log(`🎉 Successfully updated listing: ${result.hubspotListing.id}`);
                    } else if (result.status === 'skipped') {
                        console.log(`⚠️ Skipped: ${result.reason}`);
                    } else {
                        console.log(`❌ Error: ${result.error}`);
                    }
                } catch (error) {
                    console.error(`❌ Failed to sync unit ${unitId}:`, error.message);
                    process.exit(1);
                }
                break;

            case 'batch':
            case 'batch-sync':
                // Parse optional --limit flag
                let limit = 10;
                
                // Look for --limit flag
                const limitIndex = args.indexOf('--limit');
                if (limitIndex !== -1 && args[limitIndex + 1]) {
                    limit = parseInt(args[limitIndex + 1]);
                    if (isNaN(limit) || limit < 1) {
                        console.error('❌ Invalid limit value. Must be a positive number.');
                        process.exit(1);
                    }
                }
                
                await integration.batchSyncTenants({ limit });
                break;

            case 'sync-property':
                const propertyId = args[1];
                if (!propertyId) {
                    console.error('❌ Please provide a property ID: npm start sync-property <property_id>');
                    process.exit(1);
                }
                await integration.syncPropertyToListing(propertyId);
                break;

            case 'owners':
                // Parse owners command options
                const ownersOptions = {};
                
                // Check for --sync-all flag
                if (args.includes('--sync-all')) {
                    ownersOptions.syncAll = true;
                }
                
                // Check for --property-ids flag
                const propertyIdsIndex = args.indexOf('--property-ids');
                if (propertyIdsIndex !== -1 && args[propertyIdsIndex + 1]) {
                    ownersOptions.propertyIds = args[propertyIdsIndex + 1].split(',').map(id => parseInt(id.trim()));
                }
                
                // Check for --status flag
                const statusIndex = args.indexOf('--status');
                if (statusIndex !== -1 && args[statusIndex + 1]) {
                    ownersOptions.status = args[statusIndex + 1];
                }
                
                // Check for --type flag
                const typeIndex = args.indexOf('--type');
                if (typeIndex !== -1 && args[typeIndex + 1]) {
                    ownersOptions.ownerType = args[typeIndex + 1];
                }
                
                // Check for --dry-run flag
                if (args.includes('--dry-run')) {
                    ownersOptions.dryRun = true;
                }
                
                // Check for --verify flag
                if (args.includes('--verify')) {
                    ownersOptions.verify = true;
                }
                
                // Check for --create-missing flag
                if (args.includes('--create-missing')) {
                    ownersOptions.createMissing = true;
                }
                
                // Check for --force flag
                if (args.includes('--force')) {
                    ownersOptions.force = true;
                }
                
                // Check for --limit flag
                const ownersLimitIndex = args.indexOf('--limit');
                if (ownersLimitIndex !== -1 && args[ownersLimitIndex + 1]) {
                    ownersOptions.limit = parseInt(args[ownersLimitIndex + 1]);
                }
                
                await integration.handleOwnersCommand(ownersOptions);
                break;
                
            default:
                console.log('Usage:');
                console.log('  npm start debug                    - Debug configuration and connectivity');
                console.log('  npm start test                     - Test API connectivity');
                console.log('  npm start list                     - List available tenants');
                console.log('  npm start delete-listings          - Delete all listings in HubSpot');
                console.log('  npm start units [--limit N]        - Sync units to listings (NEW APPROACH)');
                console.log('  npm start leases [options]         - Smart lease-centric sync with lifecycle management');
                console.log('  npm start owners <options>         - Sync property owners to HubSpot');
                console.log('    Options: --sync-all, --property-ids <ids>, --status <status>,');
                console.log('             --type <rental|association|both>, --dry-run, --verify,');
                console.log('             --create-missing, --force, --limit <number>');
                console.log('  npm start sync <id>                - Sync specific tenant to HubSpot');
                console.log('  npm start sync-unit <id> [--force] - Sync specific unit to HubSpot listing');
                console.log('  npm start batch [--limit N]        - Batch sync multiple tenants');
                console.log('  npm start sync-property <id>       - Sync specific property to HubSpot Listings');
                console.log('');
                console.log('Unit Sync Options (RECOMMENDED):');
                console.log('  --limit N      Process N units (default: 10)');
                console.log('  --force        Update existing listings/contacts (safe mode)');
                console.log('');
                console.log('Lease Sync Options (SMART SYNC):');
                console.log('  --dry-run      Preview mode (no actual changes)');
                console.log('  --force        Update existing listings with new lease data');
                console.log('  --limit N      Stop after N successful operations');
                console.log('  Note: Lifecycle management (Future→Active→Inactive) is automatic');
                console.log('');
                console.log('Owners Sync Options:');
                console.log('  --sync-all           Sync all owners');
                console.log('  --property-ids N,M   Sync owners for specific properties (comma-separated)');
                console.log('  --status active      Filter by owner status (active/inactive)');
                console.log('  --type rental        Filter by owner type (rental/association/both)');
                console.log('  --dry-run           Show what would be synced without making changes');
                console.log('  --verify            Verify existing owner data integrity');
                console.log('  --create-missing    Create missing HubSpot records only');
                console.log('');
                console.log('Batch Options (Legacy):');
                console.log('  --limit N      Process until N successful syncs (default: 10)');
                console.log('');
                console.log('Rate Limiting:');
                console.log('  • Automatic exponential backoff for 429 errors');
                console.log('  • Buildium: 10 concurrent requests/second limit');
                console.log('  • Retry delays: 200ms, 400ms, 800ms (3 attempts)');
                console.log('');
                console.log('Examples:');
                console.log('  npm start debug');
                console.log('  npm start delete-listings          # Clean slate');
                console.log('  npm start units --limit 5          # Sync 5 units to listings');
                console.log('  npm start owners --sync-all        # Sync all property owners');
                console.log('  npm start owners --property-ids 123,456 --type rental');
                console.log('  npm start owners --dry-run --status active');
                console.log('  npm start sync 12345');
                console.log('  npm start sync-unit 177172 --force # Sync specific unit with active lease');
                console.log('  npm start batch --limit 5          # Process until 5 successful syncs');
                console.log('  npm start sync-property 67890');
                break;
        }
    } catch (error) {
        console.error('💥 Application error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

/**
 * Marketing Status Audit Functions
 * These functions help track and review marketing contact status changes
 */

/**
 * Create a detailed audit log of all marketing status decisions
 * This log can be reviewed if you need to identify contacts that were set to NON_MARKETABLE
 */
function createMarketingStatusAuditLog() {
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFileName = `marketing_status_audit_${timestamp}.log`;
    
    const auditContent = `
MARKETING STATUS AUDIT LOG
==========================
Generated: ${new Date().toISOString()}
Purpose: Track all contacts set to NON_MARKETABLE status to prevent billing charges

SEARCH INSTRUCTIONS:
===================
To find specific contacts in HubSpot that were set to NON_MARKETABLE:

1. Go to HubSpot Contacts
2. Create a filter: "Marketing contact status" = "Non-marketing contact"
3. Add additional filters as needed (date created, source, etc.)

REVERTING TO MARKETING CONTACT:
==============================
If you need to make a contact marketable again:

1. In HubSpot, go to the contact record
2. Find the "Marketing contact status" property
3. Change from "Non-marketing contact" to "Marketing contact"
4. Save the contact

WARNING: This will start billing charges for that contact!

LOG ENTRIES FORMAT:
==================
Each log entry shows:
- Timestamp
- Contact type (Owner/Tenant)
- Buildium ID
- Email address
- Action taken

CONSOLE LOG SEARCH:
==================
You can also search the console output for:
"📊 MARKETING STATUS AUDIT:"

This will show you all contacts that were processed with NON_MARKETABLE status.

BACKUP VERIFICATION:
===================
All transformation functions in this integration include:
- transformOwnerToContact: Sets NON_MARKETABLE
- transformTenantToContact: Sets NON_MARKETABLE  
- transformTenantToContactSafeUpdate: Sets NON_MARKETABLE

If you need to modify this behavior, search for "hs_marketable_status" in the code.
`;

    fs.writeFileSync(logFileName, auditContent);
    console.log(`📋 Marketing Status Audit Log created: ${logFileName}`);
    return logFileName;
}

// Run the application
if (require.main === module) {
    main();
}

module.exports = { IntegrationPrototype, BuildiumClient, HubSpotClient, DataTransformer };

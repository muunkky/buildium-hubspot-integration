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
    async getAllUnits(limit = 50, offset = 0) {
        try {
            console.log(`🔍 Fetching ${limit} units from Buildium (offset: ${offset})...`);
            
            const response = await this.makeRequestWithRetry(() =>
                axios.get(`${this.baseURL}/rentals/units`, {
                    headers: {
                        'x-buildium-client-id': this.clientId,
                        'x-buildium-client-secret': this.clientSecret,
                        'Content-Type': 'application/json'
                    },
                    params: { limit, offset }
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
                lease.UnitId === unitId || lease.Unit?.Id === unitId
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
     * Get all leases from Buildium (helper method)
     * Using smaller default limit to prevent timeouts
     */
    async getAllLeases(limit = 100) {
        try {
            console.log(`🔍 Fetching up to ${limit} leases from Buildium...`);
            
            const response = await this.makeRequestWithRetry(() =>
                axios.get(`${this.baseURL}/leases`, {
                    headers: {
                        'x-buildium-client-id': this.clientId,
                        'x-buildium-client-secret': this.clientSecret,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        limit: limit
                    },
                    timeout: 30000 // 30 second timeout
                })
            );

            console.log(`✅ Retrieved ${response.data.length} leases`);
            return response.data;
        } catch (error) {
            console.error('❌ Error fetching all leases:', error.response?.data || error.message);
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
                console.log('🔄 DRY RUN MODE - Would create contact with data:', JSON.stringify(contactData, null, 2));
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
                console.log('🔄 DRY RUN MODE - Would create listing with data:', JSON.stringify(listingData, null, 2));
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
            
            const response = await axios.post(`${this.baseURL}/crm/v3/objects/0-420/search`, {
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
            });

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
     * Create association between contact and listing with specified association type
     */
    async createContactListingAssociation(contactId, listingId, associationTypeId = 2) {
        try {
            const typeName = associationTypeId === 2 ? 'Active Tenant' : associationTypeId === 6 ? 'Inactive Tenant' : `Type ${associationTypeId}`;
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
                lifecyclestage: 'customer' // Since they're already tenants
            }
        };

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
}

class IntegrationPrototype {
    constructor() {
        this.buildiumClient = new BuildiumClient();
        this.hubspotClient = new HubSpotClient();
        this.transformer = new DataTransformer();
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
            const { limit = 10 } = options;
            
            console.log('🏠 Starting Unit-to-Listing Sync...');
            console.log('=' .repeat(50));
            console.log(`   Target: ${limit} units to process`);
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
            const batchSize = Math.max(limit * 2, 20);

            // Keep processing until we hit our success target or run out of units
            while (results.success < limit) {
                // Step 1: Fetch a batch of units from Buildium
                console.log(`📋 Fetching batch of units (offset: ${offset})...`);
                const units = await this.buildiumClient.getAllUnits(batchSize, offset);
                
                if (units.length === 0) {
                    console.log('ℹ️ No more units available');
                    break;
                }
                
                console.log(`   Found ${units.length} units in this batch`);

                // Step 2: Process each unit
                for (let i = 0; i < units.length && results.success < limit; i++) {
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

            // Summary
            console.log('\n🎉 Unit Sync Complete!');
            console.log('=' .repeat(50));
            console.log(`   Target: ${limit} units`);
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
                buildium_last_modified: unit.LastModifiedDateTime ? new Date(unit.LastModifiedDateTime).toISOString() : ''
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
                let unitsLimit = 10;
                
                const unitsLimitIndex = args.indexOf('--limit');
                if (unitsLimitIndex !== -1 && args[unitsLimitIndex + 1]) {
                    unitsLimit = parseInt(args[unitsLimitIndex + 1]);
                    if (isNaN(unitsLimit) || unitsLimit < 1) {
                        console.error('❌ Invalid limit value. Must be a positive number.');
                        process.exit(1);
                    }
                }
                
                // Check for --force flag
                const unitsForceUpdate = args.includes('--force');
                if (unitsForceUpdate) {
                    integration.forceUpdate = true;
                    console.log('⚡ FORCE MODE: Will update existing listings and contacts (safe mode - only non-empty fields)');
                }
                
                await integration.syncUnitsToListings({ limit: unitsLimit });
                break;
                
            case 'sync':
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
                
            default:
                console.log('Usage:');
                console.log('  npm start debug                    - Debug configuration and connectivity');
                console.log('  npm start test                     - Test API connectivity');
                console.log('  npm start list                     - List available tenants');
                console.log('  npm start delete-listings          - Delete all listings in HubSpot');
                console.log('  npm start units [--limit N]        - Sync units to listings (NEW APPROACH)');
                console.log('  npm start sync <id>                - Sync specific tenant to HubSpot');
                console.log('  npm start sync-unit <id> [--force] - Sync specific unit to HubSpot listing');
                console.log('  npm start batch [--limit N]        - Batch sync multiple tenants');
                console.log('  npm start sync-property <id>       - Sync specific property to HubSpot Listings');
                console.log('');
                console.log('Unit Sync Options (RECOMMENDED):');
                console.log('  --limit N      Process N units (default: 10)');
                console.log('  --force        Update existing listings/contacts (safe mode)');
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

// Run the application
if (require.main === module) {
    main();
}

module.exports = { IntegrationPrototype, BuildiumClient, HubSpotClient, DataTransformer };

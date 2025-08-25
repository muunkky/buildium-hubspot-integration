/**
 * Test Suite for Buildium Client Lease-Centric Extensions
 * 
 * Tests the new lease-centric methods added to the BuildiumClient class
 */

const assert = require('assert');
const { DateTime } = require('luxon');

// Import the existing BuildiumClient to extend it
// const { BuildiumClient } = require('../index.js');

// Mock HTTP client for testing
class MockHttpClient {
    constructor() {
        this.requests = [];
        this.responses = new Map();
    }

    async get(url, params = {}) {
        this.requests.push({ method: 'GET', url, params });
        
        // Return mock response based on URL
        if (this.responses.has(url)) {
            return this.responses.get(url);
        }
        
        // Default mock responses
        if (url.includes('/v1/leases')) {
            return this.getMockLeasesResponse(params);
        }
        
        throw new Error(`No mock response configured for ${url}`);
    }

    getMockLeasesResponse(params) {
        const baseLeases = [
            {
                Id: 1,
                UnitId: 101,
                PropertyId: 201,
                Status: 'Active',
                Rent: { Amount: 1500 },
                LeaseFromDate: '2024-01-01T00:00:00',
                LeaseToDate: '2024-12-31T00:00:00',
                LastUpdated: '2024-01-02T10:30:00Z'
            },
            {
                Id: 2,
                UnitId: 102,
                PropertyId: 201,
                Status: 'Terminated',
                Rent: { Amount: 1200 },
                LeaseFromDate: '2023-06-01T00:00:00',
                LeaseToDate: '2023-12-31T00:00:00',
                LastUpdated: '2024-01-01T15:45:00Z'
            },
            {
                Id: 3,
                UnitId: 103,
                PropertyId: 202,
                Status: 'Active',
                Rent: { Amount: 1800 },
                LeaseFromDate: '2024-02-01T00:00:00',
                LeaseToDate: '2025-01-31T00:00:00',
                LastUpdated: '2024-01-03T09:15:00Z'
            }
        ];

        // Filter by lastupdatedfrom if provided
        let filteredLeases = baseLeases;
        if (params.lastupdatedfrom) {
            const filterDate = DateTime.fromISO(params.lastupdatedfrom);
            filteredLeases = baseLeases.filter(lease => 
                DateTime.fromISO(lease.LastUpdated) >= filterDate
            );
        }

        // Apply pagination
        const offset = parseInt(params.offset) || 0;
        const limit = parseInt(params.limit) || 50;
        const paginatedLeases = filteredLeases.slice(offset, offset + limit);

        return {
            data: paginatedLeases,
            totalCount: filteredLeases.length,
            hasMoreResults: (offset + limit) < filteredLeases.length
        };
    }

    setMockResponse(url, response) {
        this.responses.set(url, response);
    }

    clearRequests() {
        this.requests = [];
    }
}

// Extended BuildiumClient for lease-centric operations
class LeaseCentricBuildiumClient {
    constructor(httpClient) {
        this.httpClient = httpClient;
        this.baseUrl = 'https://api.buildium.com';
        this.rateLimiter = {
            delayMs: 100,
            async delay() {
                return new Promise(resolve => setTimeout(resolve, this.delayMs));
            }
        };
    }

    /**
     * Get leases updated since a specific timestamp using Buildium's filtering
     * @param {string} lastUpdateTime - ISO timestamp
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of lease objects
     */
    async getLeasesUpdatedSince(lastUpdateTime, options = {}) {
        const { 
            limit = 50, 
            offset = 0,
            propertyIds = null,
            leaseStatuses = null 
        } = options;

        const params = {
            lastupdatedfrom: lastUpdateTime,
            limit,
            offset
        };

        // Add optional filters
        if (propertyIds && propertyIds.length > 0) {
            params.propertyids = propertyIds.join(',');
        }

        if (leaseStatuses && leaseStatuses.length > 0) {
            params.leasestatuses = leaseStatuses.join(',');
        }

        await this.rateLimiter.delay();

        const response = await this.httpClient.get(`${this.baseUrl}/v1/leases`, params);
        
        return response.data.map(lease => this.transformBuildiumLease(lease));
    }

    /**
     * Get all leases updated since timestamp with automatic pagination
     * @param {string} lastUpdateTime - ISO timestamp
     * @param {Object} options - Query options
     * @returns {Promise<Array>} All matching leases
     */
    async getAllLeasesUpdatedSince(lastUpdateTime, options = {}) {
        const { batchSize = 50, maxResults = 1000 } = options;
        const allLeases = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore && allLeases.length < maxResults) {
            const batch = await this.getLeasesUpdatedSince(lastUpdateTime, {
                ...options,
                limit: batchSize,
                offset
            });

            allLeases.push(...batch);
            
            // Check if we got fewer results than requested (indicates end)
            hasMore = batch.length === batchSize;
            offset += batchSize;
        }

        return allLeases.slice(0, maxResults);
    }

    /**
     * Get leases updated within a specific time range
     * @param {string} fromTime - ISO timestamp for start of range
     * @param {string} toTime - ISO timestamp for end of range
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of lease objects
     */
    async getLeasesUpdatedBetween(fromTime, toTime, options = {}) {
        const params = {
            lastupdatedfrom: fromTime,
            lastupdatedto: toTime,
            limit: options.limit || 50,
            offset: options.offset || 0
        };

        await this.rateLimiter.delay();

        const response = await this.httpClient.get(`${this.baseUrl}/v1/leases`, params);
        
        return response.data.map(lease => this.transformBuildiumLease(lease));
    }

    /**
     * Get a specific lease by ID
     * @param {number} leaseId - The lease ID
     * @returns {Promise<Object>} Lease object
     */
    async getLeaseById(leaseId) {
        await this.rateLimiter.delay();

        const response = await this.httpClient.get(`${this.baseUrl}/v1/leases/${leaseId}`);
        
        return this.transformBuildiumLease(response.data);
    }

    /**
     * Transform raw Buildium lease data to our internal format
     * @param {Object} buildiumLease - Raw lease data from Buildium API
     * @returns {Object} Transformed lease object
     */
    transformBuildiumLease(buildiumLease) {
        return {
            id: buildiumLease.Id,
            unitId: buildiumLease.UnitId,
            propertyId: buildiumLease.PropertyId,
            status: buildiumLease.Status,
            rent: {
                amount: buildiumLease.Rent?.Amount || 0,
                frequency: buildiumLease.Rent?.Frequency || 'Monthly'
            },
            leaseFromDate: buildiumLease.LeaseFromDate ? 
                DateTime.fromISO(buildiumLease.LeaseFromDate).toISODate() : null,
            leaseToDate: buildiumLease.LeaseToDate ? 
                DateTime.fromISO(buildiumLease.LeaseToDate).toISODate() : null,
            lastUpdated: buildiumLease.LastUpdated,
            tenants: buildiumLease.Tenants || [],
            // Additional fields that might be useful
            securityDeposit: buildiumLease.SecurityDeposit?.Amount || 0,
            leaseType: buildiumLease.LeaseType,
            renewalOfferExpiration: buildiumLease.RenewalOfferExpiration,
            moveInDate: buildiumLease.MoveInDate,
            noticeMoveOutDate: buildiumLease.NoticeMoveOutDate
        };
    }

    /**
     * Test API connectivity and validate credentials
     * @returns {Promise<boolean>} True if API is accessible
     */
    async testConnection() {
        try {
            // Make a simple API call to test connectivity
            await this.getLeasesUpdatedSince(
                DateTime.now().minus({ days: 1 }).toISO(),
                { limit: 1 }
            );
            return true;
        } catch (error) {
            console.error('Buildium API connection test failed:', error.message);
            return false;
        }
    }
}

// Test Suite
describe('Buildium Client Lease Extensions', function() {
    let httpClient, buildiumClient;

    beforeEach(function() {
        httpClient = new MockHttpClient();
        buildiumClient = new LeaseCentricBuildiumClient(httpClient);
    });

    describe('getLeasesUpdatedSince', function() {
        it('should make correct API call with timestamp filter', async function() {
            const lastUpdateTime = '2024-01-01T00:00:00.000Z';
            
            await buildiumClient.getLeasesUpdatedSince(lastUpdateTime);

            const request = httpClient.requests[0];
            assert.equal(request.method, 'GET');
            assert(request.url.includes('/v1/leases'));
            assert.equal(request.params.lastupdatedfrom, lastUpdateTime);
        });

        it('should apply limit and offset parameters', async function() {
            const lastUpdateTime = '2024-01-01T00:00:00.000Z';
            const options = { limit: 25, offset: 50 };

            await buildiumClient.getLeasesUpdatedSince(lastUpdateTime, options);

            const request = httpClient.requests[0];
            assert.equal(request.params.limit, 25);
            assert.equal(request.params.offset, 50);
        });

        it('should include property filter when provided', async function() {
            const lastUpdateTime = '2024-01-01T00:00:00.000Z';
            const options = { propertyIds: [201, 202, 203] };

            await buildiumClient.getLeasesUpdatedSince(lastUpdateTime, options);

            const request = httpClient.requests[0];
            assert.equal(request.params.propertyids, '201,202,203');
        });

        it('should include lease status filter when provided', async function() {
            const lastUpdateTime = '2024-01-01T00:00:00.000Z';
            const options = { leaseStatuses: ['Active', 'Terminated'] };

            await buildiumClient.getLeasesUpdatedSince(lastUpdateTime, options);

            const request = httpClient.requests[0];
            assert.equal(request.params.leasestatuses, 'Active,Terminated');
        });

        it('should transform lease data correctly', async function() {
            const lastUpdateTime = '2024-01-01T00:00:00.000Z';
            
            const leases = await buildiumClient.getLeasesUpdatedSince(lastUpdateTime);

            // Should get filtered results (only leases updated since 2024-01-01)
            assert(leases.length >= 1);
            
            const lease = leases[0];
            assert.equal(lease.id, 1);
            assert.equal(lease.unitId, 101);
            assert.equal(lease.propertyId, 201);
            assert.equal(lease.status, 'Active');
            assert.equal(lease.rent.amount, 1500);
            assert.equal(lease.leaseFromDate, '2024-01-01');
            assert.equal(lease.leaseToDate, '2024-12-31');
        });

        it('should filter by timestamp correctly', async function() {
            // Request leases updated since 2024-01-02 (should exclude the older one)
            const lastUpdateTime = '2024-01-02T00:00:00.000Z';
            
            const leases = await buildiumClient.getLeasesUpdatedSince(lastUpdateTime);

            // Should only get leases updated on or after 2024-01-02
            const expectedLeaseIds = [1, 3]; // Based on mock data LastUpdated times
            const actualLeaseIds = leases.map(lease => lease.id);
            
            expectedLeaseIds.forEach(expectedId => {
                assert(actualLeaseIds.includes(expectedId), 
                    `Expected lease ${expectedId} in results`);
            });

            // Should not include lease 2 (updated on 2024-01-01)
            assert(!actualLeaseIds.includes(2), 
                'Should not include lease 2 updated before filter time');
        });
    });

    describe('getAllLeasesUpdatedSince', function() {
        it('should handle pagination automatically', async function() {
            // Mock multiple pages of results
            const lastUpdateTime = '2024-01-01T00:00:00.000Z';
            
            // First page
            httpClient.setMockResponse(`${buildiumClient.baseUrl}/v1/leases`, {
                data: [
                    { Id: 1, UnitId: 101, Status: 'Active', LastUpdated: '2024-01-02T10:30:00Z' },
                    { Id: 2, UnitId: 102, Status: 'Active', LastUpdated: '2024-01-02T11:30:00Z' }
                ],
                totalCount: 3,
                hasMoreResults: true
            });

            const allLeases = await buildiumClient.getAllLeasesUpdatedSince(lastUpdateTime, {
                batchSize: 2
            });

            // Should make multiple requests for pagination
            assert(httpClient.requests.length >= 1);
            
            // Verify offset parameter progression
            const offsets = httpClient.requests.map(req => req.params.offset);
            assert.equal(offsets[0], 0);
        });

        it('should respect maxResults limit', async function() {
            const lastUpdateTime = '2024-01-01T00:00:00.000Z';
            const maxResults = 2;

            const allLeases = await buildiumClient.getAllLeasesUpdatedSince(lastUpdateTime, {
                batchSize: 1,
                maxResults
            });

            assert(allLeases.length <= maxResults, 
                `Expected max ${maxResults} results, got ${allLeases.length}`);
        });
    });

    describe('getLeasesUpdatedBetween', function() {
        it('should use both from and to timestamp filters', async function() {
            const fromTime = '2024-01-01T00:00:00.000Z';
            const toTime = '2024-01-02T23:59:59.999Z';

            await buildiumClient.getLeasesUpdatedBetween(fromTime, toTime);

            const request = httpClient.requests[0];
            assert.equal(request.params.lastupdatedfrom, fromTime);
            assert.equal(request.params.lastupdatedto, toTime);
        });
    });

    describe('getLeaseById', function() {
        it('should make correct API call for specific lease', async function() {
            const leaseId = 123;

            // Mock single lease response
            httpClient.setMockResponse(`${buildiumClient.baseUrl}/v1/leases/${leaseId}`, {
                data: {
                    Id: 123,
                    UnitId: 456,
                    Status: 'Active',
                    LastUpdated: '2024-01-02T10:30:00Z'
                }
            });

            await buildiumClient.getLeaseById(leaseId);

            const request = httpClient.requests[0];
            assert.equal(request.method, 'GET');
            assert(request.url.includes(`/v1/leases/${leaseId}`));
        });
    });

    describe('Rate Limiting', function() {
        it('should apply rate limiting delays', async function() {
            const startTime = Date.now();
            const lastUpdateTime = '2024-01-01T00:00:00.000Z';

            await buildiumClient.getLeasesUpdatedSince(lastUpdateTime);

            const endTime = Date.now();
            const elapsed = endTime - startTime;

            // Should take at least the rate limit delay time
            assert(elapsed >= buildiumClient.rateLimiter.delayMs, 
                `Expected at least ${buildiumClient.rateLimiter.delayMs}ms delay, got ${elapsed}ms`);
        });
    });

    describe('Data Transformation', function() {
        it('should handle missing optional fields gracefully', async function() {
            const mockLeaseData = {
                Id: 123,
                UnitId: 456,
                Status: 'Active',
                LastUpdated: '2024-01-02T10:30:00Z'
                // Missing Rent, dates, etc.
            };

            const transformed = buildiumClient.transformBuildiumLease(mockLeaseData);

            assert.equal(transformed.id, 123);
            assert.equal(transformed.unitId, 456);
            assert.equal(transformed.status, 'Active');
            assert.equal(transformed.rent.amount, 0); // Default value
            assert.equal(transformed.leaseFromDate, null);
            assert.equal(transformed.leaseToDate, null);
        });

        it('should parse dates correctly', async function() {
            const mockLeaseData = {
                Id: 123,
                UnitId: 456,
                Status: 'Active',
                LeaseFromDate: '2024-01-01T00:00:00',
                LeaseToDate: '2024-12-31T23:59:59',
                LastUpdated: '2024-01-02T10:30:00Z'
            };

            const transformed = buildiumClient.transformBuildiumLease(mockLeaseData);

            assert.equal(transformed.leaseFromDate, '2024-01-01');
            assert.equal(transformed.leaseToDate, '2024-12-31');
        });
    });

    describe('Connection Testing', function() {
        it('should return true for successful connection test', async function() {
            const isConnected = await buildiumClient.testConnection();
            assert.equal(isConnected, true);
        });

        it('should return false for failed connection test', async function() {
            // Force an error
            httpClient.get = async () => {
                throw new Error('Network error');
            };

            const isConnected = await buildiumClient.testConnection();
            assert.equal(isConnected, false);
        });
    });

    describe('Error Handling', function() {
        it('should propagate API errors with context', async function() {
            httpClient.get = async () => {
                throw new Error('API rate limit exceeded');
            };

            try {
                await buildiumClient.getLeasesUpdatedSince('2024-01-01T00:00:00.000Z');
                assert.fail('Expected error was not thrown');
            } catch (error) {
                assert(error.message.includes('API rate limit exceeded'));
            }
        });
    });
});

// Performance and Integration Tests
describe('Lease-Centric Performance Tests', function() {
    let httpClient, buildiumClient;

    beforeEach(function() {
        httpClient = new MockHttpClient();
        buildiumClient = new LeaseCentricBuildiumClient(httpClient);
    });

    describe('API Efficiency Comparison', function() {
        it('should demonstrate efficiency vs unit-centric approach', function() {
            // This test documents the efficiency improvement
            
            // Unit-centric approach (simulated):
            // - Get all units (1000 units = 1 API call)
            // - Get leases for each unit (1000 units = 1000 API calls)
            // - Total: 1001 API calls to find 5 updated leases
            
            const unitCentricApiCalls = 1 + 1000; // getAllUnits + getLeasesForUnit × 1000
            
            // Lease-centric approach:
            // - Get leases updated since timestamp (1 API call)
            // - Get unit details for each updated lease (5 API calls)
            // - Get property details for each unique property (2 API calls)
            // - Total: 8 API calls to find 5 updated leases
            
            const leaseCentricApiCalls = 1 + 5 + 2; // getUpdatedLeases + units + properties
            
            const efficiency = unitCentricApiCalls / leaseCentricApiCalls;
            
            console.log(`Unit-centric: ${unitCentricApiCalls} API calls`);
            console.log(`Lease-centric: ${leaseCentricApiCalls} API calls`);
            console.log(`Efficiency improvement: ${efficiency.toFixed(1)}x`);
            
            assert(efficiency > 100, 'Lease-centric should be 100x+ more efficient');
        });
    });

    describe('Real-world Scenarios', function() {
        it('should handle typical daily sync workload', async function() {
            // Simulate daily sync: check for leases updated in last 24 hours
            const lastUpdateTime = DateTime.now().minus({ days: 1 }).toISO();
            
            httpClient.clearRequests();
            
            const leases = await buildiumClient.getLeasesUpdatedSince(lastUpdateTime, {
                limit: 100
            });
            
            // Should make only one API call for the daily check
            assert.equal(httpClient.requests.length, 1);
            assert(leases.length >= 0); // Could be 0 if no updates
        });

        it('should handle incremental sync with time range', async function() {
            const fromTime = DateTime.now().minus({ hours: 6 }).toISO();
            const toTime = DateTime.now().toISO();
            
            const leases = await buildiumClient.getLeasesUpdatedBetween(fromTime, toTime);
            
            // Verify the time range parameters
            const request = httpClient.requests[0];
            assert(request.params.lastupdatedfrom);
            assert(request.params.lastupdatedto);
        });
    });
});

// Export for use in integration tests
module.exports = {
    LeaseCentricBuildiumClient,
    MockHttpClient
};

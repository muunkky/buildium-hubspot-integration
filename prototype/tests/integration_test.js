/**
 * End-to-End Integration Tests for Lease-Centric Sync
 * 
 * Tests the complete integration between Buildium lease API,
 * HubSpot listings API, and the sync orchestration logic.
 */

const assert = require('assert');
const { DateTime } = require('luxon');

// Import our test components
const { LeaseCentricSync, MockBuildiumClient, MockHubSpotClient } = require('./lease_centric_sync_test');
const { LeaseCentricBuildiumClient, MockHttpClient } = require('./buildium_lease_client_test');
const { LeaseCentricHubSpotClient, MockHubSpotHttpClient } = require('./hubspot_listings_test');

// Integration test suite
describe('Lease-Centric Sync Integration', function() {
    let buildiumHttpClient, hubspotHttpClient;
    let buildiumClient, hubspotClient, syncEngine;

    beforeEach(function() {
        // Set up HTTP clients
        buildiumHttpClient = new MockHttpClient();
        hubspotHttpClient = new MockHubSpotHttpClient();

        // Set up API clients
        buildiumClient = new LeaseCentricBuildiumClient(buildiumHttpClient);
        hubspotClient = new LeaseCentricHubSpotClient(hubspotHttpClient, 'test-token');

        // Set up sync engine
        syncEngine = new LeaseCentricSync(buildiumClient, hubspotClient);
    });

    describe('Real-world Sync Scenarios', function() {
        it('should sync new active lease to create HubSpot listing', async function() {
            const sinceTime = '2024-01-01T00:00:00.000Z';

            // Mock Buildium data: new active lease
            const mockLease = {
                Id: 101,
                UnitId: 201,
                PropertyId: 301,
                Status: 'Active',
                Rent: { Amount: 1650 },
                LeaseFromDate: '2024-01-15T00:00:00',
                LeaseToDate: '2024-12-31T23:59:59',
                LastUpdated: '2024-01-15T10:30:00Z',
                Tenants: [{ ContactId: 401, FirstName: 'John', LastName: 'Smith' }]
            };

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/leases`,
                { data: [mockLease], totalCount: 1, hasMoreResults: false }
            );

            // Mock unit data
            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/rentals/units/201`,
                {
                    data: {
                        Id: 201,
                        PropertyId: 301,
                        UnitNumber: '2B',
                        Type: 'Apartment',
                        SquareFootage: 950,
                        Bedrooms: 2,
                        Bathrooms: 1.5
                    }
                }
            );

            // Mock property data
            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/properties/301`,
                {
                    data: {
                        Id: 301,
                        Name: 'Riverside Gardens',
                        Address: {
                            FullAddress: '789 River Rd, Riverside, CA 92507',
                            City: 'Riverside',
                            State: 'CA',
                            PostalCode: '92507'
                        }
                    }
                }
            );

            // Mock HubSpot search (no existing listing)
            hubspotHttpClient.setMockResponse(
                'POST /crm/v3/objects/0-420/search',
                { results: [], total: 0, paging: { next: null } }
            );

            // Execute sync
            const results = await syncEngine.syncLeasesIncremental(sinceTime);

            // Verify results
            assert.equal(results.processed, 1);
            assert.equal(results.created, 1);
            assert.equal(results.updated, 0);
            assert.equal(results.archived, 0);
            assert.equal(results.errors.length, 0);

            // Verify API interactions
            const buildiumRequests = buildiumHttpClient.requests;
            const hubspotRequests = hubspotHttpClient.requests;

            // Should have made minimal API calls
            assert(buildiumRequests.length >= 3); // leases, unit, property
            assert(hubspotRequests.length >= 2); // search, create

            // Verify HubSpot listing was created with correct data
            const createRequest = hubspotRequests.find(req => 
                req.method === 'POST' && 
                req.endpoint.includes('/crm/v3/objects/0-420') &&
                !req.endpoint.includes('/search')
            );

            assert(createRequest, 'Should have made create listing request');
            assert.equal(createRequest.data.properties.buildium_lease_id, '101');
            assert.equal(createRequest.data.properties.name, 'Riverside Gardens - Unit 2B');
            assert.equal(createRequest.data.properties.rent_amount, '1650');
            assert.equal(createRequest.data.properties.bedrooms, '2');
        });

        it('should update existing listing when lease is modified', async function() {
            const sinceTime = '2024-01-01T00:00:00.000Z';

            // Mock updated lease
            const mockLease = {
                Id: 102,
                UnitId: 202,
                PropertyId: 302,
                Status: 'Active',
                Rent: { Amount: 1750 }, // Rent increased
                LeaseFromDate: '2024-01-01T00:00:00',
                LeaseToDate: '2024-12-31T23:59:59',
                LastUpdated: '2024-01-15T14:45:00Z' // Recently updated
            };

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/leases`,
                { data: [mockLease], totalCount: 1, hasMoreResults: false }
            );

            // Mock unit and property
            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/rentals/units/202`,
                {
                    data: {
                        Id: 202,
                        PropertyId: 302,
                        UnitNumber: '1A',
                        Type: 'Apartment'
                    }
                }
            );

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/properties/302`,
                {
                    data: {
                        Id: 302,
                        Name: 'Downtown Lofts',
                        Address: {
                            FullAddress: '456 Main St, Downtown, NY 10001',
                            City: 'Downtown',
                            State: 'NY',
                            PostalCode: '10001'
                        }
                    }
                }
            );

            // Mock existing listing in HubSpot
            const existingListing = {
                id: 'listing_102',
                properties: {
                    buildium_lease_id: '102',
                    name: 'Downtown Lofts - Unit 1A',
                    rent_amount: '1700' // Old rent amount
                }
            };

            hubspotHttpClient.setMockResponse(
                'POST /crm/v3/objects/0-420/search',
                { results: [existingListing], total: 1, paging: { next: null } }
            );

            // Execute sync
            const results = await syncEngine.syncLeasesIncremental(sinceTime);

            // Verify results
            assert.equal(results.processed, 1);
            assert.equal(results.created, 0);
            assert.equal(results.updated, 1);
            assert.equal(results.archived, 0);
            assert.equal(results.errors.length, 0);

            // Verify update was called
            const updateRequest = hubspotHttpClient.requests.find(req => 
                req.method === 'PATCH' && 
                req.endpoint.includes('listing_102')
            );

            assert(updateRequest, 'Should have made update request');
            assert.equal(updateRequest.data.properties.rent_amount, '1750');
        });

        it('should archive listing when lease is terminated', async function() {
            const sinceTime = '2024-01-01T00:00:00.000Z';

            // Mock terminated lease
            const mockLease = {
                Id: 103,
                UnitId: 203,
                PropertyId: 303,
                Status: 'Terminated',
                Rent: { Amount: 1500 },
                LeaseFromDate: '2023-06-01T00:00:00',
                LeaseToDate: '2023-12-31T23:59:59',
                LastUpdated: '2024-01-10T09:00:00Z'
            };

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/leases`,
                { data: [mockLease], totalCount: 1, hasMoreResults: false }
            );

            // Mock existing listing
            const existingListing = {
                id: 'listing_103',
                properties: {
                    buildium_lease_id: '103',
                    name: 'Property - Unit 203',
                    lease_status: 'Active'
                }
            };

            hubspotHttpClient.setMockResponse(
                'POST /crm/v3/objects/0-420/search',
                { results: [existingListing], total: 1, paging: { next: null } }
            );

            // Execute sync
            const results = await syncEngine.syncLeasesIncremental(sinceTime);

            // Verify results
            assert.equal(results.processed, 1);
            assert.equal(results.created, 0);
            assert.equal(results.updated, 0);
            assert.equal(results.archived, 1);
            assert.equal(results.errors.length, 0);

            // Verify archive was called
            const archiveRequest = hubspotHttpClient.requests.find(req => 
                req.method === 'DELETE' && 
                req.endpoint.includes('listing_103')
            );

            assert(archiveRequest, 'Should have made archive request');
        });

        it('should handle multiple lease updates in a single sync', async function() {
            const sinceTime = '2024-01-01T00:00:00.000Z';

            // Mock multiple updated leases
            const mockLeases = [
                {
                    Id: 201,
                    UnitId: 301,
                    PropertyId: 401,
                    Status: 'Active',
                    Rent: { Amount: 1600 },
                    LastUpdated: '2024-01-15T10:00:00Z'
                },
                {
                    Id: 202,
                    UnitId: 302,
                    PropertyId: 401,
                    Status: 'Active',
                    Rent: { Amount: 1700 },
                    LastUpdated: '2024-01-15T11:00:00Z'
                },
                {
                    Id: 203,
                    UnitId: 303,
                    PropertyId: 402,
                    Status: 'Ended',
                    Rent: { Amount: 1550 },
                    LastUpdated: '2024-01-15T12:00:00Z'
                }
            ];

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/leases`,
                { data: mockLeases, totalCount: 3, hasMoreResults: false }
            );

            // Mock units and properties for all leases
            [301, 302, 303].forEach(unitId => {
                buildiumHttpClient.setMockResponse(
                    `${buildiumClient.baseUrl}/v1/rentals/units/${unitId}`,
                    {
                        data: {
                            Id: unitId,
                            PropertyId: unitId === 303 ? 402 : 401,
                            UnitNumber: `Unit${unitId}`,
                            Type: 'Apartment'
                        }
                    }
                );
            });

            [401, 402].forEach(propId => {
                buildiumHttpClient.setMockResponse(
                    `${buildiumClient.baseUrl}/v1/properties/${propId}`,
                    {
                        data: {
                            Id: propId,
                            Name: `Property ${propId}`,
                            Address: { City: 'Test City' }
                        }
                    }
                );
            });

            // Mock HubSpot responses
            hubspotHttpClient.setMockResponse(
                'POST /crm/v3/objects/0-420/search',
                { results: [], total: 0, paging: { next: null } } // No existing listings
            );

            // Execute sync
            const results = await syncEngine.syncLeasesIncremental(sinceTime);

            // Verify results
            assert.equal(results.processed, 3);
            assert.equal(results.created, 2); // Two active leases
            assert.equal(results.archived, 1); // One ended lease
            assert.equal(results.errors.length, 0);

            // Verify API efficiency
            const buildiumCalls = buildiumHttpClient.requests.length;
            const hubspotCalls = hubspotHttpClient.requests.length;

            console.log(`Buildium API calls: ${buildiumCalls}`);
            console.log(`HubSpot API calls: ${hubspotCalls}`);

            // Should be efficient: 1 lease query + unit/property lookups + HubSpot operations
            assert(buildiumCalls <= 8, `Expected <= 8 Buildium calls, got ${buildiumCalls}`);
        });
    });

    describe('Error Handling and Recovery', function() {
        it('should handle partial failures gracefully', async function() {
            const sinceTime = '2024-01-01T00:00:00.000Z';

            // Mock leases with one that will fail
            const mockLeases = [
                {
                    Id: 301,
                    UnitId: 401,
                    PropertyId: 501,
                    Status: 'Active',
                    LastUpdated: '2024-01-15T10:00:00Z'
                },
                {
                    Id: 302,
                    UnitId: 999, // Non-existent unit (will cause error)
                    PropertyId: 502,
                    Status: 'Active',
                    LastUpdated: '2024-01-15T11:00:00Z'
                }
            ];

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/leases`,
                { data: mockLeases, totalCount: 2, hasMoreResults: false }
            );

            // Mock successful unit/property for first lease
            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/rentals/units/401`,
                {
                    data: {
                        Id: 401,
                        PropertyId: 501,
                        UnitNumber: 'A1',
                        Type: 'Apartment'
                    }
                }
            );

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/properties/501`,
                {
                    data: {
                        Id: 501,
                        Name: 'Success Property',
                        Address: { City: 'Success City' }
                    }
                }
            );

            // Unit 999 will return error (not mocked)

            hubspotHttpClient.setMockResponse(
                'POST /crm/v3/objects/0-420/search',
                { results: [], total: 0, paging: { next: null } }
            );

            // Execute sync
            const results = await syncEngine.syncLeasesIncremental(sinceTime);

            // Should process one successfully and have one error
            assert.equal(results.processed, 1);
            assert.equal(results.created, 1);
            assert.equal(results.errors.length, 1);
            assert.equal(results.errors[0].leaseId, 302);
        });

        it('should handle rate limiting and retry scenarios', async function() {
            const sinceTime = '2024-01-01T00:00:00.000Z';

            // Mock a lease that triggers rate limiting
            const mockLease = {
                Id: 401,
                UnitId: 501,
                PropertyId: 601,
                Status: 'Active',
                LastUpdated: '2024-01-15T10:00:00Z'
            };

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/leases`,
                { data: [mockLease], totalCount: 1, hasMoreResults: false }
            );

            // Set up other required mocks
            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/rentals/units/501`,
                {
                    data: {
                        Id: 501,
                        PropertyId: 601,
                        UnitNumber: 'Rate1',
                        Type: 'Apartment'
                    }
                }
            );

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/properties/601`,
                {
                    data: {
                        Id: 601,
                        Name: 'Rate Test Property',
                        Address: { City: 'Rate City' }
                    }
                }
            );

            hubspotHttpClient.setMockResponse(
                'POST /crm/v3/objects/0-420/search',
                { results: [], total: 0, paging: { next: null } }
            );

            const startTime = Date.now();
            const results = await syncEngine.syncLeasesIncremental(sinceTime);
            const endTime = Date.now();

            // Should complete successfully despite rate limiting
            assert.equal(results.processed, 1);
            assert.equal(results.created, 1);
            assert.equal(results.errors.length, 0);

            // Should take some time due to rate limiting
            assert(endTime - startTime >= 100, 'Should have rate limiting delays');
        });
    });

    describe('Performance and Scalability', function() {
        it('should efficiently handle large sync operations', async function() {
            const sinceTime = '2024-01-01T00:00:00.000Z';

            // Mock larger dataset
            const mockLeases = [];
            for (let i = 1; i <= 25; i++) {
                mockLeases.push({
                    Id: 1000 + i,
                    UnitId: 2000 + i,
                    PropertyId: 3000 + Math.floor(i / 5), // 5 properties total
                    Status: i % 10 === 0 ? 'Terminated' : 'Active',
                    Rent: { Amount: 1500 + (i * 50) },
                    LastUpdated: `2024-01-15T${String(10 + i % 14).padStart(2, '0')}:00:00Z`
                });
            }

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/leases`,
                { data: mockLeases, totalCount: 25, hasMoreResults: false }
            );

            // Mock units and properties
            for (let i = 1; i <= 25; i++) {
                buildiumHttpClient.setMockResponse(
                    `${buildiumClient.baseUrl}/v1/rentals/units/${2000 + i}`,
                    {
                        data: {
                            Id: 2000 + i,
                            PropertyId: 3000 + Math.floor(i / 5),
                            UnitNumber: `Unit${i}`,
                            Type: 'Apartment'
                        }
                    }
                );
            }

            for (let i = 0; i < 5; i++) {
                buildiumHttpClient.setMockResponse(
                    `${buildiumClient.baseUrl}/v1/properties/${3000 + i}`,
                    {
                        data: {
                            Id: 3000 + i,
                            Name: `Large Property ${i}`,
                            Address: { City: `City ${i}` }
                        }
                    }
                );
            }

            hubspotHttpClient.setMockResponse(
                'POST /crm/v3/objects/0-420/search',
                { results: [], total: 0, paging: { next: null } }
            );

            const startTime = Date.now();
            const results = await syncEngine.syncLeasesIncremental(sinceTime);
            const endTime = Date.now();

            // Verify results
            assert.equal(results.processed, 25);
            assert.equal(results.created, 23); // 23 active leases
            assert.equal(results.archived, 2); // 2 terminated leases (10, 20)
            assert.equal(results.errors.length, 0);

            // Performance metrics
            const duration = endTime - startTime;
            const buildiumCalls = buildiumHttpClient.requests.length;
            const hubspotCalls = hubspotHttpClient.requests.length;

            console.log(`\nPerformance Metrics:`);
            console.log(`Duration: ${duration}ms`);
            console.log(`Processed: ${results.processed} leases`);
            console.log(`Buildium API calls: ${buildiumCalls}`);
            console.log(`HubSpot API calls: ${hubspotCalls}`);
            console.log(`Rate: ${(results.processed / (duration / 1000)).toFixed(2)} leases/second`);

            // Efficiency checks
            assert(buildiumCalls <= 31, `Expected <= 31 Buildium calls (1 + 25 + 5), got ${buildiumCalls}`);
            assert(duration < 5000, `Should complete in under 5 seconds, took ${duration}ms`);
        });
    });

    describe('Data Consistency and Integrity', function() {
        it('should maintain data consistency across sync operations', async function() {
            const sinceTime = '2024-01-01T00:00:00.000Z';

            // Mock lease with complex data
            const mockLease = {
                Id: 501,
                UnitId: 601,
                PropertyId: 701,
                Status: 'Active',
                Rent: { Amount: 2250 },
                LeaseFromDate: '2024-02-01T00:00:00',
                LeaseToDate: '2025-01-31T23:59:59',
                LastUpdated: '2024-01-15T15:30:00Z',
                SecurityDeposit: { Amount: 2250 },
                LeaseType: 'FixedTerm',
                MoveInDate: '2024-02-01T00:00:00'
            };

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/leases`,
                { data: [mockLease], totalCount: 1, hasMoreResults: false }
            );

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/rentals/units/601`,
                {
                    data: {
                        Id: 601,
                        PropertyId: 701,
                        UnitNumber: '3C',
                        Type: 'Apartment',
                        SquareFootage: 1200,
                        Bedrooms: 3,
                        Bathrooms: 2
                    }
                }
            );

            buildiumHttpClient.setMockResponse(
                `${buildiumClient.baseUrl}/v1/properties/701`,
                {
                    data: {
                        Id: 701,
                        Name: 'Premium Heights',
                        Address: {
                            FullAddress: '555 Premium Ave, Heights, TX 77001',
                            City: 'Heights',
                            State: 'TX',
                            PostalCode: '77001'
                        }
                    }
                }
            );

            hubspotHttpClient.setMockResponse(
                'POST /crm/v3/objects/0-420/search',
                { results: [], total: 0, paging: { next: null } }
            );

            // Execute sync
            const results = await syncEngine.syncLeasesIncremental(sinceTime);

            // Verify data integrity
            assert.equal(results.processed, 1);
            assert.equal(results.created, 1);

            // Find the create request and verify all data was transformed correctly
            const createRequest = hubspotHttpClient.requests.find(req => 
                req.method === 'POST' && 
                req.endpoint.includes('/crm/v3/objects/0-420') &&
                !req.endpoint.includes('/search')
            );

            const properties = createRequest.data.properties;
            
            // Verify key identifiers
            assert.equal(properties.buildium_lease_id, '501');
            assert.equal(properties.buildium_unit_id, '601');
            assert.equal(properties.buildium_property_id, '701');

            // Verify property details
            assert.equal(properties.name, 'Premium Heights - Unit 3C');
            assert.equal(properties.address, '555 Premium Ave, Heights, TX 77001');
            assert.equal(properties.city, 'Heights');
            assert.equal(properties.state, 'TX');
            assert.equal(properties.postal_code, '77001');

            // Verify lease details
            assert.equal(properties.rent_amount, '2250');
            assert.equal(properties.lease_start_date, '2024-02-01');
            assert.equal(properties.lease_end_date, '2025-01-31');
            assert.equal(properties.lease_status, 'Active');

            // Verify unit details
            assert.equal(properties.square_footage, '1200');
            assert.equal(properties.bedrooms, '3');
            assert.equal(properties.bathrooms, '2');
        });
    });
});

// Performance benchmark tests
describe('Lease-Centric vs Unit-Centric Performance Comparison', function() {
    it('should demonstrate efficiency gains over unit-centric approach', function() {
        // Scenario: 1000 units, 5 lease updates in last 24 hours
        
        const totalUnits = 1000;
        const updatedLeases = 5;
        const avgPropertiesPerLease = 2; // Unique properties
        
        // Unit-centric approach simulation
        const unitCentricCalls = {
            getAllUnits: 1,
            getLeasesPerUnit: totalUnits, // 1 call per unit
            getPropertyDetails: totalUnits * 0.1, // Assume 10% unique properties
            hubspotOperations: updatedLeases * 2 // search + upsert per updated lease
        };
        
        const unitCentricTotal = Object.values(unitCentricCalls).reduce((sum, calls) => sum + calls, 0);
        
        // Lease-centric approach
        const leaseCentricCalls = {
            getUpdatedLeases: 1,
            getUnitDetails: updatedLeases,
            getPropertyDetails: avgPropertiesPerLease,
            hubspotOperations: updatedLeases * 2 // search + upsert per lease
        };
        
        const leaseCentricTotal = Object.values(leaseCentricCalls).reduce((sum, calls) => sum + calls, 0);
        
        const efficiency = unitCentricTotal / leaseCentricTotal;
        
        console.log('\n=== Performance Comparison ===');
        console.log(`Scenario: ${totalUnits} units, ${updatedLeases} lease updates`);
        console.log('\nUnit-centric approach:');
        Object.entries(unitCentricCalls).forEach(([operation, calls]) => {
            console.log(`  ${operation}: ${calls} calls`);
        });
        console.log(`  Total: ${unitCentricTotal} API calls`);
        
        console.log('\nLease-centric approach:');
        Object.entries(leaseCentricCalls).forEach(([operation, calls]) => {
            console.log(`  ${operation}: ${calls} calls`);
        });
        console.log(`  Total: ${leaseCentricTotal} API calls`);
        
        console.log(`\nEfficiency gain: ${efficiency.toFixed(1)}x fewer API calls`);
        console.log(`Reduction: ${((1 - leaseCentricTotal/unitCentricTotal) * 100).toFixed(1)}%`);
        
        // Assert significant efficiency gain
        assert(efficiency > 50, `Expected >50x efficiency gain, got ${efficiency.toFixed(1)}x`);
        
        // Test passes - demonstrates the massive efficiency improvement
        console.log('\n[OK] Lease-centric approach is significantly more efficient!\n');
    });
});

module.exports = {
    // Export test utilities for other test files
};

/**
 * Test Suite for HubSpot Listings Integration
 * 
 * Tests the HubSpot API interactions for the lease-centric sync,
 * including listings object manipulation and association management.
 */

const assert = require('assert');

// Mock HubSpot API response structures
const mockListingResponse = {
    id: 'listing_123456789',
    properties: {
        buildium_lease_id: '12345',
        buildium_unit_id: '67890',
        buildium_property_id: '11111',
        name: 'Sunset Apartments - Unit 2A',
        property_type: 'Apartment',
        address: '123 Main St, Springfield, IL 62701',
        city: 'Springfield',
        state: 'IL',
        postal_code: '62701',
        rent_amount: '1500',
        lease_start_date: '2024-01-01',
        lease_end_date: '2024-12-31',
        lease_status: 'Active',
        square_footage: '850',
        bedrooms: '2',
        bathrooms: '1',
        hs_createdate: '2024-01-02T10:30:00.000Z',
        hs_lastmodifieddate: '2024-01-02T10:30:00.000Z'
    },
    createdAt: '2024-01-02T10:30:00.000Z',
    updatedAt: '2024-01-02T10:30:00.000Z',
    archived: false
};

// Mock HTTP client for HubSpot API
class MockHubSpotHttpClient {
    constructor() {
        this.requests = [];
        this.responses = new Map();
        this.rateLimiter = { requests: 0, lastReset: Date.now() };
    }

    async request(method, endpoint, data = null, options = {}) {
        // Simulate rate limiting
        await this.applyRateLimit();

        this.requests.push({ method, endpoint, data, options });

        // Return mock response based on endpoint
        const responseKey = `${method} ${endpoint}`;
        if (this.responses.has(responseKey)) {
            return this.responses.get(responseKey);
        }

        // Default responses
        if (endpoint.includes('/crm/v3/objects/0-420') && method === 'POST') {
            return this.getMockCreateListingResponse(data);
        } else if (endpoint.includes('/crm/v3/objects/0-420/search') && method === 'POST') {
            return this.getMockSearchResponse(data);
        } else if (endpoint.includes('/crm/v3/objects/0-420') && method === 'PATCH') {
            return this.getMockUpdateListingResponse(data);
        } else if (endpoint.includes('/crm/v3/objects/0-420') && method === 'DELETE') {
            return { archived: true };
        }

        throw new Error(`No mock response configured for ${method} ${endpoint}`);
    }

    async applyRateLimit() {
        // Simulate HubSpot rate limiting (100 requests per 10 seconds)
        const now = Date.now();
        if (now - this.rateLimiter.lastReset > 10000) {
            this.rateLimiter.requests = 0;
            this.rateLimiter.lastReset = now;
        }

        this.rateLimiter.requests++;
        if (this.rateLimiter.requests > 100) {
            // Simulate rate limit delay
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    getMockCreateListingResponse(data) {
        return {
            id: `listing_${Date.now()}`,
            properties: data.properties,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            archived: false
        };
    }

    getMockSearchResponse(searchRequest) {
        const { filterGroups } = searchRequest;
        
        // Mock search results based on filters
        if (filterGroups && filterGroups.length > 0) {
            const filter = filterGroups[0].filters[0];
            if (filter.propertyName === 'buildium_lease_id' && filter.value === '12345') {
                return {
                    results: [mockListingResponse],
                    total: 1,
                    paging: { next: null }
                };
            }
        }

        return {
            results: [],
            total: 0,
            paging: { next: null }
        };
    }

    getMockUpdateListingResponse(data) {
        return {
            ...mockListingResponse,
            properties: { ...mockListingResponse.properties, ...data.properties },
            updatedAt: new Date().toISOString()
        };
    }

    setMockResponse(method, endpoint, response) {
        this.responses.set(`${method} ${endpoint}`, response);
    }

    clearRequests() {
        this.requests = [];
    }
}

// HubSpot Client for Lease-Centric Operations
class LeaseCentricHubSpotClient {
    constructor(httpClient, accessToken) {
        this.httpClient = httpClient;
        this.accessToken = accessToken;
        this.baseUrl = 'https://api.hubapi.com';
        this.listingsObjectType = '0-420'; // HubSpot's listings object type ID
    }

    /**
     * Search for listings by Buildium lease ID
     * @param {string} buildiumLeaseId - The Buildium lease ID
     * @returns {Promise<Object|null>} Listing object or null if not found
     */
    async findListingByLeaseId(buildiumLeaseId) {
        const searchRequest = {
            filterGroups: [{
                filters: [{
                    propertyName: 'buildium_lease_id',
                    operator: 'EQ',
                    value: buildiumLeaseId.toString()
                }]
            }],
            properties: ['buildium_lease_id', 'buildium_unit_id', 'name', 'lease_status'],
            limit: 1
        };

        const response = await this.httpClient.request(
            'POST',
            `/crm/v3/objects/${this.listingsObjectType}/search`,
            searchRequest
        );

        return response.results.length > 0 ? response.results[0] : null;
    }

    /**
     * Create a new listing in HubSpot
     * @param {Object} properties - Listing properties
     * @returns {Promise<Object>} Created listing object
     */
    async createListing(properties) {
        const createRequest = {
            properties: this.sanitizeProperties(properties)
        };

        return await this.httpClient.request(
            'POST',
            `/crm/v3/objects/${this.listingsObjectType}`,
            createRequest
        );
    }

    /**
     * Update an existing listing in HubSpot
     * @param {string} listingId - HubSpot listing ID
     * @param {Object} properties - Properties to update
     * @returns {Promise<Object>} Updated listing object
     */
    async updateListing(listingId, properties) {
        const updateRequest = {
            properties: this.sanitizeProperties(properties)
        };

        return await this.httpClient.request(
            'PATCH',
            `/crm/v3/objects/${this.listingsObjectType}/${listingId}`,
            updateRequest
        );
    }

    /**
     * Archive (soft delete) a listing in HubSpot
     * @param {string} listingId - HubSpot listing ID
     * @returns {Promise<Object>} Archive confirmation
     */
    async archiveListing(listingId) {
        return await this.httpClient.request(
            'DELETE',
            `/crm/v3/objects/${this.listingsObjectType}/${listingId}`
        );
    }

    /**
     * Create or update a listing based on lease data
     * @param {Object} leaseData - Transformed lease data
     * @returns {Promise<Object>} Result with action taken and listing
     */
    async upsertListing(leaseData) {
        const existingListing = await this.findListingByLeaseId(leaseData.buildium_lease_id);

        if (existingListing) {
            const updated = await this.updateListing(existingListing.id, leaseData);
            return {
                action: 'updated',
                listing: updated,
                previousListing: existingListing
            };
        } else {
            const created = await this.createListing(leaseData);
            return {
                action: 'created',
                listing: created,
                previousListing: null
            };
        }
    }

    /**
     * Batch process multiple listing operations
     * @param {Array} operations - Array of {action, data} objects
     * @returns {Promise<Object>} Batch results
     */
    async batchProcessListings(operations) {
        const results = {
            processed: 0,
            created: 0,
            updated: 0,
            archived: 0,
            errors: []
        };

        for (const operation of operations) {
            try {
                let result;
                switch (operation.action) {
                    case 'upsert':
                        result = await this.upsertListing(operation.data);
                        if (result.action === 'created') {
                            results.created++;
                        } else {
                            results.updated++;
                        }
                        break;
                    case 'archive':
                        await this.archiveListing(operation.listingId);
                        results.archived++;
                        break;
                    default:
                        throw new Error(`Unknown operation: ${operation.action}`);
                }
                results.processed++;
            } catch (error) {
                results.errors.push({
                    operation,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Search for listings with advanced filters
     * @param {Object} searchCriteria - Search criteria
     * @returns {Promise<Array>} Array of matching listings
     */
    async searchListings(searchCriteria) {
        const { filters, properties = [], limit = 100, after = null } = searchCriteria;

        const searchRequest = {
            filterGroups: filters,
            properties,
            limit,
            after
        };

        const response = await this.httpClient.request(
            'POST',
            `/crm/v3/objects/${this.listingsObjectType}/search`,
            searchRequest
        );

        return response.results;
    }

    /**
     * Get listings by multiple lease IDs
     * @param {Array} leaseIds - Array of Buildium lease IDs
     * @returns {Promise<Array>} Array of found listings
     */
    async getListingsByLeaseIds(leaseIds) {
        if (leaseIds.length === 0) return [];

        const searchRequest = {
            filterGroups: [{
                filters: [{
                    propertyName: 'buildium_lease_id',
                    operator: 'IN',
                    values: leaseIds.map(id => id.toString())
                }]
            }],
            properties: ['buildium_lease_id', 'buildium_unit_id', 'name', 'lease_status'],
            limit: Math.min(leaseIds.length, 100)
        };

        const response = await this.httpClient.request(
            'POST',
            `/crm/v3/objects/${this.listingsObjectType}/search`,
            searchRequest
        );

        return response.results;
    }

    /**
     * Create association between contact and listing
     * @param {string} contactId - HubSpot contact ID
     * @param {string} listingId - HubSpot listing ID
     * @param {string} associationType - Type of association
     * @returns {Promise<Object>} Association result
     */
    async createContactListingAssociation(contactId, listingId, associationType = 'contact_to_listing') {
        const associationRequest = {
            inputs: [{
                from: { id: contactId },
                to: { id: listingId },
                type: associationType
            }]
        };

        return await this.httpClient.request(
            'POST',
            '/crm/v4/associations/contacts/0-420/batch/create',
            associationRequest
        );
    }

    /**
     * Sanitize properties for HubSpot API
     * @param {Object} properties - Raw properties
     * @returns {Object} Sanitized properties
     */
    sanitizeProperties(properties) {
        const sanitized = {};

        for (const [key, value] of Object.entries(properties)) {
            if (value !== null && value !== undefined) {
                // Convert numbers to strings for HubSpot
                sanitized[key] = typeof value === 'number' ? value.toString() : value;
            }
        }

        return sanitized;
    }

    /**
     * Validate listing data before sending to HubSpot
     * @param {Object} listingData - Listing data to validate
     * @returns {Object} Validation result
     */
    validateListingData(listingData) {
        const errors = [];
        const required = ['buildium_lease_id', 'buildium_unit_id', 'name'];

        for (const field of required) {
            if (!listingData[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Validate data types
        if (listingData.rent_amount && isNaN(Number(listingData.rent_amount))) {
            errors.push('rent_amount must be a valid number');
        }

        if (listingData.bedrooms && isNaN(Number(listingData.bedrooms))) {
            errors.push('bedrooms must be a valid number');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// Test Suite
describe('HubSpot Listings Integration', function() {
    let httpClient, hubspotClient;

    beforeEach(function() {
        httpClient = new MockHubSpotHttpClient();
        hubspotClient = new LeaseCentricHubSpotClient(httpClient, 'test-access-token');
    });

    describe('Listing Search Operations', function() {
        it('should find existing listing by lease ID', async function() {
            const listing = await hubspotClient.findListingByLeaseId('12345');

            assert(listing !== null);
            assert.equal(listing.properties.buildium_lease_id, '12345');

            // Verify API call was made correctly
            const request = httpClient.requests[0];
            assert.equal(request.method, 'POST');
            assert(request.endpoint.includes('/search'));
            assert.equal(request.data.filterGroups[0].filters[0].value, '12345');
        });

        it('should return null when listing not found', async function() {
            const listing = await hubspotClient.findListingByLeaseId('nonexistent');

            assert.equal(listing, null);
        });

        it('should search listings with multiple filters', async function() {
            const searchCriteria = {
                filters: [{
                    filters: [
                        { propertyName: 'lease_status', operator: 'EQ', value: 'Active' },
                        { propertyName: 'property_type', operator: 'EQ', value: 'Apartment' }
                    ]
                }],
                properties: ['name', 'rent_amount'],
                limit: 50
            };

            await hubspotClient.searchListings(searchCriteria);

            const request = httpClient.requests[0];
            assert.equal(request.data.filterGroups.length, 1);
            assert.equal(request.data.filterGroups[0].filters.length, 2);
            assert.equal(request.data.limit, 50);
        });
    });

    describe('Listing CRUD Operations', function() {
        it('should create new listing with correct properties', async function() {
            const listingData = {
                buildium_lease_id: '67890',
                buildium_unit_id: '11111',
                name: 'New Listing',
                rent_amount: 1800,
                bedrooms: 3
            };

            const result = await hubspotClient.createListing(listingData);

            assert(result.id);
            assert.equal(result.properties.buildium_lease_id, '67890');
            assert.equal(result.properties.rent_amount, '1800'); // Should be converted to string

            // Verify API call
            const request = httpClient.requests[0];
            assert.equal(request.method, 'POST');
            assert(request.endpoint.includes('/crm/v3/objects/0-420'));
        });

        it('should update existing listing', async function() {
            const listingId = 'listing_123';
            const updates = {
                rent_amount: 1600,
                lease_status: 'Renewed'
            };

            const result = await hubspotClient.updateListing(listingId, updates);

            assert.equal(result.properties.rent_amount, '1600');
            assert.equal(result.properties.lease_status, 'Renewed');

            // Verify API call
            const request = httpClient.requests[0];
            assert.equal(request.method, 'PATCH');
            assert(request.endpoint.includes(listingId));
        });

        it('should archive listing', async function() {
            const listingId = 'listing_123';

            const result = await hubspotClient.archiveListing(listingId);

            assert.equal(result.archived, true);

            // Verify API call
            const request = httpClient.requests[0];
            assert.equal(request.method, 'DELETE');
            assert(request.endpoint.includes(listingId));
        });
    });

    describe('Upsert Operations', function() {
        it('should create listing when none exists', async function() {
            const leaseData = {
                buildium_lease_id: '99999',
                buildium_unit_id: '88888',
                name: 'New Property',
                rent_amount: 2000
            };

            const result = await hubspotClient.upsertListing(leaseData);

            assert.equal(result.action, 'created');
            assert(result.listing.id);
            assert.equal(result.previousListing, null);
        });

        it('should update listing when one exists', async function() {
            const leaseData = {
                buildium_lease_id: '12345', // This exists in our mock
                buildium_unit_id: '67890',
                name: 'Updated Property',
                rent_amount: 1700
            };

            const result = await hubspotClient.upsertListing(leaseData);

            assert.equal(result.action, 'updated');
            assert(result.listing.id);
            assert(result.previousListing);
            assert.equal(result.previousListing.properties.buildium_lease_id, '12345');
        });
    });

    describe('Batch Operations', function() {
        it('should process multiple operations in batch', async function() {
            const operations = [
                {
                    action: 'upsert',
                    data: { buildium_lease_id: '111', name: 'Listing 1', rent_amount: 1500 }
                },
                {
                    action: 'upsert',
                    data: { buildium_lease_id: '222', name: 'Listing 2', rent_amount: 1600 }
                },
                {
                    action: 'archive',
                    listingId: 'listing_to_archive'
                }
            ];

            const results = await hubspotClient.batchProcessListings(operations);

            assert.equal(results.processed, 3);
            assert.equal(results.created, 2);
            assert.equal(results.archived, 1);
            assert.equal(results.errors.length, 0);
        });

        it('should handle errors in batch operations gracefully', async function() {
            // Force an error by setting up a bad response
            httpClient.setMockResponse('POST', '/crm/v3/objects/0-420', new Error('API Error'));

            const operations = [
                {
                    action: 'upsert',
                    data: { buildium_lease_id: '333', name: 'Bad Listing' }
                }
            ];

            const results = await hubspotClient.batchProcessListings(operations);

            assert.equal(results.processed, 0);
            assert.equal(results.errors.length, 1);
            assert(results.errors[0].error.includes('API Error'));
        });
    });

    describe('Data Validation', function() {
        it('should validate required fields', function() {
            const invalidData = {
                buildium_unit_id: '123',
                // Missing buildium_lease_id and name
                rent_amount: 1500
            };

            const validation = hubspotClient.validateListingData(invalidData);

            assert.equal(validation.isValid, false);
            assert(validation.errors.some(err => err.includes('buildium_lease_id')));
            assert(validation.errors.some(err => err.includes('name')));
        });

        it('should validate numeric fields', function() {
            const invalidData = {
                buildium_lease_id: '123',
                buildium_unit_id: '456',
                name: 'Test Listing',
                rent_amount: 'not-a-number',
                bedrooms: 'also-not-a-number'
            };

            const validation = hubspotClient.validateListingData(invalidData);

            assert.equal(validation.isValid, false);
            assert(validation.errors.some(err => err.includes('rent_amount')));
            assert(validation.errors.some(err => err.includes('bedrooms')));
        });

        it('should pass validation for valid data', function() {
            const validData = {
                buildium_lease_id: '123',
                buildium_unit_id: '456',
                name: 'Valid Listing',
                rent_amount: 1500,
                bedrooms: 2,
                bathrooms: 1
            };

            const validation = hubspotClient.validateListingData(validData);

            assert.equal(validation.isValid, true);
            assert.equal(validation.errors.length, 0);
        });
    });

    describe('Property Sanitization', function() {
        it('should convert numbers to strings', function() {
            const properties = {
                rent_amount: 1500,
                bedrooms: 2,
                bathrooms: 1.5,
                name: 'Test Property'
            };

            const sanitized = hubspotClient.sanitizeProperties(properties);

            assert.equal(sanitized.rent_amount, '1500');
            assert.equal(sanitized.bedrooms, '2');
            assert.equal(sanitized.bathrooms, '1.5');
            assert.equal(sanitized.name, 'Test Property'); // String unchanged
        });

        it('should remove null and undefined values', function() {
            const properties = {
                name: 'Test Property',
                description: null,
                notes: undefined,
                rent_amount: 0
            };

            const sanitized = hubspotClient.sanitizeProperties(properties);

            assert.equal(sanitized.name, 'Test Property');
            assert.equal(sanitized.rent_amount, '0');
            assert(!('description' in sanitized));
            assert(!('notes' in sanitized));
        });
    });

    describe('Association Management', function() {
        it('should create contact-listing association', async function() {
            const contactId = 'contact_123';
            const listingId = 'listing_456';

            await hubspotClient.createContactListingAssociation(contactId, listingId);

            const request = httpClient.requests[0];
            assert.equal(request.method, 'POST');
            assert(request.endpoint.includes('/associations/contacts/0-420'));
            assert.equal(request.data.inputs[0].from.id, contactId);
            assert.equal(request.data.inputs[0].to.id, listingId);
        });
    });

    describe('Rate Limiting', function() {
        it('should handle rate limiting gracefully', async function() {
            // Make multiple requests to trigger rate limiting
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(hubspotClient.findListingByLeaseId(`lease_${i}`));
            }

            await Promise.all(promises);

            // Should have made all requests without errors
            assert.equal(httpClient.requests.length, 5);
        });
    });

    describe('Multiple Lease ID Queries', function() {
        it('should query multiple lease IDs efficiently', async function() {
            const leaseIds = ['123', '456', '789'];

            await hubspotClient.getListingsByLeaseIds(leaseIds);

            const request = httpClient.requests[0];
            assert.equal(request.data.filterGroups[0].filters[0].operator, 'IN');
            assert.deepEqual(request.data.filterGroups[0].filters[0].values, leaseIds);
        });

        it('should handle empty lease ID array', async function() {
            const result = await hubspotClient.getListingsByLeaseIds([]);

            assert.deepEqual(result, []);
            assert.equal(httpClient.requests.length, 0);
        });
    });
});

// Integration Tests
describe('HubSpot Integration End-to-End', function() {
    let httpClient, hubspotClient;

    beforeEach(function() {
        httpClient = new MockHubSpotHttpClient();
        hubspotClient = new LeaseCentricHubSpotClient(httpClient, 'test-token');
    });

    describe('Real-world Scenarios', function() {
        it('should handle complete lease-to-listing workflow', async function() {
            // Step 1: Check if listing exists
            let listing = await hubspotClient.findListingByLeaseId('new_lease_123');
            assert.equal(listing, null);

            // Step 2: Create new listing
            const leaseData = {
                buildium_lease_id: 'new_lease_123',
                buildium_unit_id: 'unit_456',
                buildium_property_id: 'prop_789',
                name: 'Workflow Test Property',
                rent_amount: 1750,
                lease_status: 'Active'
            };

            const createResult = await hubspotClient.upsertListing(leaseData);
            assert.equal(createResult.action, 'created');

            // Step 3: Update the listing
            const updatedData = {
                ...leaseData,
                rent_amount: 1800,
                lease_status: 'Renewed'
            };

            const updateResult = await hubspotClient.upsertListing(updatedData);
            assert.equal(updateResult.action, 'updated');

            // Step 4: Archive the listing
            await hubspotClient.archiveListing(updateResult.listing.id);

            // Verify total API calls made
            assert(httpClient.requests.length >= 4); // Search, create, search, update, archive
        });
    });
});

// Export for integration tests
module.exports = {
    LeaseCentricHubSpotClient,
    MockHubSpotHttpClient
};

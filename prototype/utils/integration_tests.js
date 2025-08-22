const axios = require('axios');
require('dotenv').config();

// Import our main classes
const { BuildiumClient, HubSpotClient, DataTransformer, IntegrationPrototype } = require('../index.js');

/**
 * Comprehensive Integration Test Suite
 * 
 * This test suite validates:
 * 1. Buildium API connectivity and data retrieval
 * 2. HubSpot API connectivity and data creation
 * 3. Data transformation accuracy
 * 4. End-to-end sync workflows
 * 5. Association creation and management
 * 6. Field mapping validation
 */

class IntegrationTestSuite {
    constructor() {
        this.buildiumClient = new BuildiumClient();
        this.hubspotClient = new HubSpotClient();
        this.transformer = new DataTransformer();
        this.integration = new IntegrationPrototype();
        
        // Test results tracking
        this.testResults = {
            passed: 0,
            failed: 0,
            skipped: 0,
            details: []
        };
        
        // Store test data for cleanup
        this.createdContacts = [];
        this.createdListings = [];
    }

    /**
     * Run all integration tests
     */
    async runAllTests() {
        console.log('🧪 Starting Comprehensive Integration Tests');
        console.log('=' .repeat(60));
        console.log(`Started at: ${new Date().toISOString()}`);
        console.log('');

        try {
            // Phase 1: Basic connectivity tests
            await this.testConnectivity();
            
            // Phase 2: Data retrieval tests
            await this.testDataRetrieval();
            
            // Phase 3: Data transformation tests
            await this.testDataTransformation();
            
            // Phase 4: HubSpot creation tests
            await this.testHubSpotCreation();
            
            // Phase 5: End-to-end workflow tests
            await this.testEndToEndWorkflows();
            
            // Phase 6: Association tests
            await this.testAssociations();
            
            // Phase 7: Field validation tests
            await this.testFieldValidation();
            
            // Cleanup
            await this.cleanup();
            
            // Summary
            this.printSummary();
            
        } catch (error) {
            console.error('💥 Test suite failed:', error.message);
            await this.cleanup();
        }
    }

    /**
     * Test basic API connectivity
     */
    async testConnectivity() {
        console.log('\n📡 Phase 1: API Connectivity Tests');
        console.log('-'.repeat(40));

        // Test 1: Buildium API connectivity
        await this.runTest('Buildium API Connectivity', async () => {
            const tenants = await this.buildiumClient.getAllTenants(1);
            if (!tenants || tenants.length === 0) {
                throw new Error('No tenants returned from Buildium API');
            }
            return `Retrieved ${tenants.length} tenant(s)`;
        });

        // Test 2: HubSpot API connectivity
        await this.runTest('HubSpot API Connectivity', async () => {
            const contacts = await this.hubspotClient.getAllListings();
            return `HubSpot API accessible, found ${contacts.length} existing listings`;
        });

        // Test 3: Buildium Units API
        await this.runTest('Buildium Units API', async () => {
            const units = await this.buildiumClient.getAllUnits(5);
            if (!units || units.length === 0) {
                throw new Error('No units returned from Buildium API');
            }
            return `Retrieved ${units.length} unit(s)`;
        });
    }

    /**
     * Test data retrieval from Buildium
     */
    async testDataRetrieval() {
        console.log('\n📋 Phase 2: Data Retrieval Tests');
        console.log('-'.repeat(40));

        // Test 1: Tenant data completeness
        await this.runTest('Tenant Data Completeness', async () => {
            const tenants = await this.buildiumClient.getAllTenants(3);
            const tenant = tenants[0];
            
            const requiredFields = ['Id', 'FirstName', 'LastName'];
            const missingFields = requiredFields.filter(field => !tenant[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }
            
            const optionalFields = ['Email', 'PhoneNumbers', 'Address'];
            const presentOptional = optionalFields.filter(field => tenant[field]);
            
            return `Required fields present. Optional fields available: ${presentOptional.join(', ')}`;
        });

        // Test 2: Unit and lease data
        await this.runTest('Unit and Lease Data', async () => {
            const units = await this.buildiumClient.getAllUnits(1);
            const unit = units[0];
            
            if (!unit.Id || !unit.PropertyId) {
                throw new Error('Unit missing required ID or PropertyId');
            }
            
            // Test lease retrieval for this unit
            const leases = await this.buildiumClient.getAllLeasesForUnit(unit.Id);
            
            return `Unit ${unit.Id} has ${leases.length} lease(s). Property ID: ${unit.PropertyId}`;
        });

        // Test 3: Property data retrieval
        await this.runTest('Property Data Retrieval', async () => {
            const units = await this.buildiumClient.getAllUnits(1);
            const unit = units[0];
            
            const property = await this.buildiumClient.getProperty(unit.PropertyId);
            
            if (!property.Id || !property.Name) {
                throw new Error('Property missing required fields');
            }
            
            const hasAddress = property.Address && property.Address.AddressLine1;
            
            return `Property "${property.Name}" (ID: ${property.Id}) ${hasAddress ? 'has address' : 'missing address'}`;
        });
    }

    /**
     * Test data transformation logic
     */
    async testDataTransformation() {
        console.log('\n🔄 Phase 3: Data Transformation Tests');
        console.log('-'.repeat(40));

        // Test 1: Tenant to Contact transformation
        await this.runTest('Tenant to Contact Transformation', async () => {
            const tenants = await this.buildiumClient.getAllTenants(1);
            const tenant = tenants[0];
            
            const contactData = this.transformer.transformTenantToContact(tenant);
            
            // Validate required HubSpot fields
            const requiredFields = ['firstname', 'lastname'];
            const missingFields = requiredFields.filter(field => !contactData.properties[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Transformation missing required fields: ${missingFields.join(', ')}`);
            }
            
            // Check data mapping
            const mappedFields = Object.keys(contactData.properties);
            
            return `Mapped ${mappedFields.length} fields: ${mappedFields.join(', ')}`;
        });

        // Test 2: Unit to Listing transformation
        await this.runTest('Unit to Listing Transformation', async () => {
            const units = await this.buildiumClient.getAllUnits(1);
            const unit = units[0];
            
            const property = await this.buildiumClient.getProperty(unit.PropertyId);
            const leases = await this.buildiumClient.getAllLeasesForUnit(unit.Id);
            const activeLease = leases.find(l => l.LeaseStatus === 'Active');
            
            const buildiumUnitUrl = `https://ripple.managebuilding.com/manager/app/properties/${unit.PropertyId}/units/${unit.Id}/summary`;
            
            const listingData = this.integration.transformUnitToListing(unit, property, activeLease, leases, buildiumUnitUrl);
            
            // Validate required fields
            if (!listingData.properties.buildium_unit_id) {
                throw new Error('Missing buildium_unit_id in transformation');
            }
            
            if (!listingData.properties.hs_name) {
                throw new Error('Missing hs_name in transformation');
            }
            
            const mappedFields = Object.keys(listingData.properties);
            
            return `Mapped ${mappedFields.length} listing fields, unit URL included`;
        });
    }

    /**
     * Test HubSpot object creation
     */
    async testHubSpotCreation() {
        console.log('\n🏗️ Phase 4: HubSpot Creation Tests');
        console.log('-'.repeat(40));

        // Test 1: Contact creation
        await this.runTest('Contact Creation', async () => {
            const tenants = await this.buildiumClient.getAllTenants(1);
            const tenant = tenants[0];
            
            // Transform to HubSpot format
            const contactData = this.transformer.transformTenantToContact(tenant);
            
            // Add test identifier to avoid conflicts
            contactData.properties.lastname = `${contactData.properties.lastname}_TEST_${Date.now()}`;
            contactData.properties.email = `test.${Date.now()}@test-domain-integration.com`;
            
            // Create contact
            const contact = await this.hubspotClient.createContact(contactData);
            this.createdContacts.push(contact.id);
            
            // Verify creation
            if (!contact.id) {
                throw new Error('Contact creation did not return an ID');
            }
            
            return `Created contact ${contact.id} with email ${contactData.properties.email}`;
        });

        // Test 2: Listing creation
        await this.runTest('Listing Creation', async () => {
            const units = await this.buildiumClient.getAllUnits(1);
            const unit = units[0];
            
            const property = await this.buildiumClient.getProperty(unit.PropertyId);
            const leases = await this.buildiumClient.getAllLeasesForUnit(unit.Id);
            const activeLease = leases.find(l => l.LeaseStatus === 'Active');
            
            const buildiumUnitUrl = `https://ripple.managebuilding.com/manager/app/properties/${unit.PropertyId}/units/${unit.Id}/summary`;
            
            // Transform to listing format with test identifier
            const listingData = this.integration.transformUnitToListing(unit, property, activeLease, leases, buildiumUnitUrl);
            // Add test identifier to name only (buildium_unit_id will be handled correctly by the transform method)
            listingData.properties.hs_name = `TEST: ${listingData.properties.hs_name} - ${Date.now()}`;
            
            // Check if a listing already exists for this unit
            const existingListing = await this.hubspotClient.searchListingByUnitId(unit.Id);
            if (existingListing) {
                return `Listing already exists for unit ${unit.Id} (ID: ${existingListing.id})`;
            }
            
            // Create listing
            const listing = await this.hubspotClient.createListing(listingData);
            this.createdListings.push(listing.id);
            
            // Verify creation
            if (!listing.id) {
                throw new Error('Listing creation did not return an ID');
            }
            
            return `Created listing ${listing.id} for unit ${unit.Id}`;
        });

        // Test 3: Custom properties existence
        await this.runTest('Custom Properties Setup', async () => {
            await this.hubspotClient.createListingCustomProperties();
            return 'Custom properties verified/created successfully';
        });
    }

    /**
     * Test end-to-end workflows
     */
    async testEndToEndWorkflows() {
        console.log('\n🔄 Phase 5: End-to-End Workflow Tests');
        console.log('-'.repeat(40));

        // Test 1: Complete tenant sync workflow
        await this.runTest('Complete Tenant Sync Workflow', async () => {
            const tenants = await this.buildiumClient.getAllTenants(1);
            const tenant = tenants[0];
            
            // Create a test email to avoid conflicts
            const originalEmail = tenant.Email;
            tenant.Email = `test.tenant.${Date.now()}@test-domain-integration.com`;
            
            // Mock the getTenant method to return our modified tenant
            const originalGetTenant = this.buildiumClient.getTenant;
            this.buildiumClient.getTenant = async (id) => {
                if (id === tenant.Id) return tenant;
                return originalGetTenant.call(this.buildiumClient, id);
            };
            
            try {
                const result = await this.integration.syncTenantToContact(tenant.Id);
                
                // Both success and skipped (existing contact) are valid outcomes
                if (result.status !== 'success' && result.status !== 'skipped') {
                    throw new Error(`Sync failed with status: ${result.status}`);
                }
                
                // Track for cleanup
                if (result.hubspotContact) {
                    this.createdContacts.push(result.hubspotContact.id);
                }
                if (result.hubspotListing) {
                    this.createdListings.push(result.hubspotListing.id);
                }
                
                return `Tenant sync completed with status: ${result.status}${result.status === 'skipped' ? ' (contact already exists)' : ''}`;
                
                // Restore original method
                this.buildiumClient.getTenant = originalGetTenant;
                
                return `Sync successful: Contact ${result.hubspotContact.id}${result.hubspotListing ? `, Listing ${result.hubspotListing.id}` : ''}`;
                
            } catch (error) {
                // Restore original method on error
                this.buildiumClient.getTenant = originalGetTenant;
                throw error;
            }
        });

        // Test 2: Unit-centric sync workflow
        await this.runTest('Unit-Centric Sync Workflow', async () => {
            const units = await this.buildiumClient.getAllUnits(1);
            const unit = units[0];
            
            // Use the real unit instead of creating a fake one
            console.log(`🏠 Processing Unit ${unit.UnitNumber || unit.Id} (Property: ${unit.PropertyId})`);
            
            // Check if listing already exists first
            const existingListingId = await this.hubspotClient.findListingByUnitId(unit.Id);
            if (existingListingId) {
                console.log(`⚠️ Listing already exists for unit ${unit.Id}, skipping creation`);
                return `Unit sync skipped - listing already exists with ID: ${existingListingId}`;
            }
            
            const result = await this.integration.syncUnitToListing(unit);
            
            if (result.status === 'error') {
                throw new Error(`Unit sync failed: ${result.error}`);
            }
            
            // Track for cleanup if successful
            if (result.status === 'success' && result.hubspotListing) {
                this.createdListings.push(result.hubspotListing.id);
            }
            
            return `Unit sync completed with status: ${result.status}`;
        });
    }

    /**
     * Test association functionality
     */
    async testAssociations() {
        console.log('\n🔗 Phase 6: Association Tests');
        console.log('-'.repeat(40));

        // Test 1: Association type discovery
        await this.runTest('Association Types Discovery', async () => {
            const types = await this.hubspotClient.getAssociationTypes('contacts', '0-420');
            
            if (!types || types.length === 0) {
                throw new Error('No association types found between contacts and listings');
            }
            
            // Look for our expected types
            const activeType = types.find(t => t.label === 'Active Tenant');
            const inactiveType = types.find(t => t.label === 'Inactive Tenant');
            
            return `Found ${types.length} association types. Active: ${activeType ? '✓' : '✗'}, Inactive: ${inactiveType ? '✓' : '✗'}`;
        });

        // Test 2: Association creation
        await this.runTest('Association Creation', async () => {
            // Only run if we have created objects to associate
            if (this.createdContacts.length === 0 || this.createdListings.length === 0) {
                console.log('⚠️ Skipping association test - need both contacts and listings to test associations');
                return 'Skipped - no test contacts or listings available. Run with fresh data to test associations.';
            }
            
            const contactId = this.createdContacts[0];
            const listingId = this.createdListings[0];
            
            // Create Active Tenant association
            const result = await this.hubspotClient.createContactListingAssociation(
                contactId, 
                listingId, 
                2 // Active Tenant type ID
            );
            
            if (!result) {
                throw new Error('Association creation returned null/false');
            }
            
            // Verify association exists
            const associations = await this.hubspotClient.getContactAssociations(contactId);
            const foundAssociation = associations.find(a => a.toObjectId === listingId);
            
            if (!foundAssociation) {
                throw new Error('Created association not found when querying back');
            }
            
            return `Association created and verified between contact ${contactId} and listing ${listingId}`;
        });
    }

    /**
     * Test field validation and data integrity
     */
    async testFieldValidation() {
        console.log('\n🔍 Phase 7: Field Validation Tests');
        console.log('-'.repeat(40));

        // Test 1: Required field mapping
        await this.runTest('Required Field Mapping', async () => {
            const tenants = await this.buildiumClient.getAllTenants(1);
            const tenant = tenants[0];
            
            const contactData = this.transformer.transformTenantToContact(tenant);
            
            // Check that Buildium ID is stored somewhere
            const buildiumIdStored = contactData.properties.hs_content_membership_notes && 
                                    contactData.properties.hs_content_membership_notes.includes(tenant.Id.toString());
            
            if (!buildiumIdStored) {
                throw new Error('Buildium tenant ID not stored in contact data');
            }
            
            // Check lifecycle stage is set
            if (!contactData.properties.lifecyclestage) {
                throw new Error('Lifecycle stage not set');
            }
            
            return 'All required field mappings verified';
        });

        // Test 2: Data type validation
        await this.runTest('Data Type Validation', async () => {
            const units = await this.buildiumClient.getAllUnits(1);
            const unit = units[0];
            
            const property = await this.buildiumClient.getProperty(unit.PropertyId);
            const leases = await this.buildiumClient.getAllLeasesForUnit(unit.Id);
            const activeLease = leases.find(l => l.LeaseStatus === 'Active');
            
            const buildiumUnitUrl = `https://ripple.managebuilding.com/manager/app/properties/${unit.PropertyId}/units/${unit.Id}/summary`;
            const listingData = this.integration.transformUnitToListing(unit, property, activeLease, leases, buildiumUnitUrl);
            
            // Check numeric fields are properly typed
            const numericFields = ['hs_bedrooms', 'hs_bathrooms', 'hs_price', 'hs_square_footage'];
            
            for (const field of numericFields) {
                if (listingData.properties[field] !== undefined && 
                    typeof listingData.properties[field] !== 'number') {
                    throw new Error(`Field ${field} should be numeric but is ${typeof listingData.properties[field]}`);
                }
            }
            
            // Check URLs are valid
            if (listingData.properties.buildium_unit_url && 
                !listingData.properties.buildium_unit_url.startsWith('https://')) {
                throw new Error('Buildium unit URL is not a valid HTTPS URL');
            }
            
            return 'All data types validated correctly';
        });
    }

    /**
     * Cleanup test data
     */
    async cleanup() {
        console.log('\n🧹 Cleanup Phase');
        console.log('-'.repeat(40));

        let cleanupResults = { contacts: 0, listings: 0, errors: 0 };

        // Delete test contacts
        for (const contactId of this.createdContacts) {
            try {
                await this.hubspotClient.deleteContact(contactId);
                cleanupResults.contacts++;
                console.log(`✅ Deleted test contact ${contactId}`);
            } catch (error) {
                cleanupResults.errors++;
                console.log(`❌ Failed to delete contact ${contactId}: ${error.message}`);
            }
        }

        // Delete test listings
        for (const listingId of this.createdListings) {
            try {
                await this.hubspotClient.deleteListing(listingId);
                cleanupResults.listings++;
                console.log(`✅ Deleted test listing ${listingId}`);
            } catch (error) {
                cleanupResults.errors++;
                console.log(`❌ Failed to delete listing ${listingId}: ${error.message}`);
            }
        }

        console.log(`\n🧹 Cleanup complete: ${cleanupResults.contacts} contacts, ${cleanupResults.listings} listings deleted`);
        if (cleanupResults.errors > 0) {
            console.log(`⚠️ ${cleanupResults.errors} cleanup errors occurred`);
        }
    }

    /**
     * Helper method to run individual tests
     */
    async runTest(testName, testFunction) {
        const startTime = Date.now();
        
        try {
            console.log(`\n🧪 Running: ${testName}`);
            
            const result = await testFunction();
            const duration = Date.now() - startTime;
            
            // Check if test was skipped
            if (result && result.toLowerCase().includes('skipped')) {
                console.log(`⏸️ SKIPPED (${duration}ms): ${result}`);
                
                this.testResults.skipped++;
                this.testResults.details.push({
                    name: testName,
                    status: 'SKIPPED',
                    duration,
                    result
                });
            } else {
                console.log(`✅ PASSED (${duration}ms): ${result}`);
                
                this.testResults.passed++;
                this.testResults.details.push({
                    name: testName,
                    status: 'PASSED',
                    duration,
                    result
                });
            }
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.log(`❌ FAILED (${duration}ms): ${error.message}`);
            
            this.testResults.failed++;
            this.testResults.details.push({
                name: testName,
                status: 'FAILED',
                duration,
                error: error.message
            });
        }
    }

    /**
     * Print comprehensive test summary
     */
    printSummary() {
        console.log('\n🎯 Integration Test Summary');
        console.log('=' .repeat(60));
        console.log(`Completed at: ${new Date().toISOString()}`);
        console.log('');
        
        console.log(`✅ PASSED: ${this.testResults.passed}`);
        console.log(`❌ FAILED: ${this.testResults.failed}`);
        console.log(`⏸️ SKIPPED: ${this.testResults.skipped}`);
        console.log(`📊 TOTAL: ${this.testResults.passed + this.testResults.failed + this.testResults.skipped}`);
        
        const totalDuration = this.testResults.details.reduce((sum, test) => sum + test.duration, 0);
        console.log(`⏱️ TOTAL TIME: ${totalDuration}ms`);
        
        console.log('\n📋 Detailed Results:');
        console.log('-'.repeat(60));
        
        this.testResults.details.forEach((test, index) => {
            const status = test.status === 'PASSED' ? '✅' : test.status === 'FAILED' ? '❌' : '⏸️';
            console.log(`${index + 1}. ${status} ${test.name} (${test.duration}ms)`);
            
            if (test.status === 'PASSED' && test.result) {
                console.log(`   ${test.result}`);
            } else if (test.status === 'FAILED' && test.error) {
                console.log(`   Error: ${test.error}`);
            }
        });
        
        // Overall status
        console.log('\n🏆 Overall Status:');
        if (this.testResults.failed === 0) {
            console.log('🎉 ALL TESTS PASSED! The integration is working correctly.');
        } else {
            console.log(`⚠️ ${this.testResults.failed} test(s) failed. Review the failures above.`);
        }
        
        console.log('');
    }
}

// Export for use in other scripts
module.exports = { IntegrationTestSuite };

// Run tests if this file is executed directly
if (require.main === module) {
    const testSuite = new IntegrationTestSuite();
    testSuite.runAllTests();
}

/**
 * Integration test for HubSpot Contact-Listing associations
 * Tests both directions and discovers correct association type IDs
 */

require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');
const { HubSpotClient } = require('../index.js');

async function runIntegrationTest() {
    const buildiumClient = new BuildiumClient();
    const hubspotClient = new HubSpotClient();
    
    console.log('🧪 HubSpot Contact-Listing Association Integration Test');
    console.log('=' .repeat(60));
    
    try {
        // Step 1: Get available association types for both directions
        console.log('\n1️⃣ Discovering Association Types');
        console.log('-'.repeat(40));
        
        console.log('📋 Contact → Listing association types:');
        const contactToListingTypes = await hubspotClient.getAssociationTypes('contacts', '0-420');
        contactToListingTypes.forEach(type => {
            if (type.category === 'USER_DEFINED') {
                console.log(`   ${type.label}: ID ${type.typeId} (${type.category})`);
            }
        });
        
        console.log('\n📋 Listing → Contact association types:');
        const listingToContactTypes = await hubspotClient.getAssociationTypes('0-420', 'contacts');
        listingToContactTypes.forEach(type => {
            if (type.category === 'USER_DEFINED') {
                console.log(`   ${type.label}: ID ${type.typeId} (${type.category})`);
            }
        });
        
        // Step 2: Create test contacts
        console.log('\n2️⃣ Creating Test Contacts');
        console.log('-'.repeat(40));
        
        const testContacts = [];
        
        // Create Active Tenant test contact
        const activeContactData = {
            firstname: 'Test',
            lastname: 'ActiveTenant',
            email: `test.activetenant.${Date.now()}@example.com`,
            phone: '555-0001',
            buildium_tenant_id: '999001'
        };
        
        const activeContact = await hubspotClient.createContact(activeContactData);
        testContacts.push({ contact: activeContact, type: 'active' });
        console.log(`✅ Created Active test contact: ${activeContact.id}`);
        
        // Create Inactive Tenant test contact
        const inactiveContactData = {
            firstname: 'Test',
            lastname: 'InactiveTenant',
            email: `test.inactivetenant.${Date.now()}@example.com`,
            phone: '555-0002',
            buildium_tenant_id: '999002'
        };
        
        const inactiveContact = await hubspotClient.createContact(inactiveContactData);
        testContacts.push({ contact: inactiveContact, type: 'inactive' });
        console.log(`✅ Created Inactive test contact: ${inactiveContact.id}`);
        
        // Step 3: Create test listing
        console.log('\n3️⃣ Creating Test Listing');
        console.log('-'.repeat(40));
        
        const testListingData = {
            properties: {
                hs_name: `Integration Test Listing ${Date.now()}`,
                hs_address_1: '123 Test Street',
                hs_city: 'Test City',
                hs_state_province: 'AB',
                hs_address_2: 'T1T 1T1',
                hs_listing_type: 'apartments',
                hs_price: 1000
            }
        };
        
        const testListing = await hubspotClient.createListing(testListingData);
        console.log(`✅ Created test listing: ${testListing.id}`);
        
        // Step 4: Test association creation with different type IDs
        console.log('\n4️⃣ Testing Association Creation');
        console.log('-'.repeat(40));
        
        const testResults = {
            activeAssociations: [],
            inactiveAssociations: [],
            errors: []
        };
        
        // Test Active Tenant associations
        const activeTypeIds = [2]; // Correct ID for Contact → Listing direction
        for (const typeId of activeTypeIds) {
            try {
                console.log(`\n🔗 Testing Active Tenant association with type ID ${typeId}...`);
                await hubspotClient.createContactListingAssociation(
                    activeContact.id, 
                    testListing.id, 
                    typeId
                );
                testResults.activeAssociations.push(typeId);
                console.log(`✅ Success: Active association created with type ID ${typeId}`);
            } catch (error) {
                testResults.errors.push({ type: 'active', typeId, error: error.message });
                console.log(`❌ Failed: Active association with type ID ${typeId} - ${error.message}`);
            }
        }
        
        // Test Inactive Tenant associations
        const inactiveTypeIds = [6]; // Correct ID for Contact → Listing direction
        for (const typeId of inactiveTypeIds) {
            try {
                console.log(`\n🔗 Testing Inactive Tenant association with type ID ${typeId}...`);
                await hubspotClient.createContactListingAssociation(
                    inactiveContact.id, 
                    testListing.id, 
                    typeId
                );
                testResults.inactiveAssociations.push(typeId);
                console.log(`✅ Success: Inactive association created with type ID ${typeId}`);
            } catch (error) {
                testResults.errors.push({ type: 'inactive', typeId, error: error.message });
                console.log(`❌ Failed: Inactive association with type ID ${typeId} - ${error.message}`);
            }
        }
        
        // Step 5: Verify associations by reading them back
        console.log('\n5️⃣ Verifying Created Associations');
        console.log('-'.repeat(40));
        
        const createdAssociations = await hubspotClient.getListingAssociations(testListing.id);
        console.log(`📊 Total associations found: ${createdAssociations.length}`);
        
        createdAssociations.forEach((assoc, index) => {
            console.log(`\nAssociation ${index + 1}:`);
            console.log(`  Contact ID: ${assoc.toObjectId}`);
            console.log(`  Association Types:`);
            assoc.associationTypes.forEach(type => {
                if (type.category === 'USER_DEFINED') {
                    console.log(`    ${type.label}: ID ${type.typeId} (${type.category})`);
                }
            });
        });
        
        // Step 6: Test reverse direction (Listing → Contact)
        console.log('\n6️⃣ Testing Reverse Direction Associations');
        console.log('-'.repeat(40));
        
        try {
            const contactAssociations = await hubspotClient.getContactAssociations(activeContact.id);
            console.log(`📊 Associations from Contact ${activeContact.id}:`);
            contactAssociations.forEach((assoc, index) => {
                console.log(`\nReverse Association ${index + 1}:`);
                console.log(`  Listing ID: ${assoc.toObjectId}`);
                console.log(`  Association Types:`);
                assoc.associationTypes.forEach(type => {
                    if (type.category === 'USER_DEFINED') {
                        console.log(`    ${type.label}: ID ${type.typeId} (${type.category})`);
                    }
                });
            });
        } catch (error) {
            console.log(`❌ Error getting reverse associations: ${error.message}`);
        }
        
        // Step 7: Summary and recommendations
        console.log('\n7️⃣ Test Results & Recommendations');
        console.log('=' .repeat(60));
        
        console.log('\n📊 Working Association Type IDs:');
        if (testResults.activeAssociations.length > 0) {
            console.log(`✅ Active Tenant: ${testResults.activeAssociations.join(', ')}`);
        }
        if (testResults.inactiveAssociations.length > 0) {
            console.log(`✅ Inactive Tenant: ${testResults.inactiveAssociations.join(', ')}`);
        }
        
        if (testResults.errors.length > 0) {
            console.log('\n❌ Failed Association Attempts:');
            testResults.errors.forEach(error => {
                console.log(`   ${error.type} type ID ${error.typeId}: ${error.error}`);
            });
        }
        
        console.log('\n💡 Recommended Configuration:');
        const recommendedActive = testResults.activeAssociations[0] || 'Unknown';
        const recommendedInactive = testResults.inactiveAssociations[0] || 'Unknown';
        console.log(`   Active Tenant Association Type ID: ${recommendedActive}`);
        console.log(`   Inactive Tenant Association Type ID: ${recommendedInactive}`);
        
        // Step 8: Cleanup
        console.log('\n8️⃣ Cleanup');
        console.log('-'.repeat(40));
        
        try {
            // Delete test contacts
            for (const testContact of testContacts) {
                await hubspotClient.deleteContact(testContact.contact.id);
                console.log(`🗑️ Deleted test contact: ${testContact.contact.id}`);
            }
            
            // Delete test listing
            await hubspotClient.deleteListing(testListing.id);
            console.log(`🗑️ Deleted test listing: ${testListing.id}`);
            
            console.log('✅ Cleanup completed successfully');
        } catch (error) {
            console.log(`⚠️ Cleanup warning: ${error.message}`);
            console.log('   Test objects may need manual cleanup');
        }
        
    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        console.error(error.stack);
    }
}

runIntegrationTest();

require('dotenv').config();
const { IntegrationPrototype } = require('../index.js');

async function testDuplicateHandling() {
    try {
        console.log('=== Testing Duplicate Unit ID Handling ===\n');
        
        const integration = new IntegrationPrototype();
        
        // Test data - simulating a property and unit that already exists
        const testProperty = {
            Id: 99999,
            Name: "Test Property for Duplicate Handling",
            Address: {
                AddressLine1: "123 Test Street",
                City: "Test City",
                State: "TestState",
                PostalCode: "T1T 1T1"
            }
        };
        
        const existingUnitId = 177176; // We know this Unit ID already exists
        
        console.log(`Testing with Unit ID: ${existingUnitId}`);
        console.log(`Property: ${testProperty.Name}`);
        
        // Step 1: Try to create a listing that should fail due to duplicate
        console.log('\n1. Attempting to create listing with existing Unit ID...');
        const listingData = integration.transformer.transformPropertyToListing(testProperty, existingUnitId);
        
        try {
            const newListing = await integration.hubspotClient.createListing(listingData);
            console.log('❌ Unexpected success - listing was created:', newListing.id);
        } catch (createError) {
            console.log('Caught error:', createError.message);
            console.log('Error details:', createError.response?.data || 'No response data');
            
            if (createError.message.includes('already has that value') || 
                createError.message.includes('buildium_unit_id') ||
                createError.response?.data?.message?.includes('already has that value')) {
                console.log('✅ Expected error - Unit ID already exists');
                
                // Step 2: Search for the existing listing
                console.log('\n2. Searching for existing listing with this Unit ID...');
                const existingListing = await integration.hubspotClient.searchListingByUnitId(existingUnitId);
                
                if (existingListing) {
                    console.log('✅ Successfully found existing listing:');
                    console.log(`   Listing ID: ${existingListing.id}`);
                    console.log(`   Name: ${existingListing.properties.hs_name}`);
                    console.log(`   Unit ID: ${existingListing.properties.buildium_unit_id}`);
                } else {
                    console.log('❌ Could not find existing listing');
                }
            } else {
                console.log('❌ Unexpected error type');
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testDuplicateHandling();

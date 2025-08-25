/**
 * Simple HubSpot Test - Test just the batch creation
 */

const { HubSpotClient } = require('../index.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function testHubSpotOnly() {
    console.log('🟠 TESTING HUBSPOT BATCH API ONLY');
    console.log('='.repeat(50));
    
    try {
        const client = new HubSpotClient();
        
        console.log('🔍 HubSpot Access Token present:', !!process.env.HUBSPOT_ACCESS_TOKEN);
        
        const testListings = [{
            properties: {
                hs_listing_price: '999',
                hs_city: 'Simple Test City',
                buildium_unit_id: `simple-test-${Date.now()}`
            }
        }];
        
        console.log('🚀 Calling createListingsBatch...');
        
        const results = await client.createListingsBatch(testListings);
        
        console.log('✅ Success:', results);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testHubSpotOnly();

/**
 * Test different values for hs_marketable_status
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function testMarketableValues() {
    console.log('Testing different hs_marketable_status values...\n');
    
    const baseURL = process.env.HUBSPOT_BASE_URL;
    const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
    
    try {
        // Get one ticket-handler contact
        const searchResponse = await axios.post(
            `${baseURL}/crm/v3/objects/contacts/search`,
            {
                filterGroups: [{
                    filters: [{
                        propertyName: 'hs_object_source_detail_1',
                        operator: 'EQ',
                        value: 'ticket-handler'
                    }]
                }],
                properties: ['firstname', 'lastname', 'hs_marketable_status'],
                limit: 1
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (searchResponse.data.results.length === 0) {
            console.log('No contacts found');
            return;
        }
        
        const contact = searchResponse.data.results[0];
        const name = `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim();
        
        console.log(`Testing with: ${name}`);
        console.log(`Current status: ${contact.properties.hs_marketable_status}`);
        
        // Test different values
        const testValues = [
            'NON_MARKETABLE',
            'false', 
            false,
            'MARKETABLE',
            'true',
            true
        ];
        
        for (const value of testValues) {
            console.log(`\nTesting value: ${value} (${typeof value})`);
            
            try {
                // Update
                await axios.patch(
                    `${baseURL}/crm/v3/objects/contacts/${contact.id}`,
                    {
                        properties: {
                            hs_marketable_status: value
                        }
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                // Check result immediately
                const checkResponse = await axios.get(
                    `${baseURL}/crm/v3/objects/contacts/${contact.id}?properties=hs_marketable_status`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                const result = checkResponse.data.properties.hs_marketable_status;
                console.log(`  Result: ${result} (${typeof result})`);
                
                // Small delay
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.log(`  ERROR: ${error.response?.data?.message || error.message}`);
            }
        }
        
    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

testMarketableValues();

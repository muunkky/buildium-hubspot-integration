/**
 * Test updating a single contact to debug the marketable status issue
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function testSingleUpdate() {
    console.log('Testing single contact update...\n');
    
    const baseURL = process.env.HUBSPOT_BASE_URL;
    const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
    
    try {
        // First, get one ticket-handler contact
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
                properties: [
                    'firstname', 
                    'lastname', 
                    'email', 
                    'hs_marketable_status'
                ],
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
            console.log('No ticket-handler contacts found');
            return;
        }
        
        const contact = searchResponse.data.results[0];
        const props = contact.properties;
        const name = `${props.firstname || ''} ${props.lastname || ''}`.trim() || props.email;
        
        console.log(`Found contact: ${name}`);
        console.log(`Current marketable status: ${props.hs_marketable_status} (type: ${typeof props.hs_marketable_status})`);
        
        // Test different update formats
        console.log('\nTesting update with string "false"...');
        try {
            const updateResponse1 = await axios.patch(
                `${baseURL}/crm/v3/objects/contacts/${contact.id}`,
                {
                    properties: {
                        hs_marketable_status: "false"  // String false
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('String "false" update successful');
            
            // Check the result
            const checkResponse1 = await axios.get(
                `${baseURL}/crm/v3/objects/contacts/${contact.id}?properties=hs_marketable_status`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log(`Result: ${checkResponse1.data.properties.hs_marketable_status} (type: ${typeof checkResponse1.data.properties.hs_marketable_status})`);
            
        } catch (error) {
            console.error('String "false" update failed:', error.response?.data || error.message);
        }
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('\nTesting update with boolean false...');
        try {
            const updateResponse2 = await axios.patch(
                `${baseURL}/crm/v3/objects/contacts/${contact.id}`,
                {
                    properties: {
                        hs_marketable_status: false  // Boolean false
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Boolean false update successful');
            
            // Check the result
            const checkResponse2 = await axios.get(
                `${baseURL}/crm/v3/objects/contacts/${contact.id}?properties=hs_marketable_status`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log(`Result: ${checkResponse2.data.properties.hs_marketable_status} (type: ${typeof checkResponse2.data.properties.hs_marketable_status})`);
            
        } catch (error) {
            console.error('Boolean false update failed:', error.response?.data || error.message);
        }
        
    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

testSingleUpdate();

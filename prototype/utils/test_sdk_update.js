/**
 * Test updating marketable status using the proper HubSpot SDK pattern
 */

require('dotenv').config({ path: '../.env' });
const hubspot = require('@hubspot/api-client');

async function testWithSDK() {
    console.log('Testing with official HubSpot SDK...\n');
    
    const hubspotClient = new hubspot.Client({ 
        accessToken: process.env.HUBSPOT_ACCESS_TOKEN 
    });
    
    try {
        // First, search for a ticket-handler contact
        const searchRequest = {
            filterGroups: [{
                filters: [{
                    propertyName: 'hs_object_source_detail_1',
                    operator: 'EQ',
                    value: 'ticket-handler'
                }]
            }],
            properties: ['firstname', 'lastname', 'email', 'hs_marketable_status'],
            limit: 1
        };
        
        const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch(searchRequest);
        
        if (searchResponse.results.length === 0) {
            console.log('No ticket-handler contacts found');
            return;
        }
        
        const contact = searchResponse.results[0];
        const props = contact.properties;
        const name = `${props.firstname || ''} ${props.lastname || ''}`.trim() || props.email;
        
        console.log(`Found contact: ${name}`);
        console.log(`Current marketable status: ${props.hs_marketable_status} (type: ${typeof props.hs_marketable_status})`);
        
        // Test update using the SDK basicApi.update method
        console.log('\nTesting update with SDK basicApi.update...');
        
        const updateData = {
            properties: {
                hs_marketable_status: 'false'  // Try string first
            }
        };
        
        const updateResponse = await hubspotClient.crm.contacts.basicApi.update(contact.id, updateData);
        console.log('SDK update successful');
        
        // Check the result immediately
        const checkResponse = await hubspotClient.crm.contacts.basicApi.getById(
            contact.id, 
            ['hs_marketable_status']
        );
        
        console.log(`Result: ${checkResponse.properties.hs_marketable_status} (type: ${typeof checkResponse.properties.hs_marketable_status})`);
        
        // Also try with boolean
        console.log('\nTesting with boolean false...');
        
        const updateData2 = {
            properties: {
                hs_marketable_status: false  // Boolean
            }
        };
        
        const updateResponse2 = await hubspotClient.crm.contacts.basicApi.update(contact.id, updateData2);
        console.log('Boolean update successful');
        
        // Check the result
        const checkResponse2 = await hubspotClient.crm.contacts.basicApi.getById(
            contact.id, 
            ['hs_marketable_status']
        );
        
        console.log(`Result: ${checkResponse2.properties.hs_marketable_status} (type: ${typeof checkResponse2.properties.hs_marketable_status})`);
        
    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response?.data) {
            console.error('Error details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testWithSDK();

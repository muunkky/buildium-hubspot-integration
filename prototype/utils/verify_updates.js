/**
 * Verify if ticket-handler contacts were actually updated to non-marketable
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function verifyUpdates() {
    console.log('Verifying if contacts were actually updated...\n');
    
    const baseURL = process.env.HUBSPOT_BASE_URL;
    const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
    
    try {
        // Search for ticket-handler contacts
        const searchBody = {
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
                'hs_object_source', 
                'hs_object_source_detail_1', 
                'hs_marketable_status'
            ],
            limit: 20
        };
        
        const response = await axios.post(
            `${baseURL}/crm/v3/objects/contacts/search`,
            searchBody,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Sample of ticket-handler contacts:');
        console.log('==================================');
        
        let marketableCount = 0;
        let nonMarketableCount = 0;
        
        response.data.results.forEach((contact, index) => {
            const props = contact.properties;
            const name = `${props.firstname || ''} ${props.lastname || ''}`.trim() || props.email;
            const marketable = props.hs_marketable_status;
            
            console.log(`${index + 1}. ${name} - Marketable: ${marketable}`);
            
            if (marketable === 'true' || marketable === true) {
                marketableCount++;
            } else {
                nonMarketableCount++;
            }
        });
        
        console.log('\nSample Results:');
        console.log(`Marketable: ${marketableCount}`);
        console.log(`Non-marketable: ${nonMarketableCount}`);
        
        if (marketableCount === 0) {
            console.log('\nSUCCESS: All sampled contacts are now non-marketable!');
        } else {
            console.log('\nWARNING: Some contacts are still marketable - updates may not have worked');
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

verifyUpdates();

/**
 * Verify specific contacts that were just updated
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function verifySpecificUpdates() {
    console.log('Checking specific contacts that were just updated...\n');
    
    const baseURL = process.env.HUBSPOT_BASE_URL;
    const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
    
    // These are the contacts we just saw being updated
    const testNames = ['JOHNDIE VICENTE', 'Manal Sleiman', 'Aldrin Alcazar', 'Hassan Umer', 'Sean Perry'];
    
    try {
        for (const name of testNames) {
            const [firstName, lastName] = name.split(' ');
            
            // Search for this specific contact
            const searchBody = {
                filterGroups: [{
                    filters: [
                        {
                            propertyName: 'firstname',
                            operator: 'EQ',
                            value: firstName
                        },
                        {
                            propertyName: 'lastname',
                            operator: 'EQ',
                            value: lastName || ''
                        }
                    ]
                }],
                properties: ['firstname', 'lastname', 'hs_marketable_status', 'hs_object_source_detail_1'],
                limit: 1
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
            
            if (response.data.results.length > 0) {
                const contact = response.data.results[0];
                const props = contact.properties;
                const marketable = props.hs_marketable_status;
                const source = props.hs_object_source_detail_1;
                
                console.log(`${name}: ${marketable} (source: ${source})`);
            } else {
                console.log(`${name}: NOT FOUND`);
            }
            
            // Small delay to be nice to the API
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
    } catch (error) {
        console.error('Verification failed:', error.response?.data || error.message);
    }
}

verifySpecificUpdates();

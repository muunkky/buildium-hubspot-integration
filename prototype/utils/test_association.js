require('dotenv').config();
const axios = require('axios');

async function testAssociation() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        console.log('=== Testing Association Creation ===\n');
        
        // Test creating association with default type first
        const contactId = '149379834702'; // Gladys Vicente
        const listingId = '455042216836';
        
        console.log(`Creating association between Contact ${contactId} and Listing ${listingId}...`);
        
        // Try with a standard association type first
        const associationData = {
            inputs: [{
                from: { id: contactId },
                to: { id: listingId },
                type: {
                    associationCategory: "HUBSPOT_DEFINED", // Try standard type first
                    associationTypeId: 279  // Standard contact to listing association
                }
            }]
        };

        console.log('Attempting with standard association...');
        try {
            const response = await axios.post(
                `${baseURL}/crm/v4/associations/contact/0-420/batch/create`,
                associationData,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('[OK] Standard association created successfully!');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log('[FAIL] Standard association failed:', error.response?.data || error.message);
            
            // Try with USER_DEFINED if standard fails
            console.log('\nTrying with USER_DEFINED association...');
            associationData.inputs[0].type = {
                associationCategory: "USER_DEFINED",
                associationTypeId: 1
            };
            
            try {
                const response2 = await axios.post(
                    `${baseURL}/crm/v4/associations/contact/0-420/batch/create`,
                    associationData,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                console.log('[OK] Custom association created successfully!');
                console.log(JSON.stringify(response2.data, null, 2));
            } catch (error2) {
                console.log('[FAIL] Custom association also failed:', error2.response?.data || error2.message);
            }
        }
        
        // Check what associations exist now
        console.log('\nChecking current associations...');
        try {
            const checkResponse = await axios.get(
                `${baseURL}/crm/v4/objects/0-420/${listingId}/associations/contact`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Current associations:');
            console.log(JSON.stringify(checkResponse.data, null, 2));
        } catch (error) {
            console.log('Error checking associations:', error.response?.data || error.message);
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testAssociation();

require('dotenv').config();
const axios = require('axios');

async function findCorrectAssociation() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        console.log('=== Finding Correct Association Type ===\n');
        
        // Try to get all available association schemas
        console.log('1. Checking association schemas...');
        try {
            const response = await axios.get(
                `${baseURL}/crm/v4/associations/contact/0-420/labels`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Available association labels between contacts and listings:');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log('Error getting association labels:', error.response?.data || error.message);
        }
        
        // Try the v3 associations API instead
        console.log('\n2. Trying v3 associations API...');
        const contactId = '149379834702'; 
        const listingId = '455042216836';
        
        try {
            const response = await axios.put(
                `${baseURL}/crm/v3/objects/contacts/${contactId}/associations/0-420/${listingId}/contact_to_listing`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('[OK] V3 association created successfully!');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log('[FAIL] V3 association failed:', error.response?.data || error.message);
        }
        
        // Try just using the simple object ID without object type
        console.log('\n3. Trying simple association without category...');
        try {
            const associationData = {
                inputs: [{
                    from: { id: contactId },
                    to: { id: listingId },
                    type: {
                        associationTypeId: 279  // Just the ID without category
                    }
                }]
            };
            
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
            console.log('[OK] Simple association created successfully!');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log('[FAIL] Simple association failed:', error.response?.data || error.message);
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

findCorrectAssociation();

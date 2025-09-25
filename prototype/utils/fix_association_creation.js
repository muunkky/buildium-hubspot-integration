require('dotenv').config();
const axios = require('axios');

async function fixAssociationCreation() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        const contactId = '149369317801'; // Manveer Bains
        const listingId = '455038092291'; // The listing
        
        console.log('=== Testing Different Association Creation Methods ===\n');
        
        // Method 1: POST to create individual association
        console.log('1. Trying POST method...');
        try {
            const associationData = [{
                from: { id: contactId },
                to: { id: listingId },
                types: [{
                    associationCategory: "USER_DEFINED",
                    associationTypeId: 1
                }]
            }];
            
            const createResponse = await axios.post(
                `${baseURL}/crm/v4/associations/contacts/0-420/batch/create`,
                { inputs: associationData },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('[OK] POST method successful!');
            console.log('Status:', createResponse.data.status);
            if (createResponse.data.results) {
                console.log('Results:', createResponse.data.results.length, 'associations created');
                createResponse.data.results.forEach((result, index) => {
                    console.log(`  ${index + 1}. From: ${result.from.id} -> To: ${result.to.id}`);
                });
            }
        } catch (error) {
            console.log('[FAIL] POST method failed:', error.response?.data?.message || error.message);
            if (error.response?.data?.details) {
                console.log('Details:', JSON.stringify(error.response.data.details, null, 2));
            }
        }
        
        // Method 2: PUT to the specific association endpoint
        console.log('\n2. Trying PUT to specific endpoint...');
        try {
            const createResponse = await axios.put(
                `${baseURL}/crm/v4/objects/contacts/${contactId}/associations/0-420/${listingId}`,
                [{
                    associationCategory: "USER_DEFINED",
                    associationTypeId: 1
                }],
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('[OK] PUT to specific endpoint successful!');
            console.log('Response:', createResponse.data);
        } catch (error) {
            console.log('[FAIL] PUT to specific endpoint failed:', error.response?.data?.message || error.message);
        }
        
        // Method 3: Check what we actually have in our main index.js
        console.log('\n3. Checking our current implementation...');
        console.log('   Current method uses: POST /crm/v4/associations/contacts/0-420/batch/create');
        console.log('   With inputs array containing from/to/types structure');
        
        // Let's verify the exact structure we're using
        console.log('\n4. Verifying exact API call structure...');
        const exactData = {
            inputs: [{
                from: { id: contactId },
                to: { id: listingId },
                types: [{
                    associationCategory: "USER_DEFINED", 
                    associationTypeId: 1
                }]
            }]
        };
        
        console.log('Request body:', JSON.stringify(exactData, null, 2));
        
        try {
            const response = await axios.post(
                `${baseURL}/crm/v4/associations/contacts/0-420/batch/create`,
                exactData,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('[OK] Exact structure worked!');
            console.log('Response status:', response.status);
            console.log('Response data:', JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log('[FAIL] Exact structure failed:', error.response?.status, error.response?.data?.message || error.message);
            if (error.response?.data) {
                console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
            }
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

fixAssociationCreation();

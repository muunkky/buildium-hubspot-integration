require('dotenv').config();
const axios = require('axios');

async function createCorrectAssociation() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        const contactId = '149369317801'; // Manveer Bains
        const listingId = '455038092291'; // The listing
        
        console.log('=== Creating Correct Active Tenant Association ===\n');
        
        console.log(`Contact ID: ${contactId}`);
        console.log(`Listing ID: ${listingId}`);
        console.log(`Association Type: Active Tenant (Contact → Listing = Type ID 2)`);
        
        const associationData = {
            inputs: [{
                from: { id: contactId },
                to: { id: listingId },
                types: [{
                    associationCategory: "USER_DEFINED",
                    associationTypeId: 2  // ← This was the issue! Should be 2, not 1
                }]
            }]
        };
        
        console.log('\nRequest body:', JSON.stringify(associationData, null, 2));
        
        try {
            const response = await axios.post(
                `${baseURL}/crm/v4/associations/contacts/0-420/batch/create`,
                associationData,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('\n[OK] Association created successfully!');
            console.log('Response status:', response.status);
            console.log('Response data:', JSON.stringify(response.data, null, 2));
            
            // Now verify the association was created
            console.log('\n=== Verifying Association ===');
            
            const verifyResponse = await axios.get(
                `${baseURL}/crm/v4/objects/0-420/${listingId}/associations/contacts`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (verifyResponse.data.results && verifyResponse.data.results.length > 0) {
                console.log(`[OK] Verification successful! Found ${verifyResponse.data.results.length} associations:`);
                verifyResponse.data.results.forEach((assoc, index) => {
                    console.log(`\n  ${index + 1}. Contact ID: ${assoc.toObjectId}`);
                    assoc.associationTypes.forEach(type => {
                        const status = (type.typeId === 1 && type.category === 'USER_DEFINED' && type.label === 'Active Tenant') ? '[OK] ACTIVE TENANT' : '';
                        console.log(`     Category: ${type.category}, ID: ${type.typeId}, Label: ${type.label || 'N/A'} ${status}`);
                    });
                });
            } else {
                console.log('[FAIL] Verification failed - no associations found');
            }
            
        } catch (error) {
            console.log('[FAIL] Association creation failed:', error.response?.status, error.response?.data?.message || error.message);
            if (error.response?.data) {
                console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
            }
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

createCorrectAssociation();

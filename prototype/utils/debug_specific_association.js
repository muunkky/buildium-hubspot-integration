require('dotenv').config();
const axios = require('axios');

async function debugAssociationCreation() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        const contactId = '149369317801'; // Manveer Bains
        const listingId = '455038092291'; // The listing
        
        console.log('=== Debugging Association Creation ===\n');
        
        // Check from contact side - what listings is this contact associated with?
        console.log('1. Checking contact -> listing associations...');
        try {
            const contactAssocResponse = await axios.get(
                `${baseURL}/crm/v4/objects/contacts/${contactId}/associations/0-420`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (contactAssocResponse.data.results && contactAssocResponse.data.results.length > 0) {
                console.log(`[OK] Contact has ${contactAssocResponse.data.results.length} listing associations:`);
                contactAssocResponse.data.results.forEach((assoc, index) => {
                    console.log(`  ${index + 1}. Listing ID: ${assoc.toObjectId}`);
                    assoc.associationTypes.forEach(type => {
                        const status = (type.typeId === 1 && type.category === 'USER_DEFINED') ? '[OK] ACTIVE TENANT' : '';
                        console.log(`     Type: ${type.category}, ID: ${type.typeId}, Label: ${type.label || 'N/A'} ${status}`);
                    });
                });
            } else {
                console.log('[FAIL] Contact has no listing associations');
            }
        } catch (error) {
            console.log('[FAIL] Error checking contact associations:', error.response?.data?.message || error.message);
        }
        
        console.log('\n2. Checking listing -> contact associations...');
        try {
            const listingAssocResponse = await axios.get(
                `${baseURL}/crm/v4/objects/0-420/${listingId}/associations/contacts`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (listingAssocResponse.data.results && listingAssocResponse.data.results.length > 0) {
                console.log(`[OK] Listing has ${listingAssocResponse.data.results.length} contact associations:`);
                listingAssocResponse.data.results.forEach((assoc, index) => {
                    console.log(`  ${index + 1}. Contact ID: ${assoc.toObjectId}`);
                    assoc.associationTypes.forEach(type => {
                        const status = (type.typeId === 1 && type.category === 'USER_DEFINED') ? '[OK] ACTIVE TENANT' : '';
                        console.log(`     Type: ${type.category}, ID: ${type.typeId}, Label: ${type.label || 'N/A'} ${status}`);
                    });
                });
            } else {
                console.log('[FAIL] Listing has no contact associations');
            }
        } catch (error) {
            console.log('[FAIL] Error checking listing associations:', error.response?.data?.message || error.message);
        }
        
        console.log('\n3. Attempting to recreate the association...');
        try {
            const associationData = {
                inputs: [{
                    from: { id: contactId },
                    to: { id: listingId },
                    types: [{
                        associationCategory: "USER_DEFINED",
                        associationTypeId: 1
                    }]
                }]
            };
            
            const createResponse = await axios.put(
                `${baseURL}/crm/v4/associations/contacts/0-420/batch/create`,
                associationData,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('[OK] Association recreated successfully!');
            console.log('Status:', createResponse.data.status);
            if (createResponse.data.results) {
                console.log('Results:', createResponse.data.results.length, 'associations processed');
            }
        } catch (error) {
            console.log('[FAIL] Error recreating association:', error.response?.data?.message || error.message);
            if (error.response?.data?.details) {
                console.log('Details:', error.response.data.details);
            }
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

debugAssociationCreation();

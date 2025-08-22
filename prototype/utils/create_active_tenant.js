require('dotenv').config();
const axios = require('axios');

async function createActiveTenantsAssociation() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        const contactId = '149316252574'; // Eden May Alcazar (just created)
        const listingId = '455042216836';
        
        console.log('=== Creating Active Tenant Association ===\n');
        console.log(`Contact ID: ${contactId}`);
        console.log(`Listing ID: ${listingId}`);
        
        // Create the "Active Tenant" association using the correct type ID
        const associationData = {
            inputs: [{
                from: { id: contactId },
                to: { id: listingId },
                type: {
                    associationCategory: "USER_DEFINED",
                    associationTypeId: 2  // "Active Tenant" association ID
                }
            }]
        };

        console.log('Creating association with data:', JSON.stringify(associationData, null, 2));
        
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
        
        console.log('✅ Association creation response:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Wait a moment for it to propagate
        console.log('\nWaiting for association to propagate...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Now check the associations
        console.log('\n=== Checking Associations ===');
        
        const checkResponse = await axios.get(
            `${baseURL}/crm/v4/objects/0-420/${listingId}/associations/contact`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Current associations for listing:');
        console.log(JSON.stringify(checkResponse.data, null, 2));
        
        // Check the specific association types for each contact
        if (checkResponse.data.results) {
            for (const assoc of checkResponse.data.results) {
                console.log(`\nContact ${assoc.toObjectId} association types:`);
                for (const type of assoc.associationTypes) {
                    console.log(`  - Category: ${type.category}, Type ID: ${type.typeId}, Label: ${type.label || 'N/A'}`);
                }
            }
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

createActiveTenantsAssociation();

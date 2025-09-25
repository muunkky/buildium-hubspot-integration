require('dotenv').config();
const axios = require('axios');

async function testFixedAssociation() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        console.log('=== Testing Fixed Association (ID: 1) ===\n');
        
        // Use existing contact and listing IDs
        const contactId = '149352888239'; // Aldrin Alcazar 
        const listingId = '455042216836';  // 10 Prestwick Bay SE- Unit 4107
        
        console.log(`Contact ID: ${contactId}`);
        console.log(`Listing ID: ${listingId}`);
        
        // Create the "Active Tenant" association using the correct ID (1)
        const associationData = {
            inputs: [{
                from: { id: contactId },
                to: { id: listingId },
                type: {
                    associationCategory: "USER_DEFINED",
                    associationTypeId: 1  // Correct ID from HubSpot
                }
            }]
        };

        console.log('\nCreating association with correct ID (1)...');
        
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
        
        console.log('[OK] Association creation response:');
        console.log(`Status: ${response.status}`);
        console.log(`Data:`, JSON.stringify(response.data, null, 2));
        
        // Wait for propagation
        console.log('\nWaiting 3 seconds for association to propagate...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check the listing with associations
        console.log('\n=== Checking Listing Associations ===');
        
        const listingResponse = await axios.get(
            `${baseURL}/crm/v3/objects/0-420/${listingId}?associations=contact`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Listing with associations:');
        if (listingResponse.data.associations && listingResponse.data.associations.contacts) {
            console.log(`[OK] Found ${listingResponse.data.associations.contacts.results.length} associated contacts:`);
            listingResponse.data.associations.contacts.results.forEach((contact, index) => {
                console.log(`  ${index + 1}. Contact ID: ${contact.id}, Type: ${contact.type}`);
            });
        } else {
            console.log('[FAIL] No associated contacts found');
        }
        
        // Also check via V4 API
        console.log('\n=== V4 API Association Check ===');
        
        const v4Response = await axios.get(
            `${baseURL}/crm/v4/objects/0-420/${listingId}/associations/contact`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('V4 API associations:');
        if (v4Response.data.results && v4Response.data.results.length > 0) {
            v4Response.data.results.forEach((assoc, index) => {
                console.log(`  ${index + 1}. Contact ID: ${assoc.toObjectId}`);
                assoc.associationTypes.forEach((type, typeIndex) => {
                    console.log(`     Type ${typeIndex + 1}: Category: ${type.category}, ID: ${type.typeId}, Label: ${type.label || 'N/A'}`);
                });
            });
        } else {
            console.log('[FAIL] No associations found via V4 API');
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testFixedAssociation();

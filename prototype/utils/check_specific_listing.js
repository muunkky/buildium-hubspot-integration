require('dotenv').config();
const axios = require('axios');

async function checkSpecificListingAssociations() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        const listingId = '455038092291'; // The listing we just associated with
        
        console.log(`=== Checking Listing ${listingId} for Active Tenant Associations ===\n`);
        
        // Get listing details first
        const listingResponse = await axios.get(
            `${baseURL}/crm/v3/objects/0-420/${listingId}?properties=hs_name,buildium_unit_id,hs_address_1`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Listing Details:');
        console.log(`  Name: ${listingResponse.data.properties.hs_name}`);
        console.log(`  Address: ${listingResponse.data.properties.hs_address_1}`);
        console.log(`  Unit ID: ${listingResponse.data.properties.buildium_unit_id}`);
        
        // Check associations
        console.log('\nChecking associations...');
        const assocResponse = await axios.get(
            `${baseURL}/crm/v4/objects/0-420/${listingId}/associations/contact`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (assocResponse.data.results && assocResponse.data.results.length > 0) {
            console.log(`[OK] Found ${assocResponse.data.results.length} associated contacts:`);
            
            for (const assoc of assocResponse.data.results) {
                console.log(`\n  Contact ID: ${assoc.toObjectId}`);
                
                // Get contact details
                try {
                    const contactResponse = await axios.get(
                        `${baseURL}/crm/v3/objects/contacts/${assoc.toObjectId}?properties=firstname,lastname,email`,
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    
                    const contact = contactResponse.data.properties;
                    console.log(`  Name: ${contact.firstname || ''} ${contact.lastname || ''}`.trim());
                    console.log(`  Email: ${contact.email || 'N/A'}`);
                } catch (error) {
                    console.log(`  Name: Could not fetch contact details`);
                }
                
                console.log(`  Association Types:`);
                assoc.associationTypes.forEach((type, index) => {
                    const status = (type.typeId === 1 && type.category === 'USER_DEFINED') ? '[OK] ACTIVE TENANT' : '';
                    console.log(`    ${index + 1}. Category: ${type.category}, ID: ${type.typeId}, Label: ${type.label || 'N/A'} ${status}`);
                });
            }
        } else {
            console.log('[FAIL] No associated contacts found');
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

checkSpecificListingAssociations();

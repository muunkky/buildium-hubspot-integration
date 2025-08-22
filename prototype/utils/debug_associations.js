require('dotenv').config();
const axios = require('axios');

async function debugAssociations() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        console.log('=== Debugging Association Issues ===\n');
        
        // 1. Check available association types between contacts and listings
        console.log('1. Checking available association types...');
        try {
            const assocResponse = await axios.get(
                `${baseURL}/crm/v4/associations/contact/0-420/types`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Available association types:');
            console.log(JSON.stringify(assocResponse.data, null, 2));
        } catch (error) {
            console.log('Error getting association types:', error.response?.data || error.message);
        }
        
        console.log('\n2. Checking Listings object properties...');
        // 2. Check what properties are available for the Listings object
        try {
            const propsResponse = await axios.get(
                `${baseURL}/crm/v3/properties/0-420`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Available properties for Listings:');
            propsResponse.data.results.forEach(prop => {
                if (prop.name.startsWith('hs_')) {
                    console.log(`  ${prop.name}: ${prop.label} (${prop.type})`);
                }
            });
        } catch (error) {
            console.log('Error getting properties:', error.response?.data || error.message);
        }
        
        console.log('\n3. Re-checking our specific listing with all properties...');
        // 3. Get listing with all properties
        try {
            const listingResponse = await axios.get(
                `${baseURL}/crm/v3/objects/0-420/455042216836?properties=hs_name,hs_address_1,hs_city,hs_zip,hs_address_2,hs_bedrooms,hs_bathrooms,hs_price,hs_listing_type`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Full listing details:');
            console.log(JSON.stringify(listingResponse.data, null, 2));
        } catch (error) {
            console.log('Error getting full listing:', error.response?.data || error.message);
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

debugAssociations();

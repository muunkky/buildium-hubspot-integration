require('dotenv').config();
const axios = require('axios');

async function checkAssociations() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        const listingId = '455042216836';
        
        console.log('Checking associations for listing:', listingId);
        
        const response = await axios.get(
            `${baseURL}/crm/v4/objects/0-420/${listingId}/associations/contact`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Associated contacts:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Also check if we can get the listing details to see its properties
        const listingResponse = await axios.get(
            `${baseURL}/crm/v3/objects/0-420/${listingId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('\nListing details:');
        console.log(JSON.stringify(listingResponse.data, null, 2));
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

checkAssociations();

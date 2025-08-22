require('dotenv').config();
const axios = require('axios');

async function verifyActiveTenantsAssociation() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        const listingId = '455042216836';
        
        console.log('=== Verifying Active Tenant Associations ===\n');
        
        // Get the listing with all associated contacts
        console.log('Getting listing with associated contacts...');
        const response = await axios.get(
            `${baseURL}/crm/v3/objects/0-420/${listingId}?associations=contact`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Listing with associated contacts:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Also check associations via V4 API
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
        console.log(JSON.stringify(v4Response.data, null, 2));
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

verifyActiveTenantsAssociation();

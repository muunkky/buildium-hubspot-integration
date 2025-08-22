require('dotenv').config();
const axios = require('axios');

async function getListingsPropertyGroups() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        console.log('=== Getting Listings Property Groups ===\n');
        
        // Get property groups for Listings (object type 0-420)
        const response = await axios.get(
            `${baseURL}/crm/v3/properties/0-420/groups`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Available property groups for Listings:');
        response.data.results.forEach((group, index) => {
            console.log(`${index + 1}. Name: ${group.name}`);
            console.log(`   Label: ${group.label}`);
            console.log(`   Display Order: ${group.displayOrder}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

getListingsPropertyGroups();

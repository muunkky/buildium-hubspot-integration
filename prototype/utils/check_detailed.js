require('dotenv').config();
const axios = require('axios');

async function checkAssociationsDetailed() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        const contactId = '149379834702'; // Gladys Vicente
        const listingId = '455042216836';
        
        console.log('=== Detailed Association Check ===\n');
        
        // Check associations FROM the contact TO listings
        console.log('1. Checking associations FROM contact TO listings...');
        try {
            const response = await axios.get(
                `${baseURL}/crm/v4/objects/contact/${contactId}/associations/0-420`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Contact to Listings associations:');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log('Error checking contact associations:', error.response?.data || error.message);
        }
        
        // Check associations FROM the listing TO contacts  
        console.log('\n2. Checking associations FROM listing TO contacts...');
        try {
            const response = await axios.get(
                `${baseURL}/crm/v4/objects/0-420/${listingId}/associations/contact`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Listing to Contacts associations:');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log('Error checking listing associations:', error.response?.data || error.message);
        }
        
        // Try to get the contact with associated listings
        console.log('\n3. Getting contact with associated listings...');
        try {
            const response = await axios.get(
                `${baseURL}/crm/v3/objects/contacts/${contactId}?associations=0-420`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Contact with associations:');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log('Error getting contact with associations:', error.response?.data || error.message);
        }
        
        // Try to get the listing with associated contacts
        console.log('\n4. Getting listing with associated contacts...');
        try {
            const response = await axios.get(
                `${baseURL}/crm/v3/objects/0-420/${listingId}?associations=contact`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Listing with associations:');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log('Error getting listing with associations:', error.response?.data || error.message);
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

checkAssociationsDetailed();

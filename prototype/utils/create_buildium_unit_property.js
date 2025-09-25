require('dotenv').config();
const axios = require('axios');

async function createBuildiumUnitIdProperty() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        console.log('=== Creating Buildium Unit ID Property ===\n');
        
        // Create the custom property for Listings (object type 0-420)
        const propertyData = {
            name: "buildium_unit_id",
            label: "Buildium Unit ID", 
            type: "number",
            fieldType: "number",
            description: "Unique identifier for the unit from Buildium API",
            groupName: "listing_information", // Correct group name for listings
            options: [],
            hasUniqueValue: true, // This ensures no duplicates!
            hidden: false,
            displayOrder: -1
        };
        
        console.log('Creating custom property with data:');
        console.log(JSON.stringify(propertyData, null, 2));
        
        const response = await axios.post(
            `${baseURL}/crm/v3/properties/0-420`,
            propertyData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('[OK] Successfully created Buildium Unit ID property!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        if (error.response?.status === 409) {
            console.log('️ Property already exists, which is fine!');
            console.log('Error details:', error.response.data);
        } else {
            console.error('[FAIL] Error creating property:', error.response?.data || error.message);
        }
    }
}

createBuildiumUnitIdProperty();

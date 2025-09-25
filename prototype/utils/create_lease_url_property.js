/**
 * Create Buildium Lease URL Property
 */

require('dotenv').config({ path: '../.env' });
const { HubSpotClient } = require('../index.js');
const axios = require('axios');

async function createLeaseUrlProperty() {
    const client = new HubSpotClient();
    
    const property = {
        name: 'buildium_lease_url',
        label: 'Buildium Lease URL',
        type: 'string',
        fieldType: 'text',
        description: 'Direct link to view this lease in Buildium (clickable URL)'
    };

    try {
        console.log('[TOOL] Creating buildium_lease_url property...');
        
        // Check if property already exists
        try {
            const existingResponse = await client.makeRequestWithRetry(() =>
                axios.get(`${client.baseURL}/crm/v3/properties/0-420/${property.name}`, {
                    headers: client.getHeaders()
                })
            );
            
            console.log('[OK] Property buildium_lease_url already exists');
        } catch (error) {
            if (error.response?.status === 404) {
                // Property doesn't exist, create it
                const createData = {
                    name: property.name,
                    label: property.label,
                    type: property.type,
                    fieldType: property.fieldType,
                    groupName: 'listing_information',
                    description: property.description
                };

                const createResponse = await client.makeRequestWithRetry(() =>
                    axios.post(`${client.baseURL}/crm/v3/properties/0-420`, createData, {
                        headers: client.getHeaders()
                    })
                );
                
                console.log('[OK] Created: buildium_lease_url');
            } else {
                throw error;
            }
        }
        
        console.log('[COMPLETE] Buildium lease URL property ready!');
    } catch (error) {
        console.error('[FAIL] Failed to create property:', error.response?.data || error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    createLeaseUrlProperty();
}

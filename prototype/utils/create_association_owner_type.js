const axios = require('axios');
require('dotenv').config();

async function createAssociationOwnerType() {
    try {
        console.log('[TOOL] Creating "Association Owner" association type...');
        
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        // Create association type for Contact → Listing
        const associationData = {
            label: 'Association Owner',
            name: 'association_owner',
            fromObjectTypeId: '0-1', // Contacts
            toObjectTypeId: '0-420'  // Listings
        };
        
        console.log('[ITEM] Creating association type with data:', JSON.stringify(associationData, null, 2));
        
        const response = await axios.post(
            `${baseURL}/crm/v4/associations/0-1/0-420/labels`,
            associationData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('[OK] Association type created successfully!');
        console.log('� Full response:', JSON.stringify(response.data, null, 2));
        
        const typeId = response.data.typeId || response.data.id;
        const label = response.data.label || response.data.name;
        
        console.log(` New Association Type ID: ${typeId}`);
        console.log(`[ITEM] Label: ${label}`);
        console.log(`[RETRY] Category: ${response.data.category}`);
        
        // The reverse association type should be created automatically
        console.log('\n[SEARCH] Checking for reverse association type...');
        
        // Wait a moment for the reverse type to be created
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const reverseResponse = await axios.get(
            `${baseURL}/crm/v4/associations/0-420/0-1/labels`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const reverseType = reverseResponse.data.results.find(
            type => type.label === 'Association Owner'
        );
        
        if (reverseType) {
            console.log(`[OK] Reverse association type found: ID ${reverseType.typeId}`);
            console.log(`[ITEM] Bidirectional mapping: Contact→Listing ID ${response.data.typeId}  Listing→Contact ID ${reverseType.typeId}`);
        } else {
            console.log('[WARN]️ Reverse association type not found yet (may take time to propagate)');
        }
        
        return {
            success: true,
            forwardTypeId: response.data.typeId,
            reverseTypeId: reverseType?.typeId,
            label: response.data.label
        };
        
    } catch (error) {
        if (error.response?.status === 409) {
            console.log('️ Association type "Association Owner" already exists');
            
            // Get existing type
            const existingResponse = await axios.get(
                `${baseURL}/crm/v4/associations/0-1/0-420/labels`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            const existingType = existingResponse.data.results.find(
                type => type.label === 'Association Owner' || type.name === 'association_owner'
            );
            
            if (existingType) {
                console.log(`[OK] Found existing association type: ID ${existingType.typeId}`);
                return {
                    success: true,
                    forwardTypeId: existingType.typeId,
                    label: existingType.label,
                    existed: true
                };
            }
        }
        
        console.error('[FAIL] Error creating association type:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
}

// Run if this file is executed directly
if (require.main === module) {
    createAssociationOwnerType().catch(console.error);
}

module.exports = { createAssociationOwnerType };

require('dotenv').config();
const axios = require('axios');

async function discoverAssociationTypes() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        console.log('=== Discovering Available Association Types ===\n');
        
        // Method 1: Get all association types for contacts -> listings
        console.log('1. Getting association schema for contacts -> listings...');
        try {
            const schemaResponse = await axios.get(
                `${baseURL}/crm/v4/associations/contacts/0-420/labels`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log(`[OK] Found ${schemaResponse.data.results.length} association types:`);
            schemaResponse.data.results.forEach((assocType, index) => {
                console.log(`\n  ${index + 1}. Label: "${assocType.label}"`);
                console.log(`     Type ID: ${assocType.typeId}`);
                console.log(`     Category: ${assocType.category}`);
                if (assocType.label && assocType.label.toLowerCase().includes('tenant')) {
                    console.log(`      THIS LOOKS LIKE OUR ACTIVE TENANT TYPE!`);
                }
            });
        } catch (error) {
            console.log('[FAIL] Error getting association schema:', error.response?.data?.message || error.message);
        }
        
        // Method 2: Try to get association types in reverse direction too
        console.log('\n2. Getting association schema for listings -> contacts...');
        try {
            const reverseSchemaResponse = await axios.get(
                `${baseURL}/crm/v4/associations/0-420/contacts/labels`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log(`[OK] Found ${reverseSchemaResponse.data.results.length} reverse association types:`);
            reverseSchemaResponse.data.results.forEach((assocType, index) => {
                console.log(`\n  ${index + 1}. Label: "${assocType.label}"`);
                console.log(`     Type ID: ${assocType.typeId}`);
                console.log(`     Category: ${assocType.category}`);
                if (assocType.label && assocType.label.toLowerCase().includes('tenant')) {
                    console.log(`      THIS LOOKS LIKE OUR ACTIVE TENANT TYPE!`);
                }
            });
        } catch (error) {
            console.log('[FAIL] Error getting reverse association schema:', error.response?.data?.message || error.message);
        }
        
        // Method 3: Check what association types already exist in the system
        console.log('\n3. Checking existing associations in the system...');
        try {
            // Get a listing that might already have associations
            const listingsResponse = await axios.get(
                `${baseURL}/crm/v3/objects/0-420?limit=5&properties=hs_name`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            for (const listing of listingsResponse.data.results) {
                console.log(`\nChecking listing ${listing.id} (${listing.properties.hs_name})...`);
                try {
                    const assocResponse = await axios.get(
                        `${baseURL}/crm/v4/objects/0-420/${listing.id}/associations/contacts`,
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    
                    if (assocResponse.data.results && assocResponse.data.results.length > 0) {
                        console.log(`  [OK] Found ${assocResponse.data.results.length} associations`);
                        assocResponse.data.results.forEach((assoc, idx) => {
                            console.log(`    ${idx + 1}. Contact: ${assoc.toObjectId}`);
                            assoc.associationTypes.forEach(type => {
                                console.log(`       Category: ${type.category}, ID: ${type.typeId}, Label: ${type.label || 'N/A'}`);
                            });
                        });
                        break; // Found some associations, that's enough
                    } else {
                        console.log(`  No associations found`);
                    }
                } catch (error) {
                    console.log(`  Error checking associations: ${error.response?.data?.message || error.message}`);
                }
            }
        } catch (error) {
            console.log('[FAIL] Error checking existing associations:', error.response?.data?.message || error.message);
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

discoverAssociationTypes();

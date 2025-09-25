/**
 * Direct API test to verify property filtering
 */

require('dotenv').config();
const axios = require('axios');

async function testAPIDirectly() {
    const baseURL = process.env.BUILDIUM_BASE_URL;
    const clientId = process.env.BUILDIUM_CLIENT_ID;
    const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;
    
    console.log('[SEARCH] Testing Buildium API Directly');
    console.log(`Base URL: ${baseURL}`);
    console.log(`Client ID: ${clientId ? 'Set' : 'Missing'}`);
    console.log(`Client Secret: ${clientSecret ? 'Set' : 'Missing'}\n`);
    
    const headers = {
        'x-buildium-client-id': clientId,
        'x-buildium-client-secret': clientSecret,
        'Content-Type': 'application/json'
    };
    
    try {
        // Test 1: No filtering
        console.log('Test 1: All rental owners (limit 10)');
        const response1 = await axios.get(`${baseURL}/rentals/owners`, {
            headers,
            params: { limit: 10 },
            timeout: 30000
        });
        
        console.log(`[OK] Success: ${response1.data.length} owners returned`);
        if (response1.data.length > 0) {
            const owner = response1.data[0];
            console.log(`First owner: ${owner.FirstName} ${owner.LastName} (ID: ${owner.Id})`);
            console.log(`Properties: [${owner.PropertyIds?.join(', ')}]\n`);
        }
        
        // Test 2: With property filter
        console.log('Test 2: Property 140054 filter');
        const response2 = await axios.get(`${baseURL}/rentals/owners`, {
            headers,
            params: { 
                propertyids: [140054],
                limit: 100 
            },
            timeout: 30000
        });
        
        console.log(`[OK] Success: ${response2.data.length} owners returned`);
        
        // Validate the results
        let validCount = 0;
        let invalidCount = 0;
        
        response2.data.forEach((owner, index) => {
            const ownsProperty = owner.PropertyIds && owner.PropertyIds.includes(140054);
            if (ownsProperty) {
                validCount++;
                if (index < 3) { // Show first 3 valid owners
                    console.log(`[OK] Valid: ${owner.FirstName} ${owner.LastName} - Properties: [${owner.PropertyIds.join(', ')}]`);
                }
            } else {
                invalidCount++;
                if (index < 3) { // Show first 3 invalid owners
                    console.log(`[FAIL] Invalid: ${owner.FirstName} ${owner.LastName} - Properties: [${owner.PropertyIds?.join(', ')}]`);
                }
            }
        });
        
        console.log(`\n[STATS] Filter Results:`);
        console.log(`[OK] Owners who own property 140054: ${validCount}`);
        console.log(`[FAIL] Owners who DON'T own property 140054: ${invalidCount}`);
        
        if (invalidCount > 0) {
            console.log(`\n CRITICAL BUG: Buildium API property filter is not working correctly!`);
            console.log(`The API returned ${invalidCount} owners who don't own the specified property.`);
        } else {
            console.log(`\n[OK] Property filtering working correctly!`);
        }
        
    } catch (error) {
        console.error('[FAIL] API Error:', error.response?.data || error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
    }
}

testAPIDirectly();

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function testParameterSerialization() {
    const baseURL = process.env.BUILDIUM_BASE_URL;
    const clientId = process.env.BUILDIUM_CLIENT_ID;
    const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;
    
    console.log('[TEST] Testing Buildium API Parameter Serialization');
    console.log('=' .repeat(60));
    
    const headers = {
        'x-buildium-client-id': clientId,
        'x-buildium-client-secret': clientSecret,
        'Content-Type': 'application/json'
    };
    
    const testPropertyId = 140054;
    
    try {
        console.log('\n[STATS] According to OpenAPI spec:');
        console.log('  - propertyids: array of integers');
        console.log('  - explode: true');
        console.log('  - collectionFormat: "multi"');
        console.log('  - Should serialize as: ?propertyids=140054&propertyids=140055');
        
        // Test 1: Default axios array serialization (BROKEN)
        console.log('\n[STATS] Test 1: Default axios array serialization');
        const response1 = await axios.get(`${baseURL}/rentals/owners`, {
            headers,
            params: { 
                propertyids: [testPropertyId],
                limit: 5 
            },
            timeout: 30000
        });
        console.log(`Result: ${response1.data.length} owners`);
        
        // Test 2: Manual string serialization (WORKS)
        console.log('\n[STATS] Test 2: Manual string serialization');
        const response2 = await axios.get(`${baseURL}/rentals/owners`, {
            headers,
            params: { 
                propertyids: testPropertyId.toString(),
                limit: 5 
            },
            timeout: 30000
        });
        console.log(`Result: ${response2.data.length} owners`);
        
        // Test 3: Axios with explode-style serialization
        console.log('\n[STATS] Test 3: Axios with custom array serialization');
        const response3 = await axios.get(`${baseURL}/rentals/owners`, {
            headers,
            params: { 
                propertyids: [testPropertyId],
                limit: 5 
            },
            paramsSerializer: params => {
                const searchParams = new URLSearchParams();
                Object.keys(params).forEach(key => {
                    if (Array.isArray(params[key])) {
                        // Explode array parameters per OpenAPI spec
                        params[key].forEach(value => {
                            searchParams.append(key, value);
                        });
                    } else {
                        searchParams.append(key, params[key]);
                    }
                });
                return searchParams.toString();
            },
            timeout: 30000
        });
        console.log(`Result: ${response3.data.length} owners`);
        
        // Test 4: Multiple property IDs with proper serialization
        console.log('\n[STATS] Test 4: Multiple property IDs with custom serialization');
        const response4 = await axios.get(`${baseURL}/rentals/owners`, {
            headers,
            params: { 
                propertyids: [testPropertyId, testPropertyId + 1],
                limit: 10 
            },
            paramsSerializer: params => {
                const searchParams = new URLSearchParams();
                Object.keys(params).forEach(key => {
                    if (Array.isArray(params[key])) {
                        params[key].forEach(value => {
                            searchParams.append(key, value);
                        });
                    } else {
                        searchParams.append(key, params[key]);
                    }
                });
                const serialized = searchParams.toString();
                console.log(`    Serialized URL: ${baseURL}/rentals/owners?${serialized}`);
                return serialized;
            },
            timeout: 30000
        });
        console.log(`Result: ${response4.data.length} owners`);
        
        // Validation
        console.log('\n[SEARCH] Validating results...');
        
        if (response2.data.length > 0) {
            const owner = response2.data[0];
            const ownsProperty = owner.PropertyIds && owner.PropertyIds.includes(testPropertyId);
            const displayName = owner.IsCompany ? owner.CompanyName : `${owner.FirstName} ${owner.LastName}`;
            console.log(`[OK] String method owner: ${displayName}`);
            console.log(`   Properties: [${owner.PropertyIds?.join(', ')}]`);
            console.log(`   Owns target property: ${ownsProperty ? 'YES' : 'NO'}`);
        }
        
        if (response3.data.length > 0) {
            const owner = response3.data[0];
            const ownsProperty = owner.PropertyIds && owner.PropertyIds.includes(testPropertyId);
            const displayName = owner.IsCompany ? owner.CompanyName : `${owner.FirstName} ${owner.LastName}`;
            console.log(`[OK] Custom serialization owner: ${displayName}`);
            console.log(`   Properties: [${owner.PropertyIds?.join(', ')}]`);
            console.log(`   Owns target property: ${ownsProperty ? 'YES' : 'NO'}`);
        }
        
        console.log('\n SUMMARY:');
        console.log(`Default array (BROKEN): ${response1.data.length} owners`);
        console.log(`String method (WORKS): ${response2.data.length} owners`);
        console.log(`Custom serialization: ${response3.data.length} owners`);
        console.log(`Multiple IDs: ${response4.data.length} owners`);
        
        // Recommend solution
        if (response3.data.length === response2.data.length && response3.data.length > 0) {
            console.log('\n[OK] SOLUTION: Use custom paramsSerializer for proper array handling');
        } else if (response2.data.length > 0 && response1.data.length !== response2.data.length) {
            console.log('\n[OK] SOLUTION: Convert arrays to strings for single property filtering');
        }
        
    } catch (error) {
        console.error('[FAIL] API Error:', error.response?.data || error.message);
    }
}

testParameterSerialization();

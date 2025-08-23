require('dotenv').config({ path: '../.env' });
const axios = require('axios');
const { BuildiumClient } = require('../index.js');

async function testPropertyFiltering() {
    const baseURL = process.env.BUILDIUM_BASE_URL;
    const clientId = process.env.BUILDIUM_CLIENT_ID;
    const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;
    
    console.log('🧪 Testing Buildium API Property Filtering');
    console.log('=' .repeat(50));
    console.log(`Base URL: ${baseURL}`);
    console.log(`Client ID: ${clientId ? 'Set' : 'Missing'}`);
    console.log(`Client Secret: ${clientSecret ? 'Set' : 'Missing'}`);
    
    const headers = {
        'x-buildium-client-id': clientId,
        'x-buildium-client-secret': clientSecret,
        'Content-Type': 'application/json'
    };
    
    const testPropertyId = 140054;
    
    try {
        // Test 1: All owners (baseline)
        console.log('\n📊 Test 1: All rental owners (baseline)');
        const allOwnersResponse = await axios.get(`${baseURL}/rentals/owners`, {
            headers,
            params: { limit: 100 },
            timeout: 30000
        });
        
        console.log(`Total owners: ${allOwnersResponse.data.length}`);
        
        // Test 2: Property filtering as array
        console.log('\n📊 Test 2: Property filter as array [140054]');
        const filteredResponse1 = await axios.get(`${baseURL}/rentals/owners`, {
            headers,
            params: { 
                propertyids: [testPropertyId],
                limit: 100 
            },
            timeout: 30000
        });
        
        console.log(`Filtered owners (array): ${filteredResponse1.data.length}`);
        
        // Test 3: Property filtering as string
        console.log('\n📊 Test 3: Property filter as string "140054"');
        const filteredResponse2 = await axios.get(`${baseURL}/rentals/owners`, {
            headers,
            params: { 
                propertyids: testPropertyId.toString(),
                limit: 100 
            },
            timeout: 30000
        });
        
        console.log(`Filtered owners (string): ${filteredResponse2.data.length}`);
        
        // Test 4: URL logging to see actual request
        console.log('\n📊 Test 4: Debug URL parameters');
        const testUrl = new URL(`${baseURL}/rentals/owners`);
        testUrl.searchParams.append('propertyids', testPropertyId);
        testUrl.searchParams.append('limit', '100');
        console.log(`Request URL: ${testUrl.toString()}`);
        
        // Test 5: Using our BuildiumClient implementation
        console.log('\n📊 Test 5: Using our BuildiumClient wrapper');
        const buildiumClient = new BuildiumClient();
        const ourResult = await buildiumClient.getRentalOwners({ 
            propertyIds: [testPropertyId],
            limit: 100 
        });
        console.log(`Our implementation result: ${ourResult.length} owners`);
        
        // Validation: Check if returned owners actually own the property
        console.log('\n🔍 Validating first 10 owners from array test:');
        let validOwners = 0;
        let invalidOwners = 0;
        
        filteredResponse1.data.slice(0, 10).forEach((owner, index) => {
            const ownsProperty = owner.PropertyIds && owner.PropertyIds.includes(testPropertyId);
            const displayName = owner.IsCompany ? owner.CompanyName : `${owner.FirstName} ${owner.LastName}`;
            
            if (ownsProperty) {
                validOwners++;
                console.log(`✅ ${index + 1}. ${displayName} - Properties: [${owner.PropertyIds.join(', ')}]`);
            } else {
                invalidOwners++;
                console.log(`❌ ${index + 1}. ${displayName} - Properties: [${owner.PropertyIds?.join(', ') || 'None'}] - INVALID!`);
            }
        });
        
        // Full validation of all returned owners
        console.log('\n🔍 Full validation of all returned owners...');
        validOwners = 0;
        invalidOwners = 0;
        
        filteredResponse1.data.forEach(owner => {
            const ownsProperty = owner.PropertyIds && owner.PropertyIds.includes(testPropertyId);
            if (ownsProperty) {
                validOwners++;
            } else {
                invalidOwners++;
            }
        });
        
        console.log('\n📈 FINAL RESULTS:');
        console.log(`Total owners (no filter): ${allOwnersResponse.data.length}`);
        console.log(`Filtered owners (array): ${filteredResponse1.data.length}`);
        console.log(`Filtered owners (string): ${filteredResponse2.data.length}`);
        console.log(`Our implementation: ${ourResult.length}`);
        console.log(`✅ Valid owners (own property ${testPropertyId}): ${validOwners}`);
        console.log(`❌ Invalid owners (don't own property ${testPropertyId}): ${invalidOwners}`);
        console.log(`🎯 Accuracy: ${validOwners}/${filteredResponse1.data.length} (${((validOwners/filteredResponse1.data.length)*100).toFixed(1)}%)`);
        
        // Compare our implementation with raw API
        if (ourResult.length === filteredResponse1.data.length) {
            console.log('✅ Our implementation matches raw API result');
        } else {
            console.log('❌ Our implementation differs from raw API result');
        }
        
        if (invalidOwners > 0) {
            console.log('\n🚨 CRITICAL BUG CONFIRMED: Property filtering is not working correctly!');
            console.log('The Buildium API is returning owners who do not own the specified property.');
            console.log('This is a data integrity issue that must be fixed before production use.');
            return false;
        } else {
            console.log('\n✅ Property filtering working correctly!');
            return true;
        }
        
    } catch (error) {
        console.error('❌ API Error:', error.response?.data || error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
        return false;
    }
}

testPropertyFiltering();

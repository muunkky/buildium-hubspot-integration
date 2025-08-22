const { BuildiumClient } = require('../index.js');

async function testUnitNumberApproach() {
    console.log('🔍 Testing UnitNumber vs PropertyId Approach');
    console.log('========================================');
    
    try {
        const buildiumClient = new BuildiumClient();
        
        // Test with unit 177184
        const unitId = 177184;
        
        console.log(`1. Getting unit ${unitId} details...`);
        const unit = await buildiumClient.getUnit(unitId);
        const unitNumber = unit.UnitNumber;
        const propertyId = unit.PropertyId;
        
        console.log(`   Unit Number: "${unitNumber}"`);
        console.log(`   Property ID: ${propertyId}`);
        
        // Method 1: Using unitnumber filter
        console.log('\n2. Testing unitnumber filter approach...');
        const startTime1 = Date.now();
        
        const axios = require('axios');
        const response1 = await axios.get(`${buildiumClient.baseURL}/leases`, {
            headers: {
                'x-buildium-client-id': buildiumClient.clientId,
                'x-buildium-client-secret': buildiumClient.clientSecret,
                'Content-Type': 'application/json'
            },
            params: {
                unitnumber: unitNumber,
                limit: 100
            },
            timeout: 30000
        });
        
        const duration1 = Date.now() - startTime1;
        console.log(`   Found ${response1.data.length} leases using unitnumber filter in ${duration1}ms`);
        
        // Log which units these leases are for
        const unitNumberMatches = response1.data.map(lease => ({
            leaseId: lease.Id,
            unitId: lease.UnitId,
            unitNumber: lease.Unit?.UnitNumber || 'Unknown'
        }));
        console.log('   Unit matches:', unitNumberMatches);
        
        // Method 2: Using propertyids filter  
        console.log('\n3. Testing propertyids filter approach...');
        const startTime2 = Date.now();
        
        const response2 = await axios.get(`${buildiumClient.baseURL}/leases`, {
            headers: {
                'x-buildium-client-id': buildiumClient.clientId,
                'x-buildium-client-secret': buildiumClient.clientSecret,
                'Content-Type': 'application/json'
            },
            params: {
                propertyids: [propertyId],
                limit: 100
            },
            timeout: 30000
        });
        
        // Filter for our specific unit
        const unitLeases = response2.data.filter(lease => 
            lease.UnitId === unitId || lease.Unit?.Id === unitId
        );
        
        const duration2 = Date.now() - startTime2;
        console.log(`   Found ${response2.data.length} total leases for property, ${unitLeases.length} for our unit in ${duration2}ms`);
        
        // Compare results
        console.log('\n4. Comparison:');
        console.log(`   UnitNumber approach: ${response1.data.length} leases in ${duration1}ms`);
        console.log(`   PropertyId approach: ${unitLeases.length} leases in ${duration2}ms`);
        
        // Check if results are the same
        const method1LeaseIds = response1.data.map(l => l.Id).sort();
        const method2LeaseIds = unitLeases.map(l => l.Id).sort();
        const sameResults = JSON.stringify(method1LeaseIds) === JSON.stringify(method2LeaseIds);
        
        console.log(`   Same results: ${sameResults}`);
        if (!sameResults) {
            console.log(`   Method 1 lease IDs: [${method1LeaseIds.join(', ')}]`);
            console.log(`   Method 2 lease IDs: [${method2LeaseIds.join(', ')}]`);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testUnitNumberApproach();

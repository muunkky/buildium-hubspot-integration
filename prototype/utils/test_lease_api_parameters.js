/**
 * Test different API parameter formats to find the correct way to filter leases by unit
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function testLeaseAPIParameters() {
    const buildiumClient = {
        baseURL: process.env.BUILDIUM_BASE_URL,
        clientId: process.env.BUILDIUM_CLIENT_ID,
        clientSecret: process.env.BUILDIUM_CLIENT_SECRET
    };
    
    const headers = {
        'x-buildium-client-id': buildiumClient.clientId,
        'x-buildium-client-secret': buildiumClient.clientSecret,
        'Content-Type': 'application/json'
    };
    
    const testUnitId = 177184;
    
    console.log('[TEST] Testing different API parameter formats for leases');
    console.log(`Target Unit ID: ${testUnitId}\n`);
    
    const testCases = [
        { params: { unitids: testUnitId }, description: 'unitids (current)' },
        { params: { unitid: testUnitId }, description: 'unitid (singular)' },
        { params: { UnitIds: testUnitId }, description: 'UnitIds (capitalized)' },
        { params: { UnitId: testUnitId }, description: 'UnitId (singular capitalized)' },
        { params: { unit_ids: testUnitId }, description: 'unit_ids (underscore)' },
        { params: { unit_id: testUnitId }, description: 'unit_id (singular underscore)' }
    ];
    
    for (const testCase of testCases) {
        try {
            console.log(`Testing: ${testCase.description}`);
            
            const response = await axios.get(`${buildiumClient.baseURL}/leases`, {
                headers,
                params: testCase.params
            });
            
            const leases = response.data;
            const unitSpecificLeases = leases.filter(lease => lease.UnitId === testUnitId);
            
            console.log(`  Total leases returned: ${leases.length}`);
            console.log(`  Leases for target unit: ${unitSpecificLeases.length}`);
            
            if (unitSpecificLeases.length === leases.length && leases.length > 0) {
                console.log(`  [OK] SUCCESS: All returned leases are for target unit!`);
            } else if (unitSpecificLeases.length > 0) {
                console.log(`  [WARN]️  PARTIAL: Some leases for target unit, but also others`);
            } else {
                console.log(`  [FAIL] FAILED: No leases for target unit`);
            }
            
            console.log();
            
        } catch (error) {
            console.log(`  [FAIL] ERROR: ${error.response?.status || error.message}`);
            console.log();
        }
    }
    
    // Also test without any unit filter to see the baseline
    console.log('Testing: No unit filter (baseline)');
    try {
        const response = await axios.get(`${buildiumClient.baseURL}/leases`, {
            headers,
            params: { limit: 50 }
        });
        
        const leases = response.data;
        const unitSpecificLeases = leases.filter(lease => lease.UnitId === testUnitId);
        
        console.log(`  Total leases returned: ${leases.length}`);
        console.log(`  Leases for target unit: ${unitSpecificLeases.length}`);
        
        // Show which units are actually represented
        const unitIds = [...new Set(leases.map(lease => lease.UnitId))];
        console.log(`  Unique unit IDs in response: ${unitIds.length}`);
        console.log(`  Sample unit IDs: ${unitIds.slice(0, 10).join(', ')}`);
        
    } catch (error) {
        console.log(`  [FAIL] ERROR: ${error.response?.status || error.message}`);
    }
}

testLeaseAPIParameters();

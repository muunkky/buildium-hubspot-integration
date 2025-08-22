const { BuildiumClient } = require('../index.js');
require('dotenv').config();

async function testGetAllLeases() {
    console.log('🔍 Testing getAllLeases with different limits');
    console.log('=' .repeat(40));
    
    const buildiumClient = new BuildiumClient();
    
    try {
        // Test with small limit first
        console.log('1. Testing getAllLeases with limit 10...');
        const startTime1 = Date.now();
        const smallBatch = await buildiumClient.getAllLeases(10);
        const duration1 = Date.now() - startTime1;
        console.log(`   Retrieved ${smallBatch.length} leases in ${duration1}ms`);
        
        if (smallBatch.length > 0) {
            const lease = smallBatch[0];
            console.log(`   Sample lease: ID ${lease.Id}, UnitId: ${lease.UnitId}, Status: ${lease.LeaseStatus}`);
        }
        
        // Test with medium limit
        console.log('\n2. Testing getAllLeases with limit 50...');
        const startTime2 = Date.now();
        const mediumBatch = await buildiumClient.getAllLeases(50);
        const duration2 = Date.now() - startTime2;
        console.log(`   Retrieved ${mediumBatch.length} leases in ${duration2}ms`);
        
        console.log('\n✅ getAllLeases tests completed successfully');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testGetAllLeases();

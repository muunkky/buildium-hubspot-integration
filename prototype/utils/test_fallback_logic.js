const { BuildiumClient } = require('../index.js');

async function testFallbackLogic() {
    console.log('🧪 Testing Lease Retrieval Fallback Logic');
    console.log('========================================');
    
    try {
        const buildiumClient = new BuildiumClient();
        
        // Get a real unit
        console.log('1. Getting a real unit...');
        const units = await buildiumClient.getAllUnits(1);
        if (units.length === 0) {
            console.log('❌ No units found');
            return;
        }
        
        const unit = units[0];
        console.log(`   Unit: ${unit.Id} (Property: ${unit.PropertyId})`);
        
        // Test 1: Normal operation (should use primary filters)
        console.log('\n2. Testing normal retrieval...');
        const startTime1 = Date.now();
        const normalLeases = await buildiumClient.getAllLeasesForUnit(unit.Id);
        const duration1 = Date.now() - startTime1;
        console.log(`   Retrieved ${normalLeases.length} leases in ${duration1}ms`);
        
        // Test 2: Simulate fallback by temporarily modifying the unit number
        console.log('\n3. Testing fallback scenario...');
        console.log('   (Using the actual getAllLeasesForUnit method with a fake unit to trigger fallback)');
        
        // Temporarily modify the getUnit method to return a fake unit number
        const originalGetUnit = buildiumClient.getUnit;
        buildiumClient.getUnit = async function(unitId) {
            const realUnit = await originalGetUnit.call(this, unitId);
            // Return the same unit but with a fake unit number to trigger fallback
            return {
                ...realUnit,
                UnitNumber: "NONEXISTENT_UNIT_NUMBER_12345"
            };
        };
        
        const startTime2 = Date.now();
        const fallbackLeases = await buildiumClient.getAllLeasesForUnit(unit.Id);
        const duration2 = Date.now() - startTime2;
        console.log(`   Retrieved ${fallbackLeases.length} leases in ${duration2}ms using fallback`);
        
        // Restore original method
        buildiumClient.getUnit = originalGetUnit;
        
        // Compare results
        console.log('\n4. Comparing results...');
        console.log(`   Normal method: ${normalLeases.length} leases`);
        console.log(`   Fallback method: ${fallbackLeases.length} leases`);
        
        if (normalLeases.length === fallbackLeases.length) {
            console.log('✅ Both methods returned the same number of leases - fallback working correctly!');
        } else {
            console.log('⚠️  Different number of leases returned - investigate further');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testFallbackLogic();

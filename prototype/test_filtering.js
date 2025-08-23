const { IntegrationPrototype } = require('./index.js');

async function testPropertyFiltering() {
    try {
        const integration = new IntegrationPrototype();
        
        console.log('🔍 Testing property filtering with known property IDs...');
        
        // Test with property 57543 (we know it has units from previous output)
        console.log('\n📋 Testing with property 57543 (known to have units):');
        const units57543 = await integration.buildiumClient.getAllUnits(10, 0, [57543]);
        console.log(`📊 Found ${units57543.length} units for property 57543`);
        
        if (units57543.length > 0) {
            console.log('🏠 Sample units from property 57543:');
            units57543.slice(0, 3).forEach((unit, i) => {
                console.log(`  ${i+1}. Unit ${unit.UnitNumber} (ID: ${unit.Id}) - Property: ${unit.PropertyId}`);
            });
            
            // Check if all returned units are actually from property 57543
            const correctProperty = units57543.filter(unit => unit.PropertyId === 57543);
            console.log(`✅ Units correctly filtered: ${correctProperty.length}/${units57543.length}`);
        }
        
        // Now test with property 140054
        console.log('\n📋 Testing with property 140054:');
        const units140054 = await integration.buildiumClient.getAllUnits(10, 0, [140054]);
        console.log(`📊 Found ${units140054.length} units for property 140054`);
        
        if (units140054.length > 0) {
            console.log('🏠 Sample units from property 140054:');
            units140054.slice(0, 3).forEach((unit, i) => {
                console.log(`  ${i+1}. Unit ${unit.UnitNumber} (ID: ${unit.Id}) - Property: ${unit.PropertyId}`);
            });
            
            // Check if all returned units are actually from property 140054
            const correctProperty = units140054.filter(unit => unit.PropertyId === 140054);
            console.log(`✅ Units correctly filtered: ${correctProperty.length}/${units140054.length}`);
        } else {
            console.log('⚠️  No units found for property 140054 - property likely has no units');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testPropertyFiltering();

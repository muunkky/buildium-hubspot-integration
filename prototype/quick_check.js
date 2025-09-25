const { IntegrationPrototype } = require('./index.js');

async function quickCheck() {
    try {
        const integration = new IntegrationPrototype();
        
        console.log('[SEARCH] Quick check: Does property 140054 exist and have units?');
        
        // Try to get property 140054
        try {
            const property = await integration.buildiumClient.getProperty(140054);
            console.log(`[OK] Property 140054 exists: ${property.Name}`);
        } catch (error) {
            if (error.response?.status === 404) {
                console.log('[FAIL] Property 140054 does not exist');
                return;
            }
            throw error;
        }
        
        // Try to get units with no filter first (just a few)
        console.log('[SEARCH] Getting first 5 units (no filter)...');
        const allUnits = await integration.buildiumClient.getAllUnits(5, 0);
        console.log(`[STATS] Found ${allUnits.length} units total (sample)`);
        if (allUnits.length > 0) {
            allUnits.forEach((unit, i) => {
                console.log(`  ${i+1}. Unit ${unit.UnitNumber} (ID: ${unit.Id}) - Property: ${unit.PropertyId}`);
            });
        }
        
        // Now try with property filter
        console.log('[SEARCH] Getting units for property 140054...');
        const filteredUnits = await integration.buildiumClient.getAllUnits(50, 0, [140054]);
        console.log(`[STATS] Found ${filteredUnits.length} units for property 140054`);
        if (filteredUnits.length > 0) {
            filteredUnits.slice(0, 3).forEach((unit, i) => {
                console.log(`  ${i+1}. Unit ${unit.UnitNumber} (ID: ${unit.Id}) - Property: ${unit.PropertyId}`);
            });
        } else {
            console.log('[WARN]️  Property 140054 has no units');
        }
        
    } catch (error) {
        console.error('[FAIL] Error:', error.message);
    }
}

quickCheck();

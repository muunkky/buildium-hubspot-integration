const { BuildiumClient } = require('../index.js');

async function debugUnitStructure() {
    console.log('[SEARCH] Debug Unit Data Structure');
    console.log('========================================');
    
    try {
        const buildiumClient = new BuildiumClient();
        
        // Get a unit to inspect its structure
        console.log('1. Getting a unit...');
        const units = await buildiumClient.getAllUnits(1); // Get just 1 unit
        
        if (units.length === 0) {
            console.log('[FAIL] No units found');
            return;
        }
        
        const unit = units[0];
        console.log('2. Unit structure:');
        console.log(JSON.stringify(unit, null, 2));
        
        // Now try to get the unit details directly
        console.log('\n3. Getting unit details directly...');
        const unitDetails = await buildiumClient.getUnit(unit.Id);
        console.log('4. Unit details structure:');
        console.log(JSON.stringify(unitDetails, null, 2));
        
    } catch (error) {
        console.error('[FAIL] Debug failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugUnitStructure();

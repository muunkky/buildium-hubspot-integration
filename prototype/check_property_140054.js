const { IntegrationPrototype } = require('./index.js');

async function checkProperty() {
    try {
        const integration = new IntegrationPrototype();
        
        console.log('🔍 Checking property 140054...');
        const property = await integration.buildiumClient.getProperty(140054);
        console.log('✅ Property found:', property.Name);
        
        console.log('🔍 Checking units for property 140054...');
        const units = await integration.buildiumClient.getAllUnits(50, 0, [140054]);
        console.log('📊 Units found:', units.length);
        if (units.length > 0) {
            console.log('🏠 Sample units:');
            units.slice(0, 3).forEach((unit, i) => {
                console.log(`  ${i+1}. Unit ${unit.UnitNumber} (ID: ${unit.Id}) - Property: ${unit.PropertyId}`);
            });
        } else {
            console.log('⚠️  Property 140054 has no units');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkProperty();

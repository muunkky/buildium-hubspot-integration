/**
 * Simple diagnostic to check property filtering
 */

const { BuildiumClient } = require('../index.js');

async function diagnosePropertyFiltering() {
    console.log('[SEARCH] Diagnosing Property Filtering Issue\n');
    
    const buildium = new BuildiumClient();
    
    try {
        // Test 1: Get all owners (no filter)
        console.log('Test 1: All owners (no filter)');
        const allOwners = await buildium.getRentalOwners();
        console.log(`Result: ${allOwners.length} owners\n`);
        
        // Test 2: Filter by property 140054
        console.log('Test 2: Property 140054 filter');
        const filteredOwners = await buildium.getRentalOwners({ propertyIds: [140054] });
        console.log(`Result: ${filteredOwners.length} owners`);
        
        // Check if any actually own property 140054
        console.log('Checking property ownership...');
        let validOwners = 0;
        let invalidOwners = 0;
        
        filteredOwners.forEach(owner => {
            const ownsProperty = owner.PropertyIds && owner.PropertyIds.includes(140054);
            if (ownsProperty) {
                validOwners++;
            } else {
                invalidOwners++;
                console.log(`[FAIL] Owner ${owner.Id} (${owner.FirstName} ${owner.LastName}) - Properties: [${owner.PropertyIds?.join(', ')}]`);
            }
        });
        
        console.log(`\n[STATS] Results:`);
        console.log(`[OK] Valid owners (own property 140054): ${validOwners}`);
        console.log(`[FAIL] Invalid owners (don't own property 140054): ${invalidOwners}`);
        
        if (invalidOwners > 0) {
            console.log(`\n BUG CONFIRMED: Property filtering is not working!`);
            console.log(`Expected: Only owners of property 140054`);
            console.log(`Actual: ${filteredOwners.length} owners returned, ${invalidOwners} don't own the property`);
        } else {
            console.log(`\n[OK] Property filtering working correctly`);
        }
        
    } catch (error) {
        console.error('[FAIL] Error:', error.message);
    }
}

diagnosePropertyFiltering();

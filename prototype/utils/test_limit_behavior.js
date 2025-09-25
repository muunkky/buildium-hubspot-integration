require('dotenv').config({ path: '../.env' });
const { IntegrationPrototype } = require('../index.js');

/**
 * Test that --limit counts successful syncs, not skipped records
 */
async function testLimitWithSkips() {
    console.log('[TARGET] Testing --limit with Skip Behavior');
    console.log('=' .repeat(60));
    
    const integration = new IntegrationPrototype();
    
    try {
        console.log('\n[STATS] Test: --limit behavior comparison');
        console.log('-'.repeat(50));
        
        console.log('[SEARCH] Without --limit (processes all available):');
        const allResults = await integration.handleOwnersCommand({
            propertyIds: [140054, 57129], // Two properties  
            dryRun: true,
            type: 'rental'
        });
        
        console.log('\n[TARGET] With --limit 2 (stops after 2 successes):');
        const limitedResults = await integration.handleOwnersCommand({
            propertyIds: [140054, 57129], // Same two properties
            limit: 2,
            dryRun: true,
            type: 'rental'
        });
        
        console.log('\n[STATS] Comparison Results:');
        console.log('=' .repeat(30));
        console.log('Without limit:');
        console.log(`  [OK] Success: ${allResults.success}`);
        console.log(`  [RETRY] Enriched: ${allResults.enriched}`);
        console.log(`  [WARN]️ Skipped: ${allResults.skipped}`);
        console.log(`  [STATS] Total: ${allResults.total}`);
        
        console.log('\nWith --limit 2:');
        console.log(`  [OK] Success: ${limitedResults.success}`);
        console.log(`  [RETRY] Enriched: ${limitedResults.enriched}`);
        console.log(`  [WARN]️ Skipped: ${limitedResults.skipped}`);
        console.log(`  [STATS] Total: ${limitedResults.total}`);
        
        console.log('\n Key Insights:');
        console.log(`  • --limit controls successful operations (success + enriched)`);
        console.log(`  • Skipped records don't count against the limit`);
        console.log(`  • System keeps processing until target successes reached`);
        console.log(`  • Similar to units/tenants sync behavior`);
        
        if (limitedResults.success + limitedResults.enriched === 2) {
            console.log('\n[OK] SUCCESS: --limit working correctly!');
            console.log(`   Achieved exactly ${limitedResults.success + limitedResults.enriched} successful operations`);
        } else {
            console.log('\n[WARN]️ NOTICE: Unexpected limit behavior');
        }
        
        console.log('\n[TARGET] Usage Examples:');
        console.log('');
        console.log('# Sync exactly 5 owners successfully:');
        console.log('node index.js owners --sync-all --limit 5');
        console.log('');
        console.log('# Test 3 enrichments (force mode):');
        console.log('node index.js owners --sync-all --limit 3 --force --dry-run');
        console.log('');
        console.log('# Get 10 successes from specific properties:');
        console.log('node index.js owners --property-ids 140054,57129 --limit 10');
        
        return {
            withoutLimit: allResults,
            withLimit: limitedResults
        };
        
    } catch (error) {
        console.error('[FAIL] Test failed:', error.message);
        return null;
    }
}

// Run the test
testLimitWithSkips();

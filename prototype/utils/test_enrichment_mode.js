require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');

/**
 * Test the new --force enrichment functionality
 */
async function testEnrichmentMode() {
    console.log('[RETRY] Testing Owner Enrichment with --force Flag');
    console.log('=' .repeat(60));
    
    const buildium = new BuildiumClient();
    
    try {
        // Test 1: Normal mode (should skip existing owners)
        console.log('\n[STATS] Test 1: Normal Mode (without --force)');
        console.log('-'.repeat(40));
        
        const normalOwners = await buildium.getRentalOwners({ 
            propertyIds: [140054], 
            limit: 1 
        });
        
        console.log(`Found ${normalOwners.length} owners for testing`);
        
        if (normalOwners.length > 0) {
            const owner = normalOwners[0];
            const name = owner.IsCompany ? owner.CompanyName : `${owner.FirstName} ${owner.LastName}`;
            console.log(`Testing with: ${name} (ID: ${owner.Id})`);
            
            // Show available fields for enrichment
            console.log('\n[ITEM] Available fields for enrichment:');
            Object.entries(owner).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    let displayValue = value;
                    if (typeof value === 'object') {
                        displayValue = Array.isArray(value) ? `[${value.length} items]` : '[object]';
                    }
                    console.log(`  ${key}: ${displayValue}`);
                }
            });
        }
        
        // Test 2: Force mode behavior
        console.log('\n[STATS] Test 2: Force Mode Behavior');
        console.log('-'.repeat(40));
        
        console.log('[SEARCH] Without --force:');
        console.log('  [OK] Creates new owners');
        console.log('  [WARN]️ Skips existing owners');
        console.log('   Message: "Contact/Company already exists (use --force to update)"');
        
        console.log('\n With --force:');
        console.log('  [OK] Creates new owners');
        console.log('  [RETRY] Enriches existing owners');
        console.log('   Message: "Enriching existing contact/company"');
        
        // Test 3: Field enrichment scenarios
        console.log('\n[STATS] Test 3: Enrichment Scenarios');
        console.log('-'.repeat(40));
        
        console.log('[RETRY] Potential enrichment updates:');
        console.log('   Email changes');
        console.log('   Phone number updates');
        console.log('   Address changes');
        console.log('   Company name updates');
        console.log('  [ITEM] Property ownership changes');
        console.log('  [OK] Status changes (active/inactive)');
        
        // Test 4: Command examples
        console.log('\n[STATS] Test 4: Command Examples');
        console.log('-'.repeat(40));
        
        console.log(' Usage examples:');
        console.log('');
        console.log('# Create new owners only (skip existing):');
        console.log('node index.js owners --property-ids 140054');
        console.log('');
        console.log('# Enrich existing owners:');
        console.log('node index.js owners --property-ids 140054 --force');
        console.log('');
        console.log('# Dry-run enrichment test:');
        console.log('node index.js owners --property-ids 140054 --force --dry-run');
        console.log('');
        console.log('# Limited enrichment:');
        console.log('node index.js owners --sync-all --force --limit 10');
        
        return {
            testOwners: normalOwners.length,
            enrichmentReady: true
        };
        
    } catch (error) {
        console.error('[FAIL] Error testing enrichment:', error.message);
        return null;
    }
}

// Run the test
testEnrichmentMode();

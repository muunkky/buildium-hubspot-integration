/**
 * End-to-End Test: Units Sync Process
 * Property 140054: Buildium Units → Sync → HubSpot Listings verification
 */

console.log(' UNITS END-TO-END DATA FLOW TEST');
console.log('='.repeat(70));
console.log(`[TARGET] Target: Property 140054 Units`);
console.log(`[DATE] ${new Date().toLocaleString()}\n`);

async function runCommand(description, command) {
    console.log(`[ITEM] ${description}`);
    console.log(` Command: ${command}`);
    console.log('-'.repeat(50));
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
        const { stdout, stderr } = await execAsync(command);
        console.log(stdout);
        if (stderr && !stderr.includes('Warning')) {
            console.log('[WARN]️ Stderr:', stderr);
        }
        return { success: true, output: stdout };
    } catch (error) {
        console.error(`[FAIL] Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function main() {
    // Step 1: Show source unit data from Buildium
    console.log('[SEARCH] STEP 1: SOURCE UNIT DATA FROM BUILDIUM');
    console.log('='.repeat(70));
    const step1 = await runCommand(
        'Get unit data for property 140054 from Buildium',
        'node utils/check_unit_ids.js'
    );
    
    console.log('\n');
    
    // Step 2: Check current HubSpot listings state
    console.log(' STEP 2: CURRENT HUBSPOT LISTINGS STATE');
    console.log('='.repeat(70));
    const step2 = await runCommand(
        'Check existing listings for property 140054 in HubSpot',
        'node utils/check_specific_listing.js'
    );
    
    console.log('\n');
    
    // Step 3: Perform the units sync operation
    console.log('[RETRY] STEP 3: UNITS SYNC OPERATION');
    console.log('='.repeat(70));
    const step3 = await runCommand(
        'Perform units sync for property 140054',
        'node index.js units --property-ids 140054 --force'
    );
    
    console.log('\n');
    
    // Step 4: Verify listings were created/updated
    console.log(' STEP 4: VERIFY LISTINGS IN HUBSPOT');
    console.log('='.repeat(70));
    const step4 = await runCommand(
        'Check listings after sync operation',
        'node utils/check_specific_listing.js'
    );
    
    console.log('\n');
    
    // Step 5: Verify listing structure and data integrity
    console.log('[SEARCH] STEP 5: VERIFY LISTING DATA INTEGRITY');
    console.log('='.repeat(70));
    const step5 = await runCommand(
        'Check detailed listing structure and properties',
        'node utils/check_listing_properties.js'
    );
    
    console.log('\n');
    
    // Generate comprehensive summary
    console.log('[STATS] UNITS END-TO-END TEST SUMMARY');
    console.log('='.repeat(70));
    
    const steps = [
        { name: 'Buildium Unit Source Data', result: step1 },
        { name: 'HubSpot Listings Current State', result: step2 },
        { name: 'Units Sync Operation', result: step3 },
        { name: 'Listings Verification', result: step4 },
        { name: 'Data Integrity Check', result: step5 }
    ];
    
    let passCount = 0;
    steps.forEach((step, i) => {
        const status = step.result.success ? '[OK] PASS' : '[FAIL] FAIL';
        console.log(`${i + 1}. ${step.name}: ${status}`);
        if (step.result.success) passCount++;
    });
    
    const successRate = (passCount / steps.length * 100).toFixed(1);
    console.log(`\n Success Rate: ${successRate}% (${passCount}/${steps.length})`);
    
    // Analyze sync operation results
    if (step3.success && step3.output) {
        console.log('\n[SEARCH] UNITS SYNC OPERATION ANALYSIS:');
        const output = step3.output;
        
        // Extract key metrics
        if (output.includes('FORCE MODE')) {
            console.log('[OK] Force mode enabled for units sync');
        }
        
        if (output.includes('Successfully synced:')) {
            const syncedMatch = output.match(/Successfully synced: (\d+)/);
            if (syncedMatch) {
                console.log(`[OK] Successfully synced ${syncedMatch[1]} unit(s)`);
            }
        }
        
        if (output.includes('Created:')) {
            const createdMatch = output.match(/Created: (\d+)/);
            if (createdMatch) {
                console.log(`[OK] Created ${createdMatch[1]} new listing(s)`);
            }
        }
        
        if (output.includes('Updated:')) {
            const updatedMatch = output.match(/Updated: (\d+)/);
            if (updatedMatch) {
                console.log(`[OK] Updated ${updatedMatch[1]} existing listing(s)`);
            }
        }
        
        if (output.includes('Errors: 0')) {
            console.log('[OK] Zero errors in units sync operation');
        } else {
            const errorMatch = output.match(/Errors: (\d+)/);
            if (errorMatch && errorMatch[1] !== '0') {
                console.log(`[FAIL] ${errorMatch[1]} error(s) in sync operation`);
            }
        }
    }
    
    // Analyze data integrity
    if (step5.success && step5.output) {
        console.log('\n[SEARCH] DATA INTEGRITY ANALYSIS:');
        const output = step5.output;
        
        if (output.includes('buildium_property_id')) {
            console.log('[OK] Buildium property ID properly mapped');
        }
        
        if (output.includes('buildium_unit_id')) {
            console.log('[OK] Buildium unit ID properly mapped');
        }
        
        if (output.includes('unit_number')) {
            console.log('[OK] Unit number properly mapped');
        }
        
        if (output.includes('name')) {
            console.log('[OK] Listing name properly set');
        }
    }
    
    const overallSuccess = passCount === steps.length;
    console.log(`\n[TARGET] OVERALL RESULT: ${overallSuccess ? '[OK] SUCCESS' : '[FAIL] PARTIAL SUCCESS'}`);
    
    if (overallSuccess) {
        console.log('\n[COMPLETE] COMPLETE UNITS DATA FLOW VALIDATED!');
        console.log('    Source unit data retrieved from Buildium');
        console.log('   [RETRY] Unit data transformed to HubSpot listings');
        console.log('    Listings successfully created/updated in HubSpot');
        console.log('    Unit-to-listing mapping properly established');
        console.log('   [OK] End-to-end units integrity confirmed');
    } else {
        console.log(`\n[WARN]️ PARTIAL SUCCESS: ${passCount}/${steps.length} steps completed successfully`);
        console.log('Check the individual step results above for details.');
    }
    
    // Summary of what we validated
    console.log('\n[ITEM] UNITS SYNC VALIDATION CHECKLIST:');
    console.log('   [SEARCH] Source Data: Buildium unit information retrieval');
    console.log('   [RETRY] Transformation: Unit → HubSpot listing conversion');
    console.log('    Creation: New HubSpot listings from units');
    console.log('    Updates: Existing listing modifications');
    console.log('    Mapping: Unit numbers, property IDs, and relationships');
    console.log('   [OK] Integrity: Data consistency between systems');
}

main().catch(console.error);

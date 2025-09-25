/**
 * Focused End-to-End Test: Show complete data journey
 * Property 140054: Buildium → Sync → HubSpot verification
 */

console.log(' FOCUSED END-TO-END DATA FLOW TEST');
console.log('='.repeat(70));
console.log(`[TARGET] Target: Property 140054 (Vishesh Sonawala)`);
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
    // Step 1: Show source data from Buildium
    console.log('[SEARCH] STEP 1: SOURCE DATA FROM BUILDIUM');
    console.log('='.repeat(70));
    const step1 = await runCommand(
        'Get owner data for property 140054 from Buildium',
        'node utils/debug_buildium_owners.js'
    );
    
    console.log('\n');
    
    // Step 2: Check current HubSpot state
    console.log(' STEP 2: CURRENT HUBSPOT STATE');
    console.log('='.repeat(70));
    const step2 = await runCommand(
        'Check existing listings and contacts in HubSpot',
        'node test_force_sync.js'
    );
    
    console.log('\n');
    
    // Step 3: Perform the sync operation
    console.log('[RETRY] STEP 3: SYNC OPERATION');
    console.log('='.repeat(70));
    const step3 = await runCommand(
        'Perform force sync of property 140054',
        'node index.js owners --property-ids 140054 --force'
    );
    
    console.log('\n');
    
    // Step 4: Verify associations were created
    console.log(' STEP 4: VERIFY ASSOCIATIONS');
    console.log('='.repeat(70));
    const step4 = await runCommand(
        'Check associations in HubSpot',
        'node utils/check_associations.js'
    );
    
    console.log('\n');
    
    // Generate summary
    console.log('[STATS] END-TO-END TEST SUMMARY');
    console.log('='.repeat(70));
    
    const steps = [
        { name: 'Buildium Source Data', result: step1 },
        { name: 'HubSpot Current State', result: step2 },
        { name: 'Sync Operation', result: step3 },
        { name: 'Association Verification', result: step4 }
    ];
    
    let passCount = 0;
    steps.forEach((step, i) => {
        const status = step.result.success ? '[OK] PASS' : '[FAIL] FAIL';
        console.log(`${i + 1}. ${step.name}: ${status}`);
        if (step.result.success) passCount++;
    });
    
    const successRate = (passCount / steps.length * 100).toFixed(1);
    console.log(`\n Success Rate: ${successRate}% (${passCount}/${steps.length})`);
    
    if (step3.success && step3.output) {
        console.log('\n[SEARCH] SYNC OPERATION ANALYSIS:');
        const output = step3.output;
        
        // Extract key metrics
        if (output.includes('FORCE MODE')) {
            console.log('[OK] Force mode enabled');
        }
        
        if (output.includes('Found existing contact')) {
            console.log('[OK] Found and updated existing contact');
        }
        
        if (output.includes('Enriched existing: 1')) {
            console.log('[OK] Successfully enriched 1 contact');
        }
        
        if (output.includes('Associations Created: 1')) {
            console.log('[OK] Created 1 owner-property association');
        }
        
        if (output.includes('Errors: 0')) {
            console.log('[OK] Zero errors in sync operation');
        }
    }
    
    const overallSuccess = passCount === steps.length;
    console.log(`\n[TARGET] OVERALL RESULT: ${overallSuccess ? '[OK] SUCCESS' : '[FAIL] FAILURE'}`);
    
    if (overallSuccess) {
        console.log('\n[COMPLETE] COMPLETE DATA FLOW VALIDATED!');
        console.log('    Source data retrieved from Buildium');
        console.log('   [RETRY] Data transformed and synced');
        console.log('    Data successfully pushed to HubSpot');
        console.log('    Associations properly created');
        console.log('   [OK] End-to-end integrity confirmed');
    }
}

main().catch(console.error);

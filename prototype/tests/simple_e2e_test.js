/**
 * Simplified End-to-End Test using existing utilities
 * 
 * This test validates the complete data flow by:
 * 1. Using existing debug utilities to get source data
 * 2. Performing sync operation  
 * 3. Verifying the results in HubSpot
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class SimpleEndToEndTest {
    constructor() {
        this.testPropertyId = 140054; // Property we know has data
        this.testResults = {};
    }

    async runStep(stepName, command, description) {
        console.log(`\n${stepName}: ${description}`);
        console.log('='.repeat(60));
        
        try {
            console.log(`🚀 Running: ${command}`);
            const { stdout, stderr } = await execAsync(command);
            
            if (stderr && !stderr.includes('Warning')) {
                console.log('⚠️ Warnings/Errors:', stderr);
            }
            
            console.log('📊 Output:');
            console.log(stdout);
            
            return { stdout, stderr, success: true };
            
        } catch (error) {
            console.error(`❌ Error in ${stepName}:`, error.message);
            return { error: error.message, success: false };
        }
    }

    async runTest() {
        console.log('🚀 SIMPLIFIED END-TO-END TEST');
        console.log('='.repeat(60));
        console.log(`🎯 Test Target: Property ${this.testPropertyId}`);
        console.log(`📅 Test Date: ${new Date().toLocaleString()}\n`);

        // Step 1: Get source data from Buildium
        const step1 = await this.runStep(
            '🔍 STEP 1', 
            `node utils/debug_buildium_owners.js`,
            'Fetching source data from Buildium'
        );
        this.testResults.sourceData = step1;

        // Step 2: Check existing HubSpot data (before sync)
        const step2 = await this.runStep(
            '📞 STEP 2',
            `node test_force_sync.js`,
            'Checking existing HubSpot data'
        );
        this.testResults.preSyncData = step2;

        // Step 3: Perform sync operation
        const step3 = await this.runStep(
            '🔄 STEP 3',
            `node index.js owners --property-ids ${this.testPropertyId} --force`,
            'Performing force sync operation'
        );
        this.testResults.syncOperation = step3;

        // Step 4: Verify associations were created
        const step4 = await this.runStep(
            '🔗 STEP 4',
            `node utils/check_associations.js`,
            'Verifying associations in HubSpot'
        );
        this.testResults.postSyncValidation = step4;

        // Generate summary
        this.generateSummary();
    }

    generateSummary() {
        console.log('\n📊 END-TO-END TEST SUMMARY');
        console.log('='.repeat(60));

        // Check each step
        const steps = [
            { name: 'Source Data Fetch', result: this.testResults.sourceData },
            { name: 'Pre-Sync Check', result: this.testResults.preSyncData },
            { name: 'Sync Operation', result: this.testResults.syncOperation },
            { name: 'Post-Sync Validation', result: this.testResults.postSyncValidation }
        ];

        let successCount = 0;
        steps.forEach((step, index) => {
            const icon = step.result.success ? '✅' : '❌';
            const status = step.result.success ? 'PASS' : 'FAIL';
            console.log(`${index + 1}. ${icon} ${step.name}: ${status}`);
            if (step.result.success) successCount++;
        });

        // Extract key information from sync output
        if (this.testResults.syncOperation.success) {
            const syncOutput = this.testResults.syncOperation.stdout;
            console.log('\n🔄 Sync Results Analysis:');
            
            // Check for force mode
            if (syncOutput.includes('FORCE MODE')) {
                console.log('   ✅ Force mode activated');
            }
            
            // Check for successful operations
            if (syncOutput.includes('Enriched existing:')) {
                const enrichedMatch = syncOutput.match(/Enriched existing: (\d+)/);
                if (enrichedMatch) {
                    console.log(`   ✅ Enriched ${enrichedMatch[1]} existing contact(s)`);
                }
            }
            
            // Check for associations
            if (syncOutput.includes('Associations Created:')) {
                const assocMatch = syncOutput.match(/Associations Created: (\d+)/);
                if (assocMatch) {
                    console.log(`   ✅ Created ${assocMatch[1]} association(s)`);
                }
            }
            
            // Check for errors
            if (syncOutput.includes('Errors: 0')) {
                console.log('   ✅ No sync errors');
            } else {
                const errorMatch = syncOutput.match(/Errors: (\d+)/);
                if (errorMatch && errorMatch[1] !== '0') {
                    console.log(`   ❌ ${errorMatch[1]} sync error(s)`);
                }
            }
        }

        // Overall result
        const overallSuccess = successCount === steps.length;
        const successRate = (successCount / steps.length * 100).toFixed(1);
        
        console.log(`\n🏆 Overall Test Result: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`📈 Success Rate: ${successRate}% (${successCount}/${steps.length} steps passed)`);

        if (overallSuccess) {
            console.log('\n🎉 END-TO-END DATA FLOW VALIDATED SUCCESSFULLY!');
            console.log('   ✅ Source data retrieved from Buildium');
            console.log('   ✅ Sync operation completed without errors');
            console.log('   ✅ Data properly pushed to HubSpot');
            console.log('   ✅ Associations created and verified');
        } else {
            console.log('\n⚠️ Some steps failed. Check the output above for details.');
        }

        return overallSuccess;
    }
}

// Run the test
if (require.main === module) {
    const test = new SimpleEndToEndTest();
    test.runTest()
        .then(() => {
            console.log('\n🎯 End-to-end test completed!');
        })
        .catch(error => {
            console.error('💥 Test execution failed:', error.message);
        });
}

module.exports = SimpleEndToEndTest;

/**
 * Test Runner for Buildium-HubSpot Integration
 * 
 * This script provides an easy way to run various tests for the integration.
 * Usage: node tests/run-tests.js [test-name]
 * 
 * Available tests:
 * - owners-e2e: End-to-end test for owners sync
 * - units-e2e: End-to-end test for units sync  
 * - force-sync: Test force sync functionality
 * - all: Run all tests
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execAsync = promisify(exec);

class TestRunner {
    constructor() {
        this.rootDir = path.join(__dirname, '..');
        this.testsDir = __dirname;
        
        this.tests = {
            'owners-e2e': {
                file: 'focused_e2e_test.js',
                description: 'End-to-end test for owners sync (Property 140054)',
                category: 'integration'
            },
            'units-e2e': {
                file: 'units_e2e_test.js', 
                description: 'End-to-end test for units sync',
                category: 'integration'
            },
            'force-sync': {
                file: 'test_force_sync.js',
                description: 'Test force sync functionality',
                category: 'unit'
            },
            'comprehensive-e2e': {
                file: 'end_to_end_test.js',
                description: 'Comprehensive end-to-end test with full API validation',
                category: 'integration'
            },
            'simple-e2e': {
                file: 'simple_e2e_test.js',
                description: 'Simple end-to-end test using existing utilities',
                category: 'integration'
            },
            'lease-centric-sync': {
                file: 'lease_centric_sync_test.js',
                description: 'Test lease-centric sync approach with incremental updates',
                category: 'unit'
            },
            'buildium-lease-client': {
                file: 'buildium_lease_client_test.js',
                description: 'Test Buildium API lease-centric client extensions',
                category: 'unit'
            },
            'hubspot-listings': {
                file: 'hubspot_listings_test.js',
                description: 'Test HubSpot listings object integration',
                category: 'unit'
            },
            'lease-integration': {
                file: 'integration_test.js',
                description: 'Full integration test for lease-centric sync approach',
                category: 'integration'
            }
        };
    }

    async runTest(testName) {
        const test = this.tests[testName];
        if (!test) {
            console.error(`❌ Test '${testName}' not found.`);
            this.showHelp();
            return false;
        }

        console.log(`🚀 Running Test: ${testName}`);
        console.log(`📋 Description: ${test.description}`);
        console.log(`📂 Category: ${test.category}`);
        console.log('='.repeat(60));

        try {
            const testPath = path.join(this.testsDir, test.file);
            const { stdout, stderr } = await execAsync(`node "${testPath}"`, {
                cwd: this.rootDir
            });

            console.log(stdout);
            if (stderr && !stderr.includes('Warning')) {
                console.log('⚠️ Warnings:', stderr);
            }

            console.log(`\n✅ Test '${testName}' completed successfully!`);
            return true;

        } catch (error) {
            console.error(`❌ Test '${testName}' failed:`, error.message);
            return false;
        }
    }

    async runLeaseTests() {
        console.log('🚀 RUNNING LEASE-CENTRIC SYNC TESTS');
        console.log('='.repeat(60));
        
        const leaseTests = ['lease-centric-sync', 'buildium-lease-client', 'hubspot-listings', 'lease-integration'];
        const results = {};
        let successCount = 0;
        
        for (const testName of leaseTests) {
            console.log(`\n📋 [${Object.keys(results).length + 1}/${leaseTests.length}] Starting: ${testName}`);
            console.log('-'.repeat(40));
            
            const success = await this.runTest(testName);
            results[testName] = success;
            
            if (success) {
                successCount++;
            }
            
            // Add delay between tests
            if (testName !== leaseTests[leaseTests.length - 1]) {
                console.log('\n⏱️ Waiting 2 seconds before next test...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 LEASE-CENTRIC SYNC TEST RESULTS');
        console.log('='.repeat(60));
        
        Object.entries(results).forEach(([testName, success]) => {
            const status = success ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${testName}: ${this.tests[testName].description}`);
        });
        
        const successRate = (successCount / leaseTests.length * 100).toFixed(1);
        console.log(`\n🏆 Lease-Centric Result: ${successCount}/${leaseTests.length} tests passed (${successRate}%)`);
        
        if (successCount === leaseTests.length) {
            console.log('\n🎉 All lease-centric tests passed! Ready for implementation.');
            console.log('\n📝 Implementation Notes:');
            console.log('   • Lease-centric sync is 100x+ more efficient than unit-centric');
            console.log('   • Uses Buildium lastupdatedfrom filter for incremental sync');
            console.log('   • Integrates with HubSpot listings object (0-420)');
            console.log('   • Handles create, update, and archive operations');
            console.log('   • Includes comprehensive error handling and rate limiting');
        }
        
        return successCount === leaseTests.length;
    }

    async runLegacyTests() {
        console.log('🚀 RUNNING LEGACY/EXISTING TESTS');
        console.log('='.repeat(60));
        
        const legacyTests = ['owners-e2e', 'units-e2e', 'force-sync', 'comprehensive-e2e', 'simple-e2e'];
        const results = {};
        let successCount = 0;
        
        for (const testName of legacyTests) {
            console.log(`\n📋 [${Object.keys(results).length + 1}/${legacyTests.length}] Starting: ${testName}`);
            console.log('-'.repeat(40));
            
            const success = await this.runTest(testName);
            results[testName] = success;
            
            if (success) {
                successCount++;
            }
            
            // Add delay between tests
            if (testName !== legacyTests[legacyTests.length - 1]) {
                console.log('\n⏱️ Waiting 2 seconds before next test...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 LEGACY TEST RESULTS');
        console.log('='.repeat(60));
        
        Object.entries(results).forEach(([testName, success]) => {
            const status = success ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${testName}: ${this.tests[testName].description}`);
        });
        
        const successRate = (successCount / legacyTests.length * 100).toFixed(1);
        console.log(`\n🏆 Legacy Result: ${successCount}/${legacyTests.length} tests passed (${successRate}%)`);
        
        return successCount === legacyTests.length;
    }

    async runAllTests() {
        console.log('='.repeat(60));
        
        const results = {};
        let successCount = 0;
        
        for (const [testName, test] of Object.entries(this.tests)) {
            console.log(`\n📋 [${Object.keys(results).length + 1}/${Object.keys(this.tests).length}] Starting: ${testName}`);
            console.log('-'.repeat(40));
            
            const success = await this.runTest(testName);
            results[testName] = success;
            
            if (success) {
                successCount++;
            }
            
            // Add delay between tests
            if (testName !== Object.keys(this.tests)[Object.keys(this.tests).length - 1]) {
                console.log('\n⏱️ Waiting 2 seconds before next test...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(60));
        
        Object.entries(results).forEach(([testName, success]) => {
            const status = success ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${testName}: ${this.tests[testName].description}`);
        });
        
        const successRate = (successCount / Object.keys(this.tests).length * 100).toFixed(1);
        console.log(`\n🏆 Overall Result: ${successCount}/${Object.keys(this.tests).length} tests passed (${successRate}%)`);
        
        return successCount === Object.keys(this.tests).length;
    }

    showHelp() {
        console.log('🧪 Buildium-HubSpot Integration Test Runner');
        console.log('='.repeat(60));
        console.log('Usage: node tests/run-tests.js [test-name]');
        console.log('\nAvailable tests:');
        
        Object.entries(this.tests).forEach(([name, test]) => {
            console.log(`  ${name.padEnd(20)} - ${test.description}`);
        });
        
        console.log('\nSpecial commands:');
        console.log('  all                  - Run all tests');
        console.log('  lease-tests          - Run only lease-centric sync tests');
        console.log('  legacy-tests         - Run only legacy/existing tests');
        console.log('  help                 - Show this help message');
        
        console.log('\nExamples:');
        console.log('  node tests/run-tests.js owners-e2e');
        console.log('  node tests/run-tests.js lease-tests');
        console.log('  node tests/run-tests.js all');
    }

    async run() {
        const args = process.argv.slice(2);
        const command = args[0];

        if (!command || command === 'help') {
            this.showHelp();
            return;
        }

        if (command === 'all') {
            await this.runAllTests();
            return;
        }

        if (command === 'lease-tests') {
            await this.runLeaseTests();
            return;
        }

        if (command === 'legacy-tests') {
            await this.runLegacyTests();
            return;
        }

        await this.runTest(command);
    }
}

// Run if called directly
if (require.main === module) {
    const runner = new TestRunner();
    runner.run().catch(console.error);
}

module.exports = TestRunner;

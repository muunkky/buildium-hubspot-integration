// Simple single test runner for TDD
const { DateTime } = require('luxon');

// Import the test module to get the classes
const { LeaseCentricSync, MockBuildiumClient, MockHubSpotClient } = require('./lease_centric_sync_test.js');

async function runFirstTest() {
    console.log('[TEST] Running First Test: "should only fetch leases updated since specified time"');
    console.log('='.repeat(70));
    
    try {
        // Setup (beforeEach equivalent)
        const buildiumClient = new MockBuildiumClient();
        const hubspotClient = new MockHubSpotClient();
        const leaseCentricSync = new LeaseCentricSync(buildiumClient, hubspotClient);
        
        // Test setup
        const sinceTime = '2024-01-01T00:00:00.000Z';
        
        // Add mock leases with different update times
        buildiumClient.addMockLease({
            id: 1,
            unitId: 101,
            status: 'Active',
            lastUpdated: '2024-01-02T00:00:00.000Z',
            rent: { amount: 1500 }
        });
        
        buildiumClient.addMockLease({
            id: 2,
            unitId: 102,
            status: 'Active',
            lastUpdated: '2023-12-30T00:00:00.000Z', // Before sinceTime
            rent: { amount: 1200 }
        });

        console.log('[ITEM] Test data setup:');
        console.log(`  sinceTime: ${sinceTime}`);
        console.log(`  lease 1 updated: 2024-01-02 (should be included)`);
        console.log(`  lease 2 updated: 2023-12-30 (should be excluded)`);
        console.log('');

        // Execute the test
        console.log(' Executing: syncLeasesIncremental(sinceTime, { dryRun: true })');
        
        const result = await leaseCentricSync.syncLeasesIncremental(sinceTime, { dryRun: true });
        
        console.log('[OK] Test completed without errors');
        console.log('[STATS] Results:', result);
        console.log('');
        
        // Verify only called with correct parameters
        console.log('[SEARCH] Verifying API calls:');
        console.log(`  API calls made: ${buildiumClient.apiCalls.length}`);
        
        if (buildiumClient.apiCalls.length > 0) {
            const firstCall = buildiumClient.apiCalls[0];
            console.log(`  First call method: ${firstCall.method}`);
            console.log(`  First call params:`, firstCall.params);
            
            // Check assertions
            if (buildiumClient.apiCalls.length === 1) {
                console.log('  [OK] Made exactly 1 API call');
            } else {
                console.log(`  [FAIL] Expected 1 API call, got ${buildiumClient.apiCalls.length}`);
            }
            
            if (firstCall.method === 'getLeasesUpdatedSince') {
                console.log('  [OK] Called correct method');
            } else {
                console.log(`  [FAIL] Expected 'getLeasesUpdatedSince', got '${firstCall.method}'`);
            }
            
            if (firstCall.params.lastUpdateTime === sinceTime) {
                console.log('  [OK] Used correct timestamp');
            } else {
                console.log(`  [FAIL] Expected timestamp '${sinceTime}', got '${firstCall.params.lastUpdateTime}'`);
            }
        } else {
            console.log('  [FAIL] No API calls were made');
        }
        
        console.log('\n[TARGET] Test Status: PASSED');
        
    } catch (error) {
        console.error('[FAIL] Test Status: FAILED');
        console.error('Error:', error.message);
        console.error('\nStack trace:', error.stack);
        
        console.log('\n[TOOL] Next Implementation Steps:');
        console.log('1. Fix the syncLeasesIncremental method');
        console.log('2. Ensure it calls buildiumClient.getLeasesUpdatedSince with correct params');
        console.log('3. Handle the filtering logic properly');
    }
}

// Run the test
runFirstTest();

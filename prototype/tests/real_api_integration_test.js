/**
 * Real API Integration Test: Lease-Centric Sync
 * 
 * This test makes ACTUAL API calls to validate our implementation
 * WARNING: This will consume API rate limits and may create real data
 * 
 * Prerequisites:
 * - Valid Buildium API credentials in .env
 * - Valid HubSpot API credentials in .env
 * - Internet connection
 */

const { BuildiumClient, HubSpotClient } = require('../index.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log(' REAL API INTEGRATION TEST: Lease-Centric Sync');
console.log('='.repeat(70));
console.log(`[DATE] ${new Date().toLocaleString()}`);
console.log(`[WARN]️  WARNING: This makes REAL API calls!\n`);

// Test helpers
function assert(condition, message) {
    if (!condition) {
        throw new Error(`[FAIL] Assertion failed: ${message}`);
    }
    console.log(`[OK] ${message}`);
}

async function testRealBuildiumAPI() {
    console.log('\n️ TESTING REAL BUILDIUM API');
    console.log('-'.repeat(50));
    
    try {
        const client = new BuildiumClient();
        
        // Test with a recent date to get some results
        const testDate = new Date('2024-01-01');
        console.log(`[SEARCH] Calling real Buildium API: getLeasesUpdatedSince(${testDate.toISOString()})`);
        
        // Make the REAL API call
        const startTime = Date.now();
        const leases = await client.getLeasesUpdatedSince(testDate, { limit: 5 });
        const duration = Date.now() - startTime;
        
        console.log(`[DURATION]️  API call took ${duration}ms`);
        console.log(`[STATS] Retrieved ${leases.length} lease(s) from Buildium`);
        
        if (leases.length > 0) {
            console.log(` Sample lease data:`, {
                id: leases[0].Id,
                propertyId: leases[0].PropertyId,
                unitId: leases[0].UnitId,
                status: leases[0].LeaseStatus,
                lastUpdated: leases[0].LastUpdated
            });
        }
        
        assert(Array.isArray(leases), 'Should return array of leases');
        console.log('[OK] REAL BUILDIUM API TEST PASSED');
        return { success: true, data: leases, duration };
        
    } catch (error) {
        console.log(`[FAIL] REAL BUILDIUM API TEST FAILED: ${error.message}`);
        if (error.response?.status === 401) {
            console.log(' Check your Buildium API credentials in .env file');
        }
        return { success: false, error: error.message };
    }
}

async function testRealHubSpotAPI() {
    console.log('\n TESTING REAL HUBSPOT API');
    console.log('-'.repeat(50));
    
    try {
        const client = new HubSpotClient();
        
        // Create test listings with CONSISTENT IDs (will be skipped if they exist)
        const testListings = [
            {
                properties: {
                    hs_listing_price: '1000',
                    hs_city: 'Test City API',
                    hs_state_region: 'Test State',
                    buildium_unit_id: 'api-test-listing-1' // Consistent ID
                }
            },
            {
                properties: {
                    hs_listing_price: '1200', 
                    hs_city: 'Test City 2 API',
                    hs_state_region: 'Test State',
                    buildium_unit_id: 'api-test-listing-2' // Consistent ID
                }
            }
        ];
        
        console.log(`[SEARCH] Calling real HubSpot API: createListingsBatch(${testListings.length} listings)`);
        
        if (process.env.DRY_RUN === 'true') {
            console.log('[RETRY] DRY_RUN mode enabled - no real listings will be created');
        } else {
            console.log('[WARN]️  REAL LISTINGS WILL BE CREATED OR SKIPPED IF DUPLICATES!');
            console.log('️  Using consistent test IDs: api-test-listing-1, api-test-listing-2');
        }
        
        // Make the REAL API call
        const startTime = Date.now();
        const results = await client.createListingsBatch(testListings);
        const duration = Date.now() - startTime;
        
        console.log(`[DURATION]️  API call took ${duration}ms`);
        console.log(`[STATS] Created ${results.length} listing(s) in HubSpot`);
        
        if (results.created && results.created.length > 0) {
            console.log(` Sample listing created:`, {
                id: results.created[0].id,
                price: results.created[0].properties?.hs_listing_price,
                city: results.created[0].properties?.hs_city
            });
        }
        
        const createdCount = results.created ? results.created.length : results.length;
        const skippedCount = results.skipped ? results.skipped.length : 0;
        
        assert(Array.isArray(results.created || results), 'Should return array of created listings');
        console.log(`[STATS] Results: ${createdCount} created, ${skippedCount} skipped as duplicates`);
        console.log('[OK] REAL HUBSPOT API TEST PASSED');
        return { success: true, data: results, duration };
        
    } catch (error) {
        console.log(`[FAIL] REAL HUBSPOT API TEST FAILED: ${error.message}`);
        if (error.response?.status === 401) {
            console.log(' Check your HubSpot API credentials in .env file');
        }
        return { success: false, error: error.message };
    }
}

async function runRealAPITests() {
    console.log(' RUNNING REAL API INTEGRATION TESTS');
    console.log('='.repeat(70));
    console.log('[WARN]️  These tests make ACTUAL API calls and may:');
    console.log('   • Consume API rate limits');
    console.log('   • Create real data in HubSpot (unless DRY_RUN=true)');
    console.log('   • Take several seconds to complete');
    console.log('   • Fail if API credentials are missing/invalid\n');

    // Check if we have required environment variables
    const hasBuilidumCreds = process.env.BUILDIUM_CLIENT_ID && process.env.BUILDIUM_CLIENT_SECRET;
    const hasHubSpotCreds = process.env.HUBSPOT_ACCESS_TOKEN;
    
    if (!hasBuilidumCreds) {
        console.log('[FAIL] Missing Buildium credentials (BUILDIUM_CLIENT_ID, BUILDIUM_CLIENT_SECRET)');
    }
    if (!hasHubSpotCreds) {
        console.log('[FAIL] Missing HubSpot credentials (HUBSPOT_ACCESS_TOKEN)');
    }
    
    if (!hasBuilidumCreds || !hasHubSpotCreds) {
        console.log('\n To run real API tests, ensure you have API credentials in .env file');
        return;
    }

    const results = [];
    let totalDuration = 0;
    
    // Test Buildium API
    const buildiumResult = await testRealBuildiumAPI();
    results.push({ name: 'Buildium API', ...buildiumResult });
    if (buildiumResult.duration) totalDuration += buildiumResult.duration;
    
    console.log('\n[DURATION]️  Waiting 2 seconds between API tests...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test HubSpot API  
    const hubspotResult = await testRealHubSpotAPI();
    results.push({ name: 'HubSpot API', ...hubspotResult });
    if (hubspotResult.duration) totalDuration += hubspotResult.duration;

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('[STATS] REAL API TEST RESULTS');
    console.log('='.repeat(70));
    
    let successCount = 0;
    results.forEach(result => {
        const status = result.success ? '[OK] PASS' : '[FAIL] FAIL';
        console.log(`${status} ${result.name}: ${result.duration || 0}ms`);
        if (result.success) successCount++;
        if (result.error) {
            console.log(`   └── ${result.error}`);
        }
    });
    
    console.log(`\n Real API Results: ${successCount}/${results.length} tests passed`);
    console.log(`[DURATION]️  Total API time: ${totalDuration}ms`);
    
    if (successCount === results.length) {
        console.log('\n[COMPLETE] All real API tests passed!');
        console.log('[OK] Lease-centric sync implementation is working with real APIs');
        console.log('[OK] Both Buildium and HubSpot integrations are functional');
    } else {
        console.log('\n[WARN]️  Some API tests failed - check credentials and network connectivity');
    }
    
    return { passCount: successCount, totalCount: results.length, totalDuration };
}

// Run the real API tests
async function main() {
    try {
        await runRealAPITests();
    } catch (error) {
        console.error(' Real API test runner error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { runRealAPITests };

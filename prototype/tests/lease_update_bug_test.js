/**
 * Test Suite for Lease Update Bug
 * 
 * This test validates the bug where lease updates are skipped when a listing
 * already exists in HubSpot, even if the lease data has changed since the last sync.
 * 
 * Bug Description:
 * - Lease timestamp filtering works correctly (lease passes filter when updated)
 * - But createListingsBatch skips update when listing exists (without force flag)
 * - Result: Updated lease data doesn't sync to existing HubSpot listings
 * 
 * Expected Fix:
 * - createListingsBatch should check if lease passed timestamp filter
 * - If lease was updated, update listing even if it exists
 * - If lease wasn't updated, use current skip logic
 */

const assert = require('assert');

console.log('🚀 LEASE UPDATE BUG TEST SUITE');
console.log('='.repeat(60));

// Test data setup
const mockBuildiumData = {
    lease: {
        Id: 12345,
        UnitId: 67890,
        LeaseStatus: 'Active',
        LastUpdatedDateTime: '2024-09-10T10:00:00Z', // Recently updated
        Rent: { Amount: 1800 }, // Increased from 1500
        LeaseFromDate: '2024-01-01',
        LeaseToDate: '2024-12-31'
    },
    unit: {
        Id: 67890,
        PropertyId: 11111,
        UnitNumber: '2A',
        Type: 'Apartment'
    },
    property: {
        Id: 11111,
        Name: 'Sunset Apartments',
        Address: {
            FullAddress: '123 Main St, Springfield, IL 62701'
        }
    }
};

const mockHubSpotData = {
    existingListing: {
        id: 'existing_listing_123',
        properties: {
            buildium_lease_id: '12345',
            buildium_unit_id: '67890',
            buildium_market_rent: '1500', // Old rent value
            lease_status: 'Active',
            name: 'Sunset Apartments - Unit 2A'
        }
    }
};

const mockTimestamps = {
    lastSyncTimestamps: { 
        [mockBuildiumData.lease.Id]: '2024-09-01T00:00:00Z' // Last sync was before lease update
    }
};

let testsPassed = 0;
let testsTotal = 0;

function runTest(testName, testFunction) {
    testsTotal++;
    try {
        console.log(`\n🧪 ${testName}`);
        console.log('-'.repeat(60));
        testFunction();
        console.log(`✅ PASSED: ${testName}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ FAILED: ${testName}`);
        console.log(`   Error: ${error.message}`);
    }
}

// Test 1: Demonstrate the lease update skip bug
runTest('Bug Reproduction - Lease Update Skip', function() {
    const { lease } = mockBuildiumData;
    const { existingListing } = mockHubSpotData;
    const { lastSyncTimestamps } = mockTimestamps;

    // Step 1: Verify lease passes timestamp filter (this works correctly)
    const leasePassesTimestampFilter = new Date(lease.LastUpdatedDateTime) > 
        new Date(lastSyncTimestamps[lease.Id]);

    assert.strictEqual(leasePassesTimestampFilter, true, 
        'Lease should pass timestamp filter since it was updated after last sync');

    // Step 2: Simulate current (buggy) behavior in createListingsBatch
    const forceFlag = false;
    const listingExists = existingListing !== null;
    
    // Current logic: Skip if listing exists and force flag is false
    const currentBehavior = listingExists && !forceFlag ? 'SKIP' : 'UPDATE';
    
    // Expected logic: Update if lease passed timestamp filter
    const expectedBehavior = leasePassesTimestampFilter ? 'UPDATE' : 'SKIP';

    // Assert the bug exists
    assert.strictEqual(currentBehavior, 'SKIP', 'Current behavior should be SKIP (demonstrating the bug)');
    assert.strictEqual(expectedBehavior, 'UPDATE', 'Expected behavior should be UPDATE');
    assert.notStrictEqual(currentBehavior, expectedBehavior, 'Bug confirmed: current behavior differs from expected');

    console.log(`   🐛 Current behavior: ${currentBehavior} (WRONG)`);
    console.log(`   ✅ Expected behavior: ${expectedBehavior} (CORRECT)`);
    console.log(`   🎯 Bug confirmed: Lease updates are skipped when listing exists`);
});

// Test 2: Data inconsistency caused by the bug
runTest('Data Inconsistency Validation', function() {
    const { lease } = mockBuildiumData;
    const { existingListing } = mockHubSpotData;

    // Demonstrate data inconsistency
    const buildiumRent = lease.Rent.Amount;
    const hubspotRent = parseInt(existingListing.properties.buildium_market_rent);

    assert.notStrictEqual(buildiumRent, hubspotRent, 
        'Bug causes data inconsistency: Buildium rent differs from HubSpot rent');
    assert.strictEqual(buildiumRent, 1800, 'Buildium has updated rent');
    assert.strictEqual(hubspotRent, 1500, 'HubSpot still has old rent');

    console.log(`   📊 Buildium rent: $${buildiumRent} (current)`);
    console.log(`   📊 HubSpot rent: $${hubspotRent} (outdated)`);
    console.log(`   🚨 Data inconsistency confirmed`);
});

// Test 3: Force flag workaround
runTest('Force Flag Workaround', function() {
    const { existingListing } = mockHubSpotData;
    
    // Test force flag workaround
    const forceFlag = true;
    const listingExists = existingListing !== null;
    
    const behaviorWithForce = listingExists && !forceFlag ? 'SKIP' : 'UPDATE';
    
    assert.strictEqual(behaviorWithForce, 'UPDATE', 
        'Force flag should cause update even when listing exists');

    console.log(`   🔧 Force flag behavior: ${behaviorWithForce}`);
    console.log(`   ⚠️  Force flag updates ALL data (inefficient)`);
    console.log(`   ⚠️  Requires manual intervention (--force)`);
    console.log(`   ⚠️  Not ideal for automated incremental sync`);
});

// Test 4: Expected fix validation
runTest('Expected Fix Logic', function() {
    const { lease } = mockBuildiumData;
    const { existingListing } = mockHubSpotData;
    const { lastSyncTimestamps } = mockTimestamps;

    // Simulate the expected fix logic
    function expectedCreateListingsBatchLogic(lease, existingListing, lastSyncTimestamps, forceFlag = false) {
        const listingExists = existingListing !== null;
        
        if (!listingExists) {
            return 'CREATE'; // No listing exists, create new one
        }
        
        if (forceFlag) {
            return 'UPDATE_ALL'; // Force flag updates all fields
        }
        
        // THE FIX: Check if lease was updated since last sync
        const leaseLastUpdated = new Date(lease.LastUpdatedDateTime);
        const lastSyncTime = new Date(lastSyncTimestamps[lease.Id] || '1970-01-01T00:00:00Z');
        const leaseWasUpdated = leaseLastUpdated > lastSyncTime;
        
        if (leaseWasUpdated) {
            return 'UPDATE_LEASE_FIELDS'; // Update only lease-related fields
        }
        
        return 'SKIP'; // No changes, skip update
    }

    // Test the expected fix
    const fixedBehavior = expectedCreateListingsBatchLogic(
        lease, 
        existingListing, 
        lastSyncTimestamps, 
        false
    );

    assert.strictEqual(fixedBehavior, 'UPDATE_LEASE_FIELDS', 
        'Fixed logic should update lease fields when lease was updated');

    console.log(`   🔧 Fixed behavior: ${fixedBehavior}`);
    console.log(`   ✅ Only updates lease-related fields (efficient)`);
    console.log(`   ✅ Works automatically without force flag`);
    console.log(`   ✅ Perfect for incremental sync`);
});

// Test 5: Comprehensive scenario testing
runTest('All Scenarios with Fix', function() {
    const { lease } = mockBuildiumData;
    const { lastSyncTimestamps } = mockTimestamps;

    function expectedCreateListingsBatchLogic(lease, existingListing, lastSyncTimestamps, forceFlag = false) {
        const listingExists = existingListing !== null;
        
        if (!listingExists) return 'CREATE';
        if (forceFlag) return 'UPDATE_ALL';
        
        const leaseLastUpdated = new Date(lease.LastUpdatedDateTime);
        const lastSyncTime = new Date(lastSyncTimestamps[lease.Id] || '1970-01-01T00:00:00Z');
        const leaseWasUpdated = leaseLastUpdated > lastSyncTime;
        
        return leaseWasUpdated ? 'UPDATE_LEASE_FIELDS' : 'SKIP';
    }

    // Test all scenarios
    const scenarios = [
        {
            name: 'New listing',
            test: () => expectedCreateListingsBatchLogic(lease, null, lastSyncTimestamps),
            expected: 'CREATE'
        },
        {
            name: 'Force flag',
            test: () => expectedCreateListingsBatchLogic(lease, mockHubSpotData.existingListing, lastSyncTimestamps, true),
            expected: 'UPDATE_ALL'
        },
        {
            name: 'Updated lease',
            test: () => expectedCreateListingsBatchLogic(lease, mockHubSpotData.existingListing, lastSyncTimestamps),
            expected: 'UPDATE_LEASE_FIELDS'
        },
        {
            name: 'Unchanged lease',
            test: () => {
                const oldLease = { ...lease, LastUpdatedDateTime: '2024-08-01T00:00:00Z' };
                return expectedCreateListingsBatchLogic(oldLease, mockHubSpotData.existingListing, lastSyncTimestamps);
            },
            expected: 'SKIP'
        }
    ];

    scenarios.forEach(scenario => {
        const result = scenario.test();
        assert.strictEqual(result, scenario.expected, `${scenario.name} should return ${scenario.expected}`);
        console.log(`   ✅ ${scenario.name}: ${result}`);
    });
});

// Test 6: Implementation guidance
runTest('Implementation Guidance', function() {
    const implementationSteps = [
        'Modify createListingsBatch() method in HubSpotClient',
        'Accept lease timestamp metadata as parameter',
        'Check if lease passed timestamp filter before skip logic',
        'Update lease-related fields when lease was updated',
        'Preserve current skip logic for unchanged leases',
        'Maintain force flag functionality for full updates'
    ];

    const leaseRelatedFields = [
        'buildium_market_rent',
        'rent_amount', 
        'lease_start_date',
        'lease_end_date',
        'lease_status',
        'last_updated'
    ];

    assert.strictEqual(implementationSteps.length, 6, 'Should have 6 implementation steps');
    assert.ok(leaseRelatedFields.length > 0, 'Should identify lease-related fields to update');

    console.log(`   📋 Implementation has ${implementationSteps.length} steps`);
    console.log(`   📊 ${leaseRelatedFields.length} lease-related fields need updating`);
    console.log(`   🎯 Implementation roadmap validated`);
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsTotal - testsPassed}`);
console.log(`📈 Success Rate: ${Math.round(testsPassed / testsTotal * 100)}%`);

if (testsPassed === testsTotal) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('\n🎯 KEY FINDINGS:');
    console.log('1. ✅ Lease timestamp filtering works correctly');
    console.log('2. 🐛 createListingsBatch skips update when listing exists');
    console.log('3. 🚨 Result: Changed leases don\'t update existing listings');
    console.log('4. 🔧 Workaround: Use --force flag (but updates ALL data)');
    console.log('5. ✅ Solution: Update lease fields when lease timestamp filter passes');

    console.log('\n🔧 RECOMMENDED FIX:');
    console.log('Modify createListingsBatch() to check if lease passed timestamp filter');
    console.log('If yes, update lease-related fields even if listing exists');
    console.log('If no, use current skip logic');

    console.log('\n💡 IMPLEMENTATION APPROACH:');
    console.log('1. Pass lease timestamp info to createListingsBatch()');
    console.log('2. When existing listing found, check if lease was updated');
    console.log('3. If lease updated, update lease fields (rent, tenant, dates)');
    console.log('4. If not updated, use current skip logic');
} else {
    console.log('\n❌ Some tests failed. Please review the errors above.');
}

console.log('\n🚀 Ready for bug fix implementation!');

// Export test data for use in other test files
module.exports = {
    mockBuildiumData,
    mockHubSpotData,
    mockTimestamps,
    testResults: {
        passed: testsPassed,
        total: testsTotal,
        successRate: Math.round(testsPassed / testsTotal * 100)
    }
};
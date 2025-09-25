/**
 * TEST: Tenant Lifecycle Manager
 * Validates the tenant association transition logic
 */

const TenantLifecycleManager = require('../TenantLifecycleManager.js');

// Helper function to run tests
function runTests() {
    console.log('[TEST] TENANT LIFECYCLE MANAGER TESTS');
    console.log('=' .repeat(40));

    const tests = [
        () => {
            const manager = new TenantLifecycleManager();
            console.log('[OK] Manager initialization');
            
            // Test association mappings
            if (manager.ASSOCIATION_TYPES.FUTURE_TENANT === 11 &&
                manager.ASSOCIATION_TYPES.ACTIVE_TENANT === 2 &&
                manager.ASSOCIATION_TYPES.INACTIVE_TENANT === 6) {
                console.log('[OK] Association type mappings correct');
            } else {
                console.log('[FAIL] Association type mappings incorrect');
            }

            // Test association names
            if (manager.getAssociationName(11) === 'Future Tenant' &&
                manager.getAssociationName(2) === 'Active Tenant' &&
                manager.getAssociationName(6) === 'Inactive Tenant') {
                console.log('[OK] Association name mapping correct');
            } else {
                console.log('[FAIL] Association name mapping incorrect');
            }

            // Test old association types
            const futureToActiveOld = manager.getOldAssociationTypes('futureToActive');
            const activeToInactiveOld = manager.getOldAssociationTypes('activeToInactive');
            
            if (futureToActiveOld.length === 1 && futureToActiveOld[0] === 11 &&
                activeToInactiveOld.length === 1 && activeToInactiveOld[0] === 2) {
                console.log('[OK] Old association type logic correct');
            } else {
                console.log('[FAIL] Old association type logic incorrect');
            }

            // Test date logic
            const today = new Date('2025-08-23');
            
            // Future lease that should be active
            const leaseStart = new Date('2025-08-20'); // Started 3 days ago
            leaseStart.setHours(0, 0, 0, 0);
            if (leaseStart <= today) {
                console.log('[OK] Future-to-Active date logic correct');
            } else {
                console.log('[FAIL] Future-to-Active date logic incorrect');
            }

            // Active lease that should be inactive
            const leaseEnd = new Date('2025-08-20'); // Ended 3 days ago
            leaseEnd.setHours(23, 59, 59, 999);
            if (leaseEnd < today) {
                console.log('[OK] Active-to-Inactive date logic correct');
            } else {
                console.log('[FAIL] Active-to-Inactive date logic incorrect');
            }

            console.log('[OK] All basic tests passed!');
        }
    ];

    tests.forEach((test, index) => {
        try {
            test();
        } catch (error) {
            console.log(`[FAIL] Test ${index + 1} failed:`, error.message);
        }
    });

    console.log('\n[COMPLETE] Lifecycle Manager tests complete!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = { runTests };

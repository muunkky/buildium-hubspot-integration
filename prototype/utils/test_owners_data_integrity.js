require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');

/**
 * Comprehensive test suite for owners command data integrity
 */
async function runOwnersSyncTests() {
    console.log('[TEST] Owners Sync Data Integrity Test Suite');
    console.log('=' .repeat(60));
    
    const buildium = new BuildiumClient();
    let allTestsPassed = true;
    const testResults = [];
    
    try {
        // Test 1: Property filtering accuracy
        console.log('\n[STATS] Test 1: Property Filtering Accuracy');
        console.log('-'.repeat(40));
        
        const testPropertyId = 140054;
        const filteredOwners = await buildium.getRentalOwners({ 
            propertyIds: [testPropertyId] 
        });
        
        console.log(`Found ${filteredOwners.length} owners for property ${testPropertyId}`);
        
        let validOwners = 0;
        let invalidOwners = 0;
        
        filteredOwners.forEach(owner => {
            const ownsProperty = owner.PropertyIds && owner.PropertyIds.includes(testPropertyId);
            if (ownsProperty) {
                validOwners++;
            } else {
                invalidOwners++;
                const name = owner.IsCompany ? owner.CompanyName : `${owner.FirstName} ${owner.LastName}`;
                console.log(`[FAIL] Invalid: ${name} (${owner.Id}) - Properties: [${owner.PropertyIds?.join(', ')}]`);
            }
        });
        
        const accuracy = filteredOwners.length > 0 ? (validOwners / filteredOwners.length) * 100 : 0;
        const test1Passed = accuracy === 100;
        
        console.log(`[OK] Valid owners: ${validOwners}`);
        console.log(`[FAIL] Invalid owners: ${invalidOwners}`);
        console.log(`[TARGET] Accuracy: ${accuracy.toFixed(1)}%`);
        console.log(`Result: ${test1Passed ? 'PASS' : 'FAIL'}`);
        
        testResults.push({
            test: 'Property Filtering Accuracy',
            passed: test1Passed,
            details: `${accuracy.toFixed(1)}% accuracy, ${validOwners}/${filteredOwners.length} valid`
        });
        
        if (!test1Passed) allTestsPassed = false;
        
        // Test 2: Multiple property filtering
        console.log('\n[STATS] Test 2: Multiple Property Filtering');
        console.log('-'.repeat(40));
        
        const multiplePropertyIds = [140054, 57129]; // Two different properties
        const multipleFiltered = await buildium.getRentalOwners({ 
            propertyIds: multiplePropertyIds 
        });
        
        console.log(`Found ${multipleFiltered.length} owners for properties [${multiplePropertyIds.join(', ')}]`);
        
        let validMultiple = 0;
        let invalidMultiple = 0;
        
        multipleFiltered.forEach(owner => {
            const ownsAnyProperty = owner.PropertyIds && 
                multiplePropertyIds.some(propId => owner.PropertyIds.includes(propId));
            
            if (ownsAnyProperty) {
                validMultiple++;
            } else {
                invalidMultiple++;
                const name = owner.IsCompany ? owner.CompanyName : `${owner.FirstName} ${owner.LastName}`;
                console.log(`[FAIL] Invalid: ${name} (${owner.Id}) - Properties: [${owner.PropertyIds?.join(', ')}]`);
            }
        });
        
        const multipleAccuracy = multipleFiltered.length > 0 ? (validMultiple / multipleFiltered.length) * 100 : 0;
        const test2Passed = multipleAccuracy === 100;
        
        console.log(`[OK] Valid owners: ${validMultiple}`);
        console.log(`[FAIL] Invalid owners: ${invalidMultiple}`);
        console.log(`[TARGET] Accuracy: ${multipleAccuracy.toFixed(1)}%`);
        console.log(`Result: ${test2Passed ? 'PASS' : 'FAIL'}`);
        
        testResults.push({
            test: 'Multiple Property Filtering',
            passed: test2Passed,
            details: `${multipleAccuracy.toFixed(1)}% accuracy, ${validMultiple}/${multipleFiltered.length} valid`
        });
        
        if (!test2Passed) allTestsPassed = false;
        
        // Test 3: Status filtering
        console.log('\n[STATS] Test 3: Status Filtering');
        console.log('-'.repeat(40));
        
        const activeOwners = await buildium.getRentalOwners({ 
            status: 'Active',
            propertyIds: [testPropertyId]
        });
        
        console.log(`Found ${activeOwners.length} active owners for property ${testPropertyId}`);
        
        let validActiveStatus = 0;
        let invalidActiveStatus = 0;
        
        activeOwners.forEach(owner => {
            if (owner.IsActive === true) {
                validActiveStatus++;
            } else {
                invalidActiveStatus++;
                const name = owner.IsCompany ? owner.CompanyName : `${owner.FirstName} ${owner.LastName}`;
                console.log(`[FAIL] Non-active: ${name} (${owner.Id}) - IsActive: ${owner.IsActive}`);
            }
        });
        
        const statusAccuracy = activeOwners.length > 0 ? (validActiveStatus / activeOwners.length) * 100 : 100;
        const test3Passed = statusAccuracy === 100;
        
        console.log(`[OK] Active owners: ${validActiveStatus}`);
        console.log(`[FAIL] Non-active owners: ${invalidActiveStatus}`);
        console.log(`[TARGET] Status accuracy: ${statusAccuracy.toFixed(1)}%`);
        console.log(`Result: ${test3Passed ? 'PASS' : 'FAIL'}`);
        
        testResults.push({
            test: 'Status Filtering',
            passed: test3Passed,
            details: `${statusAccuracy.toFixed(1)}% accuracy, ${validActiveStatus}/${activeOwners.length} valid`
        });
        
        if (!test3Passed) allTestsPassed = false;
        
        // Test 4: Data completeness
        console.log('\n[STATS] Test 4: Data Completeness');
        console.log('-'.repeat(40));
        
        const sampleOwner = filteredOwners[0];
        const requiredFields = ['Id', 'PropertyIds'];
        const optionalFields = ['FirstName', 'LastName', 'CompanyName', 'Email', 'IsActive'];
        
        let missingRequired = [];
        let presentOptional = [];
        
        requiredFields.forEach(field => {
            if (!sampleOwner[field]) {
                missingRequired.push(field);
            }
        });
        
        optionalFields.forEach(field => {
            if (sampleOwner[field]) {
                presentOptional.push(field);
            }
        });
        
        const test4Passed = missingRequired.length === 0;
        
        console.log(`Required fields: ${requiredFields.join(', ')}`);
        console.log(`Missing required: ${missingRequired.length > 0 ? missingRequired.join(', ') : 'None'}`);
        console.log(`Present optional: ${presentOptional.join(', ')}`);
        console.log(`Result: ${test4Passed ? 'PASS' : 'FAIL'}`);
        
        testResults.push({
            test: 'Data Completeness',
            passed: test4Passed,
            details: `${missingRequired.length} missing required fields`
        });
        
        if (!test4Passed) allTestsPassed = false;
        
        // Final Results
        console.log('\n TEST SUITE RESULTS');
        console.log('=' .repeat(60));
        
        testResults.forEach((result, index) => {
            const status = result.passed ? '[OK] PASS' : '[FAIL] FAIL';
            console.log(`${index + 1}. ${result.test}: ${status}`);
            console.log(`   ${result.details}`);
        });
        
        console.log('\n Overall Result:');
        console.log(`${allTestsPassed ? '[OK] ALL TESTS PASSED' : '[FAIL] SOME TESTS FAILED'}`);
        console.log(`Passed: ${testResults.filter(r => r.passed).length}/${testResults.length}`);
        
        if (allTestsPassed) {
            console.log('\n[COMPLETE] OWNERS SYNC DATA INTEGRITY VERIFIED!');
            console.log('The property filtering bug has been successfully fixed.');
            console.log('The system is now ready for production use.');
        } else {
            console.log('\n DATA INTEGRITY ISSUES DETECTED!');
            console.log('Please address the failing tests before using in production.');
        }
        
        return allTestsPassed;
        
    } catch (error) {
        console.error('[FAIL] Test suite failed:', error.message);
        return false;
    }
}

// Run the test suite
runOwnersSyncTests();

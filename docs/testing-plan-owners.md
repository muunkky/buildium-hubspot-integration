# Owners Command Testing Plan

## Critical Bug Identified

**Issue**: Command `npm start owners --property-ids 140054 --type rental --dry-run` fetched 100+ owners instead of filtering by property ID 140054.

**Root Cause Analysis Needed**:
1. Verify Buildium API parameter format for `propertyids`
2. Check if the API call is actually sending the filter
3. Validate response data contains only owners for specified property
4. Ensure data transformation preserves filtering intent

## Testing Strategy

### Phase 1: API Integration Validation

#### 1.1 Buildium API Parameter Testing
```bash
# Test individual API calls to verify filtering works
node prototype/index.js test-buildium-api
```

**Test Cases**:
- [ ] GET `/v1/rentals/owners` without filters (should return all owners)
- [ ] GET `/v1/rentals/owners?propertyids=140054` (should return only owners of property 140054)
- [ ] GET `/v1/rentals/owners?propertyids=140054,140055` (should return owners of both properties)
- [ ] GET `/v1/rentals/owners?status=Active` (should return only active owners)
- [ ] GET `/v1/associations/owners?associationids=123` (should return association owners)

**Expected Results**:
- Property filtering reduces owner count to property-specific subset
- API response includes property relationship data
- Status filtering works correctly
- No owners returned for non-existent property IDs

#### 1.2 Data Integrity Validation
```javascript
// For each returned owner, verify:
function validateOwnerData(owner, expectedFilters) {
    const validations = {
        hasRequiredFields: checkRequiredFields(owner),
        propertyAssociation: verifyPropertyAssociation(owner, expectedFilters.propertyIds),
        statusMatch: verifyStatus(owner, expectedFilters.status),
        dataCompleteness: checkDataCompleteness(owner)
    };
    return validations;
}
```

### Phase 2: Data Transformation Testing

#### 2.1 Owner Type Classification
```javascript
// Test individual vs company owner detection
const testCases = [
    {
        input: { IsCompany: false, FirstName: "John", LastName: "Smith" },
        expected: { type: "individual", hubspotEntity: "contact" }
    },
    {
        input: { IsCompany: true, CompanyName: "ABC Properties LLC" },
        expected: { type: "company", hubspotEntity: "company" }
    }
];
```

#### 2.2 Data Mapping Accuracy
```javascript
// Verify Buildium → HubSpot field mapping
const mappingTests = {
    rentalOwner: {
        buildium: {
            Id: 12345,
            FirstName: "Jane",
            LastName: "Doe", 
            Email: "jane@example.com",
            PhoneNumbers: [{ Number: "555-123-4567", Type: "Home" }],
            PropertyIds: [140054, 140055]
        },
        expectedHubSpot: {
            buildium_owner_id: "12345",
            firstname: "Jane",
            lastname: "Doe",
            email: "jane@example.com",
            phone: "555-123-4567",
            buildium_property_ids: "140054,140055"
        }
    }
};
```

### Phase 3: Integration Testing

#### 3.1 End-to-End Sync Validation
```bash
# Test complete sync workflow
npm start owners --property-ids 140054 --type rental --dry-run --verbose
```

**Validation Steps**:
1. **API Request Validation**: Log actual API calls made
2. **Filter Verification**: Confirm only property 140054 owners returned
3. **Data Transformation**: Verify Buildium data correctly mapped to HubSpot format
4. **Duplicate Detection**: Ensure no duplicate owners created
5. **Error Handling**: Test with invalid property IDs

#### 3.2 Command Option Testing
```bash
# Test all command combinations
npm start owners --sync-all --dry-run
npm start owners --property-ids 140054,140055 --dry-run
npm start owners --status active --type rental --dry-run
npm start owners --verify
npm start owners --create-missing --dry-run
```

### Phase 4: Data Consistency Testing

#### 4.1 Cross-Reference Validation
```javascript
// Verify owner-property relationships
async function validateOwnerPropertyRelationships(propertyId) {
    // 1. Get all owners for property from Buildium
    const ownersFromBuildium = await buildiumClient.getRentalOwners({ propertyIds: [propertyId] });
    
    // 2. Get property details to verify ownership
    const propertyDetails = await buildiumClient.getProperty(propertyId);
    
    // 3. Cross-validate ownership claims
    const validations = ownersFromBuildium.map(owner => ({
        ownerId: owner.Id,
        claimsProperty: owner.PropertyIds?.includes(propertyId),
        propertyExists: !!propertyDetails,
        validation: owner.PropertyIds?.includes(propertyId) && !!propertyDetails
    }));
    
    return validations;
}
```

#### 4.2 HubSpot Sync Verification
```javascript
// After sync, verify HubSpot data matches Buildium
async function verifySyncAccuracy(buildiumOwnerId) {
    const buildiumOwner = await buildiumClient.getOwnerById(buildiumOwnerId);
    const hubspotRecord = await hubspotClient.findContactByBuildiumId(buildiumOwnerId) ||
                         await hubspotClient.findCompanyByBuildiumId(buildiumOwnerId);
    
    const fieldComparisons = {
        name: compareNames(buildiumOwner, hubspotRecord),
        email: buildiumOwner.Email === hubspotRecord.properties.email,
        phone: comparePhoneNumbers(buildiumOwner.PhoneNumbers, hubspotRecord.properties.phone),
        address: compareAddresses(buildiumOwner.Address, hubspotRecord.properties),
        propertyIds: buildiumOwner.PropertyIds?.join(',') === hubspotRecord.properties.buildium_property_ids
    };
    
    return fieldComparisons;
}
```

## Test Implementation Plan

### Step 1: Create Test Utilities (Week 1)

**File**: `prototype/utils/test_owners_api.js`
```javascript
/**
 * Test Buildium API filtering and parameter handling
 */
async function testBuildiumOwnersAPI() {
    const buildium = new BuildiumClient();
    
    console.log('🧪 Testing Buildium Owners API...');
    
    // Test 1: Fetch all owners (baseline)
    const allOwners = await buildium.getRentalOwners();
    console.log(`📊 Total owners: ${allOwners.length}`);
    
    // Test 2: Filter by specific property
    const propertyOwners = await buildium.getRentalOwners({ propertyIds: [140054] });
    console.log(`🏠 Owners for property 140054: ${propertyOwners.length}`);
    
    // Test 3: Verify property association
    const invalidPropertyOwners = await buildium.getRentalOwners({ propertyIds: [999999] });
    console.log(`❌ Owners for invalid property: ${invalidPropertyOwners.length}`);
    
    // Test 4: Status filtering
    const activeOwners = await buildium.getRentalOwners({ status: 'Active' });
    console.log(`✅ Active owners: ${activeOwners.length}`);
    
    // Data validation
    propertyOwners.forEach(owner => {
        const ownsTargetProperty = owner.PropertyIds?.includes(140054);
        console.log(`👤 Owner ${owner.Id}: ${owner.FirstName} ${owner.LastName} - Owns 140054: ${ownsTargetProperty}`);
        if (!ownsTargetProperty) {
            console.error(`❌ BUG: Owner ${owner.Id} returned but doesn't own property 140054!`);
        }
    });
}
```

### Step 2: Create Data Validation Tests

**File**: `prototype/utils/test_owners_data_integrity.js`
```javascript
/**
 * Validate data transformation and mapping accuracy
 */
async function testDataIntegrity() {
    // Test individual owner transformation
    const testOwner = {
        Id: 12345,
        IsCompany: false,
        FirstName: "John",
        LastName: "Smith",
        Email: "john@example.com",
        PhoneNumbers: [{ Number: "555-123-4567", Type: "Home" }],
        PropertyIds: [140054]
    };
    
    const transformed = DataTransformer.transformOwnerToContact(testOwner);
    
    // Validate transformation
    const validations = {
        idPreserved: transformed.properties.buildium_owner_id === "12345",
        nameCorrect: transformed.properties.firstname === "John" && transformed.properties.lastname === "Smith",
        emailCorrect: transformed.properties.email === "john@example.com",
        phoneCorrect: transformed.properties.phone === "555-123-4567",
        propertyIdsCorrect: transformed.properties.buildium_property_ids === "140054"
    };
    
    console.log('🔍 Data Transformation Validation:', validations);
    return Object.values(validations).every(v => v);
}
```

### Step 3: Create Integration Test Suite

**File**: `prototype/utils/test_owners_integration.js`
```javascript
/**
 * End-to-end integration testing
 */
async function testOwnersIntegration() {
    const integration = new IntegrationPrototype();
    
    // Test 1: Property-specific sync
    console.log('🧪 Testing property-specific owner sync...');
    const result = await integration.handleOwnersCommand({
        propertyIds: [140054],
        ownerType: 'rental',
        dryRun: true
    });
    
    // Validate results
    console.log(`📊 Sync Results: ${result.processed} processed, ${result.success} success, ${result.errors} errors`);
    
    // Test 2: Verify no unauthorized data
    if (result.owners) {
        const unauthorizedOwners = result.owners.filter(owner => 
            !owner.PropertyIds?.includes(140054)
        );
        
        if (unauthorizedOwners.length > 0) {
            console.error(`❌ BUG: ${unauthorizedOwners.length} owners returned that don't own property 140054`);
            unauthorizedOwners.forEach(owner => {
                console.error(`   - Owner ${owner.Id}: Properties [${owner.PropertyIds?.join(', ')}]`);
            });
        } else {
            console.log('✅ All returned owners correctly associated with property 140054');
        }
    }
}
```

### Step 4: Automated Test Runner

**File**: `prototype/utils/run_owners_tests.js`
```javascript
/**
 * Automated test runner for owners functionality
 */
async function runAllOwnersTests() {
    console.log('🚀 Starting Owners Command Test Suite...\n');
    
    const tests = [
        { name: 'Buildium API Parameter Testing', fn: testBuildiumOwnersAPI },
        { name: 'Data Transformation Integrity', fn: testDataIntegrity },
        { name: 'End-to-End Integration', fn: testOwnersIntegration },
        { name: 'Property Association Validation', fn: testPropertyAssociations }
    ];
    
    const results = [];
    
    for (const test of tests) {
        try {
            console.log(`🧪 Running: ${test.name}`);
            const result = await test.fn();
            results.push({ name: test.name, passed: true, result });
            console.log(`✅ PASSED: ${test.name}\n`);
        } catch (error) {
            results.push({ name: test.name, passed: false, error: error.message });
            console.error(`❌ FAILED: ${test.name} - ${error.message}\n`);
        }
    }
    
    // Summary
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    console.log(`📊 Test Summary: ${passed}/${total} tests passed`);
    
    if (passed < total) {
        console.error('❌ Some tests failed. Review the issues above before deploying.');
        process.exit(1);
    } else {
        console.log('🎉 All tests passed! Owners command is ready for production.');
    }
}
```

## Immediate Action Items

### 1. Debug Current Property Filtering Bug
```bash
# Add debug logging to verify API parameters
node -e "
const axios = require('axios');
const buildium = new (require('./prototype/index.js')).BuildiumClient();

// Log the actual API call being made
const originalMakeRequest = buildium.makeRequestWithRetry;
buildium.makeRequestWithRetry = function(requestFn) {
    const request = requestFn();
    console.log('🔍 API Request:', request.config?.url, request.config?.params);
    return originalMakeRequest.call(this, requestFn);
};

// Test the specific call that's failing
buildium.getRentalOwners({ propertyIds: [140054] }).then(owners => {
    console.log(\`📊 Returned \${owners.length} owners\`);
    owners.slice(0, 3).forEach(owner => {
        console.log(\`👤 Owner \${owner.Id}: Properties [\${owner.PropertyIds?.join(', ')}]\`);
    });
});
"
```

### 2. Verify Buildium API Documentation
- Check if `propertyids` parameter format is correct
- Verify if multiple property IDs require different syntax
- Confirm the API actually supports property-based filtering

### 3. Create Quick Validation Command
```bash
# Add a validation command to the CLI
npm start owners --validate-filters --property-ids 140054
```

This should:
1. Show the exact API URL and parameters being sent
2. Display first few returned owners with their PropertyIds
3. Count how many actually own the specified property
4. Report any filtering failures

## Success Criteria

1. **Filtering Accuracy**: `--property-ids 140054` returns only owners who actually own property 140054
2. **Data Integrity**: All transformed data matches original Buildium data
3. **No Data Loss**: All relevant owner information preserved during transformation
4. **Duplicate Prevention**: No duplicate HubSpot records created
5. **Error Handling**: Graceful handling of invalid property IDs, API failures, etc.
6. **Performance**: Reasonable sync times for large owner datasets
7. **Audit Trail**: Complete logging of what was synced, skipped, or failed

Once these tests are implemented, we'll have confidence that the owners command actually syncs the right data to the right places!

# Owners Command Testing Plan

## Overview

This document outlines a comprehensive testing strategy to ensure data integrity for the owners synchronization command, specifically addressing the critical bug where property filtering isn't working correctly.

## Critical Bug Identified

**Issue**: When running `owners --property-ids 140054`, the system returned 100+ owners instead of only owners for property 140054.

**Root Cause**: Property filtering in the Buildium API may not be working as expected, or our parameter formatting is incorrect.

**Impact**: Data integrity violation - syncing incorrect owners to HubSpot.

## Testing Strategy

### Phase 1: API Parameter Validation

#### 1.1 Buildium API Property Filtering Test

**Objective**: Verify if Buildium API property filtering works correctly

**Test Script**: `test_property_filtering.js`

```javascript
require('dotenv').config();
const axios = require('axios');

async function testPropertyFiltering() {
    const baseURL = process.env.BUILDIUM_BASE_URL;
    const clientId = process.env.BUILDIUM_CLIENT_ID;
    const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;
    
    console.log('🧪 Testing Buildium API Property Filtering');
    console.log('=' .repeat(50));
    
    const headers = {
        'x-buildium-client-id': clientId,
        'x-buildium-client-secret': clientSecret,
        'Content-Type': 'application/json'
    };
    
    const testPropertyId = 140054;
    
    try {
        // Test 1: All owners (baseline)
        console.log('\\n📊 Test 1: All rental owners (baseline)');
        const allOwnersResponse = await axios.get(`${baseURL}/rentals/owners`, {
            headers,
            params: { limit: 100 },
            timeout: 30000
        });
        
        console.log(`Total owners: ${allOwnersResponse.data.length}`);
        
        // Test 2: Property filtering as array
        console.log('\\n📊 Test 2: Property filter as array [140054]');
        const filteredResponse1 = await axios.get(`${baseURL}/rentals/owners`, {
            headers,
            params: { 
                propertyids: [testPropertyId],
                limit: 100 
            },
            timeout: 30000
        });
        
        console.log(`Filtered owners (array): ${filteredResponse1.data.length}`);
        
        // Test 3: Property filtering as string
        console.log('\\n📊 Test 3: Property filter as string "140054"');
        const filteredResponse2 = await axios.get(`${baseURL}/rentals/owners`, {
            headers,
            params: { 
                propertyids: testPropertyId.toString(),
                limit: 100 
            },
            timeout: 30000
        });
        
        console.log(`Filtered owners (string): ${filteredResponse2.data.length}`);
        
        // Validation: Check if returned owners actually own the property
        console.log('\\n🔍 Validating first 10 owners from array test:');
        let validOwners = 0;
        let invalidOwners = 0;
        
        filteredResponse1.data.slice(0, 10).forEach((owner, index) => {
            const ownsProperty = owner.PropertyIds && owner.PropertyIds.includes(testPropertyId);
            const displayName = owner.IsCompany ? owner.CompanyName : `${owner.FirstName} ${owner.LastName}`;
            
            if (ownsProperty) {
                validOwners++;
                console.log(`✅ ${index + 1}. ${displayName} - Properties: [${owner.PropertyIds.join(', ')}]`);
            } else {
                invalidOwners++;
                console.log(`❌ ${index + 1}. ${displayName} - Properties: [${owner.PropertyIds?.join(', ') || 'None'}] - INVALID!`);
            }
        });
        
        // Full validation
        filteredResponse1.data.forEach(owner => {
            const ownsProperty = owner.PropertyIds && owner.PropertyIds.includes(testPropertyId);
            if (ownsProperty) validOwners++;
            else invalidOwners++;
        });
        
        console.log('\\n📈 Summary:');
        console.log(`Total owners (no filter): ${allOwnersResponse.data.length}`);
        console.log(`Filtered owners (array): ${filteredResponse1.data.length}`);
        console.log(`Filtered owners (string): ${filteredResponse2.data.length}`);
        console.log(`Valid owners: ${validOwners}`);
        console.log(`Invalid owners: ${invalidOwners}`);
        
        if (invalidOwners > 0) {
            console.log('\\n🚨 CRITICAL BUG CONFIRMED: Property filtering is not working correctly!');
            return false;
        } else {
            console.log('\\n✅ Property filtering working correctly!');
            return true;
        }
        
    } catch (error) {
        console.error('❌ API Error:', error.response?.data || error.message);
        return false;
    }
}

testPropertyFiltering();
```

This comprehensive testing plan ensures that the owners sync command works correctly and maintains data integrity throughout the synchronization process.

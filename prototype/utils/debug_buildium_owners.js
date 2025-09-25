/**
 * Debug Buildium API parameter handling for owners
 * This utility helps diagnose why property filtering isn't working correctly
 */

const axios = require('axios');
require('dotenv').config();

class BuildiumDebugger {
    constructor() {
        this.baseURL = process.env.BUILDIUM_BASE_URL;
        this.clientId = process.env.BUILDIUM_CLIENT_ID;
        this.clientSecret = process.env.BUILDIUM_CLIENT_SECRET;
    }

    /**
     * Test raw API calls with detailed logging
     */
    async testRawAPI(endpoint, params = {}) {
        try {
            console.log(`[SEARCH] Testing: ${endpoint}`);
            console.log(` Parameters:`, JSON.stringify(params, null, 2));
            
            const response = await axios.get(`${this.baseURL}${endpoint}`, {
                headers: {
                    'x-buildium-client-id': this.clientId,
                    'x-buildium-client-secret': this.clientSecret,
                    'Content-Type': 'application/json'
                },
                params,
                timeout: 30000
            });

            console.log(`[OK] Response: ${response.data.length} items returned`);
            return response.data;
        } catch (error) {
            console.error(`[FAIL] API Error:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Test different parameter formats for property filtering
     */
    async testPropertyFiltering(propertyId = 140054) {
        console.log(`[TEST] Testing Property ID Filtering for Property ${propertyId}\n`);
        
        // Test 1: No filtering (baseline)
        console.log('[STATS] Test 1: All owners (no filtering)');
        const allOwners = await this.testRawAPI('/rentals/owners', { limit: 100 });
        console.log(`   Total owners: ${allOwners.length}\n`);
        
        // Test 2: Single property ID as array
        console.log('[STATS] Test 2: Property filter as array');
        const owners1 = await this.testRawAPI('/rentals/owners', { 
            propertyids: [propertyId],
            limit: 100 
        });
        console.log(`   Filtered owners: ${owners1.length}`);
        this.validateOwners(owners1, [propertyId]);
        console.log('');
        
        // Test 3: Single property ID as string
        console.log('[STATS] Test 3: Property filter as string');
        const owners2 = await this.testRawAPI('/rentals/owners', { 
            propertyids: propertyId.toString(),
            limit: 100 
        });
        console.log(`   Filtered owners: ${owners2.length}`);
        this.validateOwners(owners2, [propertyId]);
        console.log('');
        
        // Test 4: Multiple property IDs
        console.log('[STATS] Test 4: Multiple property IDs');
        const owners3 = await this.testRawAPI('/rentals/owners', { 
            propertyids: [propertyId, propertyId + 1],
            limit: 100 
        });
        console.log(`   Filtered owners: ${owners3.length}`);
        this.validateOwners(owners3, [propertyId, propertyId + 1]);
        console.log('');
        
        // Test 5: Invalid property ID
        console.log('[STATS] Test 5: Invalid property ID (999999)');
        const owners4 = await this.testRawAPI('/rentals/owners', { 
            propertyids: [999999],
            limit: 100 
        });
        console.log(`   Filtered owners: ${owners4.length}`);
        this.validateOwners(owners4, [999999]);
        console.log('');
        
        return {
            totalOwners: allOwners.length,
            filteredOwners: owners1.length,
            filterWorking: owners1.length < allOwners.length
        };
    }

    /**
     * Validate that returned owners actually own the specified properties
     */
    validateOwners(owners, expectedPropertyIds) {
        if (owners.length === 0) {
            console.log('   [WARN]️  No owners returned');
            return;
        }

        let validOwners = 0;
        let invalidOwners = 0;
        
        console.log('    Owner validation:');
        owners.slice(0, 5).forEach(owner => { // Show first 5 for brevity
            const ownerProperties = owner.PropertyIds || [];
            const hasExpectedProperty = expectedPropertyIds.some(propId => 
                ownerProperties.includes(propId)
            );
            
            if (hasExpectedProperty) {
                validOwners++;
                console.log(`   [OK] Owner ${owner.Id} (${owner.FirstName} ${owner.LastName}): Properties [${ownerProperties.join(', ')}]`);
            } else {
                invalidOwners++;
                console.log(`   [FAIL] Owner ${owner.Id} (${owner.FirstName} ${owner.LastName}): Properties [${ownerProperties.join(', ')}] - DOES NOT OWN TARGET PROPERTY`);
            }
        });
        
        if (owners.length > 5) {
            // Check all owners, but don't print them
            owners.slice(5).forEach(owner => {
                const ownerProperties = owner.PropertyIds || [];
                const hasExpectedProperty = expectedPropertyIds.some(propId => 
                    ownerProperties.includes(propId)
                );
                
                if (hasExpectedProperty) validOwners++;
                else invalidOwners++;
            });
        }
        
        console.log(`   [STATS] Summary: ${validOwners} valid, ${invalidOwners} invalid owners`);
        
        if (invalidOwners > 0) {
            console.log(`    BUG DETECTED: ${invalidOwners} owners returned that don't own the target properties!`);
        }
    }

    /**
     * Test status filtering
     */
    async testStatusFiltering() {
        console.log(`[TEST] Testing Status Filtering\n`);
        
        // Test active owners
        console.log('[STATS] Test 1: Active owners only');
        const activeOwners = await this.testRawAPI('/rentals/owners', { 
            status: 'Active',
            limit: 50 
        });
        console.log(`   Active owners: ${activeOwners.length}`);
        
        // Test inactive owners
        console.log('[STATS] Test 2: Inactive owners only');
        const inactiveOwners = await this.testRawAPI('/rentals/owners', { 
            status: 'Inactive',
            limit: 50 
        });
        console.log(`   Inactive owners: ${inactiveOwners.length}`);
        
        // Validate status values
        console.log('   [SEARCH] Status validation:');
        activeOwners.slice(0, 3).forEach(owner => {
            console.log(`   [OK] Active owner ${owner.Id}: IsActive = ${owner.IsActive}`);
        });
        
        inactiveOwners.slice(0, 3).forEach(owner => {
            console.log(`   [FAIL] Inactive owner ${owner.Id}: IsActive = ${owner.IsActive}`);
        });
    }

    /**
     * Compare with our current implementation
     */
    async testCurrentImplementation(propertyId = 140054) {
        console.log(`[TEST] Testing Current Implementation vs Raw API\n`);
        
        // Import our current implementation
        const { BuildiumClient } = require('./index.js');
        const buildium = new BuildiumClient();
        
        // Test our wrapper
        console.log('[STATS] Our implementation:');
        const ourResult = await buildium.getRentalOwners({ propertyIds: [propertyId] });
        console.log(`   Our result: ${ourResult.length} owners`);
        
        // Test raw API
        console.log('[STATS] Raw API:');
        const rawResult = await this.testRawAPI('/rentals/owners', { 
            propertyids: [propertyId],
            limit: 100 
        });
        console.log(`   Raw result: ${rawResult.length} owners`);
        
        // Compare
        if (ourResult.length === rawResult.length) {
            console.log('[OK] Our implementation matches raw API');
        } else {
            console.log('[FAIL] Mismatch between our implementation and raw API');
        }
        
        // Validate both results
        console.log('\n[SEARCH] Validating our implementation:');
        this.validateOwners(ourResult, [propertyId]);
    }
}

// Main execution
async function main() {
    const apiDebugger = new BuildiumDebugger();
    
    try {
        console.log(' Buildium Owners API Debug Session\n');
        console.log('=' .repeat(60));
        
        // Test property filtering
        await apiDebugger.testPropertyFiltering(140054);
        
        console.log('=' .repeat(60));
        
        // Test status filtering
        await apiDebugger.testStatusFiltering();
        
        console.log('=' .repeat(60));
        
        // Test our current implementation
        await apiDebugger.testCurrentImplementation(140054);
        
        console.log('\n[COMPLETE] Debug session complete!');
        
    } catch (error) {
        console.error(' Debug session failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { BuildiumDebugger };

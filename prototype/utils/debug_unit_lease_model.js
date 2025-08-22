/**
 * Debug the unit-lease data model to understand the correct relationship
 * and fix the issue where we're getting too many tenants per unit
 */

require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');

async function debugUnitLeaseModel() {
    const buildiumClient = new BuildiumClient();
    
    try {
        console.log('🔍 Understanding Unit-Lease Relationship');
        console.log('=====================================\n');
        
        // First, let's understand what units look like
        console.log('1. Getting sample units...');
        const units = await buildiumClient.getAllUnits(5);
        console.log(`Found ${units.length} units\n`);
        
        // Let's examine the first unit in detail
        const testUnit = units[0];
        console.log(`📍 Examining Unit: ${testUnit.Id} (${testUnit.UnitNumber})`);
        console.log(`   Property ID: ${testUnit.PropertyId}`);
        console.log(`   Is Occupied: ${testUnit.IsUnitOccupied}`);
        console.log(`   Is Listed: ${testUnit.IsUnitListed}\n`);
        
        // Now let's see what leases are associated with this unit
        console.log('2. Getting leases using current method...');
        const leasesCurrentMethod = await buildiumClient.getAllLeasesForUnit(testUnit.Id);
        console.log(`Current method found ${leasesCurrentMethod.length} leases\n`);
        
        // Let's examine each lease to understand the data structure
        console.log('3. Analyzing lease data structure...');
        for (let i = 0; i < Math.min(3, leasesCurrentMethod.length); i++) {
            const lease = leasesCurrentMethod[i];
            console.log(`\n--- Lease ${i + 1} ---`);
            console.log(`ID: ${lease.Id}`);
            console.log(`Status: ${lease.LeaseStatus}`);
            console.log(`Property ID: ${lease.PropertyId}`);
            console.log(`Unit ID: ${lease.UnitId}`);
            console.log(`From: ${lease.LeaseFromDate} to ${lease.LeaseToDate}`);
            
            // Check if this lease is actually for our unit
            if (lease.UnitId !== testUnit.Id) {
                console.log(`⚠️  WARNING: This lease is for unit ${lease.UnitId}, not our target unit ${testUnit.Id}!`);
            }
            
            // Check tenant information
            if (lease.CurrentTenants) {
                console.log(`Current Tenants: ${lease.CurrentTenants.length}`);
                lease.CurrentTenants.forEach((tenant, idx) => {
                    console.log(`  ${idx + 1}. ${tenant.FirstName} ${tenant.LastName} (${tenant.Id})`);
                });
            }
            
            // Check for other tenant-related fields
            Object.keys(lease).forEach(key => {
                if (key.toLowerCase().includes('tenant') && key !== 'CurrentTenants') {
                    console.log(`${key}: ${JSON.stringify(lease[key])}`);
                }
            });
        }
        
        // Let's also try a different approach - get all leases and filter ourselves
        console.log('\n4. Alternative approach - filtering all leases...');
        const allLeases = await getAllLeases(buildiumClient);
        const unitSpecificLeases = allLeases.filter(lease => lease.UnitId === testUnit.Id);
        console.log(`All leases: ${allLeases.length}`);
        console.log(`Unit-specific leases: ${unitSpecificLeases.length}`);
        
        // Compare the results
        console.log('\n5. Comparison of methods...');
        console.log(`Current method: ${leasesCurrentMethod.length} leases`);
        console.log(`Filter method: ${unitSpecificLeases.length} leases`);
        
        if (leasesCurrentMethod.length !== unitSpecificLeases.length) {
            console.log('⚠️  Different results! Need to investigate the API call.');
        }
        
        // Let's understand lease statuses
        console.log('\n6. Lease Status Analysis...');
        const statusCounts = {};
        unitSpecificLeases.forEach(lease => {
            statusCounts[lease.LeaseStatus] = (statusCounts[lease.LeaseStatus] || 0) + 1;
        });
        
        console.log('Lease statuses for this unit:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`  ${status}: ${count}`);
        });
        
        // Check current date to determine what should be "active"
        const now = new Date();
        console.log(`\nCurrent date: ${now.toISOString().split('T')[0]}`);
        
        const currentLeases = unitSpecificLeases.filter(lease => {
            const fromDate = new Date(lease.LeaseFromDate);
            const toDate = new Date(lease.LeaseToDate);
            return fromDate <= now && now <= toDate;
        });
        
        console.log(`Leases that should be current by date: ${currentLeases.length}`);
        
        if (currentLeases.length > 1) {
            console.log('⚠️  Multiple current leases found - this might be the issue!');
            currentLeases.forEach((lease, idx) => {
                console.log(`  ${idx + 1}. ${lease.Id} (${lease.LeaseFromDate} to ${lease.LeaseToDate}) - Status: ${lease.LeaseStatus}`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response?.data) {
            console.error('API Response:', error.response.data);
        }
    }
}

// Helper function to get all leases (for comparison)
async function getAllLeases(buildiumClient) {
    try {
        console.log('Getting all leases for comparison...');
        
        const response = await require('axios').get(`${buildiumClient.baseURL}/leases`, {
            headers: {
                'x-buildium-client-id': buildiumClient.clientId,
                'x-buildium-client-secret': buildiumClient.clientSecret,
                'Content-Type': 'application/json'
            },
            params: {
                limit: 100  // Get a reasonable sample
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching all leases:', error.message);
        return [];
    }
}

debugUnitLeaseModel();

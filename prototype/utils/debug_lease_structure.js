/**
 * Debug specific lease to understand tenant structure
 */

require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');

async function debugLease() {
    const buildiumClient = new BuildiumClient();
    const unitId = 177286;
    
    try {
        console.log('🔍 Getting first few leases for unit', unitId);
        const leases = await buildiumClient.getAllLeasesForUnit(unitId);
        
        console.log(`Total leases: ${leases.length}`);
        
        // Check the first few leases
        for (let i = 0; i < Math.min(3, leases.length); i++) {
            const lease = leases[i];
            console.log(`\n--- Lease ${i + 1} ---`);
            console.log(`ID: ${lease.Id}`);
            console.log(`Status: ${lease.LeaseStatus}`);
            console.log(`From: ${lease.LeaseFromDate} to ${lease.LeaseToDate}`);
            console.log(`Property ID: ${lease.PropertyId}`);
            console.log(`Unit ID: ${lease.UnitId}`);
            
            // Check tenant data structure
            console.log('Tenant Info:');
            if (lease.TenantIds) {
                console.log(`  TenantIds: ${JSON.stringify(lease.TenantIds)}`);
            } else {
                console.log('  No TenantIds field');
            }
            
            if (lease.Tenants) {
                console.log(`  Tenants: ${JSON.stringify(lease.Tenants)}`);
            } else {
                console.log('  No Tenants field');
            }
            
            // Show all properties
            console.log('All lease properties:');
            Object.keys(lease).forEach(key => {
                if (key.toLowerCase().includes('tenant')) {
                    console.log(`  ${key}: ${JSON.stringify(lease[key])}`);
                }
            });
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugLease();

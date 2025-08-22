/**
 * Test with different units to find one with active tenants
 */

require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');

async function findActiveTenantsExample() {
    const buildiumClient = new BuildiumClient();
    
    try {
        console.log('🔍 Looking for units with active tenants');
        console.log('=====================================\n');
        
        // Get a few units to test
        const units = await buildiumClient.getAllUnits(10);
        console.log(`Testing ${units.length} units for active tenants...\n`);
        
        for (let i = 0; i < Math.min(5, units.length); i++) {
            const unit = units[i];
            console.log(`\n--- Unit ${i + 1}: ${unit.UnitNumber} (ID: ${unit.Id}) ---`);
            console.log(`Property: ${unit.PropertyId}, Occupied: ${unit.IsUnitOccupied}`);
            
            try {
                // Get leases for this unit using our improved method
                const leases = await buildiumClient.getAllLeasesForUnit(unit.Id);
                
                console.log(`Found ${leases.length} lease(s) for this unit`);
                
                leases.forEach((lease, idx) => {
                    console.log(`  Lease ${idx + 1}: ${lease.Id} - Status: ${lease.LeaseStatus}`);
                    console.log(`    Date range: ${lease.LeaseFromDate} to ${lease.LeaseToDate}`);
                    
                    if (lease.Tenants && lease.Tenants.length > 0) {
                        console.log(`    Tenants (${lease.Tenants.length}):`);
                        lease.Tenants.forEach(tenant => {
                            console.log(`      - ID: ${tenant.Id}, Status: ${tenant.Status}, Move-in: ${tenant.MoveInDate}`);
                        });
                    }
                    
                    if (lease.CurrentTenants && lease.CurrentTenants.length > 0) {
                        console.log(`    Current Tenants (${lease.CurrentTenants.length}):`);
                        lease.CurrentTenants.forEach(tenant => {
                            console.log(`      - ID: ${tenant.Id}, Name: ${tenant.FirstName} ${tenant.LastName}`);
                        });
                    }
                });
                
                // If we found a unit with current tenants, break
                const hasCurrentTenants = leases.some(lease => 
                    lease.CurrentTenants && lease.CurrentTenants.length > 0
                );
                
                if (hasCurrentTenants) {
                    console.log('\n✅ Found a unit with current tenants!');
                    break;
                }
                
            } catch (error) {
                console.log(`❌ Error processing unit ${unit.Id}: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

findActiveTenantsExample();

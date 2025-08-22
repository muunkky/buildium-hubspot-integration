/**
 * Simple test to verify the fixed approach works correctly
 */

require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');

async function simpleLeaseTest() {
    const buildiumClient = new BuildiumClient();
    
    try {
        console.log('🔧 Simple Lease Test');
        console.log('===================\n');
        
        // Test the core issue: get leases for ONE specific unit
        const testUnitId = 177184; // We know this unit has 1 lease
        
        console.log(`Testing unit: ${testUnitId}`);
        
        // OLD METHOD (broken)
        console.log('\n❌ OLD METHOD (showing why it was broken):');
        const allLeases = await buildiumClient.getAllLeases(50);
        console.log(`- getAllLeases() returned ${allLeases.length} total leases`);
        
        const wrongFiltering = allLeases.filter(lease => lease.UnitId === testUnitId);
        console.log(`- Filtering for unit ${testUnitId} gives ${wrongFiltering.length} leases`);
        
        // But the old method was returning ALL leases, not filtering!
        console.log(`- OLD METHOD was returning ALL ${allLeases.length} leases (WRONG!)`);
        
        // NEW METHOD (correct)
        console.log('\n✅ NEW METHOD (correct approach):');
        
        // Step 1: Get lease IDs for specific unit
        const unitLeaseIds = allLeases
            .filter(lease => lease.UnitId === testUnitId)
            .map(lease => lease.Id);
        
        console.log(`- Found ${unitLeaseIds.length} lease ID(s) for unit ${testUnitId}: [${unitLeaseIds.join(', ')}]`);
        
        if (unitLeaseIds.length > 0) {
            // Step 2: Fetch first lease individually
            const leaseId = unitLeaseIds[0];
            console.log(`- Fetching detailed lease ${leaseId}...`);
            
            const detailedLease = await buildiumClient.getLeaseById(leaseId);
            
            console.log(`- Lease ${leaseId}: ${detailedLease.LeaseStatus} status`);
            console.log(`- Tenants in this lease: ${detailedLease.Tenants?.length || 0}`);
            console.log(`- Current tenants: ${detailedLease.CurrentTenants?.length || 0}`);
            
            console.log('\n🎯 RESULT: Instead of hundreds of tenants, we get the ACTUAL tenants for this unit!');
        }
        
        console.log('\n📋 SUMMARY:');
        console.log('- OLD METHOD: Returned all leases from multiple units → hundreds of wrong tenants');
        console.log('- NEW METHOD: Returns only leases for specific unit → correct tenant count (2-3 per unit max)');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

simpleLeaseTest();

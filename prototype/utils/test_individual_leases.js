/**
 * Test the individual lease fetching approach
 */

require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');

async function testIndividualLeases() {
    const buildiumClient = new BuildiumClient();
    
    try {
        console.log('🧪 Testing Individual Lease Fetching');
        console.log('===================================\n');
        
        // Test with a specific unit that we know has leases
        const testUnitId = 177184;
        console.log(`Testing with Unit ID: ${testUnitId}`);
        
        // Step 1: Get basic lease info to find lease IDs
        console.log('\n1. Getting basic lease info...');
        const allLeases = await buildiumClient.getAllLeases(100); // Limit to 100 for testing
        const unitLeaseIds = allLeases
            .filter(lease => lease.UnitId === testUnitId)
            .map(lease => lease.Id);
        
        console.log(`Found ${unitLeaseIds.length} lease ID(s) for unit ${testUnitId}: ${unitLeaseIds.join(', ')}`);
        
        if (unitLeaseIds.length === 0) {
            console.log('No leases found for this unit');
            return;
        }
        
        // Step 2: Test fetching one lease individually
        console.log('\n2. Testing individual lease fetch...');
        const firstLeaseId = unitLeaseIds[0];
        console.log(`Fetching detailed info for lease: ${firstLeaseId}`);
        
        const detailedLease = await buildiumClient.getLeaseById(firstLeaseId);
        
        console.log('\n3. Detailed lease information:');
        console.log(`Lease ID: ${detailedLease.Id}`);
        console.log(`Status: ${detailedLease.LeaseStatus}`);
        console.log(`Property ID: ${detailedLease.PropertyId}`);
        console.log(`Unit ID: ${detailedLease.UnitId}`);
        console.log(`From: ${detailedLease.LeaseFromDate} to ${detailedLease.LeaseToDate}`);
        
        // Check tenant structure in detailed lease
        console.log('\n4. Tenant Information:');
        if (detailedLease.Tenants) {
            console.log(`Tenants array: ${detailedLease.Tenants.length} tenant(s)`);
            detailedLease.Tenants.forEach((tenant, idx) => {
                console.log(`  ${idx + 1}. ID: ${tenant.Id}, Status: ${tenant.Status}, Name: ${tenant.FirstName} ${tenant.LastName}`);
                if (tenant.MoveInDate) console.log(`     Move-in: ${tenant.MoveInDate}`);
            });
        } else {
            console.log('No Tenants array found');
        }
        
        if (detailedLease.CurrentTenants) {
            console.log(`CurrentTenants array: ${detailedLease.CurrentTenants.length} tenant(s)`);
            detailedLease.CurrentTenants.forEach((tenant, idx) => {
                console.log(`  ${idx + 1}. ID: ${tenant.Id}, Name: ${tenant.FirstName} ${tenant.LastName}`);
            });
        } else {
            console.log('No CurrentTenants array found');
        }
        
        // Show all properties containing 'tenant'
        console.log('\n5. All tenant-related properties:');
        Object.keys(detailedLease).forEach(key => {
            if (key.toLowerCase().includes('tenant')) {
                console.log(`${key}: ${JSON.stringify(detailedLease[key])}`);
            }
        });
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response?.data) {
            console.error('API Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testIndividualLeases();

const { BuildiumClient } = require('../index.js');
require('dotenv').config();

async function testLeaseRetrieval() {
    console.log('🔍 Testing Lease Retrieval Logic');
    console.log('=' .repeat(40));
    
    const buildiumClient = new BuildiumClient();
    
    try {
        // Get a unit
        console.log('1. Getting units...');
        const units = await buildiumClient.getAllUnits(1);
        const unit = units[0];
        console.log(`   Unit: ${unit.Id} (Property: ${unit.PropertyId})`);
        
        // Test the corrected lease fetching
        console.log('\n2. Testing getAllLeasesForUnit...');
        const startTime = Date.now();
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000);
        });
        
        const leasePromise = buildiumClient.getAllLeasesForUnit(unit.Id);
        
        const leases = await Promise.race([leasePromise, timeoutPromise]);
        
        const duration = Date.now() - startTime;
        console.log(`   Retrieved ${leases.length} leases in ${duration}ms`);
        
        // Show lease details
        leases.forEach((lease, index) => {
            console.log(`   Lease ${index + 1}: ID ${lease.Id}, Status: ${lease.LeaseStatus}, Tenants: ${lease.Tenants?.length || 0}`);
        });
        
        console.log('\n✅ Lease retrieval test completed successfully');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testLeaseRetrieval();

const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function showLeaseData() {
    try {
        console.log('[SEARCH] Fetching lease data to see structure...');
        
        // Get a few leases to see the structure
        const response = await axios.get('https://api.buildium.com/v1/leases', {
            headers: {
                'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID,
                'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET,
                'Content-Type': 'application/json'
            },
            params: {
                limit: 3
            }
        });
        
        console.log('\n[ITEM] Sample Lease Data Structure:');
        console.log('=' .repeat(60));
        
        response.data.forEach((lease, index) => {
            console.log(`\nLease ${index + 1}:`);
            console.log('  ID:', lease.Id);
            console.log('  Status:', lease.LeaseStatus);
            console.log('  From Date:', lease.LeaseFromDate);
            console.log('  To Date:', lease.LeaseToDate);
            console.log('  Unit ID:', lease.UnitId);
            console.log('  Property ID:', lease.PropertyId);
            console.log('  Tenant Count:', lease.Tenants ? lease.Tenants.length : 0);
            
            if (lease.Tenants && lease.Tenants.length > 0) {
                console.log('  First Tenant:', lease.Tenants[0].FirstName, lease.Tenants[0].LastName);
                console.log('  Tenant Email:', lease.Tenants[0].Email);
            }
        });
        
    } catch (error) {
        console.error('[FAIL] Error:', error.response?.data || error.message);
    }
}

showLeaseData();

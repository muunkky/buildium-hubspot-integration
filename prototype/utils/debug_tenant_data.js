const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function debugTenantData() {
    try {
        console.log('[SEARCH] Debugging tenant data structure...');
        
        // Get a specific lease to see tenant structure
        const response = await axios.get('https://api.buildium.com/v1/leases', {
            headers: {
                'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID,
                'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET,
                'Content-Type': 'application/json'
            },
            params: {
                unitids: 177194,  // The unit we just processed
                limit: 3
            }
        });
        
        console.log('\n[ITEM] Raw Lease Data for Unit 177194:');
        console.log('=' .repeat(60));
        
        response.data.forEach((lease, index) => {
            console.log(`\nLease ${index + 1} (ID: ${lease.Id}):`);
            console.log('  Status:', lease.LeaseStatus);
            console.log('  From Date:', lease.LeaseFromDate);
            console.log('  To Date:', lease.LeaseToDate);
            console.log('  Tenant Count:', lease.Tenants ? lease.Tenants.length : 0);
            
            if (lease.Tenants && lease.Tenants.length > 0) {
                console.log('  Tenants:');
                lease.Tenants.forEach((tenant, tIndex) => {
                    console.log(`    Tenant ${tIndex + 1}:`);
                    console.log('      Raw Tenant Object:', JSON.stringify(tenant, null, 6));
                    console.log('      FirstName:', tenant.FirstName);
                    console.log('      LastName:', tenant.LastName);
                    console.log('      Email:', tenant.Email);
                    console.log('      ID:', tenant.Id);
                });
            } else {
                console.log('  No tenants found in this lease');
            }
        });
        
    } catch (error) {
        console.error('[FAIL] Error:', error.response?.data || error.message);
    }
}

debugTenantData();

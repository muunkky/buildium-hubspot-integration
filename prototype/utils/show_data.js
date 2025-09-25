const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function showTenantData() {
  try {
    const response = await axios.get('https://api.buildium.com/v1/leases/tenants/318408', {
      headers: {
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('[ITEM] Complete Tenant Data Structure:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n Lease Information:');
    if (response.data.Leases && response.data.Leases.length > 0) {
      response.data.Leases.forEach((lease, index) => {
        console.log(`\nLease ${index + 1}:`);
        console.log(`  Lease ID: ${lease.Id}`);
        console.log(`  Unit: ${lease.UnitAddress}`);
        console.log(`  Rent: $${lease.Rent}`);
        console.log(`  Start: ${lease.LeaseFromDate}`);
        console.log(`  End: ${lease.LeaseToDate}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

showTenantData();

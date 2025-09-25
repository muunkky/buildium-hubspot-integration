/**
 * Check units data for property 140054 specifically
 */

const axios = require('axios');
require('dotenv').config();

async function checkProperty140054Units() {
    const buildiumAuth = Buffer.from(`${process.env.BUILDIUM_CLIENT_ID}:${process.env.BUILDIUM_CLIENT_SECRET}`).toString('base64');
    const baseURL = 'https://api.buildium.com';
    
    console.log('[SEARCH] Checking units for Property 140054...');
    console.log('-'.repeat(50));
    
    try {
        // First, get property details
        console.log('[ITEM] Getting property details...');
        const propertyResponse = await axios.get(
            `${baseURL}/v1/rentals/140054`,
            {
                headers: {
                    'Authorization': `Basic ${buildiumAuth}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const property = propertyResponse.data;
        console.log(`[OK] Property: ${property.Name} (ID: ${property.Id})`);
        console.log(`   Address: ${property.Address.AddressLine1}, ${property.Address.City}`);
        
        // Get units for this property
        console.log('\n Getting units for this property...');
        const unitsResponse = await axios.get(
            `${baseURL}/v1/rentals/140054/units`,
            {
                headers: {
                    'Authorization': `Basic ${buildiumAuth}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const units = unitsResponse.data;
        console.log(`[OK] Found ${units.length} unit(s):`);
        
        units.forEach((unit, index) => {
            console.log(`\n   Unit ${index + 1}:`);
            console.log(`     Unit ID: ${unit.Id} (${typeof unit.Id})`);
            console.log(`     Unit Number: ${unit.UnitNumber || 'N/A'}`);
            console.log(`     Property ID: ${unit.PropertyId || 'N/A'} (${typeof unit.PropertyId})`);
            console.log(`     Unit Type: ${unit.UnitType || 'N/A'}`);
            console.log(`     Address: ${unit.Address?.AddressLine1 || 'Same as property'}`);
            console.log(`     Market Rent: $${unit.MarketRent || 'N/A'}`);
        });
        
        // Also check if there are any leases for these units
        console.log('\n Checking for active leases...');
        try {
            const leasesResponse = await axios.get(
                `${baseURL}/v1/leases`,
                {
                    headers: {
                        'Authorization': `Basic ${buildiumAuth}`,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        propertyids: 140054,
                        leasestatus: 'Active'
                    }
                }
            );
            
            const leases = leasesResponse.data;
            console.log(`[OK] Found ${leases.length} active lease(s) for property 140054`);
            
            leases.forEach((lease, index) => {
                console.log(`   Lease ${index + 1}: ${lease.Id}`);
                console.log(`     Unit ID: ${lease.UnitId}`);
                console.log(`     Tenant(s): ${lease.Tenants?.map(t => `${t.FirstName} ${t.LastName}`).join(', ') || 'N/A'}`);
            });
            
        } catch (leaseError) {
            console.log('[WARN]️ Could not fetch lease data:', leaseError.response?.status);
        }
        
        console.log('\n[STATS] SUMMARY FOR PROPERTY 140054:');
        console.log(`   Property Name: ${property.Name}`);
        console.log(`   Total Units: ${units.length}`);
        if (units.length > 0) {
            console.log(`   Unit IDs: ${units.map(u => u.Id).join(', ')}`);
            console.log(`   Unit Numbers: ${units.map(u => u.UnitNumber || 'N/A').join(', ')}`);
        }
        
        return { property, units };
        
    } catch (error) {
        console.error('[FAIL] Error fetching data:', error.response?.data || error.message);
        throw error;
    }
}

if (require.main === module) {
    checkProperty140054Units()
        .then(() => console.log('\n[OK] Unit data check complete'))
        .catch(console.error);
}

module.exports = checkProperty140054Units;

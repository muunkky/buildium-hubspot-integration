/**
 * Get Total Contact Count from Buildium - Simple Version
 */

const path = require('path');

// Change to the main directory to load the modules
process.chdir(path.join(__dirname, '..'));

// Now require the main module
const { BuildiumClient, HubSpotClient } = require('./index.js');

async function getTotalBuildiumContacts() {
    console.log('🏢 Getting total contact count from Buildium...\n');

    try {
        const buildium = new BuildiumClient();

        // Get owners count
        console.log('📊 1. Counting Owners...');
        const rentalOwners = await buildium.getAllOwners('rental');
        const ownersCount = rentalOwners.length;
        console.log(`   📋 Rental owners: ${ownersCount}`);
        
        // Get tenants count
        console.log('📊 2. Counting Tenants...');
        let totalTenants = 0;
        let offset = 0;
        const batchSize = 100;
        let hasMore = true;

        while (hasMore) {
            const tenants = await buildium.getAllTenants(batchSize, offset);
            
            if (tenants && tenants.length > 0) {
                totalTenants += tenants.length;
                offset += batchSize;
                hasMore = tenants.length === batchSize;
                
                if (totalTenants % 500 === 0 || !hasMore) {
                    console.log(`   📊 Counted ${totalTenants} tenants so far...`);
                }
            } else {
                hasMore = false;
            }
        }

        console.log(`   🏠 Total tenants found: ${totalTenants}`);

        const totalBuildium = ownersCount + totalTenants;

        console.log('\n📈 BUILDIUM CONTACT SUMMARY:');
        console.log('============================');
        console.log(`📋 Owners: ${ownersCount}`);
        console.log(`🏠 Tenants: ${totalTenants}`);
        console.log(`🎯 TOTAL BUILDIUM CONTACTS: ${totalBuildium}`);

        console.log('\n🔍 COMPARISON WITH HUBSPOT IMPORT:');
        console.log('==================================');
        console.log(`📊 Buildium Total: ${totalBuildium}`);
        console.log(`📈 HubSpot Import (last week): ~1,555`);
        
        const difference = Math.abs(totalBuildium - 1555);
        if (difference < 200) {
            console.log('✅ CLOSE MATCH: Buildium count roughly matches HubSpot import');
            console.log('   The bulk import was likely mostly Buildium data');
        } else if (totalBuildium > 1555) {
            console.log(`📊 Buildium has ${difference} MORE contacts than imported`);
            console.log('   Possible reasons: filtering, duplicates removed, or partial import');
        } else {
            console.log(`📊 HubSpot import has ${difference} MORE than Buildium`);
            console.log('   Possible reasons: duplicates created, or other data sources');
        }

        // Detailed analysis
        console.log('\n🔍 DETAILED ANALYSIS:');
        console.log('====================');
        if (totalBuildium > 0) {
            const ownerPercentage = ((ownersCount / totalBuildium) * 100).toFixed(1);
            const tenantPercentage = ((totalTenants / totalBuildium) * 100).toFixed(1);
            console.log(`📊 Owners: ${ownersCount} (${ownerPercentage}%)`);
            console.log(`📊 Tenants: ${totalTenants} (${tenantPercentage}%)`);
            
            const ratio = ownersCount > 0 ? (totalTenants / ownersCount).toFixed(1) : 'N/A';
            console.log(`📊 Tenant-to-Owner Ratio: ${ratio}:1`);
        }

        return {
            owners: ownersCount,
            tenants: totalTenants,
            total: totalBuildium
        };

    } catch (error) {
        console.error('❌ Error getting Buildium contact counts:', error.message);
        console.error('Stack:', error.stack);
        return null;
    }
}

// Run the function
getTotalBuildiumContacts().catch(console.error);

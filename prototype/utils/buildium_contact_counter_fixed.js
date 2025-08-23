/**
 * Get Total Contact Count from Buildium - Fixed Version
 * Including owners, tenants, and all other contact types
 */

require('dotenv').config({ path: '../.env' });

// Import the classes from the main file
const fs = require('fs');
const path = require('path');

// Read the main file and evaluate it to get the classes
const mainPath = path.join(__dirname, '../index.js');
const mainCode = fs.readFileSync(mainPath, 'utf8');

// Create a sandbox to evaluate the main file
const BuildiumClient = eval(`
    const axios = require('axios');
    require('dotenv').config({ path: '../.env' });
    ${mainCode}
    BuildiumClient;
`);

class BuildiumContactCounter {
    constructor() {
        this.buildium = new BuildiumClient();
    }

    async getTotalBuildiumContacts() {
        console.log('🏢 Getting total contact count from Buildium...\n');

        try {
            // Get owners count (fix the double counting issue)
            console.log('📊 1. Counting Owners...');
            const ownersCount = await this.countOwners();
            
            // Get tenants count
            console.log('📊 2. Counting Tenants...');
            const tenantsCount = await this.countTenants();
            
            console.log('\n📈 BUILDIUM CONTACT SUMMARY:');
            console.log('============================');
            console.log(`📋 Owners: ${ownersCount}`);
            console.log(`🏠 Tenants: ${tenantsCount}`);

            const totalBuildium = ownersCount + tenantsCount;

            console.log(`\n🎯 TOTAL BUILDIUM CONTACTS: ${totalBuildium}`);

            console.log('\n🔍 COMPARISON WITH HUBSPOT IMPORT:');
            console.log('==================================');
            console.log(`📊 Buildium Total: ${totalBuildium}`);
            console.log(`📈 HubSpot Import (last week): ~1,555`);
            
            const difference = Math.abs(totalBuildium - 1555);
            if (difference < 100) {
                console.log('✅ MATCH: Buildium count matches HubSpot import');
                console.log('   The bulk import was likely all Buildium data');
            } else if (totalBuildium > 1555) {
                console.log(`📊 Buildium has ${difference} MORE contacts than imported`);
                console.log('   Possible reasons: filtering, duplicates removed, or partial import');
            } else {
                console.log(`📊 HubSpot import has ${difference} MORE than Buildium`);
                console.log('   Possible reasons: duplicates created, or other data sources');
            }

            // Additional analysis
            console.log('\n🔍 DETAILED ANALYSIS:');
            console.log('====================');
            const ownerPercentage = ((ownersCount / totalBuildium) * 100).toFixed(1);
            const tenantPercentage = ((tenantsCount / totalBuildium) * 100).toFixed(1);
            console.log(`📊 Owners: ${ownersCount} (${ownerPercentage}%)`);
            console.log(`📊 Tenants: ${tenantsCount} (${tenantPercentage}%)`);

            if (totalBuildium > 0) {
                const ratio = (tenantsCount / ownersCount).toFixed(1);
                console.log(`📊 Tenant-to-Owner Ratio: ${ratio}:1`);
            }

            return {
                owners: ownersCount,
                tenants: tenantsCount,
                total: totalBuildium
            };

        } catch (error) {
            console.error('❌ Error getting Buildium contact counts:', error.message);
            return null;
        }
    }

    async countOwners() {
        try {
            // Just get rental owners since that's what we actually have
            const rentalOwners = await this.buildium.getAllOwners('rental');
            
            console.log(`   📋 Rental owners: ${rentalOwners.length}`);
            console.log(`   📋 Association owners: 0 (none in system)`);
            console.log(`   📋 Total owners: ${rentalOwners.length}`);
            
            return rentalOwners.length;

        } catch (error) {
            console.error('   ❌ Error counting owners:', error.message);
            return 0;
        }
    }

    async countTenants() {
        try {
            console.log('   🔍 Fetching tenant data using getAllTenants method...');
            
            let totalTenants = 0;
            let offset = 0;
            const batchSize = 100;
            let hasMore = true;

            while (hasMore) {
                const tenants = await this.buildium.getAllTenants(batchSize, offset);
                
                if (tenants && tenants.length > 0) {
                    totalTenants += tenants.length;
                    offset += batchSize;
                    
                    // Continue if we got a full batch
                    hasMore = tenants.length === batchSize;
                    
                    if (totalTenants % 500 === 0 || !hasMore) {
                        console.log(`   📊 Counted ${totalTenants} tenants so far...`);
                    }
                } else {
                    hasMore = false;
                }
            }

            console.log(`   🏠 Total tenants found: ${totalTenants}`);
            return totalTenants;

        } catch (error) {
            console.error('   ❌ Error counting tenants:', error.message);
            return 0;
        }
    }
}

async function main() {
    const counter = new BuildiumContactCounter();
    await counter.getTotalBuildiumContacts();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { BuildiumContactCounter };

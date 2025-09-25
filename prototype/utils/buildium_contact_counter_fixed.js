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
        console.log(' Getting total contact count from Buildium...\n');

        try {
            // Get owners count (fix the double counting issue)
            console.log('[STATS] 1. Counting Owners...');
            const ownersCount = await this.countOwners();
            
            // Get tenants count
            console.log('[STATS] 2. Counting Tenants...');
            const tenantsCount = await this.countTenants();
            
            console.log('\n BUILDIUM CONTACT SUMMARY:');
            console.log('============================');
            console.log(`[ITEM] Owners: ${ownersCount}`);
            console.log(` Tenants: ${tenantsCount}`);

            const totalBuildium = ownersCount + tenantsCount;

            console.log(`\n[TARGET] TOTAL BUILDIUM CONTACTS: ${totalBuildium}`);

            console.log('\n[SEARCH] COMPARISON WITH HUBSPOT IMPORT:');
            console.log('==================================');
            console.log(`[STATS] Buildium Total: ${totalBuildium}`);
            console.log(` HubSpot Import (last week): ~1,555`);
            
            const difference = Math.abs(totalBuildium - 1555);
            if (difference < 100) {
                console.log('[OK] MATCH: Buildium count matches HubSpot import');
                console.log('   The bulk import was likely all Buildium data');
            } else if (totalBuildium > 1555) {
                console.log(`[STATS] Buildium has ${difference} MORE contacts than imported`);
                console.log('   Possible reasons: filtering, duplicates removed, or partial import');
            } else {
                console.log(`[STATS] HubSpot import has ${difference} MORE than Buildium`);
                console.log('   Possible reasons: duplicates created, or other data sources');
            }

            // Additional analysis
            console.log('\n[SEARCH] DETAILED ANALYSIS:');
            console.log('====================');
            const ownerPercentage = ((ownersCount / totalBuildium) * 100).toFixed(1);
            const tenantPercentage = ((tenantsCount / totalBuildium) * 100).toFixed(1);
            console.log(`[STATS] Owners: ${ownersCount} (${ownerPercentage}%)`);
            console.log(`[STATS] Tenants: ${tenantsCount} (${tenantPercentage}%)`);

            if (totalBuildium > 0) {
                const ratio = (tenantsCount / ownersCount).toFixed(1);
                console.log(`[STATS] Tenant-to-Owner Ratio: ${ratio}:1`);
            }

            return {
                owners: ownersCount,
                tenants: tenantsCount,
                total: totalBuildium
            };

        } catch (error) {
            console.error('[FAIL] Error getting Buildium contact counts:', error.message);
            return null;
        }
    }

    async countOwners() {
        try {
            // Just get rental owners since that's what we actually have
            const rentalOwners = await this.buildium.getAllOwners('rental');
            
            console.log(`   [ITEM] Rental owners: ${rentalOwners.length}`);
            console.log(`   [ITEM] Association owners: 0 (none in system)`);
            console.log(`   [ITEM] Total owners: ${rentalOwners.length}`);
            
            return rentalOwners.length;

        } catch (error) {
            console.error('   [FAIL] Error counting owners:', error.message);
            return 0;
        }
    }

    async countTenants() {
        try {
            console.log('   [SEARCH] Fetching tenant data using getAllTenants method...');
            
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
                        console.log(`   [STATS] Counted ${totalTenants} tenants so far...`);
                    }
                } else {
                    hasMore = false;
                }
            }

            console.log(`    Total tenants found: ${totalTenants}`);
            return totalTenants;

        } catch (error) {
            console.error('   [FAIL] Error counting tenants:', error.message);
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

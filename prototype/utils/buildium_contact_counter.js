/**
 * Get Total Contact Count from Buildium
 * Including owners, tenants, and all other contact types
 */

require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');

class BuildiumContactCounter {
    constructor() {
        this.buildium = new BuildiumClient(
            process.env.BUILDIUM_CLIENT_ID,
            process.env.BUILDIUM_CLIENT_SECRET
        );
    }

    async getTotalBuildiumContacts() {
        console.log('🏢 Getting total contact count from Buildium...\n');

        try {
            // Get owners count
            console.log('📊 1. Counting Owners...');
            const ownersCount = await this.countOwners();
            
            // Get tenants count
            console.log('📊 2. Counting Tenants...');
            const tenantsCount = await this.countTenants();
            
            // Get other contact types if they exist
            console.log('📊 3. Checking for other contact types...');
            const otherContacts = await this.checkOtherContactTypes();

            console.log('\n📈 BUILDIUM CONTACT SUMMARY:');
            console.log('============================');
            console.log(`📋 Owners: ${ownersCount}`);
            console.log(`🏠 Tenants: ${tenantsCount}`);
            
            if (otherContacts.length > 0) {
                otherContacts.forEach(type => {
                    console.log(`${type.icon} ${type.name}: ${type.count}`);
                });
            }

            const totalBuildium = ownersCount + tenantsCount + 
                otherContacts.reduce((sum, type) => sum + type.count, 0);

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

            return {
                owners: ownersCount,
                tenants: tenantsCount,
                others: otherContacts,
                total: totalBuildium
            };

        } catch (error) {
            console.error('❌ Error getting Buildium contact counts:', error.message);
            return null;
        }
    }

    async countOwners() {
        try {
            // Get both rental and association owners
            const rentalOwners = await this.buildium.getAllOwners('rental');
            const associationOwners = await this.buildium.getAllOwners('association');
            
            const totalOwners = rentalOwners.length + associationOwners.length;
            console.log(`   📋 Rental owners: ${rentalOwners.length}`);
            console.log(`   📋 Association owners: ${associationOwners.length}`);
            console.log(`   📋 Total owners: ${totalOwners}`);
            
            return totalOwners;

        } catch (error) {
            console.error('   ❌ Error counting owners:', error.message);
            return 0;
        }
    }

    async countTenants() {
        try {
            // Get tenants - need to check if there's a direct count method
            console.log('   🔍 Fetching tenant data...');
            
            // Try to get a sample to understand tenant API structure
            const sampleResponse = await this.buildium.makeRequest('/v1/leases/tenants', {
                offset: 0,
                limit: 100
            });

            if (sampleResponse && sampleResponse.data) {
                // If we can get total count from the API response
                const totalTenants = sampleResponse.data.TotalCount || sampleResponse.data.length || 0;
                console.log(`   🏠 Found ${totalTenants} tenants (from sample or total count)`);
                
                // If this is just a sample, we need to get the full count
                if (sampleResponse.data.length === 100 && !sampleResponse.data.TotalCount) {
                    console.log('   📊 Getting full tenant count (this may take a moment)...');
                    return await this.getFullTenantCount();
                }
                
                return totalTenants;
            } else {
                console.log('   ⚠️ Unable to get tenant count - trying alternative method');
                return await this.getTenantCountViaLeases();
            }

        } catch (error) {
            console.error('   ❌ Error counting tenants:', error.message);
            console.log('   📊 Trying alternative tenant counting method...');
            return await this.getTenantCountViaLeases();
        }
    }

    async getFullTenantCount() {
        try {
            let totalTenants = 0;
            let offset = 0;
            const limit = 100;
            let hasMore = true;

            while (hasMore) {
                const response = await this.buildium.makeRequest('/v1/leases/tenants', {
                    offset,
                    limit
                });

                if (response && response.data && response.data.length > 0) {
                    totalTenants += response.data.length;
                    hasMore = response.data.length === limit;
                    offset += limit;
                    
                    if (offset % 500 === 0) {
                        console.log(`   📊 Counted ${totalTenants} tenants so far...`);
                    }
                } else {
                    hasMore = false;
                }
            }

            console.log(`   🏠 Total tenants found: ${totalTenants}`);
            return totalTenants;

        } catch (error) {
            console.error('   ❌ Error getting full tenant count:', error.message);
            return 0;
        }
    }

    async getTenantCountViaLeases() {
        try {
            console.log('   📊 Counting tenants via lease agreements...');
            
            const response = await this.buildium.makeRequest('/v1/leases', {
                offset: 0,
                limit: 1
            });

            if (response && response.data && response.data.TotalCount) {
                // Approximate - each lease might have 1-2 tenants
                const leaseCount = response.data.TotalCount;
                const estimatedTenants = Math.round(leaseCount * 1.3); // Rough estimate
                console.log(`   🏠 Estimated ${estimatedTenants} tenants (based on ${leaseCount} leases)`);
                return estimatedTenants;
            }

            return 0;

        } catch (error) {
            console.error('   ❌ Error counting via leases:', error.message);
            return 0;
        }
    }

    async checkOtherContactTypes() {
        const otherTypes = [];
        
        try {
            // Check for vendors
            console.log('   🔍 Checking for vendors...');
            const vendorResponse = await this.buildium.makeRequest('/v1/vendors', {
                offset: 0,
                limit: 1
            });
            
            if (vendorResponse && vendorResponse.data) {
                const vendorCount = vendorResponse.data.TotalCount || 0;
                if (vendorCount > 0) {
                    otherTypes.push({
                        name: 'Vendors',
                        count: vendorCount,
                        icon: '🔧'
                    });
                    console.log(`   🔧 Found ${vendorCount} vendors`);
                }
            }

        } catch (error) {
            console.log('   ℹ️ No vendor data available');
        }

        try {
            // Check for prospects/applicants
            console.log('   🔍 Checking for applicants...');
            const applicantResponse = await this.buildium.makeRequest('/v1/applicants', {
                offset: 0,
                limit: 1
            });
            
            if (applicantResponse && applicantResponse.data) {
                const applicantCount = applicantResponse.data.TotalCount || 0;
                if (applicantCount > 0) {
                    otherTypes.push({
                        name: 'Applicants',
                        count: applicantCount,
                        icon: '📝'
                    });
                    console.log(`   📝 Found ${applicantCount} applicants`);
                }
            }

        } catch (error) {
            console.log('   ℹ️ No applicant data available');
        }

        return otherTypes;
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

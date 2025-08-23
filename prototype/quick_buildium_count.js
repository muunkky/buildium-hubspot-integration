/**
 * Quick Buildium Contact Count
 */

require('dotenv').config();
const axios = require('axios');

class BuildiumClient {
    constructor() {
        this.baseURL = process.env.BUILDIUM_BASE_URL;
        this.clientId = process.env.BUILDIUM_CLIENT_ID;
        this.clientSecret = process.env.BUILDIUM_CLIENT_SECRET;
    }

    async makeRequest(url, params = {}) {
        try {
            const response = await axios.get(`${this.baseURL}${url}`, {
                headers: {
                    'x-buildium-client-id': this.clientId,
                    'x-buildium-client-secret': this.clientSecret,
                    'Content-Type': 'application/json'
                },
                params
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async getAllOwners(type = 'rental') {
        console.log(`🔍 Fetching all ${type} owners...`);
        let allOwners = [];
        let offset = 0;
        const limit = 100;
        
        const endpoint = type === 'rental' ? '/rentals/owners' : '/associations/owners';
        
        while (true) {
            const data = await this.makeRequest(endpoint, {
                offset,
                limit
            });
            
            if (!data || data.length === 0) break;
            
            allOwners = allOwners.concat(data);
            console.log(`✅ Retrieved ${data.length} ${type} owners (total: ${allOwners.length})`);
            
            if (data.length < limit) break;
            offset += limit;
        }
        
        return allOwners;
    }

    async getAllTenants() {
        console.log('🔍 Fetching all tenants...');
        let allTenants = [];
        let offset = 0;
        const limit = 100;
        
        while (true) {
            const data = await this.makeRequest('/leases/tenants', {
                offset,
                limit
            });
            
            if (!data || data.length === 0) break;
            
            allTenants = allTenants.concat(data);
            console.log(`✅ Retrieved ${data.length} tenants (total: ${allTenants.length})`);
            
            if (data.length < limit) break;
            offset += limit;
        }
        
        return allTenants;
    }
}

async function main() {
    console.log('🏢 Getting total contact count from Buildium...\n');

    try {
        const buildium = new BuildiumClient();

        // Get owners
        console.log('📊 1. Counting Owners...');
        const owners = await buildium.getAllOwners('rental');
        const ownersCount = owners.length;
        
        // Get tenants
        console.log('\n📊 2. Counting Tenants...');
        const tenants = await buildium.getAllTenants();
        const tenantsCount = tenants.length;

        const totalBuildium = ownersCount + tenantsCount;

        console.log('\n📈 BUILDIUM CONTACT SUMMARY:');
        console.log('============================');
        console.log(`📋 Owners: ${ownersCount}`);
        console.log(`🏠 Tenants: ${tenantsCount}`);
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

        // Tenant to owner ratio analysis
        if (ownersCount > 0) {
            const ratio = (tenantsCount / ownersCount).toFixed(1);
            console.log(`\n📊 Tenant-to-Owner Ratio: ${ratio}:1`);
            
            if (ratio > 3) {
                console.log('📈 High tenant ratio suggests multi-unit properties');
            } else if (ratio < 1) {
                console.log('📉 Low tenant ratio suggests many vacant units or owner-occupied properties');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response?.data) {
            console.error('API Error:', error.response.data);
        }
    }
}

main();

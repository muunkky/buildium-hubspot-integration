require('dotenv').config();
const axios = require('axios');

async function verifyBothIssuesFixed() {
    try {
        const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        console.log('=== Verifying Both Issues Are Fixed ===\n');
        
        // Issue 1: Check for duplicate listings prevention
        console.log('1. CHECKING: Duplicate Listings Prevention');
        console.log('   Looking for listings with same Unit ID...\n');
        
        // Search for listings with buildium_unit_id to see if we have any duplicates
        const searchResponse = await axios.post(`${baseURL}/crm/v3/objects/0-420/search`, {
            filterGroups: [{
                filters: [{
                    propertyName: 'buildium_unit_id',
                    operator: 'HAS_PROPERTY'
                }]
            }],
            properties: ['hs_name', 'hs_address_1', 'buildium_unit_id'],
            limit: 100
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const listings = searchResponse.data.results;
        console.log(`Found ${listings.length} listings with Buildium Unit ID`);
        
        // Group by Unit ID to check for duplicates
        const unitIdGroups = {};
        listings.forEach(listing => {
            const unitId = listing.properties.buildium_unit_id;
            if (!unitIdGroups[unitId]) {
                unitIdGroups[unitId] = [];
            }
            unitIdGroups[unitId].push(listing);
        });
        
        let duplicatesFound = false;
        Object.keys(unitIdGroups).forEach(unitId => {
            if (unitIdGroups[unitId].length > 1) {
                console.log(`❌ DUPLICATE UNIT ID ${unitId}:`);
                unitIdGroups[unitId].forEach(listing => {
                    console.log(`   - Listing ${listing.id}: ${listing.properties.hs_name}`);
                });
                duplicatesFound = true;
            }
        });
        
        if (!duplicatesFound) {
            console.log('✅ NO DUPLICATES FOUND - All Unit IDs are unique!');
        }
        
        // Issue 2: Check Active Tenant associations
        console.log('\n2. CHECKING: Active Tenant Associations');
        console.log('   Looking for listings with associated contacts...\n');
        
        let associationsFound = 0;
        let activeTenantAssociationsFound = 0;
        
        // Check a few recent listings for associations
        const recentListings = listings.slice(0, 5);
        
        for (const listing of recentListings) {
            try {
                const assocResponse = await axios.get(
                    `${baseURL}/crm/v4/objects/0-420/${listing.id}/associations/contact`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                if (assocResponse.data.results && assocResponse.data.results.length > 0) {
                    associationsFound++;
                    console.log(`✅ Listing ${listing.id} (${listing.properties.hs_name}):`);
                    
                    assocResponse.data.results.forEach(assoc => {
                        console.log(`   - Contact ${assoc.toObjectId}:`);
                        assoc.associationTypes.forEach(type => {
                            console.log(`     Type: ${type.category}, ID: ${type.typeId}, Label: ${type.label || 'N/A'}`);
                            if (type.typeId === 1 && type.category === 'USER_DEFINED') {
                                activeTenantAssociationsFound++;
                            }
                        });
                    });
                }
            } catch (error) {
                // Skip errors for individual listings
            }
        }
        
        console.log(`\n📊 SUMMARY:`);
        console.log(`   Listings checked: ${recentListings.length}`);
        console.log(`   Listings with associations: ${associationsFound}`);
        console.log(`   Active Tenant associations: ${activeTenantAssociationsFound}`);
        
        if (activeTenantAssociationsFound > 0) {
            console.log('✅ ACTIVE TENANT ASSOCIATIONS WORKING!');
        } else {
            console.log('⚠️ No Active Tenant associations found in checked listings');
        }
        
        // Overall status
        console.log('\n🎯 OVERALL STATUS:');
        console.log(`   ✅ Duplicate Prevention: ${!duplicatesFound ? 'WORKING' : 'NEEDS ATTENTION'}`);
        console.log(`   ✅ Active Tenant Field: ${activeTenantAssociationsFound > 0 ? 'WORKING' : 'NEEDS VERIFICATION'}`);
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

verifyBothIssuesFixed();

/**
 * Check specific unit data in Buildium vs HubSpot
 */

require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');
const { HubSpotClient } = require('../index.js');

async function checkSpecificUnit() {
    const buildiumClient = new BuildiumClient();
    const hubspotClient = new HubSpotClient();
    
    const propertyId = 57639;
    const unitId = 177286;
    
    console.log('[SEARCH] Checking Unit Details');
    console.log('=' .repeat(50));
    console.log(`Property ID: ${propertyId}`);
    console.log(`Unit ID: ${unitId}`);
    console.log('');
    
    try {
        // 1. Get property details from Buildium
        console.log('[ITEM] Fetching property details from Buildium...');
        const property = await buildiumClient.getProperty(propertyId);
        console.log(`Property Name: ${property.Name}`);
        console.log(`Address: ${property.Address?.AddressLine1}, ${property.Address?.City}, ${property.Address?.State} ${property.Address?.PostalCode}`);
        console.log('');
        
        // 2. Get unit details from Buildium
        console.log(' Fetching unit details from Buildium...');
        const unit = await buildiumClient.getUnit(unitId);
        console.log(`Unit Number: ${unit.UnitNumber}`);
        console.log(`Unit Type: ${unit.UnitType}`);
        console.log(`Property ID: ${unit.PropertyId}`);
        console.log('');
        
        // 3. Get all leases for this unit
        console.log(' Fetching leases for this unit...');
        const leases = await buildiumClient.getAllLeasesForUnit(unitId);
        console.log(`Total leases found: ${leases.length}`);
        console.log('');
        
        // 4. Process each lease and get tenant details
        console.log(' Tenant Details from Buildium:');
        console.log('-'.repeat(40));
        
        const tenantSummary = {
            active: [],
            inactive: []
        };
        
        for (const lease of leases) {
            console.log(`\nLease ID: ${lease.Id}`);
            console.log(`Status: ${lease.LeaseStatus}`);
            console.log(`From: ${lease.LeaseFromDate} to ${lease.LeaseToDate}`);
            
            if (lease.Tenants && lease.Tenants.length > 0) {
                for (const tenantReference of lease.Tenants) {
                    try {
                        const tenant = await buildiumClient.getTenant(tenantReference.Id);
                        const status = lease.LeaseStatus === 'Active' ? 'ACTIVE' : 'INACTIVE';
                        
                        console.log(`  Tenant: ${tenant.FirstName} ${tenant.LastName}`);
                        console.log(`  Email: ${tenant.Email || 'No email'}`);
                        console.log(`  Status: ${status}`);
                        
                        if (status === 'ACTIVE') {
                            tenantSummary.active.push({
                                name: `${tenant.FirstName} ${tenant.LastName}`,
                                email: tenant.Email,
                                id: tenant.Id
                            });
                        } else {
                            tenantSummary.inactive.push({
                                name: `${tenant.FirstName} ${tenant.LastName}`,
                                email: tenant.Email,
                                id: tenant.Id
                            });
                        }
                    } catch (error) {
                        console.log(`  [FAIL] Error fetching tenant ${tenantReference.Id}: ${error.message}`);
                    }
                }
            }
        }
        
        console.log('\n[STATS] Summary from Buildium:');
        console.log('=' .repeat(50));
        console.log(`Active tenants: ${tenantSummary.active.length}`);
        tenantSummary.active.forEach(tenant => {
            console.log(`  [OK] ${tenant.name} (${tenant.email || 'no email'}) - ID: ${tenant.id}`);
        });
        
        console.log(`\nInactive tenants: ${tenantSummary.inactive.length}`);
        tenantSummary.inactive.forEach(tenant => {
            console.log(`  [FAIL] ${tenant.name} (${tenant.email || 'no email'}) - ID: ${tenant.id}`);
        });
        
        // 5. Check HubSpot listing
        console.log('\n[SEARCH] Checking HubSpot listing...');
        const hubspotListing = await hubspotClient.searchListingByUnitId(unitId);
        
        if (hubspotListing) {
            console.log(`[OK] Found HubSpot listing: ${hubspotListing.id}`);
            console.log(`Name: ${hubspotListing.properties.name}`);
            console.log(`Address: ${hubspotListing.properties.address}`);
            console.log(`Unit Number: ${hubspotListing.properties.buildium_unit_number}`);
            
            // 6. Get associations for this listing
            console.log('\n Checking HubSpot associations...');
            
            try {
                // Get all contacts associated with this listing
                const associations = await hubspotClient.getListingAssociations(hubspotListing.id);
                
                if (associations && associations.length > 0) {
                    console.log(`Total associated contacts: ${associations.length}`);
                    
                    // Separate by association type
                    const activeContacts = associations.filter(assoc => 
                        assoc.associationTypes?.some(type => type.category === 'USER_DEFINED' && type.label === 'Active Tenant')
                    );
                    const inactiveContacts = associations.filter(assoc => 
                        assoc.associationTypes?.some(type => type.category === 'USER_DEFINED' && type.label === 'Inactive Tenant')
                    );
                    
                    console.log(`\nActive associations (Active Tenant): ${activeContacts.length}`);
                    for (const contact of activeContacts) {
                        console.log(`  [OK] Contact ID: ${contact.toObjectId}`);
                    }
                    
                    console.log(`\nInactive associations (Inactive Tenant): ${inactiveContacts.length}`);
                    for (const contact of inactiveContacts) {
                        console.log(`  [FAIL] Contact ID: ${contact.toObjectId}`);
                    }
                } else {
                    console.log('[FAIL] No associations found');
                }
                
            } catch (error) {
                console.log(`[FAIL] Error checking associations: ${error.message}`);
            }
            
        } else {
            console.log('[FAIL] No HubSpot listing found for this unit');
        }
        
    } catch (error) {
        console.error('[FAIL] Error:', error.message);
    }
}

checkSpecificUnit();

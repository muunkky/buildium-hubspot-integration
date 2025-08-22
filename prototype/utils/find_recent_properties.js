/**
 * Find recent properties in Buildium for testing
 */

require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');

async function findRecentProperties() {
    const buildiumClient = new BuildiumClient();
    
    console.log('🔍 Finding Recent Properties in Buildium');
    console.log('=' .repeat(50));
    
    try {
        // Get recent units first
        console.log('📋 Fetching recent units from Buildium...');
        const units = await buildiumClient.getAllUnits(100, 0); // Get 100 units
        
        console.log(`📊 Found ${units.length} units`);
        console.log('');
        
        // Group units by property and analyze activity
        const propertyMap = new Map();
        
        for (const unit of units.slice(0, 30)) { // Check first 30 units
            try {
                console.log(`\n🏠 Unit: ${unit.UnitNumber || unit.Id} (Property ID: ${unit.PropertyId})`);
                
                // Get property details if we haven't seen this property yet
                let propertyInfo = propertyMap.get(unit.PropertyId);
                if (!propertyInfo) {
                    try {
                        const property = await buildiumClient.getProperty(unit.PropertyId);
                        propertyInfo = {
                            id: property.Id,
                            name: property.Name,
                            address: `${property.Address?.AddressLine1}, ${property.Address?.City}, ${property.Address?.State} ${property.Address?.PostalCode}`,
                            units: [],
                            totalTenants: 0,
                            activeTenants: 0,
                            inactiveTenants: 0,
                            lastActivity: null
                        };
                        propertyMap.set(unit.PropertyId, propertyInfo);
                        console.log(`   📍 Property: ${propertyInfo.name}`);
                        console.log(`   📍 Address: ${propertyInfo.address}`);
                    } catch (error) {
                        console.log(`   ❌ Error fetching property: ${error.message}`);
                        continue;
                    }
                }
                
                propertyInfo.units.push(unit);
                
                // Get leases for this unit
                try {
                    const leases = await buildiumClient.getAllLeasesForUnit(unit.Id);
                    console.log(`   📄 Leases: ${leases.length}`);
                    
                    for (const lease of leases) {
                        if (lease.Tenants && lease.Tenants.length > 0) {
                            propertyInfo.totalTenants += lease.Tenants.length;
                            
                            if (lease.LeaseStatus === 'Active') {
                                propertyInfo.activeTenants += lease.Tenants.length;
                                console.log(`   ✅ Active lease with ${lease.Tenants.length} tenants`);
                            } else {
                                propertyInfo.inactiveTenants += lease.Tenants.length;
                                console.log(`   ❌ ${lease.LeaseStatus} lease with ${lease.Tenants.length} tenants`);
                            }
                            
                            // Track most recent activity
                            const leaseDate = new Date(lease.LeaseFromDate);
                            if (!propertyInfo.lastActivity || leaseDate > propertyInfo.lastActivity) {
                                propertyInfo.lastActivity = leaseDate;
                            }
                        }
                    }
                } catch (error) {
                    console.log(`   ❌ Error fetching leases: ${error.message}`);
                }
                
            } catch (error) {
                console.log(`   ❌ Error analyzing unit: ${error.message}`);
            }
        }
        
        // Convert to array and sort by activity
        const recentProperties = Array.from(propertyMap.values())
            .filter(prop => prop.totalTenants > 0) // Only properties with tenants
            .map(prop => ({
                ...prop,
                score: prop.activeTenants * 3 + prop.inactiveTenants + (prop.units.length * 0.5)
            }))
            .sort((a, b) => b.score - a.score);
        
        console.log('\n🏆 Top Recent Properties for Testing:');
        console.log('=' .repeat(60));
        
        recentProperties.slice(0, 5).forEach((prop, index) => {
            console.log(`\n${index + 1}. ${prop.name} (ID: ${prop.id})`);
            console.log(`   Address: ${prop.address}`);
            console.log(`   Units analyzed: ${prop.units.length}`);
            console.log(`   Tenants: ${prop.totalTenants} total (${prop.activeTenants} active, ${prop.inactiveTenants} inactive)`);
            console.log(`   Activity Score: ${prop.score.toFixed(1)}`);
            if (prop.lastActivity) {
                console.log(`   Last activity: ${prop.lastActivity.toISOString().split('T')[0]}`);
            }
        });
        
        if (recentProperties.length > 0) {
            const topProperty = recentProperties[0];
            console.log('\n💡 Recommended for testing:');
            console.log(`   Property ID: ${topProperty.id}`);
            console.log(`   Name: ${topProperty.name}`);
            console.log(`   Units to sync: ${Math.min(5, topProperty.units.length)}`);
            console.log(`   Command: node index.js units --limit ${Math.min(5, topProperty.units.length)}`);
            
            // Show specific unit IDs for targeted testing
            console.log('\n🎯 Specific units in this property:');
            topProperty.units.slice(0, 5).forEach((unit, index) => {
                console.log(`   ${index + 1}. Unit ${unit.UnitNumber || unit.Id} (ID: ${unit.Id})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error finding recent properties:', error.message);
    }
}

findRecentProperties();

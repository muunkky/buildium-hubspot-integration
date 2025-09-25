require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');

/**
 * Test association owners vs rental owners to understand condo board contacts
 */
async function testAssociationOwners() {
    console.log(' Testing Association Owners vs Rental Owners');
    console.log('=' .repeat(60));
    
    const buildium = new BuildiumClient();
    
    try {
        console.log('\n[STATS] Fetching rental owners...');
        const rentalOwners = await buildium.getRentalOwners({ limit: 10 });
        console.log(`Found ${rentalOwners.length} rental owners`);
        
        console.log('\n️ Fetching association owners...');
        const associationOwners = await buildium.getAssociationOwners({ limit: 10 });
        console.log(`Found ${associationOwners.length} association owners`);
        
        // Compare data structures
        console.log('\n[ITEM] Rental Owner Sample:');
        if (rentalOwners.length > 0) {
            const sample = rentalOwners[0];
            Object.entries(sample).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    console.log(`  ${key}: ${value}`);
                }
            });
        }
        
        console.log('\n[ITEM] Association Owner Sample:');
        if (associationOwners.length > 0) {
            const sample = associationOwners[0];
            Object.entries(sample).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    console.log(`  ${key}: ${value}`);
                }
            });
        }
        
        // Check for overlap
        const rentalIds = new Set(rentalOwners.map(o => o.Id));
        const associationIds = new Set(associationOwners.map(o => o.Id));
        const overlap = [...rentalIds].filter(id => associationIds.has(id));
        
        console.log('\n[RETRY] Overlap Analysis:');
        console.log(`  Rental owner IDs: ${rentalIds.size}`);
        console.log(`  Association owner IDs: ${associationIds.size}`);
        console.log(`  Overlapping IDs: ${overlap.length}`);
        
        if (overlap.length > 0) {
            console.log('  Overlapping owners:');
            overlap.forEach(id => {
                const rental = rentalOwners.find(o => o.Id === id);
                const association = associationOwners.find(o => o.Id === id);
                const name = rental?.IsCompany ? rental.CompanyName : `${rental?.FirstName} ${rental?.LastName}`;
                console.log(`    - ${name} (ID: ${id})`);
            });
        }
        
        // Check if association owners have different properties
        console.log('\n Property Analysis:');
        if (associationOwners.length > 0) {
            const assocPropertyIds = associationOwners.flatMap(o => o.PropertyIds || []);
            const rentalPropertyIds = rentalOwners.flatMap(o => o.PropertyIds || []);
            
            console.log(`  Association properties: ${new Set(assocPropertyIds).size} unique`);
            console.log(`  Rental properties: ${new Set(rentalPropertyIds).size} unique`);
            
            const propertyOverlap = assocPropertyIds.filter(id => rentalPropertyIds.includes(id));
            console.log(`  Property overlap: ${new Set(propertyOverlap).size} properties`);
        }
        
        return {
            rentalCount: rentalOwners.length,
            associationCount: associationOwners.length,
            ownerOverlap: overlap.length
        };
        
    } catch (error) {
        console.error('[FAIL] Error testing association owners:', error.message);
        return null;
    }
}

// Run the test
testAssociationOwners();

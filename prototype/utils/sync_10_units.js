require('dotenv').config({ path: '../.env' });
const { BuildiumClient, HubSpotClient, IntegrationPrototype } = require('../index.js');

async function sync10Units() {
    // Check for --force flag
    const forceUpdate = process.argv.includes('--force');
    
    console.log('🚀 Syncing 2 Units from Buildium to HubSpot');
    if (forceUpdate) {
        console.log('⚡ FORCE MODE: Will update existing contacts with missing info');
    }
    console.log('='.repeat(50));
    
    try {
        const buildiumClient = new BuildiumClient();
        const hubspotClient = new HubSpotClient();
        const integration = new IntegrationPrototype();
        
        // Pass force flag to integration
        integration.forceUpdate = forceUpdate;
        
        // Ensure custom properties are set up
        console.log('🔧 Setting up custom properties...');
        await hubspotClient.createListingCustomProperties();
        console.log('✅ Custom properties ready\n');
        
        // Get 2 units from Buildium
        console.log('📋 Fetching 2 units from Buildium...');
        const units = await buildiumClient.getAllUnits(2);
        console.log(`✅ Retrieved ${units.length} units\n`);
        
        const results = {
            success: 0,
            skipped: 0,
            errors: 0,
            details: []
        };
        
        // Sync each unit
        for (let i = 0; i < units.length; i++) {
            const unit = units[i];
            console.log(`[${i + 1}/${units.length}] Processing Unit ${unit.UnitNumber || unit.Id} (Property: ${unit.PropertyId})...`);
            
            try {
                const result = await integration.syncUnitToListing(unit);
                
                if (result.status === 'success') {
                    console.log(`✅ [${i + 1}/${units.length}] Created listing: ${result.hubspotListing.id}`);
                    results.success++;
                    results.details.push({
                        unit: unit.UnitNumber || unit.Id,
                        unitId: unit.Id,
                        propertyId: unit.PropertyId,
                        status: 'success',
                        hubspotId: result.hubspotListing.id
                    });
                } else if (result.status === 'skipped') {
                    console.log(`⏸️ [${i + 1}/${units.length}] Skipped (already exists): ${result.message}`);
                    results.skipped++;
                    results.details.push({
                        unit: unit.UnitNumber || unit.Id,
                        unitId: unit.Id,
                        propertyId: unit.PropertyId,
                        status: 'skipped',
                        reason: result.message
                    });
                } else {
                    console.log(`❌ [${i + 1}/${units.length}] Error: ${result.error}`);
                    results.errors++;
                    results.details.push({
                        unit: unit.UnitNumber || unit.Id,
                        unitId: unit.Id,
                        propertyId: unit.PropertyId,
                        status: 'error',
                        error: result.error
                    });
                }
                
            } catch (error) {
                console.log(`❌ [${i + 1}/${units.length}] Exception: ${error.message}`);
                results.errors++;
                results.details.push({
                    unit: unit.UnitNumber || unit.Id,
                    unitId: unit.Id,
                    propertyId: unit.PropertyId,
                    status: 'error',
                    error: error.message
                });
            }
            
            // Add a small delay to avoid rate limiting
            if (i < units.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // Summary
        console.log('\n📊 Sync Summary:');
        console.log('='.repeat(30));
        console.log(`✅ Successfully created: ${results.success}`);
        console.log(`⏸️ Skipped (existing): ${results.skipped}`);
        console.log(`❌ Errors: ${results.errors}`);
        console.log(`📋 Total processed: ${units.length}`);
        
        if (results.success > 0) {
            console.log('\n🎉 Successfully Created Listings:');
            results.details
                .filter(d => d.status === 'success')
                .forEach((detail, index) => {
                    console.log(`  ${index + 1}. Unit ${detail.unit} → HubSpot ID: ${detail.hubspotId}`);
                });
        }
        
        if (results.errors > 0) {
            console.log('\n❌ Errors Encountered:');
            results.details
                .filter(d => d.status === 'error')
                .forEach((detail, index) => {
                    console.log(`  ${index + 1}. Unit ${detail.unit}: ${detail.error}`);
                });
        }
        
        console.log('\n🏁 Sync complete!');
        
    } catch (error) {
        console.error('💥 Sync failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the sync
sync10Units();

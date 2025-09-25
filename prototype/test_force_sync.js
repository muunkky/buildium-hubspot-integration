const { HubSpotClient } = require('./index.js');

async function testForceSync() {
    const client = new HubSpotClient();
    
    console.log('[SEARCH] Checking if property 140054 has any listings in HubSpot...');
    
    try {
        const listings = await client.searchListingsByPropertyId('140054');
        console.log(`Found ${listings.length} listing(s) for property 140054`);
        
        if (listings.length === 0) {
            console.log('[OK] Perfect! No listings found - ideal for testing force sync');
            console.log(' Now we can test if the force sync creates units for this property');
        } else {
            console.log('[WARN]️ Listings already exist:');
            listings.forEach((listing, i) => {
                console.log(`  ${i+1}. Listing ${listing.id} (Unit: ${listing.properties?.buildium_unit_id || 'N/A'})`);
            });
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testForceSync();

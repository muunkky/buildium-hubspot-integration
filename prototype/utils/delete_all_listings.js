/**
 * Delete all listings from HubSpot
 */

require('dotenv').config({ path: '../.env' });
const { HubSpotClient } = require('../index.js');

async function deleteAllListings() {
    const hubspotClient = new HubSpotClient();
    
    console.log('🗑️ Deleting All HubSpot Listings');
    console.log('=' .repeat(50));
    
    try {
        // Get all listings first
        console.log('📋 Fetching all listings...');
        const allListings = await hubspotClient.getAllListings();
        
        if (!allListings || allListings.length === 0) {
            console.log('✅ No listings found to delete');
            return;
        }
        
        console.log(`📊 Found ${allListings.length} listings to delete`);
        console.log('');
        
        // Delete each listing
        let deleted = 0;
        let errors = 0;
        
        for (let i = 0; i < allListings.length; i++) {
            const listing = allListings[i];
            const progress = `[${i + 1}/${allListings.length}]`;
            
            try {
                console.log(`${progress} Deleting listing ${listing.id} (${listing.properties.hs_name || 'Unnamed'})...`);
                await hubspotClient.deleteListing(listing.id);
                deleted++;
                console.log(`✅ ${progress} Deleted successfully`);
            } catch (error) {
                errors++;
                console.log(`❌ ${progress} Error deleting listing ${listing.id}: ${error.message}`);
            }
            
            // Add a small delay to avoid rate limiting
            if (i % 10 === 9) {
                console.log('⏳ Pausing to avoid rate limits...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log('');
        console.log('📊 Deletion Summary:');
        console.log(`✅ Successfully deleted: ${deleted}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`📋 Total processed: ${allListings.length}`);
        
    } catch (error) {
        console.error('❌ Error during deletion process:', error.message);
    }
}

deleteAllListings();

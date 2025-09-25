/**
 * Delete all listings from HubSpot
 */

require('dotenv').config({ path: '../.env' });
const { HubSpotClient } = require('../index.js');

async function deleteAllListings() {
    const hubspotClient = new HubSpotClient();
    
    console.log('️ Deleting All HubSpot Listings');
    console.log('=' .repeat(50));
    
    try {
        // Get all listings first
        console.log('[ITEM] Fetching all listings...');
        const allListings = await hubspotClient.getAllListings();
        
        if (!allListings || allListings.length === 0) {
            console.log('[OK] No listings found to delete');
            return;
        }
        
        console.log(`[STATS] Found ${allListings.length} listings to delete`);
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
                console.log(`[OK] ${progress} Deleted successfully`);
            } catch (error) {
                errors++;
                console.log(`[FAIL] ${progress} Error deleting listing ${listing.id}: ${error.message}`);
            }
            
            // Add a small delay to avoid rate limiting
            if (i % 10 === 9) {
                console.log(' Pausing to avoid rate limits...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log('');
        console.log('[STATS] Deletion Summary:');
        console.log(`[OK] Successfully deleted: ${deleted}`);
        console.log(`[FAIL] Errors: ${errors}`);
        console.log(`[ITEM] Total processed: ${allListings.length}`);
        
    } catch (error) {
        console.error('[FAIL] Error during deletion process:', error.message);
    }
}

deleteAllListings();

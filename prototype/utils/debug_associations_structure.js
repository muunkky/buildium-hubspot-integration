/**
 * Debug HubSpot associations structure
 */

require('dotenv').config({ path: '../.env' });
const { HubSpotClient } = require('../index.js');

async function debugAssociations() {
    const hubspotClient = new HubSpotClient();
    const listingId = 455094933418; // The listing ID we found
    
    try {
        console.log('[SEARCH] Getting associations for listing', listingId);
        const associations = await hubspotClient.getListingAssociations(listingId);
        
        console.log(`Total associations: ${associations.length}`);
        
        // Check the first few associations
        for (let i = 0; i < Math.min(5, associations.length); i++) {
            const assoc = associations[i];
            console.log(`\n--- Association ${i + 1} ---`);
            console.log(JSON.stringify(assoc, null, 2));
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugAssociations();

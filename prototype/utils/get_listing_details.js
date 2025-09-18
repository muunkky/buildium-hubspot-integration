
require('dotenv').config({ path: '../../.env' });
const { HubSpotClient } = require('../index.js');

async function getListingDetails(unitId) {
    try {
        const hubspotClient = new HubSpotClient();
        const listing = await hubspotClient.searchListingByUnitId(unitId);
        if (listing) {
            console.log(JSON.stringify(listing.properties, null, 2));
        } else {
            console.log(`Listing with unit ID ${unitId} not found.`);
        }
    } catch (error) {
        console.error('Error getting listing details:', error);
    }
}

const unitId = process.argv[2];
if (!unitId) {
    console.error('Please provide a unit ID.');
    process.exit(1);
}

getListingDetails(unitId);

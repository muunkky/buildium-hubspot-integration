// Utility to fetch all properties for the HubSpot listing object
async function getHubSpotListingProperties() {
    const url = 'https://api.hubapi.com/crm/v3/properties/0-420';
    const headers = {
        'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
    };
    try {
        const response = await axios.get(url, { headers });
        console.log('\n--- HubSpot Listing Properties ---');
        const fs = require('fs');
        const path = require('path');
        const logDir = path.resolve(__dirname, '../../log/temp');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logPath = path.join(logDir, 'hubspot_listing_properties.log');
        let logContent = '';
        if (Array.isArray(response.data.results)) {
            response.data.results.forEach(prop => {
                logContent += `Property: ${prop.name} | Label: ${prop.label} | Type: ${prop.type}\n`;
            });
            fs.writeFileSync(logPath, logContent);
            console.log(`Log being generated at ${logPath}`);
            return response.data.results;
        } else {
            logContent = '[FAIL] Unexpected response format: ' + JSON.stringify(response.data, null, 2);
            fs.writeFileSync(logPath, logContent);
            console.log(`Log being generated at ${logPath}`);
            return [];
        }
    } catch (err) {
        console.error('[FAIL] Error fetching HubSpot listing properties:', err.response?.data || err.message);
        throw err;
    }
}

// Utility to create the custom property if missing
async function createBuildiumLeaseLastUpdatedProperty() {
    const url = 'https://api.hubapi.com/crm/v3/properties/0-420';
    const headers = {
        'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
    };
    const body = {
        name: 'buildium_lease_last_updated',
        label: 'Buildium Lease Last Updated',
        type: 'date',
        fieldType: 'date',
        groupName: 'listing_information',
        description: 'Stores the last updated date/time from Buildium for this lease'
    };
    try {
        const response = await axios.post(url, body, { headers });
        console.log('[OK] Created custom property buildium_lease_last_updated');
        return response.data;
    } catch (err) {
        if (err.response?.status === 409) {
            console.log('️ Custom property buildium_lease_last_updated already exists.');
            return null;
        }
        console.error('[FAIL] Error creating custom property:', err.response?.data || err.message);
        throw err;
    }
}
// Diagnostic script to compare Buildium and HubSpot lease last updated dates
// Usage: node prototype/scripts/diagnose_lease_sync.js

const axios = require('axios');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// CONFIGURATION - fill in your actual API keys/tokens
const BUILDUM_API_BASE = process.env.BUILDIUM_BASE_URL || 'https://api.buildium.com/v1';
const buildiumClientId = process.env.BUILDIUM_CLIENT_ID;
const buildiumClientSecret = process.env.BUILDIUM_CLIENT_SECRET;
const HUBSPOT_API_BASE = 'https://api.hubapi.com/crm/v3/objects/0-420';
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || '<YOUR_HUBSPOT_ACCESS_TOKEN>';

// How many recent records to fetch
const LIMIT = 50;

async function getRecentBuildiumLeases() {
    // Fetch leases updated in the last 30 days
    const sinceDate = new Date(Date.now() - 30*24*60*60*1000).toISOString();
    const url = `${BUILDUM_API_BASE}/leases?lastupdatedfrom=${sinceDate}&limit=${LIMIT}`;
    const headers = {
        'x-buildium-client-id': buildiumClientId,
        'x-buildium-client-secret': buildiumClientSecret,
        'Content-Type': 'application/json'
    };
    try {
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (err) {
        console.error('[FAIL] Buildium API error:', err.response?.data || err.message);
        console.error('  URL:', url);
    console.error('  Client ID:', buildiumClientId ? 'Present' : 'Missing');
    console.error('  Client Secret:', buildiumClientSecret ? 'Present' : 'Missing');
        throw err;
    }
}

async function getRecentHubSpotListings() {
    // Fetch listings sorted by buildium_lease_last_updated descending
    const url = `${HUBSPOT_API_BASE}/search`;
    const headers = {
        'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
    };
    const body = {
        sorts: [ { propertyName: 'buildium_lease_last_updated', direction: 'DESCENDING' } ],
        properties: ['buildium_lease_id', 'buildium_lease_last_updated', 'lease_status', 'buildium_market_rent', 'primary_tenant'],
        limit: LIMIT
    };
    try {
        const response = await axios.post(url, body, { headers });
        console.log('\n--- Raw HubSpot API Response ---');
        console.dir(response.data, { depth: 5 });
        return response.data.results;
    } catch (err) {
        console.error('[FAIL] HubSpot API error:', err.response?.data || err.message);
        console.error('  URL:', url);
        console.error('  Access Token:', HUBSPOT_ACCESS_TOKEN ? 'Present' : 'Missing');
        throw err;
    }
}

function getMaxLastUpdated(items, field) {
    let max = '';
    for (const item of items) {
        const val = item[field] || item.properties?.[field];
        if (val && (!max || new Date(val) > new Date(max))) max = val;
    }
    return max;
}


(async () => {
    try {
        // Step 1: Sanity check for existing last updated property
        const properties = await getHubSpotListingProperties();
        const lastUpdatedProp = properties.find(p => p.name === 'buildium_lease_last_updated' || p.name.includes('last_updated'));
        if (lastUpdatedProp) {
            console.log(`️ Found last updated property: ${lastUpdatedProp.name}`);
        } else {
            console.log('[TOOL] Creating custom property buildium_lease_last_updated...');
            await createBuildiumLeaseLastUpdatedProperty();
        }

        // Step 2: Fetch Buildium leases
        console.log('[SEARCH] Fetching recent Buildium leases...');
        const buildiumLeases = await getRecentBuildiumLeases();
        const buildiumMax = getMaxLastUpdated(buildiumLeases, 'LastUpdatedDateTime');
        console.log('[OK] Newest Buildium lease LastUpdatedDateTime:', buildiumMax);

        // Step 3: Fetch HubSpot listings using buildium_lease_last_updated
        console.log('[SEARCH] Fetching recent HubSpot listings...');
        const hubspotListings = await getRecentHubSpotListings();
        const hubspotMax = getMaxLastUpdated(hubspotListings, 'buildium_lease_last_updated');
        console.log('[OK] Newest HubSpot listing buildium_lease_last_updated:', hubspotMax);

        // Print a few examples for manual inspection
        console.log('\n--- Buildium Lease Examples ---');
        buildiumLeases.slice(0, 3).forEach((l, i) => {
            console.log(`Buildium Lease #${i+1}:`, {
                Id: l.Id,
                LastUpdatedDateTime: l.LastUpdatedDateTime,
                LeaseStatus: l.LeaseStatus,
                Rent: l.AccountDetails?.Rent,
                Tenants: l.CurrentTenants?.map(t => t.FirstName + ' ' + t.LastName)
            });
        });
        console.log('\n--- HubSpot Listing Examples ---');
        hubspotListings.slice(0, 3).forEach((l, i) => {
            console.log(`HubSpot Listing #${i+1}:`, {
                id: l.id,
                buildium_lease_last_updated: l.properties?.buildium_lease_last_updated,
                lease_status: l.properties?.lease_status,
                buildium_market_rent: l.properties?.buildium_market_rent,
                primary_tenant: l.properties?.primary_tenant
            });
        });
    } catch (err) {
        console.error('[FAIL] Diagnostic error (main):', err.response?.data || err.message);
        console.error('  Stack:', err.stack);
    }
})();

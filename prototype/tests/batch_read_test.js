const assert = require('assert');
const axios = require('axios');
const { BuildiumClient, HubSpotClient } = require('../index.js');

async function testBuildiumBatchLeases() {
    process.env.BUILDIUM_BASE_URL = 'https://buildium.example.com';
    const originalGet = axios.get;
    const captured = [];

    axios.get = async (url, config) => {
        captured.push({ url, params: { ...config.params } });
        const { unitids, offset } = config.params;
        if (offset === 0) {
            return {
                data: unitids.map((id, idx) => ({
                    Id: Number(id) * 10 + idx,
                    UnitId: Number(id)
                }))
            };
        }
        return { data: [] };
    };

    try {
        const client = new BuildiumClient();
        client.clientId = 'test';
        client.clientSecret = 'secret';

        const leases = await client.getLeasesByUnitIds(['101', '102', '103'], {
            chunkSize: 2,
            limitPerRequest: 2
        });

        assert.strictEqual(captured.length, 3, 'should paginate and chunk requests');
        assert.deepStrictEqual(captured[0].params.unitids, ['101', '102'], 'first chunk should contain first two unit ids');
        assert.deepStrictEqual(captured[2].params.unitids, ['103'], 'second chunk should handle remaining ids');
        const sortedUnitIds = leases.map(lease => String(lease.UnitId)).sort();
        assert.deepStrictEqual(sortedUnitIds, ['101', '102', '103'], 'should return unique leases for each unit');
    } finally {
        axios.get = originalGet;
    }
}

async function testHubSpotBatchListings() {
    process.env.HUBSPOT_BASE_URL = 'https://api.hubapi.com';
    process.env.HUBSPOT_ACCESS_TOKEN = 'fake-token';
    const originalPost = axios.post;
    const captured = [];

    axios.post = async (url, body, config) => {
        captured.push({ url, body, headers: { ...config.headers } });
        return {
            data: {
                results: body.inputs.map(item => ({
                    id: `listing-${item.id}`,
                    properties: {
                        buildium_unit_id: item.id,
                        buildium_lease_id: `lease-${item.id}`
                    }
                }))
            }
        };
    };

    try {
        const client = new HubSpotClient();
        const listings = await client.getListingsByUnitIds(['201', '202', '203'], { chunkSize: 2 });

        assert.strictEqual(captured.length, 2, 'should split unit ids across batch calls');
        captured.forEach(call => {
            assert.strictEqual(call.url.endsWith('/crm/v3/objects/0-420/batch/read'), true, 'should use batch read endpoint');
            assert.strictEqual(call.body.idProperty, 'buildium_unit_id', 'should use buildium_unit_id as idProperty');
            assert.ok(Array.isArray(call.body.inputs), 'inputs should be an array');
        });
        const listingIds = listings.map(listing => listing.id).sort();
        assert.deepStrictEqual(listingIds, ['listing-201', 'listing-202', 'listing-203'], 'should return listings for each provided unit');
    } finally {
        axios.post = originalPost;
    }
}

(async () => {
    try {
        await testBuildiumBatchLeases();
        console.log('[PASS] BuildiumClient.getLeasesByUnitIds batches requests correctly');
        await testHubSpotBatchListings();
        console.log('[PASS] HubSpotClient.getListingsByUnitIds uses batch read endpoint');
        console.log('[PASS] All batch read tests completed successfully');
    } catch (error) {
        console.error('[FAIL] Batch read tests encountered an error');
        console.error(error);
        process.exit(1);
    }
})();

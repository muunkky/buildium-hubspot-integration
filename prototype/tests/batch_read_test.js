const assert = require('assert');
const axios = require('axios');
const { BuildiumClient, HubSpotClient } = require('../index.js');

async function testBuildiumBatchLeases() {
    process.env.BUILDIUM_BASE_URL = 'https://buildium.example.com';
    const originalGet = axios.get;
    const capturedRequests = [];

    axios.get = async (url, config) => {
        capturedRequests.push({ url, params: { ...config.params } });
        const { propertyids = [], offset = 0 } = config.params;
        if (offset > 0) {
            return { data: [] };
        }

        const propertySet = new Set(propertyids.map(id => id.toString()));
        const page = [];
        if (propertySet.has('201')) {
            page.push({ Id: 1001, UnitId: 101 }, { Id: 1002, UnitId: 102 });
        }
        if (propertySet.has('202')) {
            page.push({ Id: 2001, UnitId: 103 });
        }
        return { data: page };
    };

    try {
        const client = new BuildiumClient();
        client.clientId = 'test';
        client.clientSecret = 'secret';

        const fallbackCalls = [];
        client.getAllLeasesForUnit = async unitId => {
            fallbackCalls.push(unitId);
            return [{ Id: 4001, UnitId: Number(unitId) }];
        };

        const descriptors = [
            { unitId: '101', propertyId: 201 },
            { unitId: '102', propertyId: 201 },
            { unitId: '103', propertyId: 202 },
            { unitId: '104' } // missing property - exercises fallback
        ];
        const leases = await client.getLeasesByUnitIds(descriptors, {
            propertyChunkSize: 2,
            limitPerRequest: 5
        });

        assert.strictEqual(capturedRequests.length, 1, 'should request property chunk once');
        assert.deepStrictEqual(
            capturedRequests[0].params.propertyids.map(id => id.toString()),
            ['201', '202'],
            'should batch property ids into a single request'
        );
        assert.deepStrictEqual(fallbackCalls, ['104'], 'should fallback to per-unit fetch when property is missing');

        const sortedUnitIds = leases.map(lease => String(lease.UnitId)).sort();
        assert.deepStrictEqual(sortedUnitIds, ['101', '102', '103', '104'], 'should collect leases only for requested units');
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

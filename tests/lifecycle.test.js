const test = require('node:test');
const assert = require('node:assert');
const { LeaseCentricSyncManager } = require('../prototype/LeaseCentricSyncManager');

class MockBuildiumClient {
  constructor(leases, tenants) {
    this.leases = leases;
    this.tenants = tenants;
  }
  async getAllLeases() {
    return this.leases;
  }
  async getLeasesUpdatedSince() {
    return this.leases;
  }
  async getLeasesByUnitIds() {
    return this.leases;
  }
  async getTenant(id) {
    const tenant = this.tenants[id];
    if (!tenant) {
      throw new Error(`Missing tenant ${id}`);
    }
    return tenant;
  }
}

class MockHubSpotClient {
  constructor({ contacts, associations, listingLastUpdated }) {
    this.contacts = contacts;
    this.associations = associations;
    this.listingLastUpdated = listingLastUpdated || {};
    this.listingBatches = [];
    this.associationReads = [];
    this.associationCreates = [];
    this.removals = [];
  }
  async getListingsByUnitIds(unitIds) {
    return unitIds.map(id => ({
      id: `listing-${id}`,
      properties: {
        buildium_unit_id: id,
        buildium_lease_last_updated: this.listingLastUpdated[id] || null
      }
    }));
  }
  async searchListingByUnitId(unitId) {
    return {
      id: `listing-${unitId}`,
      properties: {
        buildium_unit_id: unitId,
        buildium_lease_last_updated: this.listingLastUpdated[unitId] || null
      }
    };
  }
  async createListingsBatch(listings, dryRun, force, limit) {
    this.listingBatches.push({ listings, dryRun, force, limit });
    const slice = typeof limit === 'number' ? listings.slice(0, limit) : listings;
    return {
      created: slice.map((_, idx) => ({ id: `created-${idx}` })),
      updated: [],
      skipped: []
    };
  }
  async searchContactByEmail(email) {
    return this.contacts[email.toLowerCase()] || null;
  }
  async getContactListingAssociations(contactId, listingId) {
    this.associationReads.push({ contactId, listingId });
    return this.associations[`${contactId}:${listingId}`] || [];
  }
  async createContactListingAssociation(contactId, listingId, associationTypeId) {
    this.associationCreates.push({ contactId, listingId, associationTypeId });
  }
  async makeRequest(method, path, body) {
    this.removals.push({ method, path, body });
    return {};
  }
}

function makeLease({ id, unitId, status, lastUpdated, tenantId, propertyId, propertyName }) {
  return {
    Id: id,
    UnitId: unitId,
    LeaseStatus: status,
    LeaseFromDate: '2025-09-01',
    LeaseToDate: '2026-08-31',
    LastUpdatedDateTime: lastUpdated,
    Tenants: [{ Id: tenantId }],
    PropertyId: propertyId,
    Property: { Name: propertyName },
    Unit: { UnitNumber: '101', PropertyName: propertyName },
    UnitAddress: {
      AddressLine1: '123 Main',
      City: 'Testville',
      State: 'TS',
      PostalCode: '00000'
    }
  };
}

function createManager({ leases, tenants, contacts, associations, listingLastUpdated, lastSyncTimestamps }) {
  const buildium = new MockBuildiumClient(leases, tenants);
  const hubspot = new MockHubSpotClient({ contacts, associations, listingLastUpdated });
  const integration = {
    buildiumClient: buildium,
    hubspotClient: hubspot,
    syncFutureTenantToContact: async () => ({ status: 'success' })
  };
  const manager = new LeaseCentricSyncManager(integration);
  manager.getLastSyncTimestamps = async () => ({ ...lastSyncTimestamps });
  manager.saveLastSyncTimestamps = async () => {};
  manager.updateLastSyncTime = async () => {};
  return { manager, hubspot };
}

const STALE = '2025-09-15T00:00:00.000Z';
const CURRENT = '2025-07-01T00:00:00.000Z';

const tenants = {
  T1: { Id: 'T1', Email: 'contact1@example.com', FirstName: 'C1', LastName: 'Example' },
  T2: { Id: 'T2', Email: 'contact2@example.com', FirstName: 'C2', LastName: 'Example' },
  T3: { Id: 'T3', Email: 'contact3@example.com', FirstName: 'C3', LastName: 'Example' }
};

const contacts = {
  'contact1@example.com': { id: 'C1' },
  'contact2@example.com': { id: 'C2' },
  'contact3@example.com': { id: 'C3' }
};

const baseAssociations = {
  'C1:listing-U1': [{ associationTypeId: 11 }],
  'C2:listing-U2': [{ associationTypeId: 11 }],
  'C3:listing-U3': [{ associationTypeId: 11 }]
};

test('limit restricts lifecycle processing to selected leases', async () => {
  const leases = [
    makeLease({ id: 'L1', unitId: 'U1', status: 'Active', lastUpdated: STALE, tenantId: 'T1', propertyId: 'P1', propertyName: 'Prop1' }),
    makeLease({ id: 'L2', unitId: 'U2', status: 'Active', lastUpdated: STALE, tenantId: 'T2', propertyId: 'P2', propertyName: 'Prop2' }),
    makeLease({ id: 'L3', unitId: 'U3', status: 'Active', lastUpdated: CURRENT, tenantId: 'T3', propertyId: 'P3', propertyName: 'Prop3' })
  ];
  const lastSync = { L1: CURRENT, L2: CURRENT, L3: STALE };
  const { manager, hubspot } = createManager({ leases, tenants, contacts, associations: baseAssociations, listingLastUpdated: { U1: CURRENT, U2: CURRENT, U3: CURRENT }, lastSyncTimestamps: lastSync });

  const stats = await manager.syncLeases(false, false, null, 50, 1);

  assert.strictEqual(stats.leasesSelected, 1, 'only one lease should be selected when limit=1');
  assert.strictEqual(hubspot.associationCreates.length, 1, 'only one association should be created');
  assert.deepStrictEqual(hubspot.associationCreates[0], { contactId: 'C1', listingId: 'listing-U1', associationTypeId: 2 });

  const processedUnits = hubspot.associationCreates.map(call => call.listingId);
  assert.deepStrictEqual(processedUnits, ['listing-U1']);
});

test('leases with no changes do not trigger association updates', async () => {
  const leases = [
    makeLease({ id: 'L1', unitId: 'U1', status: 'Active', lastUpdated: CURRENT, tenantId: 'T1', propertyId: 'P1', propertyName: 'Prop1' }),
    makeLease({ id: 'L2', unitId: 'U2', status: 'Active', lastUpdated: CURRENT, tenantId: 'T2', propertyId: 'P2', propertyName: 'Prop2' })
  ];
  const lastSync = { L1: CURRENT, L2: CURRENT };
  const { manager, hubspot } = createManager({ leases, tenants, contacts, associations: baseAssociations, listingLastUpdated: { U1: CURRENT, U2: CURRENT, U3: CURRENT }, lastSyncTimestamps: lastSync });

  const stats = await manager.syncLeases(false, false, null, 50, null);

  assert.strictEqual(stats.leasesSelected, 0, 'no leases should be selected when timestamps are unchanged');
  assert.strictEqual(hubspot.associationCreates.length, 0, 'no associations should be created');
  assert.strictEqual(hubspot.associationReads.length, 0, 'no association lookups should be performed');
});

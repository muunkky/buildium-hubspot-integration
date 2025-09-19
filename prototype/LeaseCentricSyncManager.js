/**
 * LEASE-CENTRIC SYNC MANAGER
 * Complete orchestration for efficient lease to listing sync
 */
const { BuildiumClient, HubSpotClient, IntegrationPrototype } = require('./index.js');
const TenantLifecycleManager = require('./TenantLifecycleManager.js');

class LeaseCentricSyncManager {
    constructor(integration = null) {
        if (integration) {
            this.integration = integration;
            this.buildiumClient = integration.buildiumClient;
            this.hubspotClient = integration.hubspotClient;
        } else {
            this.buildiumClient = new BuildiumClient();
            this.hubspotClient = new HubSpotClient();
            this.integration = new IntegrationPrototype();
        }
        this.lastSyncFile = 'last_lease_sync.json';
        this.leaseTimestampsFile = 'lease_sync_timestamps.json';
    }

    /**
     * Main sync method - orchestrates complete workflow with automatic lifecycle management
     */
    async syncLeases(dryRun = false, force = false, sinceDays = 7, batchSize = 50, limit = null, unitId = null) {
        const logger = this.createRunLogger('lease-sync', {
            mode: dryRun ? 'dry-run' : 'live',
            force,
            sinceDays,
            batchSize,
            limit,
            unitId
        });

        const stats = {
            leasesChecked: 0,
            leasesSelected: 0,
            listingsCreated: 0,
            listingsUpdated: 0,
            listingsSkipped: 0,
            futureTenantsSynced: 0,
            lifecycle: { futureToActive: 0, activeToInactive: 0, futureToInactive: 0, errors: 0 },
            errors: 0
        };

        const startTime = Date.now();

        try {
            const lastSyncTimestamps = await this.getLastSyncTimestamps();

            let leases = [];
            if (unitId) {
                logger.event('fetch.unit', { unitId });
                leases = await this.buildiumClient.getAllLeasesForUnit(unitId);
            } else if (sinceDays === null) {
                logger.event('fetch.all');
                leases = await this.buildiumClient.getAllLeases();
            } else {
                const sinceDate = new Date(Date.now() - (sinceDays * 24 * 60 * 60 * 1000));
                logger.event('fetch.updated-since', { since: sinceDate.toISOString() });
                leases = await this.buildiumClient.getLeasesUpdatedSince(sinceDate);
            }

            stats.leasesChecked = leases.length;
            logger.event('fetch.complete', { leases: leases.length });

            const unitIdsForBatch = Array.from(new Set(leases.map(lease => lease.UnitId?.toString()).filter(Boolean)));
            const hubspotListingCache = Object.create(null);

            if (unitIdsForBatch.length > 0 && limit === null) {
                logger.event('prefetch.listings.start', { units: unitIdsForBatch.length });
                const batchListings = await this.hubspotClient.getListingsByUnitIds(unitIdsForBatch);
                batchListings.forEach(listing => {
                    const unitKey = listing.properties?.buildium_unit_id;
                    if (unitKey) {
                        hubspotListingCache[unitKey] = listing;
                    }
                });
                logger.event('prefetch.listings.complete', {
                    cached: Object.keys(hubspotListingCache).length
                });
            } else if (unitIdsForBatch.length > 0) {
                logger.event('prefetch.listings.skip', { reason: 'limit-active' });
            } else {
                logger.event('prefetch.listings.skip', { reason: 'no-units' });
            }

            const filteredLeases = [];
            let skippedCount = 0;

            for (const lease of leases) {
                const lastSync = lastSyncTimestamps[lease.Id];
                let shouldSync = false;
                let reason = '';

                if (!lastSync) {
                    shouldSync = true;
                    reason = 'no-prior-sync';
                } else if (lease.LastUpdatedDateTime && new Date(lease.LastUpdatedDateTime) > new Date(lastSync)) {
                    shouldSync = true;
                    reason = 'buildium-updated';
                }

                if (!shouldSync && lease.LastUpdatedDateTime) {
                    const unitKey = lease.UnitId?.toString();
                    let hubspotListing = null;
                    if (unitKey) {
                        if (Object.prototype.hasOwnProperty.call(hubspotListingCache, unitKey)) {
                            hubspotListing = hubspotListingCache[unitKey];
                        } else {
                            hubspotListing = await this.hubspotClient.searchListingByUnitId(unitKey);
                            hubspotListingCache[unitKey] = hubspotListing || null;
                        }
                    }
                    const hubspotLastUpdated = hubspotListing?.properties?.buildium_lease_last_updated;
                    if (hubspotLastUpdated == null) {
                        shouldSync = true;
                        reason = 'missing-hubspot-timestamp';
                    }
                }

                if (shouldSync) {
                    filteredLeases.push(lease);
                    logger.event('filter.schedule', { leaseId: lease.Id, unitId: lease.UnitId, reason });
                    if (limit !== null && filteredLeases.length >= limit) {
                        logger.event('limit.reached', { limit });
                        break;
                    }
                } else {
                    skippedCount += 1;
                    logger.event('filter.skip', { leaseId: lease.Id, unitId: lease.UnitId, reason: 'no-change-detected' });
                }
            }

            const selectedCount = limit !== null ? Math.min(filteredLeases.length, limit) : filteredLeases.length;
            stats.leasesSelected = selectedCount;
            logger.event('filter.summary', { selected: selectedCount, skipped: skippedCount });

            const leasesToProcess = limit !== null ? filteredLeases.slice(0, limit) : filteredLeases;
            if (limit !== null && filteredLeases.length > limit) {
                logger.event('limit.apply', { limit, truncated: filteredLeases.length - limit });
            }

            if (leasesToProcess.length === 0) {
                stats.durationMs = Date.now() - startTime;
                logger.finish(stats);
                return stats;
            }

            logger.event('transform.prepare', { leases: leasesToProcess.length });

            const unitDescriptorMap = new Map();
            leasesToProcess.forEach(lease => {
                const leaseUnitId = lease.UnitId?.toString();
                if (!leaseUnitId) {
                    return;
                }

                if (!unitDescriptorMap.has(leaseUnitId)) {
                    unitDescriptorMap.set(leaseUnitId, {
                        unitId: leaseUnitId,
                        propertyId: lease.PropertyId ?? lease.Unit?.PropertyId ?? null,
                        unitNumber: lease.UnitNumber ?? lease.Unit?.UnitNumber ?? null
                    });
                } else {
                    const descriptor = unitDescriptorMap.get(leaseUnitId);
                    if (!descriptor.propertyId && (lease.PropertyId || lease.Unit?.PropertyId)) {
                        descriptor.propertyId = lease.PropertyId ?? lease.Unit?.PropertyId ?? null;
                    }
                    if (!descriptor.unitNumber && (lease.UnitNumber || lease.Unit?.UnitNumber)) {
                        descriptor.unitNumber = lease.UnitNumber ?? lease.Unit?.UnitNumber ?? null;
                    }
                }
            });

            let leasesForTransformation = leasesToProcess;
            if (unitDescriptorMap.size > 0) {
                logger.event('buildium.expand', { units: unitDescriptorMap.size });
                const descriptors = Array.from(unitDescriptorMap.values());
                const batchLeases = await this.buildiumClient.getLeasesByUnitIds(descriptors);
                if (batchLeases.length > 0) {
                    const allowedUnitIds = new Set(descriptors.map(descriptor => descriptor.unitId));
                    leasesForTransformation = batchLeases.filter(lease => {
                        const leaseUnitId = lease?.UnitId != null ? lease.UnitId.toString() : null;
                        return leaseUnitId && allowedUnitIds.has(leaseUnitId);
                    });
                }
                logger.event('buildium.expand.complete', { leases: leasesForTransformation.length });
            }

            const listings = this.transformLeasesToListings(leasesForTransformation);
            logger.event('transform.complete', { listings: listings.length });

            const listingLimit = limit !== null ? Math.min(limit, listings.length) : null;

            if (!dryRun) {
                logger.event('hubspot.batch.start', { listingLimit });
                const result = await this.hubspotClient.createListingsBatch(listings, false, force, listingLimit, hubspotListingCache);
                stats.listingsCreated = Array.isArray(result.created) ? result.created.length : 0;
                stats.listingsUpdated = Array.isArray(result.updated) ? result.updated.length : 0;
                stats.listingsSkipped = Array.isArray(result.skipped) ? result.skipped.length : 0;
                logger.event('hubspot.batch.result', {
                    created: stats.listingsCreated,
                    updated: stats.listingsUpdated,
                    skipped: stats.listingsSkipped
                });

                const newTimestamps = { ...lastSyncTimestamps };
                leasesToProcess.forEach(lease => {
                    newTimestamps[lease.Id] = new Date().toISOString();
                });
                await this.saveLastSyncTimestamps(newTimestamps);
                logger.event('timestamps.updated', { leases: leasesToProcess.length });
            } else {
                logger.event('hubspot.batch.skip', { reason: 'dry-run', listingLimit });
                const result = await this.hubspotClient.createListingsBatch(listings, true, force, listingLimit, hubspotListingCache);
                stats.listingsCreated = Array.isArray(result.created) ? result.created.length : listings.length;
                stats.listingsUpdated = Array.isArray(result.updated) ? result.updated.length : 0;
                stats.listingsSkipped = Array.isArray(result.skipped) ? result.skipped.length : 0;
                logger.event('hubspot.batch.simulated', {
                    created: stats.listingsCreated,
                    updated: stats.listingsUpdated,
                    skipped: stats.listingsSkipped
                });
            }

            if (!dryRun) {
                const futureTenantsSynced = await this.syncFutureTenants(leasesToProcess);
                stats.futureTenantsSynced = futureTenantsSynced;
                logger.event('future-tenants.synced', { count: futureTenantsSynced });
            } else {
                const futureTenantCandidates = this.extractFutureTenants(leasesToProcess);
                logger.event('future-tenants.preview', { count: futureTenantCandidates.length });
            }

            const lifecycleManager = new TenantLifecycleManager(this.hubspotClient, this.buildiumClient);
            const lifecycleStats = await lifecycleManager.updateTenantAssociationsForLeases(leasesToProcess, {
                dryRun,
                listingCache: hubspotListingCache,
                logger,
                verifyUnitScope: true
            });
            stats.lifecycle = lifecycleStats;
            logger.event('tenant-lifecycle.result', lifecycleStats);

            await this.updateLastSyncTime();
            logger.event('sync-state.saved');

            stats.durationMs = Date.now() - startTime;
            logger.finish(stats);
            return stats;
        } catch (error) {
            stats.errors += 1;
            stats.durationMs = Date.now() - startTime;
            logger.error(error, { stats });
            throw error;
        }
    }

    /**
     * Transform lease data to HubSpot listing format
     * Groups leases by unit and intelligently picks current + future lease info
     */
    transformLeasesToListings(leases) {
        const leasesByUnit = {};
        leases.forEach(lease => {
            const unitId = lease.UnitId?.toString();
            if (unitId) {
                if (!leasesByUnit[unitId]) {
                    leasesByUnit[unitId] = [];
                }
                leasesByUnit[unitId].push(lease);
            }
        });

        const listings = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        Object.entries(leasesByUnit).forEach(([unitId, unitLeases]) => {
            const activeLease = unitLeases.find(lease => lease.LeaseStatus === 'Active');
            const referenceLease = activeLease || unitLeases.sort((a, b) =>
                new Date(b.LeaseFromDate || 0) - new Date(a.LeaseFromDate || 0)
            )[0];

            const futureLease = unitLeases
                .filter(lease => {
                    const startDate = new Date(lease.LeaseFromDate);
                    return startDate > today && lease.LeaseStatus === 'Future';
                })
                .sort((a, b) => new Date(a.LeaseFromDate) - new Date(b.LeaseFromDate))[0];

            if (referenceLease) {
                const propertyLabel = referenceLease.Property?.Name
                    || referenceLease.PropertyName
                    || referenceLease.Unit?.PropertyName
                    || (referenceLease.PropertyId ? `Property ${referenceLease.PropertyId}` : 'Unknown Property');
                const unitLabel = referenceLease.UnitNumber
                    || referenceLease.Unit?.UnitNumber
                    || referenceLease.Unit?.Name
                    || referenceLease.UnitId?.toString()
                    || 'Unit';

                const listingName = `${propertyLabel} - Unit ${unitLabel}`.trim();

                const listing = {
                    properties: {
                        buildium_unit_id: referenceLease.UnitId?.toString(),
                        buildium_lease_id: activeLease ? activeLease.Id?.toString() : '',
                        buildium_property_id: referenceLease.PropertyId?.toString(),
                        hs_name: listingName,
                        buildium_market_rent: activeLease ? this.extractRent(activeLease) : '',
                        hs_address_1: referenceLease.UnitAddress?.AddressLine1 || '',
                        hs_city: referenceLease.UnitAddress?.City || '',
                        hs_state_province: referenceLease.UnitAddress?.State || '',
                        hs_zip: referenceLease.UnitAddress?.PostalCode || '',
                        lease_start_date: activeLease ? activeLease.LeaseFromDate : '',
                        lease_end_date: activeLease ? activeLease.LeaseToDate : '',
                        lease_status: activeLease ? activeLease.LeaseStatus : 'Past',
                        primary_tenant: activeLease ? this.extractPrimaryTenant(activeLease) : '',
                        next_lease_start: futureLease ? futureLease.LeaseFromDate : '',
                        next_lease_id: futureLease ? futureLease.Id?.toString() : '',
                        next_lease_tenant: futureLease ? this.extractPrimaryTenant(futureLease) : ''
                    }
                };

                listings.push(listing);
            }
        });

        return listings;
    }

    extractRent(lease) {
        return lease.RentAmount ||
               lease.TotalAmount ||
               lease.BaseRent ||
               lease.MonthlyRent ||
               '';
    }

    mapLeaseStatusToListing(leaseStatus) {
        const statusMap = {
            Active: 'Available',
            Future: 'Available',
            Past: 'Off Market',
            Terminated: 'Off Market',
            Expired: 'Available'
        };
        return statusMap[leaseStatus] || 'Unknown';
    }

    extractPrimaryTenant(lease) {
        if (lease.Tenants && lease.Tenants.length > 0) {
            const primary = lease.Tenants[0];
            return `${primary.FirstName || ''} ${primary.LastName || ''}`.trim();
        }
        return '';
    }

    extractFutureTenants(leases) {
        const futureTenants = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        leases.forEach(lease => {
            const startDate = new Date(lease.LeaseFromDate);
            if (startDate > today && lease.LeaseStatus === 'Future' && lease.Tenants && lease.Tenants.length > 0) {
                lease.Tenants.forEach(tenant => {
                    futureTenants.push({
                        tenantId: tenant.Id,
                        unitId: lease.UnitId,
                        leaseId: lease.Id,
                        startDate: lease.LeaseFromDate,
                        tenant
                    });
                });
            }
        });

        return futureTenants;
    }

    async syncFutureTenants(leases) {
        const futureTenants = this.extractFutureTenants(leases);
        let syncedCount = 0;

        for (const futureTenant of futureTenants) {
            try {
                console.log(`[future-tenants] syncing tenant ${(futureTenant.tenant.FirstName || '')} ${(futureTenant.tenant.LastName || '')}`.trim() +
                    ` (lease ${futureTenant.leaseId} starting ${futureTenant.startDate})`);

                const result = await this.integration.syncFutureTenantToContact(
                    futureTenant.tenantId,
                    futureTenant.unitId
                );

                if (result.status === 'success') {
                    syncedCount += 1;
                    console.log('[future-tenants] sync completed');
                } else {
                    console.log(`[future-tenants] sync skipped: ${result.reason || result.error}`);
                }
            } catch (error) {
                console.error(`[future-tenants] sync failed for tenant ${futureTenant.tenantId}: ${error.message}`);
            }
        }

        return syncedCount;
    }

    async updateLastSyncTime() {
        const fs = require('fs').promises;
        const syncData = {
            lastSync: new Date().toISOString(),
            version: '1.0'
        };

        try {
            await fs.writeFile(this.lastSyncFile, JSON.stringify(syncData, null, 2));
        } catch (error) {
            console.warn(`[lease-sync] unable to save sync timestamp: ${error.message}`);
        }
    }

    async getLastSyncTime() {
        const fs = require('fs').promises;
        try {
            const data = await fs.readFile(this.lastSyncFile, 'utf8');
            const syncData = JSON.parse(data);
            return new Date(syncData.lastSync);
        } catch (error) {
            return new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
        }
    }

    async getLastSyncTimestamps() {
        const fs = require('fs').promises;
        try {
            const data = await fs.readFile(this.leaseTimestampsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {};
            }
            console.error(`[lease-sync] error reading lease timestamps: ${error.message}`);
            return {};
        }
    }

    async saveLastSyncTimestamps(timestamps) {
        const fs = require('fs').promises;
        try {
            await fs.writeFile(this.leaseTimestampsFile, JSON.stringify(timestamps, null, 2));
        } catch (error) {
            console.error(`[lease-sync] error saving lease timestamps: ${error.message}`);
        }
    }

    createRunLogger(scope, initialMeta = {}) {
        const prefix = `[${scope}]`;
        const startTime = Date.now();
        if (initialMeta && Object.keys(initialMeta).length > 0) {
            console.log(`${prefix} start ${JSON.stringify(initialMeta)}`);
        } else {
            console.log(`${prefix} start`);
        }

        return {
            event: (name, meta = null) => {
                if (meta && Object.keys(meta).length > 0) {
                    console.log(`${prefix} ${name} ${JSON.stringify(meta)}`);
                } else {
                    console.log(`${prefix} ${name}`);
                }
            },
            warn: (name, meta = null) => {
                if (meta && Object.keys(meta).length > 0) {
                    console.warn(`${prefix} ${name} ${JSON.stringify(meta)}`);
                } else {
                    console.warn(`${prefix} ${name}`);
                }
            },
            error: (error, meta = null) => {
                const payload = {
                    message: error instanceof Error ? error.message : String(error)
                };
                if (error && error.stack) {
                    payload.stack = error.stack;
                }
                if (meta) {
                    Object.assign(payload, meta);
                }
                console.error(`${prefix} error ${JSON.stringify(payload)}`);
            },
            finish: (meta = null) => {
                const payload = {
                    durationMs: Date.now() - startTime
                };
                if (meta) {
                    Object.assign(payload, meta);
                }
                console.log(`${prefix} complete ${JSON.stringify(payload)}`);
            }
        };
    }
}

module.exports = { LeaseCentricSyncManager };

/**
 * LEASE-CENTRIC SYNC MANAGER
 * Complete orchestration for efficient lease → listing sync
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
            // Create clients directly if no integration instance provided
            this.buildiumClient = new BuildiumClient();
            this.hubspotClient = new HubSpotClient();
            
            // Create a lightweight integration-like object for future tenant sync
            this.integration = new IntegrationPrototype();
        }
        this.lastSyncFile = 'last_lease_sync.json';
        this.leaseTimestampsFile = 'lease_sync_timestamps.json';
    }

    /**
     * Main sync method - orchestrates complete workflow with automatic lifecycle management
     */
    async syncLeases(dryRun = false, force = false, sinceDays = 7, batchSize = 50, limit = null, unitId = null) {
        console.log('🚀 STARTING LEASE-CENTRIC SYNC');
        console.log('='.repeat(50));
        console.log(`📅 Sync mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
        if (unitId) {
            console.log(`🎯 Targeting specific unit: ${unitId}`);
        } else {
            console.log(`⏰ Looking back: ${sinceDays} days`);
        }
        console.log(`🔄 Force update: ${force ? 'YES - Update existing listings' : 'NO - Skip duplicates'}`);
        console.log('🔄 Tenant lifecycle management: AUTOMATIC (Future→Active→Inactive)');
        
        const startTime = Date.now();
        const stats = {
            leasesChecked: 0,
            listingsCreated: 0,
            listingsUpdated: 0,
            listingsSkipped: 0,
            errors: 0
        };

        try {
            const lastSyncTimestamps = await this.getLastSyncTimestamps();

            // Step 1: Get updated leases
            let leases;
            if (unitId) {
                console.log(`
🔍 Fetching all leases for unit ${unitId}...`);
                leases = await this.buildiumClient.getAllLeasesForUnit(unitId);
            } else if (sinceDays === null) {
                // Get ALL leases (no date filter)
                console.log(`
🔍 Fetching ALL leases from Buildium (no date filter)...`);
                leases = await this.buildiumClient.getAllLeases();
            } else {
                // Get leases since specific date
                const sinceDate = new Date(Date.now() - (sinceDays * 24 * 60 * 60 * 1000));
                console.log(`
🔍 Fetching leases updated since ${sinceDate.toISOString()}`);
                leases = await this.buildiumClient.getLeasesUpdatedSince(sinceDate);
            }
            
            stats.leasesChecked = leases.length;
            const unitIdsForBatch = Array.from(new Set(leases.map(lease => lease.UnitId?.toString()).filter(Boolean)));
            const hubspotListingCache = Object.create(null);
            if (unitIdsForBatch.length > 0) {
                const batchListings = await this.hubspotClient.getListingsByUnitIds(unitIdsForBatch);
                batchListings.forEach(listing => {
                    const unitKey = listing.properties?.buildium_unit_id;
                    if (unitKey) {
                        hubspotListingCache[unitKey] = listing;
                    }
                });
                console.log(`Prefetched ${Object.keys(hubspotListingCache).length} HubSpot listing(s) using batch read.`);
            }
            console.log(`✅ Retrieved ${leases.length} ${sinceDays === null ? 'total' : 'updated'} leases`);

            // Filter leases based on individual timestamps and HubSpot last updated value
            const filteredLeases = [];
            for (const lease of leases) {
                const lastSync = lastSyncTimestamps[lease.Id];
                let shouldSync = false;
                let syncReason = '';
                if (!lastSync) {
                    shouldSync = true;
                    syncReason = 'No previous sync timestamp (new lease)';
                } else if (lease.LastUpdatedDateTime && new Date(lease.LastUpdatedDateTime) > new Date(lastSync)) {
                    shouldSync = true;
                    syncReason = 'Buildium lease LastUpdatedDateTime is newer than last sync timestamp';
                }

                // Additional logic: If Buildium has LastUpdatedDateTime and HubSpot is missing it, sync
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
                        syncReason = 'HubSpot listing missing buildium_lease_last_updated';
                    }
                }
                if (shouldSync) {
                    filteredLeases.push(lease);
                    console.log(`🔄 Will sync lease ${lease.Id} (Unit ${lease.UnitId}): ${syncReason}`);
                } else {
                    console.log(`⏭️  Skipping lease ${lease.Id} (Unit ${lease.UnitId}): No changes detected`);
                }
            }

            console.log(`✅ Filtered down to ${filteredLeases.length} leases needing sync.`);

            if (filteredLeases.length === 0) {
                console.log('ℹ️  No new lease updates to sync - sync complete');
                return stats;
            }

            // Step 2: Transform leases to listings
            console.log('\n🔄 Transforming leases to listing format...');
            const unitDescriptorMap = new Map();
            filteredLeases.forEach(lease => {
                const unitId = lease.UnitId?.toString();
                if (!unitId) {
                    return;
                }

                if (!unitDescriptorMap.has(unitId)) {
                    unitDescriptorMap.set(unitId, {
                        unitId,
                        propertyId: lease.PropertyId ?? lease.Unit?.PropertyId ?? null,
                        unitNumber: lease.UnitNumber ?? lease.Unit?.UnitNumber ?? null
                    });
                } else {
                    const descriptor = unitDescriptorMap.get(unitId);
                    if (!descriptor.propertyId && (lease.PropertyId || lease.Unit?.PropertyId)) {
                        descriptor.propertyId = lease.PropertyId ?? lease.Unit?.PropertyId ?? null;
                    }
                    if (!descriptor.unitNumber && (lease.UnitNumber || lease.Unit?.UnitNumber)) {
                        descriptor.unitNumber = lease.UnitNumber ?? lease.Unit?.UnitNumber ?? null;
                    }
                }
            });

            const unitDescriptors = Array.from(unitDescriptorMap.values());
            let leasesForTransformation = filteredLeases;
            if (unitDescriptors.length > 0) {
                const batchLeases = await this.buildiumClient.getLeasesByUnitIds(unitDescriptors);
                if (batchLeases.length > 0) {
                    const allowedUnitIds = new Set(unitDescriptors.map(descriptor => descriptor.unitId));
                    leasesForTransformation = batchLeases.filter(lease => {
                        const unitId = lease?.UnitId != null ? lease.UnitId.toString() : null;
                        return unitId && allowedUnitIds.has(unitId);
                    });
                }
            }
            const listings = this.transformLeasesToListings(leasesForTransformation);
            console.log(`✅ Transformed ${listings.length} listings`);

            // Step 3: Create/update listings in batches
            if (!dryRun) {
                console.log('\n📦 Creating/updating listings in batches...');
                const result = await this.hubspotClient.createListingsBatch(listings, false, force, limit);
                
                stats.listingsCreated = result.created ? result.created.length : 0;
                stats.listingsUpdated = result.updated ? result.updated.length : 0;
                stats.listingsSkipped = result.skipped ? result.skipped.length : 0;

                // Update timestamps for successfully synced leases
                const newTimestamps = { ...lastSyncTimestamps };
                filteredLeases.forEach(lease => {
                    newTimestamps[lease.Id] = new Date().toISOString();
                });
                await this.saveLastSyncTimestamps(newTimestamps);

            } else {
                console.log('\n🔄 DRY RUN - Would create/update listings');
                const result = await this.hubspotClient.createListingsBatch(listings, true, force, limit);
                stats.listingsCreated = result.created ? result.created.length : listings.length;
                stats.listingsUpdated = result.updated ? result.updated.length : 0;
                stats.listingsSkipped = result.skipped ? result.skipped.length : 0;
            }

            // Step 4: Sync future tenants
            if (!dryRun) {
                console.log('\n🔮 Syncing future tenants...');
                const futureTenantsSynced = await this.syncFutureTenants(filteredLeases);
                console.log(`✅ Synced ${futureTenantsSynced} future tenants`);
            } else {
                console.log('\n🔮 DRY RUN - Would sync future tenants');
                const futureTenants = this.extractFutureTenants(filteredLeases);
                console.log(`   Would sync ${futureTenants.length} future tenants`);
            }

            // Step 6: Automatic tenant associations lifecycle management
            console.log('\n🔄 Updating tenant association lifecycle (automatic)...');
            const lifecycleManager = new TenantLifecycleManager(this.hubspotClient, this.buildiumClient);
            // Calculate appropriate date for lifecycle management
            const lifecycleDate = sinceDays === null ? new Date('2020-01-01') : new Date(Date.now() - (sinceDays * 24 * 60 * 60 * 1000));
            const lifecycleStats = await lifecycleManager.updateTenantAssociations(dryRun, limit, lifecycleDate, limit, unitId); // pass limit as maxLeases for incremental sync
            const totalLifecycleUpdates = lifecycleStats.futureToActive + lifecycleStats.activeToInactive + lifecycleStats.futureToInactive;
            console.log(`✅ Lifecycle updates: ${totalLifecycleUpdates}`);
            if (totalLifecycleUpdates === 0) {
                console.log('   ✨ All tenant associations are up to date!');
            }

            // Step 7: Update last sync time
            await this.updateLastSyncTime();

            const duration = Date.now() - startTime;
            console.log('\n✅ LEASE-CENTRIC SYNC COMPLETE');
            console.log(`⏱️  Duration: ${duration}ms`);
            console.log(`📊 Stats: ${stats.leasesChecked} leases → ${stats.listingsCreated} created, ${stats.listingsUpdated} updated, ${stats.listingsSkipped} skipped`);

            return stats;

        } catch (error) {
            stats.errors = 1;
            console.error('❌ Sync failed:', error.message);
            throw error;
        }
    }

    /**
     * Transform lease data to HubSpot listing format
     * Groups leases by unit and intelligently picks current + future lease info
     */
    transformLeasesToListings(leases) {
        // Group leases by unit ID
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

        // Process each unit to create one listing with best lease data
        const listings = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today for comparison

        Object.entries(leasesByUnit).forEach(([unitId, unitLeases]) => {
            // Find current lease (Active status only)
            const activeLease = unitLeases.find(lease => lease.LeaseStatus === 'Active');
            
            // If no active lease, we'll use the most recent lease for property info but mark as no current lease
            const referenceLease = activeLease || unitLeases.sort((a, b) => 
                new Date(b.LeaseFromDate || 0) - new Date(a.LeaseFromDate || 0)
            )[0];

            // Find next lease (Future lease starting after today)
            const futureLease = unitLeases
                .filter(lease => {
                    const startDate = new Date(lease.LeaseFromDate);
                    return startDate > today && lease.LeaseStatus === 'Future';
                })
                .sort((a, b) => new Date(a.LeaseFromDate) - new Date(b.LeaseFromDate))[0]; // Earliest future lease

            if (referenceLease) {
                const listing = {
                    properties: {
                        // Core identifiers
                        buildium_unit_id: referenceLease.UnitId?.toString(),
                        buildium_lease_id: activeLease ? activeLease.Id?.toString() : '', // Only if there's an active lease
                        buildium_property_id: referenceLease.PropertyId?.toString(),
                        
                        // Rent info (use existing property)
                        buildium_market_rent: activeLease ? this.extractRent(activeLease) : '',
                        
                        // Address info (use existing HubSpot standard properties) 
                        hs_address_1: referenceLease.UnitAddress?.AddressLine1 || '',
                        hs_city: referenceLease.UnitAddress?.City || '',
                        hs_state_province: referenceLease.UnitAddress?.State || '',
                        hs_zip: referenceLease.UnitAddress?.PostalCode || '',
                        
                        // Current lease info (only if there's an active lease)
                        lease_start_date: activeLease ? activeLease.LeaseFromDate : '',
                        lease_end_date: activeLease ? activeLease.LeaseToDate : '',
                        lease_status: activeLease ? activeLease.LeaseStatus : 'Past', // Use 'Past' instead of 'No Current Lease'
                        
                        // Tenant info (only if active lease)
                        primary_tenant: activeLease ? this.extractPrimaryTenant(activeLease) : '',

                        // Next lease info (if exists)
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

    /**
     * Extract rent amount from lease data
     */
    extractRent(lease) {
        // Try multiple fields where rent might be stored
        return lease.RentAmount || 
               lease.TotalAmount || 
               lease.BaseRent || 
               lease.MonthlyRent || 
               '';
    }

    /**
     * Map lease status to HubSpot listing status
     */
    mapLeaseStatusToListing(leaseStatus) {
        const statusMap = {
            'Active': 'Available', // Active lease = property is rented
            'Future': 'Available', // Future lease = will be rented soon
            'Past': 'Off Market', // Past lease = might be available again
            'Terminated': 'Off Market',
            'Expired': 'Available' // Expired might mean available again
        };
        
        return statusMap[leaseStatus] || 'Unknown';
    }

    /**
     * Extract primary tenant name from lease
     */
    extractPrimaryTenant(lease) {
        if (lease.Tenants && lease.Tenants.length > 0) {
            const primary = lease.Tenants[0];
            return `${primary.FirstName || ''} ${primary.LastName || ''}`.trim();
        }
        return '';
    }

    /**
     * Extract future tenants from leases
     */
    extractFutureTenants(leases) {
        const futureTenants = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        leases.forEach(lease => {
            // Only process future leases with start dates after today
            const startDate = new Date(lease.LeaseFromDate);
            if (startDate > today && lease.LeaseStatus === 'Future' && lease.Tenants && lease.Tenants.length > 0) {
                // Extract all tenants from the future lease
                lease.Tenants.forEach(tenant => {
                    futureTenants.push({
                        tenantId: tenant.Id,
                        unitId: lease.UnitId,
                        leaseId: lease.Id,
                        startDate: lease.LeaseFromDate,
                        tenant: tenant
                    });
                });
            }
        });

        return futureTenants;
    }

    /**
     * Sync future tenants to HubSpot with Future Tenant associations
     */
    async syncFutureTenants(leases) {
        const futureTenants = this.extractFutureTenants(leases);
        let syncedCount = 0;

        for (const futureTenant of futureTenants) {
            try {
                console.log(`🔮 Syncing future tenant: ${futureTenant.tenant.FirstName} ${futureTenant.tenant.LastName} (Lease starts: ${futureTenant.startDate})`);
                
                const result = await this.integration.syncFutureTenantToContact(
                    futureTenant.tenantId, 
                    futureTenant.unitId
                );

                if (result.status === 'success') {
                    syncedCount++;
                    console.log(`✅ Future tenant synced successfully`);
                } else {
                    console.log(`⚠️ Future tenant sync skipped: ${result.reason || result.error}`);
                }

            } catch (error) {
                console.error(`❌ Failed to sync future tenant ${futureTenant.tenantId}:`, error.message);
            }
        }

        return syncedCount;
    }

    /**
     * Update last sync timestamp
     */
    async updateLastSyncTime() {
        const fs = require('fs').promises;
        const syncData = {
            lastSync: new Date().toISOString(),
            version: '1.0'
        };
        
        try {
            await fs.writeFile(this.lastSyncFile, JSON.stringify(syncData, null, 2));
        } catch (error) {
            console.warn('⚠️  Could not save sync timestamp:', error.message);
        }
    }

    /**
     * Get last sync time
     */
    async getLastSyncTime() {
        const fs = require('fs').promises;
        try {
            const data = await fs.readFile(this.lastSyncFile, 'utf8');
            const syncData = JSON.parse(data);
            return new Date(syncData.lastSync);
        } catch (error) {
            // If no file exists, return a default (7 days ago)
            return new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
        }
    }

    /**
     * Get per-lease timestamps
     */
    async getLastSyncTimestamps() {
        const fs = require('fs').promises;
        try {
            const data = await fs.readFile(this.leaseTimestampsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {}; // Return empty object if file doesn't exist
            }
            console.error('❌ Error reading lease timestamps:', error.message);
            return {};
        }
    }

    /**
     * Save per-lease timestamps
     */
    async saveLastSyncTimestamps(timestamps) {
        const fs = require('fs').promises;
        try {
            await fs.writeFile(this.leaseTimestampsFile, JSON.stringify(timestamps, null, 2));
        } catch (error) {
            console.error('❌ Error saving lease timestamps:', error.message);
        }
    }
}

module.exports = { LeaseCentricSyncManager };

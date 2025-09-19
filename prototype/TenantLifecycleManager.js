/**
 * TENANT LIFECYCLE MANAGER
 * Handles the transition of tenant associations based on lease status changes
 */

const { BuildiumClient, HubSpotClient } = require('./index.js');

class TenantLifecycleManager {
    constructor(hubspotClient = null, buildiumClient = null) {
        this.hubspotClient = hubspotClient || new HubSpotClient();
        this.buildiumClient = buildiumClient || new BuildiumClient();

        this.ASSOCIATION_TYPES = {
            FUTURE_TENANT: 11,
            ACTIVE_TENANT: 2,
            INACTIVE_TENANT: 6,
            OWNER: 4
        };
    }

    createEmptyStats() {
        return {
            futureToActive: 0,
            activeToInactive: 0,
            futureToInactive: 0,
            errors: 0
        };
    }

    async updateTenantAssociations(
        dryRun = false,
        limit = null,
        sinceDate = null,
        maxLeases = null,
        unitId = null,
        options = {}
    ) {
        const listingCache = options.listingCache || Object.create(null);
        const logger = options.logger || null;
        const verifyUnitScope = options.verifyUnitScope !== false;

        let leases = [];
        if (unitId) {
            emitLifecycleEvent(logger, 'fetch.unit', { unitId });
            leases = await this.buildiumClient.getAllLeasesForUnit(unitId);
        } else {
            const defaultSinceDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
            const queryDate = sinceDate || defaultSinceDate;
            emitLifecycleEvent(logger, 'fetch.updated-since', { since: queryDate.toISOString() });
            leases = await this.getAllLeasesWithPagination(queryDate, maxLeases, logger);
        }

        emitLifecycleEvent(logger, 'fetch.complete', { leases: leases.length });
        return this.updateTenantAssociationsForLeases(leases, { dryRun, limit, listingCache, logger, verifyUnitScope });
    }

    async updateTenantAssociationsForLeases(leases, options = {}) {
        const stats = this.createEmptyStats();

        if (!Array.isArray(leases) || leases.length === 0) {
            return stats;
        }

        const { dryRun = false, limit = null, listingCache = null, logger = null, verifyUnitScope = true } = options;
        const leasesToProcess = limit !== null ? leases.slice(0, limit) : leases;

        if (limit !== null && leases.length > limit) {
            emitLifecycleEvent(logger, 'limit.apply', { limit, truncated: leases.length - limit });
        }

        const allowedUnitIds = new Set();
        leasesToProcess.forEach(lease => {
            const unitId = lease?.UnitId != null ? lease.UnitId.toString() : null;
            if (unitId) {
                allowedUnitIds.add(unitId);
            }
        });

        for (const lease of leasesToProcess) {
            try {
                await this.processLeaseLifecycle(lease, dryRun, stats, { listingCache, logger, allowedUnitIds, verifyUnitScope });
            } catch (error) {
                stats.errors += 1;
                emitLifecycleError(logger, error, { leaseId: lease?.Id || null });
            }
        }

        return stats;
    }

    async getAllLeasesWithPagination(sinceDate, maxLeases = null, logger = null) {
        const allLeases = [];
        let offset = 0;
        const batchSize = 500;
        let hasMore = true;

        while (hasMore && (maxLeases === null || allLeases.length < maxLeases)) {
            emitLifecycleEvent(logger, 'fetch.batch', { offset, batchSize });

            const batch = await this.buildiumClient.getLeasesUpdatedSince(
                sinceDate,
                { limit: batchSize, offset }
            );

            allLeases.push(...batch);
            hasMore = batch.length === batchSize;
            offset += batchSize;

            emitLifecycleEvent(logger, 'fetch.batch.complete', { received: batch.length, total: allLeases.length });

            if (maxLeases !== null && allLeases.length >= maxLeases) {
                emitLifecycleEvent(logger, 'limit.maxLeases', { maxLeases });
                break;
            }

            if (offset > 50000) {
                emitLifecycleWarn(logger, 'fetch.batch.safety-stop', { offset });
                break;
            }
        }

        if (maxLeases !== null && allLeases.length > maxLeases) {
            return allLeases.slice(0, maxLeases);
        }
        return allLeases;
    }

    async processLeaseLifecycle(lease, dryRun, stats, options = {}) {
        const { listingCache = null, logger = null, allowedUnitIds = null, verifyUnitScope = false } = options;

        const leaseUnitId = lease?.UnitId != null ? lease.UnitId.toString() : null;
        if (verifyUnitScope) {
            if (!leaseUnitId) {
                emitLifecycleWarn(logger, 'lease.unit-missing', { leaseId: lease?.Id || null });
            } else if (allowedUnitIds && allowedUnitIds.size > 0 && !allowedUnitIds.has(leaseUnitId)) {
                const scopeError = new Error(`Lifecycle scope mismatch for lease ${lease.Id} (unit ${leaseUnitId})`);
                emitLifecycleError(logger, scopeError, { leaseId: lease.Id, unitId: leaseUnitId, expectedUnits: Array.from(allowedUnitIds) });
                throw scopeError;
            }
        }
        let targetAssociationType;
        let transitionType;

        switch (lease.LeaseStatus) {
            case 'Future':
                targetAssociationType = this.ASSOCIATION_TYPES.FUTURE_TENANT;
                transitionType = 'futureToActive';
                break;
            case 'Active':
                targetAssociationType = this.ASSOCIATION_TYPES.ACTIVE_TENANT;
                transitionType = 'futureToActive';
                break;
            case 'Past':
            case 'Expired':
            case 'Terminated':
                targetAssociationType = this.ASSOCIATION_TYPES.INACTIVE_TENANT;
                transitionType = 'activeToInactive';
                break;
            default:
                emitLifecycleWarn(logger, 'lease.status-unknown', { leaseId: lease.Id, status: lease.LeaseStatus });
                return;
        }

        if (!lease.Tenants || lease.Tenants.length === 0) {
            emitLifecycleEvent(logger, 'lease.no-tenants', { leaseId: lease.Id, unitId: lease.UnitId });
            return;
        }

        for (const tenantReference of lease.Tenants) {
            await this.updateTenantAssociation(tenantReference, lease, targetAssociationType, transitionType, {
                dryRun,
                stats,
                listingCache,
                logger
            });
        }
    }

    async updateTenantAssociation(tenantReference, lease, targetAssociationType, transitionType, options = {}) {
        const { dryRun = false, stats = null, listingCache = null, logger = null } = options;

        try {
            const tenant = await this.buildiumClient.getTenant(tenantReference.Id);
            if (!tenant) {
                emitLifecycleWarn(logger, 'tenant.missing', { tenantId: tenantReference.Id });
                return;
            }

            let contact = null;
            if (tenant.Email) {
                contact = await this.hubspotClient.searchContactByEmail(tenant.Email);
            }

            if (!contact) {
                emitLifecycleWarn(logger, 'contact.missing', {
                    tenantId: tenantReference.Id,
                    email: tenant.Email || null
                });
                return;
            }

            const unitKey = lease.UnitId?.toString();
            let listing = null;

            if (unitKey && listingCache && Object.prototype.hasOwnProperty.call(listingCache, unitKey)) {
                listing = listingCache[unitKey];
            } else if (unitKey) {
                listing = await this.hubspotClient.searchListingByUnitId(unitKey);
                if (listingCache) {
                    listingCache[unitKey] = listing || null;
                }
            }

            if (!listing) {
                emitLifecycleWarn(logger, 'listing.missing', { unitId: lease.UnitId });
                return;
            }

            const currentAssociations = await this.getCurrentAssociations(contact.id, listing.id);
            const needsUpdate = await this.shouldUpdateAssociation(
                currentAssociations,
                targetAssociationType,
                transitionType
            );

            if (!needsUpdate) {
                emitLifecycleEvent(logger, 'association.no-change', {
                    contactId: contact.id,
                    listingId: listing.id,
                    transition: transitionType
                });
                return;
            }

            if (dryRun) {
                emitLifecycleEvent(logger, 'association.dry-run', {
                    contactId: contact.id,
                    listingId: listing.id,
                    target: this.getAssociationName(targetAssociationType),
                    transition: transitionType
                });
            } else {
                await this.performAssociationTransition(
                    contact.id,
                    listing.id,
                    currentAssociations,
                    targetAssociationType,
                    transitionType,
                    tenant,
                    lease,
                    logger
                );
                emitLifecycleEvent(logger, 'association.updated', {
                    contactId: contact.id,
                    listingId: listing.id,
                    transition: transitionType
                });
            }

            if (stats && Object.prototype.hasOwnProperty.call(stats, transitionType)) {
                stats[transitionType] += 1;
            }
        } catch (error) {
            emitLifecycleError(logger, error, {
                tenantId: tenantReference?.Id || null,
                leaseId: lease?.Id || null
            });
            throw error;
        }
    }

    async getCurrentAssociations(contactId, listingId) {
        try {
            const associations = await this.hubspotClient.getContactListingAssociations(contactId, listingId);
            return associations || [];
        } catch (error) {
            console.error(`[tenant-lifecycle] error fetching associations: ${error.message}`);
            return [];
        }
    }

    async shouldUpdateAssociation(currentAssociations, targetAssociationType, transitionType) {
        if (!currentAssociations.length) {
            return true;
        }

        const hasTargetAssociation = currentAssociations.some(
            assoc => assoc.associationTypeId === targetAssociationType
        );

        if (hasTargetAssociation) {
            return false;
        }

        const hasFutureAssociation = currentAssociations.some(
            assoc => assoc.associationTypeId === this.ASSOCIATION_TYPES.FUTURE_TENANT
        );
        const hasActiveAssociation = currentAssociations.some(
            assoc => assoc.associationTypeId === this.ASSOCIATION_TYPES.ACTIVE_TENANT
        );

        switch (transitionType) {
            case 'futureToActive':
                return hasFutureAssociation && targetAssociationType === this.ASSOCIATION_TYPES.ACTIVE_TENANT;
            case 'activeToInactive':
                return hasActiveAssociation && targetAssociationType === this.ASSOCIATION_TYPES.INACTIVE_TENANT;
            case 'futureToInactive':
                return hasFutureAssociation && targetAssociationType === this.ASSOCIATION_TYPES.INACTIVE_TENANT;
            default:
                return true;
        }
    }

    async performAssociationTransition(
        contactId,
        listingId,
        currentAssociations,
        targetAssociationType,
        transitionType,
        tenant,
        lease,
        logger = null
    ) {
        try {
            for (const assoc of currentAssociations) {
                if (this.shouldRemoveAssociation(assoc.associationTypeId, transitionType)) {
                    await this.removeAssociation(contactId, listingId, assoc.associationTypeId);
                    emitLifecycleEvent(logger, 'association.removed', {
                        contactId,
                        listingId,
                        type: this.getAssociationName(assoc.associationTypeId)
                    });
                }
            }

            await this.hubspotClient.createContactListingAssociation(contactId, listingId, targetAssociationType);
            emitLifecycleEvent(logger, 'association.created', {
                contactId,
                listingId,
                type: this.getAssociationName(targetAssociationType),
                tenant: `${tenant.FirstName || ''} ${tenant.LastName || ''}`.trim(),
                unitId: lease.UnitId
            });
        } catch (error) {
            emitLifecycleError(logger, error, {
                contactId,
                listingId,
                transition: transitionType
            });
            throw error;
        }
    }

    shouldRemoveAssociation(currentAssociationTypeId, transitionType) {
        switch (transitionType) {
            case 'futureToActive':
                return currentAssociationTypeId === this.ASSOCIATION_TYPES.FUTURE_TENANT;
            case 'activeToInactive':
                return currentAssociationTypeId === this.ASSOCIATION_TYPES.ACTIVE_TENANT;
            case 'futureToInactive':
                return currentAssociationTypeId === this.ASSOCIATION_TYPES.FUTURE_TENANT;
            default:
                return false;
        }
    }

    async removeAssociation(contactId, listingId, associationTypeId) {
        try {
            const requestBody = {
                inputs: [{
                    from: { id: contactId },
                    to: { id: listingId },
                    associationTypeId
                }]
            };

            return await this.hubspotClient.makeRequest(
                'DELETE',
                '/crm/v4/associations/contacts/0-420/batch/delete',
                requestBody
            );
        } catch (error) {
            console.error(`[tenant-lifecycle] failed to remove association: ${error.message}`);
            throw error;
        }
    }

    getAssociationName(associationTypeId) {
        const names = {
            [this.ASSOCIATION_TYPES.FUTURE_TENANT]: 'Future Tenant',
            [this.ASSOCIATION_TYPES.ACTIVE_TENANT]: 'Active Tenant',
            [this.ASSOCIATION_TYPES.INACTIVE_TENANT]: 'Inactive Tenant',
            [this.ASSOCIATION_TYPES.OWNER]: 'Owner'
        };
        return names[associationTypeId] || `Type ${associationTypeId}`;
    }
}

function emitLifecycleEvent(logger, event, meta = null) {
    if (logger && typeof logger.event === 'function') {
        logger.event(`tenant-lifecycle.${event}`, meta || undefined);
    } else {
        if (meta && Object.keys(meta).length > 0) {
            console.log(`[tenant-lifecycle] ${event} ${JSON.stringify(meta)}`);
        } else {
            console.log(`[tenant-lifecycle] ${event}`);
        }
    }
}

function emitLifecycleWarn(logger, event, meta = null) {
    if (logger && typeof logger.warn === 'function') {
        logger.warn(`tenant-lifecycle.${event}`, meta || undefined);
    } else {
        if (meta && Object.keys(meta).length > 0) {
            console.warn(`[tenant-lifecycle] ${event} ${JSON.stringify(meta)}`);
        } else {
            console.warn(`[tenant-lifecycle] ${event}`);
        }
    }
}

function emitLifecycleError(logger, error, meta = null) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (logger && typeof logger.error === 'function') {
        const payload = meta ? { scope: 'tenant-lifecycle', ...meta } : { scope: 'tenant-lifecycle' };
        logger.error(err, payload);
    } else {
        const payload = { message: err.message };
        if (meta && Object.keys(meta).length > 0) {
            Object.assign(payload, meta);
        }
        console.error(`[tenant-lifecycle] error ${JSON.stringify(payload)}`);
    }
}

module.exports = TenantLifecycleManager;

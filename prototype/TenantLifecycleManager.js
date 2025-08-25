/**
 * TENANT LIFECYCLE MANAGER
 * Handles the transition of tenant associations based on lease status changes
 */

class TenantLifecycleManager {
    constructor(hubspotClient = null, buildiumClient = null) {
        // Accept clients as parameters to avoid circular dependency
        if (hubspotClient && buildiumClient) {
            this.hubspotClient = hubspotClient;
            this.buildiumClient = buildiumClient;
        } else {
            // Fallback: import and create clients if not provided
            const { BuildiumClient, HubSpotClient } = require('./index.js');
            this.hubspotClient = new HubSpotClient();
            this.buildiumClient = new BuildiumClient();
        }
        
        // Association type constants (matching HubSpot's bidirectional IDs)
        this.ASSOCIATION_TYPES = {
            FUTURE_TENANT: 11,     // Future Tenant (Contact → Listing)
            ACTIVE_TENANT: 2,      // Active Tenant (Contact → Listing)  
            INACTIVE_TENANT: 6,    // Inactive Tenant (Contact → Listing)
            OWNER: 4               // Owner (Contact → Listing)
        };
    }

    /**
     * Main method - updates tenant associations based on lease status changes
     */
    async updateTenantAssociations(dryRun = false, limit = null, sinceDate = null, maxLeases = null) {
        console.log('🔄 Checking tenant association lifecycle transitions...');
        const stats = {
            futureToActive: 0,
            activeToInactive: 0,
            futureToInactive: 0,
            errors: 0
        };

        try {
            // Default to last 30 days if no date specified
            const defaultSinceDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
            const queryDate = sinceDate || defaultSinceDate;
            
            // Get ALL leases by default (no arbitrary caps)
            console.log('📊 Fetching ALL leases from Buildium (paginated)...');
            const leases = await this.getAllLeasesWithPagination(queryDate, maxLeases);

            console.log(`📋 Found ${leases.length} leases to check for lifecycle updates`);

            let processedCount = 0;
            for (const lease of leases) {
                // Respect the limit if specified
                if (limit && processedCount >= limit) {
                    console.log(`⏹️ Lifecycle check stopped at limit: ${limit}`);
                    break;
                }

                try {
                    await this.processLeaseLifecycle(lease, dryRun, stats);
                    processedCount++;
                } catch (error) {
                    console.error(`❌ Error processing lease ${lease.Id}:`, error.message);
                    stats.errors++;
                }
            }

            return stats;
        } catch (error) {
            console.error('❌ Lifecycle update failed:', error.message);
            stats.errors++;
            return stats;
        }
    }

    /**
     * Get ALL leases using pagination to avoid API limits
     */
    async getAllLeasesWithPagination(sinceDate, maxLeases = null) {
        const allLeases = [];
        let offset = 0;
        const batchSize = 500; // API limit per request
        let hasMore = true;

        while (hasMore && (maxLeases === null || allLeases.length < maxLeases)) {
            console.log(`🔍 Fetching lease batch: offset ${offset}, size ${batchSize}...`);
            
            const batch = await this.buildiumClient.getLeasesUpdatedSince(
                sinceDate,
                { limit: batchSize, offset: offset }
            );

            allLeases.push(...batch);
            
            // Check if we got fewer results than requested (indicates end)
            hasMore = batch.length === batchSize;
            offset += batchSize;

            console.log(`   Retrieved ${batch.length} leases (total so far: ${allLeases.length})`);

            // Stop if we've reached the maxLeases limit
            if (maxLeases !== null && allLeases.length >= maxLeases) {
                console.log(`🛑 Reached maxLeases limit of ${maxLeases}`);
                break;
            }

            // Safety break to avoid infinite loops (very high limit)
            if (offset > 50000) { // Safety limit for extremely large datasets
                console.log(`⚠️ Safety limit reached at ${offset} offset. Breaking pagination.`);
                break;
            }
        }

        const finalCount = maxLeases !== null ? Math.min(allLeases.length, maxLeases) : allLeases.length;
        const result = maxLeases !== null ? allLeases.slice(0, maxLeases) : allLeases;
        
        console.log(`✅ Total leases to process: ${finalCount}`);
        return result;
    }

    /**
     * Process lifecycle transitions for a single lease
     */
    async processLeaseLifecycle(lease, dryRun, stats) {
        let targetAssociationType;
        let transitionType;

        // Determine the target association based on lease status
        switch (lease.LeaseStatus) {
            case 'Future':
                targetAssociationType = this.ASSOCIATION_TYPES.FUTURE_TENANT;
                transitionType = 'futureToActive'; // This might change to active
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
                console.log(`⚠️ Unknown lease status: ${lease.LeaseStatus} for lease ${lease.Id}`);
                return;
        }

        // Skip if no tenants
        if (!lease.Tenants || lease.Tenants.length === 0) {
            return;
        }

        // Process each tenant in the lease
        for (const tenantReference of lease.Tenants) {
            await this.updateTenantAssociation(
                tenantReference, 
                lease, 
                targetAssociationType, 
                transitionType, 
                dryRun, 
                stats
            );
        }
    }

    /**
     * Update a specific tenant's association
     */
    async updateTenantAssociation(tenantReference, lease, targetAssociationType, transitionType, dryRun, stats) {
        try {
            // Step 1: Get full tenant details from Buildium
            const tenant = await this.buildiumClient.getTenant(tenantReference.Id);
            if (!tenant) {
                console.log(`⚠️ Tenant not found in Buildium: ${tenantReference.Id}`);
                return;
            }

            // Step 2: Find the tenant's contact in HubSpot
            let contact = null;
            if (tenant.Email) {
                contact = await this.hubspotClient.searchContactByEmail(tenant.Email);
            }

            if (!contact) {
                console.log(`⚠️ Contact not found for tenant ${tenant.FirstName} ${tenant.LastName} (${tenant.Email || 'no email'})`);
                return;
            }

            // Step 3: Find the listing for this unit
            const listing = await this.hubspotClient.searchListingByUnitId(lease.UnitId);
            if (!listing) {
                console.log(`⚠️ Listing not found for unit ${lease.UnitId}`);
                return;
            }

            // Step 4: Check current associations
            const currentAssociations = await this.getCurrentAssociations(contact.id, listing.id);
            
            // Step 5: Determine if update is needed
            const needsUpdate = await this.shouldUpdateAssociation(
                currentAssociations, 
                targetAssociationType, 
                transitionType
            );

            if (!needsUpdate) {
                return;
            }

            // Step 6: Perform the lifecycle transition
            if (dryRun) {
                console.log(`🔄 DRY RUN - Would update ${transitionType}:`);
                console.log(`   Contact: ${contact.id} (${tenant.FirstName} ${tenant.LastName})`);
                console.log(`   Listing: ${listing.id} (Unit ${lease.UnitId})`);
                console.log(`   New Association: ${this.getAssociationName(targetAssociationType)}`);
            } else {
                await this.performAssociationTransition(
                    contact.id, 
                    listing.id, 
                    currentAssociations, 
                    targetAssociationType, 
                    transitionType,
                    tenant,
                    lease
                );
            }

            stats[transitionType]++;

        } catch (error) {
            console.error(`❌ Error updating tenant association:`, error.message);
            throw error;
        }
    }

    /**
     * Get current associations between contact and listing
     */
    async getCurrentAssociations(contactId, listingId) {
        try {
            const associations = await this.hubspotClient.getContactListingAssociations(contactId, listingId);
            return associations || [];
        } catch (error) {
            console.error(`❌ Error getting current associations:`, error.message);
            return [];
        }
    }

    /**
     * Check if association update is needed
     */
    async shouldUpdateAssociation(currentAssociations, targetAssociationType, transitionType) {
        // If no current associations, we need to create the target
        if (!currentAssociations.length) {
            return true;
        }

        // Check if the target association already exists
        const hasTargetAssociation = currentAssociations.some(
            assoc => assoc.associationTypeId === targetAssociationType
        );

        // If we already have the target association, no update needed
        if (hasTargetAssociation) {
            return false;
        }

        // For transitions, check if we have the source association type
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

    /**
     * Perform the actual association transition
     */
    async performAssociationTransition(contactId, listingId, currentAssociations, targetAssociationType, transitionType, tenant, lease) {
        try {
            // Step 1: Remove old associations that should be transitioned
            for (const assoc of currentAssociations) {
                if (this.shouldRemoveAssociation(assoc.associationTypeId, transitionType)) {
                    await this.removeAssociation(contactId, listingId, assoc.associationTypeId);
                    console.log(`🔄 Removed ${this.getAssociationName(assoc.associationTypeId)} association`);
                }
            }

            // Step 2: Create new association
            await this.hubspotClient.createContactListingAssociation(contactId, listingId, targetAssociationType);
            console.log(`✅ ${transitionType}: ${tenant.FirstName} ${tenant.LastName} → ${this.getAssociationName(targetAssociationType)} (Unit ${lease.UnitId})`);

        } catch (error) {
            console.error(`❌ Failed to transition association:`, error.message);
            throw error;
        }
    }

    /**
     * Check if an association should be removed during transition
     */
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

    /**
     * Remove an association between contact and listing
     */
    async removeAssociation(contactId, listingId, associationTypeId) {
        try {
            const requestBody = {
                inputs: [{
                    from: { id: contactId },
                    to: { id: listingId },
                    associationTypeId: associationTypeId
                }]
            };

            const response = await this.hubspotClient.makeRequest(
                'DELETE',
                '/crm/v4/associations/contacts/0-420/batch/delete',
                requestBody
            );

            return response;
        } catch (error) {
            console.error(`❌ Failed to remove association:`, error.message);
            throw error;
        }
    }

    /**
     * Get human-readable association name
     */
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

module.exports = TenantLifecycleManager;

/**
 * TENANT LIFECYCLE MANAGER
 * Handles the transition of tenant associations based on lease status changes
 */

// Import clients directly to avoid circular dependency issues
const { BuildiumClient, HubSpotClient } = require('./index.js');

class TenantLifecycleManager {
    constructor() {
        this.hubspotClient = new HubSpotClient();
        this.buildiumClient = new BuildiumClient();
        
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
    async updateTenantAssociations(dryRun = false) {
        console.log('[RETRY] Checking tenant association lifecycle transitions...');
        const stats = {
            futureToActive: 0,
            activeToInactive: 0,
            futureToInactive: 0,
            errors: 0
        };

        try {
            // Get all leases that might need status updates
            const leases = await this.buildiumClient.getLeasesUpdatedSince(
                new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)) // Last 30 days
            );

            console.log(`[ITEM] Found ${leases.length} leases to check for lifecycle updates`);

            for (const lease of leases) {
                try {
                    await this.processLeaseLifecycle(lease, dryRun, stats);
                } catch (error) {
                    console.error(`[FAIL] Error processing lease ${lease.Id}:`, error.message);
                    stats.errors++;
                }
            }

            return stats;
        } catch (error) {
            console.error('[FAIL] Lifecycle update failed:', error.message);
            stats.errors++;
            return stats;
        }
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
                console.log(`[WARN]️ Unknown lease status: ${lease.LeaseStatus} for lease ${lease.Id}`);
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
                console.log(`[WARN]️ Tenant not found in Buildium: ${tenantReference.Id}`);
                return;
            }

            // Step 2: Find the tenant's contact in HubSpot
            let contact = null;
            if (tenant.Email) {
                contact = await this.hubspotClient.searchContactByEmail(tenant.Email);
            }

            if (!contact) {
                console.log(`[WARN]️ Contact not found for tenant ${tenant.FirstName} ${tenant.LastName} (${tenant.Email || 'no email'})`);
                return;
            }

            // Step 3: Find the listing for this unit
            const listing = await this.hubspotClient.searchListingByUnitId(lease.UnitId);
            if (!listing) {
                console.log(`[WARN]️ Listing not found for unit ${lease.UnitId}`);
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
                console.log(`[RETRY] DRY RUN - Would update ${transitionType}:`);
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
            console.error(`[FAIL] Error updating tenant association:`, error.message);
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
            console.error(`[FAIL] Error getting current associations:`, error.message);
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
                    console.log(`[RETRY] Removed ${this.getAssociationName(assoc.associationTypeId)} association`);
                }
            }

            // Step 2: Create new association
            await this.hubspotClient.createContactListingAssociation(contactId, listingId, targetAssociationType);
            console.log(`[OK] ${transitionType}: ${tenant.FirstName} ${tenant.LastName} → ${this.getAssociationName(targetAssociationType)} (Unit ${lease.UnitId})`);

        } catch (error) {
            console.error(`[FAIL] Failed to transition association:`, error.message);
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
            console.error(`[FAIL] Failed to remove association:`, error.message);
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

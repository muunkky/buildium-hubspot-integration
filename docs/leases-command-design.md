# Leases Command Design & Implementation Plan

## Overview

The `leases` command represents a strategic evolution from unit-focused synchronization to lease-focused synchronization. This approach ensures accurate active status tracking between Buildium and HubSpot by focusing on actual lease lifecycle events rather than unit occupancy assumptions.

## Problem Statement

Current unit synchronization (`sync-units`) can result in "false active" listings where:
- HubSpot listings show "Active Tenant" but no corresponding active lease exists in Buildium
- Lease status changes (renewals, move-outs, new leases) don't immediately reflect in HubSpot
- Limited lease management data available for property operations

## Buildium Leases API Analysis

### Available Endpoints
- **GET /v1/leases** - Retrieve all leases with extensive filtering
- **GET /v1/leases/{leaseId}** - Retrieve specific lease details

### Lease Status Options
- `Active` - Currently active leases
- `Past` - Completed/ended leases  
- `Future` - Leases that haven't started yet

### Key Lease Fields
| Field | Description | Use Case |
|-------|-------------|----------|
| `Id` | Unique lease identifier | Cross-reference with HubSpot |
| `LeaseStatus` | Active/Past/Future | Status verification |
| `LeaseFromDate` | Lease start date | Move-in tracking |
| `LeaseToDate` | Lease end date | **Vacancy planning** |
| `LeaseType` | AtWill, Fixed, FixedWithRollover | Lease management |
| `PaymentDueDay` | Day of month rent is due | **Operations efficiency** |
| `UnitId` | Associated unit | Entity linking |
| `PropertyId` | Associated property | Entity linking |
| `Tenants` | Array with move-in dates | Tenant management |
| `MoveOutDate` | Move-out information | Transition tracking |
| `CreatedDateTime` | Creation timestamp | Audit trail |
| `LastUpdatedDateTime` | Last modification | **Incremental sync** |

### Filtering Capabilities
- `leasestatuses=Active,Past,Future` - Filter by status
- `lastupdatedfrom`/`lastupdatedto` - Incremental sync support
- `createdfrom`/`createdto` - Historical analysis
- `unitids` - Unit-specific filtering
- `propertyids` - Property-specific filtering

### Webhook Events
- `Lease.Created` - New lease events
- `Lease.Updated` - Lease modifications
- `Lease.Deleted` - Lease removal
- `Lease.MoveOut.Created` - Move-out events

## Command Design

### Primary Objective
Maintain accurate active lease status between Buildium and HubSpot while creating missing entities and surfacing key lease management data.

### Command Signature
```bash
node prototype/index.js leases [options]
```

### Command Options
```javascript
// Basic usage - sync all active leases
node prototype/index.js leases

// Incremental sync - only recently updated leases
node prototype/index.js leases --since=2025-08-15

// Include future leases for planning
node prototype/index.js leases --status=Active,Future

// Specific property focus
node prototype/index.js leases --property-ids=123,456

// Dry run mode
node prototype/index.js leases --dry-run
```

## Implementation Strategy

### Phase 1: Core Lease Sync Logic

```javascript
async function syncLeases(options = {}) {
    const {
        since = null,           // ISO date for incremental sync
        statuses = ['Active'],  // Default to active leases only
        propertyIds = null,     // Optional property filtering
        dryRun = false         // Preview mode
    } = options;

    // 1. Fetch active leases from Buildium
    const buildiumLeases = await getBuildiumActiveLeases({
        leasestatuses: statuses.join(','),
        lastupdatedfrom: since,
        propertyids: propertyIds?.join(',')
    });

    // 2. Get HubSpot listings with active tenant associations
    const hubspotActiveListings = await getHubSpotActiveListings();

    // 3. Cross-reference and identify discrepancies
    const analysis = await analyzeLeaseMismatches(buildiumLeases, hubspotActiveListings);

    // 4. Execute synchronization actions
    await executeLeaseSyncActions(analysis, { dryRun });
}
```

### Phase 2: Status Verification Logic

```javascript
async function analyzeLeaseMismatches(buildiumLeases, hubspotListings) {
    const analysis = {
        activeInBuildiumOnly: [],     // Missing from HubSpot
        activeInHubSpotOnly: [],      // False actives in HubSpot
        statusMismatches: [],         // Status inconsistencies
        upcomingVacancies: [],        // Leases ending soon
        newLeases: []                 // Recently created leases
    };

    // Create lookup maps
    const buildiumActiveByUnit = new Map();
    buildiumLeases.forEach(lease => {
        if (lease.LeaseStatus === 'Active') {
            buildiumActiveByUnit.set(lease.UnitId, lease);
        }
    });

    const hubspotActiveByUnit = new Map();
    hubspotListings.forEach(listing => {
        if (listing.hasActiveTenant) {
            hubspotActiveByUnit.set(listing.unitId, listing);
        }
    });

    // Identify discrepancies
    buildiumActiveByUnit.forEach((lease, unitId) => {
        if (!hubspotActiveByUnit.has(unitId)) {
            analysis.activeInBuildiumOnly.push(lease);
        }
        
        // Check for upcoming vacancies (lease ending within 60 days)
        const leaseEndDate = new Date(lease.LeaseToDate);
        const daysTillEnd = (leaseEndDate - new Date()) / (1000 * 60 * 60 * 24);
        if (daysTillEnd <= 60 && daysTillEnd > 0) {
            analysis.upcomingVacancies.push(lease);
        }
    });

    hubspotActiveByUnit.forEach((listing, unitId) => {
        if (!buildiumActiveByUnit.has(unitId)) {
            analysis.activeInHubSpotOnly.push(listing);
        }
    });

    return analysis;
}
```

### Phase 3: HubSpot Lease Fields Integration

#### New Custom Properties for HubSpot Listings:
```javascript
const LEASE_FIELDS = {
    'lease_end_date': {
        name: 'lease_end_date',
        label: 'Lease End Date',
        type: 'date',
        description: 'End date of current active lease'
    },
    'lease_start_date': {
        name: 'lease_start_date', 
        label: 'Lease Start Date',
        type: 'date',
        description: 'Start date of current active lease'
    },
    'payment_due_day': {
        name: 'payment_due_day',
        label: 'Payment Due Day',
        type: 'number',
        description: 'Day of month rent payment is due'
    },
    'lease_type': {
        name: 'lease_type',
        label: 'Lease Type',
        type: 'enumeration',
        options: [
            { label: 'Fixed Term', value: 'Fixed' },
            { label: 'At Will', value: 'AtWill' },
            { label: 'Fixed with Rollover', value: 'FixedWithRollover' }
        ],
        description: 'Type of lease agreement'
    },
    'days_until_lease_end': {
        name: 'days_until_lease_end',
        label: 'Days Until Lease End',
        type: 'number',
        description: 'Calculated days remaining in lease'
    }
};
```

### Phase 4: Incremental Sync Strategy

```javascript
async function getIncrementalLeaseUpdates(lastSyncDate) {
    // Get leases updated since last sync
    const updatedLeases = await buildiumClient.makeRequestWithRetry(
        '/v1/leases',
        {
            lastupdatedfrom: lastSyncDate,
            leasestatuses: 'Active,Past,Future'
        }
    );

    // Process lease status changes
    const statusChanges = updatedLeases.filter(lease => {
        // Identify leases that changed from/to active status
        return lease.LastUpdatedDateTime > lastSyncDate;
    });

    return statusChanges;
}
```

## Benefits & Impact

### Accuracy Improvements
- **Eliminates false actives**: Verifies HubSpot active status against actual Buildium lease status
- **Real-time status updates**: Reflects lease changes immediately in HubSpot
- **Comprehensive entity creation**: Ensures all active leases have corresponding HubSpot entities

### Operational Efficiency
- **Proactive vacancy management**: Lease end dates enable 60-day vacancy planning
- **Payment scheduling**: Due day information supports rent collection operations
- **Lease lifecycle tracking**: Full visibility into lease terms and renewals

### Data Quality
- **Single source of truth**: Buildium lease status drives HubSpot listing status
- **Rich lease metadata**: Key lease fields available in HubSpot for property management
- **Audit trail**: Comprehensive logging of status changes and sync actions

## Implementation Timeline

### Week 1: Core Infrastructure
- [ ] Implement `getBuildiumActiveLeases()` function
- [ ] Create lease status analysis logic
- [ ] Add command parsing for `leases` command
- [ ] Basic dry-run functionality

### Week 2: HubSpot Integration
- [ ] Create HubSpot custom properties for lease fields
- [ ] Implement lease field updating logic
- [ ] Add entity creation for missing contacts/units/properties
- [ ] Status update mechanisms

### Week 3: Advanced Features
- [ ] Incremental sync implementation
- [ ] Upcoming vacancy detection (60-day alerts)
- [ ] Comprehensive error handling and logging
- [ ] Performance optimization

### Week 4: Testing & Refinement
- [ ] Production testing with sample properties
- [ ] Performance validation with large datasets
- [ ] Error handling verification
- [ ] Documentation and user guides

## Success Metrics

### Technical Metrics
- **Sync accuracy**: 100% correspondence between Buildium active leases and HubSpot active listings
- **Performance**: Complete lease sync in under 2 minutes for 1000+ units
- **Error rate**: <1% failure rate during sync operations

### Business Metrics  
- **Vacancy planning**: 60-day advance notice of lease endings
- **Data completeness**: All active leases have complete information in HubSpot
- **Operational efficiency**: Reduced manual status checking and updates

## Risk Mitigation

### Data Integrity
- **Backup verification**: Always verify critical status changes with secondary API calls
- **Rollback capability**: Maintain ability to revert status changes if errors detected
- **Audit logging**: Complete trail of all sync actions for troubleshooting

### Performance Considerations
- **Rate limiting**: Respect both Buildium (10 req/sec) and HubSpot (9 req/sec) limits
- **Incremental processing**: Use `lastupdatedfrom` to minimize API calls
- **Batch operations**: Group HubSpot updates for efficiency

### Error Handling
- **Graceful degradation**: Continue processing other leases if individual lease sync fails
- **Retry logic**: Exponential backoff for transient API failures
- **Notification system**: Alert on critical sync failures

## Future Enhancements

### Phase 2 Features
- **Webhook integration**: Real-time lease status updates via Buildium webhooks
- **Lease renewal tracking**: Automatic detection and processing of lease renewals
- **Move-out coordination**: Integration with move-out workflows

### Advanced Analytics
- **Vacancy prediction**: ML-based vacancy prediction using lease patterns
- **Rent optimization**: Market rate analysis integration
- **Tenant lifecycle**: Complete tenant journey tracking across lease renewals

---

*This document serves as the comprehensive design specification for the lease-focused synchronization system. Implementation should follow the phased approach outlined above, with continuous testing and validation at each stage.*

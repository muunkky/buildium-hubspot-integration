# Owners Command Design Specification

## Overview

The `owners` command manages synchronization of property owner data between Buildium and HubSpot. Owners are foundational entities that should be established before syncing dependent data like properties, units, and leases.

## Business Context

### Owner Types in Buildium
- **Rental Owners**: Individual or company owners of rental properties
- **Association Owners**: Condo/HOA unit owners with ownership accounts
- **Mixed Ownership**: Some owners may have both rental and association properties

### HubSpot Mapping Strategy
- **Individual Owners** → HubSpot Contacts
- **Company Owners** → HubSpot Companies
- **Properties** → Associated via custom properties and associations

## Command Interface

### Basic Commands
```bash
# Sync all owners
node prototype/index.js owners --sync-all

# Sync owners for specific properties
node prototype/index.js owners --property-ids 123,456,789

# Sync owners by status
node prototype/index.js owners --status active
node prototype/index.js owners --status inactive

# Verification and diagnostics
node prototype/index.js owners --verify
node prototype/index.js owners --check-missing
node prototype/index.js owners --dry-run

# Incremental sync (modified since date)
node prototype/index.js owners --since "2024-01-01"
```

### Advanced Options
```bash
# Owner type filtering
node prototype/index.js owners --type rental
node prototype/index.js owners --type association
node prototype/index.js owners --type both

# Create missing HubSpot records
node prototype/index.js owners --create-missing

# Update existing records only
node prototype/index.js owners --update-only

# Force refresh all data
node prototype/index.js owners --force-refresh
```

## Data Architecture

### Buildium Owner Data Sources

#### Rental Owners (`/v1/rentals/owners`)
```json
{
  "Id": 12345,
  "IsCompany": false,
  "IsActive": true,
  "FirstName": "John",
  "LastName": "Smith", 
  "CompanyName": null,
  "Email": "john@example.com",
  "AlternateEmail": "johnalt@example.com",
  "PhoneNumbers": [
    {
      "Number": "555-123-4567",
      "Type": "Home"
    }
  ],
  "Address": {
    "AddressLine1": "123 Main St",
    "City": "Anytown",
    "State": "CA",
    "PostalCode": "12345"
  },
  "ManagementAgreementStartDate": "2023-01-01",
  "ManagementAgreementEndDate": null,
  "PropertyIds": [100, 101, 102],
  "Comment": "Reliable owner, prefers email contact"
}
```

#### Association Owners (`/v1/associations/owners`)
```json
{
  "Id": 67890,
  "FirstName": "Jane",
  "LastName": "Doe",
  "Email": "jane@example.com",
  "AlternateEmail": "jane.doe@work.com",
  "PhoneNumbers": [
    {
      "Number": "555-987-6543", 
      "Type": "Mobile"
    }
  ],
  "PrimaryAddress": { "..." },
  "AlternateAddress": { "..." },
  "EmergencyContact": {
    "FirstName": "Bob",
    "LastName": "Doe",
    "Relationship": "Spouse",
    "PhoneNumbers": [...]
  },
  "OwnershipAccounts": [
    {
      "Id": 456,
      "UnitId": 789,
      "PropertyId": 200
    }
  ]
}
```

### HubSpot Contact/Company Mapping

#### Individual Owner → HubSpot Contact
```json
{
  "properties": {
    "buildium_owner_id": "12345",
    "buildium_owner_type": "rental", 
    "firstname": "John",
    "lastname": "Smith",
    "email": "john@example.com",
    "buildium_alternate_email": "johnalt@example.com",
    "phone": "555-123-4567",
    "address": "123 Main St",
    "city": "Anytown", 
    "state": "CA",
    "zip": "12345",
    "buildium_is_active": "true",
    "buildium_management_start": "2023-01-01",
    "buildium_property_count": "3",
    "buildium_property_ids": "100,101,102",
    "buildium_comments": "Reliable owner, prefers email contact",
    "lifecyclestage": "customer"
  }
}
```

#### Company Owner → HubSpot Company
```json
{
  "properties": {
    "buildium_owner_id": "12346",
    "buildium_owner_type": "rental",
    "name": "ABC Property Management LLC",
    "domain": "abcproperties.com",
    "buildium_contact_email": "contact@abcproperties.com",
    "buildium_alternate_email": "billing@abcproperties.com", 
    "phone": "555-456-7890",
    "address": "456 Business Blvd",
    "city": "Metro City",
    "state": "NY", 
    "zip": "67890",
    "buildium_is_active": "true",
    "buildium_management_start": "2022-06-15",
    "buildium_property_count": "25",
    "buildium_property_ids": "200,201,202,203...",
    "industry": "Real Estate"
  }
}
```

## Implementation Phases

### Phase 1: Basic Owner Sync (Week 1-2)
**Scope**: Foundational owner synchronization functionality

**Deliverables**:
- Owner data fetching from both Buildium endpoints
- Basic HubSpot Contact/Company creation
- Owner type detection and routing logic
- Simple command interface (`--sync-all`, `--property-ids`)

**Technical Implementation**:
```javascript
// Core owner sync function
async function syncOwners(options = {}) {
  const { propertyIds, ownerType = 'both', dryRun = false } = options;
  
  // Fetch rental owners
  const rentalOwners = await fetchRentalOwners(propertyIds);
  
  // Fetch association owners  
  const associationOwners = await fetchAssociationOwners(propertyIds);
  
  // Process and sync each owner type
  for (const owner of rentalOwners) {
    await syncOwnerToHubSpot(owner, 'rental', dryRun);
  }
  
  for (const owner of associationOwners) {
    await syncOwnerToHubSpot(owner, 'association', dryRun);
  }
}
```

**Success Metrics**:
- Successfully sync 100% of active owners
- Proper Contact vs Company classification
- Zero duplicate owner records
- All owner-property relationships mapped

### Phase 2: Advanced Sync Features (Week 3)
**Scope**: Enhanced synchronization capabilities and data quality

**Deliverables**:
- Incremental sync by modification date
- Duplicate detection and merging logic
- Status filtering (active/inactive)
- Verification and diagnostic commands

**Technical Implementation**:
```javascript
// Incremental sync with modification tracking
async function syncOwnersSince(sinceDate) {
  const modifiedOwners = await fetchOwnersModifiedSince(sinceDate);
  return await processOwnerUpdates(modifiedOwners);
}

// Duplicate detection
async function findDuplicateOwners(owner) {
  const searchCriteria = buildSearchCriteria(owner);
  return await hubspotClient.searchContacts(searchCriteria);
}
```

**Success Metrics**:
- Incremental sync completes in <30 seconds
- 99%+ duplicate detection accuracy
- Verification command identifies all data inconsistencies

### Phase 3: Contact Enhancement (Week 4)
**Scope**: Rich contact data and relationship management

**Deliverables**:
- Emergency contact handling for associations
- Multiple phone number and address support
- Property association tracking
- Management agreement timeline tracking

**Technical Implementation**:
```javascript
// Enhanced contact data mapping
function mapAssociationOwnerToContact(owner) {
  const contact = mapBasicOwnerData(owner);
  
  // Add emergency contact info
  if (owner.EmergencyContact) {
    contact.properties.emergency_contact_name = 
      `${owner.EmergencyContact.FirstName} ${owner.EmergencyContact.LastName}`;
    contact.properties.emergency_contact_relationship = 
      owner.EmergencyContact.Relationship;
    contact.properties.emergency_contact_phone = 
      owner.EmergencyContact.PhoneNumbers?.[0]?.Number;
  }
  
  // Map ownership accounts
  contact.properties.owned_unit_ids = 
    owner.OwnershipAccounts.map(account => account.UnitId).join(',');
    
  return contact;
}
```

**Success Metrics**:
- All emergency contacts captured
- Property ownership relationships mapped
- Management agreement dates tracked

### Phase 4: Integration & Optimization (Week 5)
**Scope**: Performance optimization and command integration

**Deliverables**:
- Performance optimization for large owner datasets
- Integration with existing unit/lease commands
- Comprehensive error handling and logging
- Documentation and usage examples

**Technical Implementation**:
```javascript
// Batch processing for performance
async function syncOwnersInBatches(owners, batchSize = 10) {
  const batches = chunkArray(owners, batchSize);
  
  for (const batch of batches) {
    await Promise.all(
      batch.map(owner => syncOwnerToHubSpot(owner))
    );
    
    // Rate limiting delay
    await delay(calculateBatchDelay(batch.length));
  }
}

// Integration with existing commands
async function ensureOwnersExist(propertyIds) {
  const missingOwners = await findMissingOwners(propertyIds);
  if (missingOwners.length > 0) {
    console.log(`Creating ${missingOwners.length} missing owner records...`);
    await syncOwners({ propertyIds, createMissing: true });
  }
}
```

**Success Metrics**:
- Sync 1000+ owners in <5 minutes
- <1% sync failure rate
- Seamless integration with unit/lease commands

## Error Handling Strategy

### Data Quality Issues
- **Missing required fields**: Skip with warning, log for manual review
- **Invalid email addresses**: Use alternate email or phone as primary contact
- **Duplicate detection conflicts**: Manual review queue with suggested merges

### API Limitations
- **Rate limiting**: Exponential backoff with service-specific delays
- **Timeout handling**: Retry with longer timeouts for large datasets
- **Partial failures**: Continue processing, report failed records

### Sync Conflicts
- **HubSpot record conflicts**: Last-modified-wins with conflict logging
- **Property ownership changes**: Update associations, maintain history
- **Status changes**: Respect HubSpot lifecycle stages, don't downgrade

## Performance Considerations

### Buildium API Optimization
- **Parallel property queries**: Fetch multiple property owners simultaneously
- **Efficient filtering**: Use API filters to reduce data transfer
- **Pagination handling**: Process large owner lists in chunks

### HubSpot API Optimization  
- **Batch operations**: Use batch endpoints where available
- **Search optimization**: Efficient duplicate detection queries
- **Association management**: Bulk association updates

### Memory Management
- **Streaming processing**: Process owners without loading all into memory
- **Garbage collection**: Clear processed data to prevent memory leaks
- **Progress tracking**: Real-time progress reporting for long operations

## Testing Strategy

### Unit Tests
- Owner data mapping functions
- Duplicate detection logic
- Error handling scenarios
- Rate limiting compliance

### Integration Tests
- End-to-end owner sync workflow
- Buildium → HubSpot data integrity
- Cross-command integration
- Performance benchmarks

### Data Validation
- Owner-property relationship accuracy
- Contact vs Company classification
- Emergency contact data preservation
- Management agreement tracking

## Monitoring and Analytics

### Sync Metrics
- **Sync duration**: Track time per owner type and batch size
- **Success rates**: Monitor sync completion and failure rates  
- **Data quality**: Track duplicate detection and resolution
- **API usage**: Monitor rate limiting and quota consumption

### Business Metrics
- **Owner coverage**: Percentage of Buildium owners in HubSpot
- **Contact engagement**: Track HubSpot engagement on owner records
- **Data freshness**: Age of owner data in HubSpot
- **Property relationships**: Accuracy of owner-property mappings

## Future Enhancements

### Advanced Features (Phase 5+)
- **Owner communication preferences**: Sync from Buildium to HubSpot
- **Financial data integration**: Owner statement and payment history
- **Document management**: Link lease agreements and contracts
- **Automated workflows**: HubSpot workflows triggered by owner events

### Reporting and Analytics
- **Owner portfolio analysis**: Multi-property owner insights
- **Communication tracking**: Email and call history integration
- **Performance dashboards**: Real-time sync and data quality metrics
- **Compliance reporting**: Property management regulation compliance

This comprehensive owners command will provide a solid foundation for property owner management and set the stage for enhanced property management workflows in HubSpot.

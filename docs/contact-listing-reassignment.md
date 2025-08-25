# Contact-Listing Association Reassignment Function

## Overview

The `reassignContactListingAssociation` function provides a safe and reliable way to create or update associations between contacts and listings in HubSpot. It handles the complexities of removing existing associations and creating new ones with the correct association types.

## Function Signature

```javascript
async reassignContactListingAssociation(contactId, listingId, associationLabel)
```

### Parameters

- **contactId** (string): HubSpot contact ID
- **listingId** (string): HubSpot listing ID  
- **associationLabel** (number): Association type ID from the `AssociationLabel` enum

### Returns

Returns a result object with the following structure:

```javascript
{
    success: boolean,
    action: 'reassigned' | 'dry_run',
    contactId: string,
    listingId: string,
    associationLabel: number,
    labelName: string,
    previousAssociations: number,
    error?: string
}
```

## Association Labels

Use the `AssociationLabel` enum for type-safe bidirectional association management:

```javascript
const AssociationLabel = {
    ACTIVE_TENANT: {
        contactToListing: 2,    // Contact → Listing: Active Tenant
        listingToContact: 1     // Listing → Contact: Active Tenant
    },
    OWNER: {
        contactToListing: 4,    // Contact → Listing: Owner
        listingToContact: 3     // Listing → Contact: Owner
    },
    INACTIVE_TENANT: {
        contactToListing: 6,    // Contact → Listing: Inactive Tenant
        listingToContact: 5     // Listing → Contact: Inactive Tenant
    },
    FUTURE_TENANT: {
        contactToListing: 11,   // Contact → Listing: Future Tenant
        listingToContact: 12    // Listing → Contact: Future Tenant
    },
    ASSOCIATION_OWNER: {
        contactToListing: 13,   // Contact → Listing: Association Owner
        listingToContact: 14    // Listing → Contact: Association Owner
    }
};
```

### Bidirectional Support

HubSpot associations are bidirectional with different IDs for each direction:
- **Contact → Listing**: When creating associations from contact to listing perspective
- **Listing → Contact**: When creating associations from listing to contact perspective

The enum design handles both directions automatically.

## Helper Function

For owner associations, use the helper function to automatically determine the correct label:

```javascript
function getOwnerAssociationLabel(owner) {
    return owner._ownerType === 'association' ? AssociationLabel.ASSOCIATION_OWNER : AssociationLabel.OWNER;
}
```

## Usage Examples

### Basic Usage

```javascript
const { HubSpotClient, AssociationLabel } = require('./index.js');
const hubspotClient = new HubSpotClient();

// Reassign a contact as an active tenant
const result = await hubspotClient.reassignContactListingAssociation(
    'contact123',
    'listing456', 
    AssociationLabel.ACTIVE_TENANT
);

if (result.success) {
    console.log(`Successfully ${result.action} association`);
} else {
    console.error(`Failed: ${result.error}`);
}
```

### Owner Association with Helper

```javascript
const { getOwnerAssociationLabel } = require('./index.js');

// For an owner object with _ownerType property
const owner = {
    Id: 'buildium123',
    FirstName: 'John',
    LastName: 'Doe',
    _ownerType: 'rental' // or 'association'
};

const associationLabel = getOwnerAssociationLabel(owner);
const result = await hubspotClient.reassignContactListingAssociation(
    'contact123',
    'listing456',
    associationLabel
);
```

### Changing Owner Type

```javascript
// Owner was previously a rental owner (ID 4) but became HOA board member
const result = await hubspotClient.reassignContactListingAssociation(
    'contact123',
    'listing456',
    AssociationLabel.ASSOCIATION_OWNER
);

// This will:
// 1. Remove existing "Owner" association (ID 4)
// 2. Create new "Association Owner" association (ID 13)
```

### Tenant Status Change

```javascript
// Tenant moved from active to inactive
const result = await hubspotClient.reassignContactListingAssociation(
    'contact123',
    'listing456',
    AssociationLabel.INACTIVE_TENANT
);

// This will:
// 1. Remove existing "Active Tenant" association (ID 2) 
// 2. Create new "Inactive Tenant" association (ID 6)
```

## Key Features

### Safety
- **Automatic Cleanup**: Removes existing associations before creating new ones
- **Input Validation**: Validates contact ID, listing ID, and association label
- **Error Handling**: Returns detailed error information for troubleshooting
- **DRY RUN Support**: Respects `process.env.DRY_RUN = 'true'` for testing

### Reliability  
- **Bidirectional Support**: Works with HubSpot's bidirectional association system
- **Enum Validation**: Only accepts valid association type IDs
- **Atomic Operations**: Uses HubSpot's batch API for consistency
- **Comprehensive Logging**: Detailed console output for monitoring

### Integration
- **Sync Function Compatible**: Designed to work with existing sync processes
- **Helper Function**: `getOwnerAssociationLabel()` for automatic owner type detection
- **Export Support**: Available as module export for testing and external use

## TODO: Multiple Association Support

Currently, this function replaces existing associations (safe for current use case where contacts have only one relationship type per listing). 

**Future Enhancement**: Add support for contacts with multiple association types, such as:
- An owner who is also the condo board representative
- A tenant who becomes the property manager
- Multiple family members with different roles

This would require:
1. Adding a `preserveExisting` parameter
2. Modifying removal logic to be selective
3. Adding conflict resolution for overlapping roles
4. Enhanced validation for role combinations

## Error Handling

The function handles various error scenarios:

```javascript
// Missing required parameters
{ success: false, error: "contactId, listingId, and associationLabel are required" }

// Invalid association label
{ success: false, error: "Invalid association label: 999. Must be one of: 2, 4, 6, 11, 13" }

// HubSpot API errors
{ success: false, error: "Failed to create new association" }

// Network/connectivity issues
{ success: false, error: "Request failed with status 429" }
```

## Testing

Run the test suite to validate functionality:

```bash
node tests/contact_listing_reassignment_test.js
```

The test suite covers:
- ✅ Function existence and accessibility
- ✅ Input validation with invalid parameters
- ✅ Association label enum correctness
- ✅ DRY RUN mode behavior
- ✅ Error handling scenarios

## Integration with Sync Functions

The reassignment function is integrated into the owner sync process:

```javascript
// In createOwnerPropertyAssociations function
const reassignResult = await this.reassignContactListingAssociation(
    hubspotRecordId, 
    listing.id, 
    associationTypeId
);

if (reassignResult.success) {
    console.log(`✅ ${reassignResult.action === 'reassigned' ? 'Reassigned' : 'Associated'} with listing`);
} else {
    console.error(`❌ Failed: ${reassignResult.error}`);
}
```

This ensures that owner associations are properly managed during sync operations, with automatic cleanup of conflicting association types.

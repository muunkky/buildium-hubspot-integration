# HubSpot Association Strategy

## Available Association Types (Confirmed)

### Contact ↔ Listing Associations
- **ID: 4** - "Owner" (Contact → Listing)
  - *Semantics:* Contact owns this property/listing
  - *Usage:* ✅ **CORRECT for property owners**
  
- **ID: 3** - "Owner" (Listing → Contact - bidirectional)
  - *Semantics:* Listing is owned by this contact
  - *Usage:* ✅ **Bidirectional pair of ID: 4**

- **ID: 2** - "Active Tenant" (Contact → Listing)
  - *Semantics:* Contact is currently renting this listing
  - *Usage:* For tenant-listing relationships
  
- **ID: 1** - "Active Tenant" (Listing → Contact - bidirectional)
  - *Semantics:* Listing is currently rented by this contact

- **ID: 6** - "Inactive Tenant" (Contact → Listing)
  - *Semantics:* Contact previously rented this listing  
  
- **ID: 5** - "Inactive Tenant" (Listing → Contact - bidirectional)
  - *Semantics:* Listing was previously rented by this contact

## Current Implementation ✅

**Using `associationTypeId = 4` ("Owner")**
- ✅ **Semantically correct** for property owners
- ✅ **Functionally working** in production
- ✅ **Bidirectional support** with reverse ID: 3

### Implementation Notes
- ✅ HubSpot associations are **bidirectional** with different IDs per direction
- ✅ "Owner" association (ID: 4 → 3) is perfect for our use case
- ✅ Force sync capability implemented and tested
- ✅ Works for both Contact and Company owners

## Features Implemented
- ✅ Smart lookup: Search for existing unit listings by property ID
- ✅ Auto-sync: If no listings found, sync property units with `--force`
- ✅ Complete association: Associate owners with all unit listings for their properties
- ✅ Robust error handling: Graceful degradation if sync fails
- ✅ Standard fields only: No custom property validation errors

## Status: COMPLETE ✅
- ✅ Proper "Owner" association types identified and implemented
- ✅ Bidirectional association behavior validated
- ✅ Force sync with unit creation working
- ✅ Semantically correct data relationships

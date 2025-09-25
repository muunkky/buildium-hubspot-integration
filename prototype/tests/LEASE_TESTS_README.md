# Lease-Centric Sync Test Suite

This directory contains comprehensive tests for the **lease-centric sync approach** - a next-generation implementation that improves efficiency by 100x+ over the existing unit-centric approach.

## Overview

The lease-centric sync approach fundamentally changes how we detect and sync changes from Buildium to HubSpot:

- **Old approach**: Query all units, then check leases for each unit (1000+ API calls for 5 updates)
- **New approach**: Query only leases updated since last sync (8 API calls for 5 updates)

## Test Files

### Core Implementation Tests

#### `lease_centric_sync_test.js`
Tests the main sync orchestration logic:
- [OK] Incremental sync based on timestamps
- [OK] Lease status handling (Active → create/update, Terminated → archive)  
- [OK] Error handling and resilience
- [OK] Batch processing with configurable limits
- [OK] Data transformation from Buildium to HubSpot format
- [OK] API efficiency validation

#### `buildium_lease_client_test.js` 
Tests Buildium API client extensions:
- [OK] `getLeasesUpdatedSince()` with filtering
- [OK] Automatic pagination for large datasets
- [OK] Time range queries with `lastupdatedfrom`/`lastupdatedto`
- [OK] Rate limiting compliance (10 requests/second)
- [OK] Data transformation and error handling
- [OK] Connection testing and validation

#### `hubspot_listings_test.js`
Tests HubSpot listings object integration:
- [OK] Search listings by Buildium lease ID
- [OK] Create, update, and archive listing operations
- [OK] Upsert logic (create if new, update if exists)
- [OK] Batch processing for multiple operations
- [OK] Data validation and property sanitization
- [OK] Contact-listing association management

### Integration Tests

#### `integration_test.js`
End-to-end integration tests:
- [OK] Complete lease-to-listing workflow
- [OK] Multi-lease sync scenarios  
- [OK] Error handling and partial failures
- [OK] Performance benchmarking
- [OK] Data consistency validation
- [OK] Rate limiting behavior under load

## Running Tests

### Option 1: Enhanced Test Runner (Recommended)
```bash
# Run all lease-centric tests
node tests/run-tests.js lease-tests

# Run specific test
node tests/run-tests.js lease-centric-sync

# Run all tests (legacy + new)
node tests/run-tests.js all
```

### Option 2: Simple Test Runner
```bash
# Run with minimal dependencies
node tests/simple-test-runner.js

# Show help
node tests/simple-test-runner.js --help
```

### Option 3: Individual Test Files
```bash
# Run specific test file
node tests/lease_centric_sync_test.js
```

## Test Dependencies

The tests require minimal dependencies:
- `luxon` - Date/time handling (already used in main project)
- Node.js built-in modules (`assert`, `child_process`, etc.)

Install missing dependencies:
```bash
npm install luxon
```

## Key Features Tested

###  Performance & Efficiency
- **100x+ API efficiency improvement** - Demonstrated through performance comparison tests
- **Incremental sync capability** - Only processes leases updated since last sync
- **Minimal API calls** - 1 lease query + unit/property lookups vs 1000+ unit queries

### [RETRY] Sync Operations  
- **Active leases** → Create or update HubSpot listings
- **Terminated/Ended leases** → Archive HubSpot listings  
- **Bulk operations** → Process multiple lease updates efficiently
- **Incremental updates** → Daily/hourly sync with timestamp filtering

### ️ Reliability & Error Handling
- **Graceful error handling** - Continue processing on individual failures
- **Rate limiting compliance** - Respect both Buildium and HubSpot API limits
- **Data validation** - Ensure data integrity throughout sync process
- **Retry mechanisms** - Handle temporary API failures

### [STATS] Data Transformation
- **Buildium lease → HubSpot listing** mapping
- **Property and unit details** integration  
- **Date format standardization** (ISO → YYYY-MM-DD)
- **Type conversion** (numbers → strings for HubSpot)

## Expected Test Results

When all tests pass, you should see:

```
[COMPLETE] ALL TESTS PASSED!

 Lease-Centric Sync is ready for implementation:
    Incremental sync using Buildium lastupdatedfrom filter
    100x+ efficiency improvement over unit-centric approach  
    HubSpot listings object integration
    Comprehensive error handling and rate limiting
    Create, update, and archive operations

 Next Steps:
   1. Integrate lease-centric methods into existing BuildiumClient
   2. Add HubSpot listings API methods to HubSpotClient  
   3. Update IntegrationPrototype to use lease-centric sync
   4. Configure incremental sync scheduling
   5. Deploy and monitor performance improvements
```

## Implementation Notes

### Buildium API Integration
- Uses `GET /v1/leases` with `lastupdatedfrom` parameter
- Supports filtering by property IDs and lease statuses
- Handles pagination automatically for large datasets
- Respects 10 requests/second rate limit

### HubSpot API Integration  
- Uses listings object (0-420) for property listings
- Search by `buildium_lease_id` for deduplication
- Supports create, update, and archive operations
- Handles rate limiting (100 requests per 10 seconds)

### Data Model
```javascript
// Buildium Lease → HubSpot Listing Property Mapping
{
  buildium_lease_id: lease.Id,
  buildium_unit_id: unit.Id, 
  buildium_property_id: property.Id,
  name: `${property.Name} - Unit ${unit.UnitNumber}`,
  rent_amount: lease.Rent.Amount,
  lease_start_date: lease.LeaseFromDate,
  lease_end_date: lease.LeaseToDate,
  lease_status: lease.Status,
  // ... additional fields
}
```

## Debugging

If tests fail, check:

1. **Dependencies**: Ensure `luxon` is installed
2. **Mock responses**: Verify mock data matches expected API responses
3. **API endpoints**: Confirm Buildium/HubSpot API endpoints are correct
4. **Rate limiting**: Check if delays are sufficient for API limits
5. **Data formats**: Ensure date/number formats match expectations

## Contributing

When adding new tests:

1. Follow existing test structure with `describe()` and `it()` blocks
2. Use mock clients to avoid actual API calls during testing  
3. Include both success and error scenarios
4. Test edge cases (empty data, malformed responses, etc.)
5. Update this README with new test descriptions

---

**Ready to revolutionize Buildium-HubSpot sync efficiency!** 

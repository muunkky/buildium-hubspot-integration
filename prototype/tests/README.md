# Test Suite for Buildium-HubSpot Integration

This directory contains all tests for the Buildium-HubSpot integration project.

## Directory Structure

```
tests/
├── run-tests.js           # Test runner script
├── end_to_end_test.js     # Comprehensive E2E test with full API validation
├── focused_e2e_test.js    # Focused E2E test for owners sync
├── simple_e2e_test.js     # Simple E2E test using existing utilities
├── units_e2e_test.js      # End-to-end test for units sync
└── test_force_sync.js     # Force sync functionality test
```

## Quick Start

### Run Individual Tests

```bash
# Test owners sync end-to-end
node tests/run-tests.js owners-e2e

# Test units sync end-to-end  
node tests/run-tests.js units-e2e

# Test force sync functionality
node tests/run-tests.js force-sync

# Run comprehensive API test
node tests/run-tests.js comprehensive-e2e
```

### Run All Tests

```bash
node tests/run-tests.js all
```

### Get Help

```bash
node tests/run-tests.js help
```

## Test Descriptions

### [TARGET] Integration Tests

#### `owners-e2e` (focused_e2e_test.js)
**Purpose**: Validates the complete owners sync pipeline  
**Target**: Property 140054 (Vishesh Sonawala)  
**Validates**:
- Source data retrieval from Buildium
- Contact search and update in HubSpot
- Force sync functionality  
- Owner-property associations
- Zero-error operation

#### `units-e2e` (units_e2e_test.js)
**Purpose**: Validates the complete units sync pipeline  
**Target**: Property 140054 units  
**Validates**:
- Unit data retrieval from Buildium
- Listing creation/updates in HubSpot
- Unit-to-listing mapping
- Data integrity and consistency

#### `comprehensive-e2e` (end_to_end_test.js)
**Purpose**: Full API validation with detailed verification  
**Features**:
- Direct API calls to both Buildium and HubSpot
- Complete data validation and integrity checks
- Detailed association verification
- Comprehensive error handling

#### `simple-e2e` (simple_e2e_test.js)
**Purpose**: Lightweight test using existing utilities  
**Features**:
- Uses existing debug and utility scripts
- Quick validation of basic functionality
- Good for rapid testing during development

### [TOOL] Unit Tests

#### `force-sync` (test_force_sync.js)
**Purpose**: Validates force sync capability  
**Tests**:
- Existing listing detection
- Force mode activation
- Contact update vs create logic

## Test Results Interpretation

### Success Indicators
- [OK] **PASS**: Test completed successfully
- [STATS] **Metrics**: Shows counts of synced, created, updated items
-  **Associations**: Verifies relationship creation
- [FAIL] **Zero Errors**: No failures in the pipeline

### Common Issues
- **401 Unauthorized**: Check API credentials in `.env`
- **409 Conflict**: Contact/listing already exists (may be normal)
- **Rate Limiting**: API calls too frequent (built-in backoff)
- **Missing Data**: Source data not found in Buildium

## Development Workflow

### Adding New Tests

1. Create test file in `/tests/` directory
2. Add entry to `run-tests.js` configuration
3. Follow naming convention: `[feature]_[type]_test.js`
4. Include proper error handling and logging

### Test Categories

- **Integration**: End-to-end pipeline validation
- **Unit**: Individual component testing
- **Performance**: Load and timing tests
- **Regression**: Verify bug fixes remain fixed

## Environment Requirements

### Required Environment Variables
```bash
BUILDIUM_CLIENT_ID=your_buildium_client_id
BUILDIUM_CLIENT_SECRET=your_buildium_client_secret  
HUBSPOT_ACCESS_TOKEN=your_hubspot_access_token
```

### Dependencies
- Node.js 18+
- All packages from `package.json`
- Active Buildium and HubSpot API access

## Troubleshooting

### Test Failures
1. Check environment variables are set
2. Verify API credentials are valid
3. Ensure test data exists (Property 140054)
4. Check network connectivity

### Performance Issues
- Tests include rate limiting delays
- Use `force-sync` test for quick validation
- `comprehensive-e2e` is slowest but most thorough

### Data Consistency
- Tests may modify HubSpot data
- Use test properties/contacts when possible
- Clean up test data if needed

## Best Practices

1. **Run tests in order**: Start with `force-sync`, then `owners-e2e`
2. **Monitor API limits**: Space out test runs
3. **Use specific data**: Target known properties/contacts
4. **Check logs**: Review output for detailed information
5. **Verify manually**: Spot-check results in HubSpot UI

## Contributing

When adding tests:
- Include clear descriptions and expected outcomes
- Add proper error handling and timeouts
- Document any test data requirements
- Follow the existing logging patterns
- Update this README with new test information

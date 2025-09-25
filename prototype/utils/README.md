# Utility Scripts

This folder contains permanent utility and debugging scripts used during development and testing of the Buildium-HubSpot integration.

## Organization

The project now uses the following structure:
- **`/utils/`** - Permanent, reusable utility scripts (this directory)
- **`/tests/`** - Formal test suite for validation
- **`/scripts/temp/`** - Temporary scripts for specific testing purposes

## Files

### Association Testing Scripts
- **`check_associations.js`** - Checks existing associations for a specific listing
- **`debug_associations.js`** - Comprehensive debugging of association issues and available properties
- **`test_association.js`** - Tests different association creation methods
- **`check_detailed.js`** - Detailed association checking from both directions (contact→listing, listing→contact)
- **`find_association.js`** - Discovers correct association types and tests different API endpoints
- **`verify_associations.js`** - Verifies that Active Tenant associations are showing up correctly
- **`create_active_tenant.js`** - Manually creates Active Tenant associations for testing

### Data Display Scripts
- **`show_data.js`** - Displays tenant and property data for inspection

### API Testing Scripts
- **`check_association_types.js`** - Discovers available association types between contacts and listings
- **`debug_buildium_owners.js`** - Tests Buildium owners API filtering and property relationships
- **`check_unit_ids.js`** - Checks Buildium unit ID types and structures

### Development Utilities
- **`integration_test.js`** - Basic integration testing utilities
- **`test_api_directly.js`** - Direct API testing without main application logic

## Usage

All scripts require the environment variables to be loaded. Run from the prototype directory:

```bash
# From prototype/ directory
node utils/script_name.js
```

## Environment Setup

These scripts automatically load the `.env` file using `require('dotenv').config()`.

## Script Categories

### [TOOL] **Debugging Tools**
Scripts that help diagnose issues:
- Association problems
- API connectivity
- Data transformation errors
- Object creation failures

### [TEST] **Testing Utilities**
Scripts that validate functionality:
- API endpoints
- Data integrity
- Association creation
- Integration workflows

### [STATS] **Data Analysis**
Scripts that examine and display data:
- Property relationships
- Contact information
- Association structures
- Unit configurations

## Development Guidelines

### Adding New Utilities
- Use clear, descriptive names
- Include purpose and usage in file header
- Add proper error handling
- Document any special requirements

### Script Lifecycle
1. **Development**: Create in `/scripts/temp/` for specific needs
2. **Testing**: Validate functionality and stability
3. **Promotion**: Move to `/utils/` when proven useful
4. **Documentation**: Update this README with description

## Related Directories

- **`/tests/`**: Run `node tests/run-tests.js help` for test options
- **`/scripts/temp/`**: Check for temporary/experimental scripts
- **`/docs/`**: See planning and API documentation

## Development Notes

These scripts were created during the development process to:
1. Debug API connectivity issues
2. Test different association approaches
3. Verify data transformation
4. Troubleshoot HubSpot object creation
5. Validate integration workflows

They serve as both debugging tools and reference implementations for future development.

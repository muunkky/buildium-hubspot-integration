# Utility Scripts

This folder contains utility and debugging scripts used during development and testing of the Buildium-HubSpot integration.

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

## Usage

All scripts require the environment variables to be loaded. Run from the prototype directory:

```bash
# From prototype/ directory
node utils/script_name.js
```

## Environment Setup

These scripts automatically load the `.env` file using `require('dotenv').config()`.

## Development Notes

These scripts were created during the development process to:
1. Debug API connectivity issues
2. Test different association approaches
3. Verify data transformation
4. Troubleshoot HubSpot object creation

They can be used as reference for future debugging or as standalone tools for testing specific functionality.

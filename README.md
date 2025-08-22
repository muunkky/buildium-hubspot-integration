# Buildium-HubSpot Integration

A comprehensive integration system for syncing property data and tenant contacts between Buildium and HubSpot, with support for listings, custom properties, and tenant associations.

## Features

### Core Functionality
- **Property Sync**: Sync Buildium properties as HubSpot listings with comprehensive field mapping
- **Tenant Sync**: Create and update HubSpot contacts from Buildium tenant data
- **Lease Management**: Track active and inactive lease relationships between tenants and properties
- **Association Mapping**: Automatically create associations between contacts and listings based on lease status

### Advanced Features
- **Force Update Mode**: Use `--force` flag to update existing records with latest data
- **Safe Update Mode**: Only updates fields with actual data to avoid overwriting existing HubSpot information
- **Canadian Address Support**: Handles both US ZIP codes and Canadian postal codes
- **Custom Properties**: Automatically creates required custom properties in HubSpot
- **Comprehensive Logging**: Detailed progress tracking and error reporting

## Project Structure

```
├── prototype/
│   ├── index.js                 # Main integration classes and logic
│   ├── package.json            # Node.js dependencies
│   └── utils/                  # Utility scripts
│       ├── sync_10_units.js    # Sync script for testing
│       ├── delete_all_listings.js
│       ├── test_contact_creation.js
│       └── [other utility scripts]
├── docs/                       # API documentation
│   ├── buildium-api-reference.md
│   ├── hubspot-api-reference.md
│   └── data-integration-plan.md
└── scripts/                    # Additional processing scripts
```

## Setup

### Prerequisites
- Node.js (v14 or higher)
- Buildium API credentials (Client ID and Secret)
- HubSpot API access token with appropriate permissions

### Installation

1. Clone the repository:
```bash
git clone https://github.com/muunkky/buildium-hubspot-integration.git
cd buildium-hubspot-integration
```

2. Install dependencies:
```bash
cd prototype
npm install
```

3. Create a `.env` file with your API credentials:
```env
BUILDIUM_BASE_URL=https://api.buildium.com
BUILDIUM_CLIENT_ID=your_buildium_client_id
BUILDIUM_CLIENT_SECRET=your_buildium_client_secret
HUBSPOT_ACCESS_TOKEN=your_hubspot_access_token
```

## Usage

### Basic Sync
Sync units from Buildium to HubSpot (creates new records, skips existing):
```bash
cd prototype/utils
node sync_10_units.js
```

### Force Update Mode
Update existing records with latest data from Buildium:
```bash
node sync_10_units.js --force
```

### Utility Scripts
- `delete_all_listings.js` - Remove all listings from HubSpot
- `test_contact_creation.js` - Test contact creation with a specific tenant
- Various debug and verification scripts in the `utils/` directory

## API Integration

### Buildium API
- **Properties**: Fetch property details, addresses, and metadata
- **Units**: Retrieve unit information, numbers, types, and status
- **Tenants**: Get tenant contact information and details
- **Leases**: Track lease relationships, status, and history

### HubSpot API
- **Listings Object**: Custom object for property listings
- **Contacts**: Standard contact records for tenants
- **Custom Properties**: Extended fields for Buildium-specific data
- **Associations**: Links between contacts and listings based on lease status

## Field Mapping

### Contact Fields (Tenant → HubSpot Contact)
- **Standard Fields**: firstname, lastname, email, phone, address, city, state, zip, country
- **Business Info**: company, jobtitle
- **Extended Fields**: mobilephone, fax, website, date_of_birth
- **Buildium Metadata**: Stored in `hs_content_membership_notes` including tenant ID, notes, emergency contacts

### Listing Fields (Unit/Property → HubSpot Listing)
- **Property Info**: name, description, address components
- **Unit Details**: unit number, type, floor, market rent, status
- **Buildium Tracking**: property ID, unit ID, URLs for management
- **Tenant Associations**: Current and previous tenant contact IDs

## Data Flow

1. **Fetch Data**: Retrieve units, properties, and lease information from Buildium
2. **Transform**: Convert Buildium data to HubSpot-compatible format
3. **Sync Listings**: Create or update property listings in HubSpot
4. **Process Tenants**: Create or update contact records for tenants
5. **Create Associations**: Link contacts to listings based on lease status (Active/Inactive)

## Safe Update Mode

The force update feature includes a "safe mode" that:
- Only updates fields where Buildium has actual data
- Never overwrites existing HubSpot data with empty values
- Preserves manually entered information in HubSpot
- Uses PATCH requests to update only specified fields

## Error Handling

- Comprehensive logging with emoji indicators for easy scanning
- Graceful handling of API rate limits and timeouts
- Detailed error reporting with context information
- Fallback mechanisms for complex property/lease queries

## International Support

- **US Addresses**: Standard ZIP code handling
- **Canadian Addresses**: Postal code validation and proper field mapping
- **Address Validation**: Regex-based detection to route addresses correctly

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with your Buildium/HubSpot instances
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the existing issues in GitHub
2. Review the documentation in the `docs/` folder
3. Create a new issue with detailed information about your setup and the problem

## Changelog

### Recent Updates
- Added force update mode with safe field updating
- Implemented comprehensive Canadian address support
- Enhanced error handling and logging
- Added association management between contacts and listings
- Improved field mapping with 20+ property fields and 16+ contact fields

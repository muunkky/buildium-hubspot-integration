# Buildium to HubSpot Integration Prototype

A comprehensive prototype demonstrating syncing data from Buildium to HubSpot using **native Listings objects** and contacts.

## 🎯 Key Features

✅ **Tenant → Contact Sync**: Buildium tenants become HubSpot contacts  
✅ **Property → Native Listings Sync**: Uses HubSpot's native Listings object (ID: 0-420)  
✅ **Duplicate Detection**: Prevents duplicate records  
✅ **Error Handling**: Comprehensive error reporting  
✅ **Dry Run Mode**: Test without creating actual records  

## 🏗️ Architecture Highlights

### HubSpot Native Objects Used
- **Contacts** (0-1): For tenant data
- **Native Listings** (0-420): For property data *(no custom objects needed!)*

### API Endpoints
- **Buildium**: `/leases/tenants/{id}` and `/rentals/{id}`
- **HubSpot**: `/crm/v3/objects/contacts` and `/crm/v3/objects/0-420`

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd prototype
npm install
```

### 2. Configure API Credentials

#### Buildium API:
1. Log into your Buildium account
2. Go to Settings > API Credentials  
3. Copy your Client ID and Client Secret

#### HubSpot API:
1. Go to HubSpot > Settings > Integrations > Private Apps
2. Create a new private app with these scopes:
   - `crm.objects.contacts.write`
   - `crm.objects.contacts.read`
   - `crm.objects.listings.write` 
   - `crm.objects.listings.read`
3. Copy the access token

### 3. Set up Environment Variables
```bash
# Copy the example environment file
copy .env.example .env

# Edit .env with your actual API credentials
```

### 4. Update .env file:
```env
BUILDIUM_CLIENT_ID=your_actual_client_id
BUILDIUM_CLIENT_SECRET=your_actual_client_secret
HUBSPOT_ACCESS_TOKEN=your_actual_access_token
DRY_RUN=true
```

## 📝 Usage

### Sync Tenant to Contact
```bash
npm start sync <tenant_id>
```

### Sync Property to Native Listing  
```bash
npm start sync-property <property_id>
```

### Other Commands
```bash
npm start debug     # Check configuration
npm start test      # Test API connectivity  
npm start list      # List available tenants
```

### Example Workflow
```bash
# 1. First, see what tenants are available
npm start list

# 2. Sync a specific tenant to HubSpot
npm start sync 12345

# 3. Sync a property to HubSpot Listings
npm start sync-property 67890
```

## 🗺️ Data Mapping

### Buildium Tenant → HubSpot Contact
| Buildium Field | HubSpot Field | Notes |
|----------------|---------------|-------|
| `FirstName` | `firstname` | Required |
| `LastName` | `lastname` | Required |
| `Email` | `email` | Required, used for duplicate check |
| `PhoneNumbers[0].Number` | `phone` | Primary phone only |
| `Address.AddressLine1/2` | `address` | Combined address |
| `Address.City` | `city` | |
| `Address.State` | `state` | |
| `Address.PostalCode` | `zip` | |
| `Id` | Custom property | Stored in notes field |

### Buildium Property → HubSpot Native Listing (0-420)
| Buildium Field | HubSpot Field | Notes |
|----------------|---------------|-------|
| `Name` | `name` | Property display name |
| `Address` | `address` | Full formatted address |
| `PropertyType` | `property_type` | Apartment, house, etc. |
| `NumberOfBedrooms` | `bedrooms` | Converted to string |
| `NumberOfBathrooms` | `bathrooms` | Converted to string |
| `MarketRent` | `rent_amount` | Monthly rent |
| `Id` | `buildium_property_id` | For duplicate prevention |

## 🛡️ Safety Features

### Dry Run Mode
Set `DRY_RUN=true` in your `.env` file to test without creating actual records.

### Duplicate Prevention
- **Contacts**: Checked by email address
- **Listings**: Checked by Buildium property ID

### Error Handling
- API errors are caught and logged
- Network timeouts are handled
- Missing required fields are validated

## 📊 Example Output

### Tenant Sync
```
🚀 Starting Buildium to HubSpot sync...
🔍 Fetching tenant 12345 from Buildium...
✅ Successfully fetched tenant from Buildium
📋 Tenant Data:
   Name: John Doe
   Email: john.doe@email.com
   ID: 12345

🔍 Searching for existing contact with email: john.doe@email.com
ℹ️ No existing contact found
🔄 Transforming tenant data to HubSpot format...
📝 Creating contact in HubSpot...
🎉 Sync completed successfully!
   HubSpot Contact ID: 123456789
```

### Property Sync
```
🏠 Starting Buildium Property to HubSpot Listing sync...
🔍 Fetching property 67890 from Buildium...
✅ Successfully fetched property from Buildium
🏢 Property Data:
   Name: Sunset Apartments
   Address: 456 Oak Street, Springfield, IL
   ID: 67890

🔍 Searching for existing listing with Buildium Property ID: 67890
ℹ️ No existing listing found
🔄 Transforming property data to HubSpot Listings format...
🏠 Creating listing in HubSpot...
🎉 Property sync completed successfully!
   HubSpot Listing ID: 987654321
```

## 🎯 Next Steps

This prototype demonstrates the basic flow using HubSpot's native Listings object. For production use, consider:

1. **Unit objects**: Create custom Unit objects associated with Listings
2. **Association logic**: Link Contacts to Units/Listings through lease data  
3. **Batch processing**: Handle multiple records at once
4. **Webhook support**: Real-time sync triggers
5. **Database storage**: Track sync state and history

See the full `data-integration-plan.md` for comprehensive production architecture.

## 📁 File Structure
```
prototype/
├── package.json          # Dependencies and scripts
├── index.js             # Main application code
├── .env.example         # Environment template
├── .env                 # Your actual credentials (gitignored)
└── README.md           # This file
```

## Quick Start

### 1. Install Dependencies
```bash
cd prototype
npm install
```

### 2. Set up Environment Variables
```bash
# Copy the example environment file
copy .env.example .env

# Edit .env with your actual API credentials
```

### 3. Configure Your API Credentials

#### Buildium API:
1. Log into your Buildium account
2. Go to Settings > API Credentials
3. Copy your Client ID and Client Secret

#### HubSpot API:
1. Go to HubSpot > Settings > Integrations > Private Apps
2. Create a new private app with these scopes:
   - `crm.objects.contacts.write`
   - `crm.objects.contacts.read`
3. Copy the access token

### 4. Update .env file:
```env
BUILDIUM_CLIENT_ID=your_actual_client_id
BUILDIUM_CLIENT_SECRET=your_actual_client_secret
HUBSPOT_ACCESS_TOKEN=your_actual_access_token
DRY_RUN=true
```

## Usage

### List Available Tenants
```bash
npm start list
```

### Sync a Specific Tenant
```bash
npm start sync <tenant_id>
```

### Example Workflow
```bash
# 1. First, see what tenants are available
npm start list

# Output will show:
# 1. John Doe
#    ID: 12345
#    Email: john.doe@email.com

# 2. Sync a specific tenant to HubSpot
npm start sync 12345
```

## Features

✅ **Fetch tenant data from Buildium**  
✅ **Transform data to HubSpot format**  
✅ **Check for existing contacts (duplicate prevention)**  
✅ **Create new contact in HubSpot**  
✅ **Dry run mode for testing**  
✅ **Detailed logging and error handling**  

## Data Mapping

| Buildium Field | HubSpot Field | Notes |
|----------------|---------------|-------|
| `FirstName` | `firstname` | Required |
| `LastName` | `lastname` | Required |
| `Email` | `email` | Required, used for duplicate check |
| `PhoneNumbers[0].Number` | `phone` | Primary phone only |
| `Address.AddressLine1/2` | `address` | Combined address |
| `Address.City` | `city` | |
| `Address.State` | `state` | |
| `Address.PostalCode` | `zip` | |
| `Id` | `buildium_tenant_id` | Custom property |
| `AlternateEmail` | `hs_additional_emails` | Custom property |
| `Comment` | `notes_last_contacted` | With import timestamp |

## Safety Features

### Dry Run Mode
Set `DRY_RUN=true` in your `.env` file to test without creating actual HubSpot contacts.

### Duplicate Prevention
The prototype checks for existing contacts with the same email address before creating new ones.

### Error Handling
- API errors are caught and logged
- Network timeouts are handled
- Missing required fields are validated

## Example Output

```
🏠➡️📞 Buildium to HubSpot Integration Prototype
============================================================
✅ Configuration validated
🚀 Starting Buildium to HubSpot sync...
==================================================
🔍 Fetching tenant 12345 from Buildium...
✅ Successfully fetched tenant from Buildium
📋 Tenant Data:
   Name: John Doe
   Email: john.doe@email.com
   ID: 12345

🔍 Searching for existing contact with email: john.doe@email.com
ℹ️ No existing contact found
🔄 Transforming tenant data to HubSpot format...
✅ Successfully transformed tenant data
📝 Creating contact in HubSpot...
🔄 DRY RUN MODE - Would create contact with data: {
  "properties": {
    "firstname": "John",
    "lastname": "Doe",
    "email": "john.doe@email.com",
    "phone": "555-123-4567",
    "address": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "zip": "12345",
    "buildium_tenant_id": "12345",
    "notes_last_contacted": "Imported from Buildium on 2025-08-21T...",
    "lifecyclestage": "customer"
  }
}
✅ Successfully created contact in HubSpot
🎉 Sync completed successfully!
   HubSpot Contact ID: dry-run-id
```

## Troubleshooting

### Common Issues

1. **API Authentication Errors**
   - Verify your API credentials are correct
   - Check that your HubSpot app has the required scopes

2. **Tenant Not Found**
   - Use `npm start list` to see available tenant IDs
   - Verify the tenant ID exists in your Buildium account

3. **Rate Limiting**
   - The prototype includes basic error handling for rate limits
   - For production use, implement proper retry logic

### Debug Mode
Add detailed logging by setting:
```env
DEBUG=true
```

## Next Steps

This prototype demonstrates the basic flow. For production use, consider:

1. **Database storage** for sync state tracking
2. **Batch processing** for multiple tenants
3. **Webhook handling** for real-time updates
4. **Error recovery** and retry mechanisms
5. **Data validation** and quality checks
6. **Monitoring** and alerting

See the full `data-integration-plan.md` for comprehensive production architecture.

## File Structure
```
prototype/
├── package.json          # Dependencies and scripts
├── index.js             # Main application code
├── .env.example         # Environment template
├── .env                 # Your actual credentials (gitignored)
└── README.md           # This file
```

# Buildium API Reference: Getting Contact and Property Information

## Overview

Buildium is a property management software with a powerful RESTful API that allows integration with external systems. The API provides access to rental properties, units, tenants (contacts), leases, and other property management data.

---

## API Authentication

### Base URL
```
https://api.buildium.com/v1/
```

### Authentication Headers
```http
x-buildium-client-id: YOUR_CLIENT_ID
x-buildium-client-secret: YOUR_CLIENT_SECRET
```

### Enabling API Access
1. Sign in to your Buildium account
2. Go to **Settings** > **Application settings**
3. Under **System preferences**, click **API settings**
4. Toggle **Open API** to enable it
5. Create API keys with appropriate permissions

---

## Getting Contact Information (Tenants/Residents)

### Retrieve All Tenants
```http
GET https://api.buildium.com/v1/tenants
```

#### Headers
```http
x-buildium-client-id: YOUR_CLIENT_ID
x-buildium-client-secret: YOUR_CLIENT_SECRET
Content-Type: application/json
```

#### Response Format
```json
[
  {
    "Id": 12345,
    "FirstName": "John",
    "LastName": "Doe",
    "Email": "john.doe@example.com",
    "AlternateEmail": "alternate@example.com",
    "PhoneNumbers": [
      {
        "Number": "+1-555-123-4567",
        "Type": "Home"
      }
    ],
    "CreatedDateTime": "2024-01-15T10:30:00Z",
    "EmergencyContact": {
      "Name": "Jane Doe",
      "RelationshipDescription": "Spouse",
      "Phone": "+1-555-987-6543",
      "Email": "jane.doe@example.com"
    },
    "DateOfBirth": "1985-03-15",
    "Address": {
      "AddressLine1": "123 Main Street",
      "AddressLine2": "Apt 4B",
      "City": "Anytown",
      "State": "CA",
      "PostalCode": "12345",
      "Country": "United States"
    },
    "AlternateAddress": {
      "AddressLine1": "456 Oak Avenue",
      "City": "Another City",
      "State": "CA",
      "PostalCode": "67890",
      "Country": "United States"
    },
    "MailingPreference": "PrimaryAddress",
    "Leases": [
      {
        "Id": 54321,
        "PropertyId": 111,
        "UnitId": 222,
        "UnitNumber": "4B",
        "LeaseFromDate": "2024-01-01",
        "LeaseToDate": "2024-12-31",
        "LeaseStatus": "Active",
        "TermType": "Fixed",
        "AccountDetails": {
          "SecurityDeposit": 1500.00,
          "Rent": 2000.00
        }
      }
    ],
    "Comment": "Reliable tenant, pays on time",
    "TaxId": "123-45-6789"
  }
]
```

### Get Specific Tenant by ID
```http
GET https://api.buildium.com/v1/tenants/{tenantId}
```

### Search Tenants
```http
GET https://api.buildium.com/v1/tenants?limit=50&offset=0&lastupdatedfrom=2024-01-01
```

---

## Getting Property Information

### Retrieve All Rental Properties
```http
GET https://api.buildium.com/v1/rentals
```

#### Response Format
```json
[
  {
    "Id": 111,
    "Name": "Sunset Apartments",
    "Address": {
      "AddressLine1": "789 Sunset Boulevard",
      "AddressLine2": "",
      "City": "Los Angeles",
      "State": "CA",
      "PostalCode": "90210",
      "Country": "United States"
    },
    "NumberUnits": 50,
    "StructureDescription": "Multi-family apartment complex",
    "YearBuilt": 1995,
    "Features": [
      "LaundryRoom",
      "Parking",
      "Pool",
      "Gym"
    ],
    "IncludedInRent": [
      "Water",
      "Trash"
    ]
  }
]
```

### Get Specific Property by ID
```http
GET https://api.buildium.com/v1/rentals/{propertyId}
```

---

## Getting Unit Information

### Retrieve All Units for a Property
```http
GET https://api.buildium.com/v1/rentals/{propertyId}/units
```

### Get All Units (All Properties)
```http
GET https://api.buildium.com/v1/units
```

#### Response Format
```json
[
  {
    "Id": 222,
    "PropertyId": 111,
    "BuildingName": "Building A",
    "UnitNumber": "4B",
    "Description": "2-bedroom, 1-bathroom apartment with balcony",
    "MarketRent": 2000.00,
    "Address": {
      "AddressLine1": "789 Sunset Boulevard",
      "AddressLine2": "Unit 4B",
      "City": "Los Angeles",
      "State": "CA",
      "PostalCode": "90210",
      "Country": "United States"
    },
    "UnitBedrooms": "TwoBed",
    "UnitBathrooms": "OneBath",
    "UnitSize": 950,
    "IsUnitListed": false,
    "IsUnitOccupied": true
  }
]
```

### Get Specific Unit by ID
```http
GET https://api.buildium.com/v1/units/{unitId}
```

---

## Getting Lease Information

### Retrieve All Leases
```http
GET https://api.buildium.com/v1/leases
```

#### Response Format
```json
[
  {
    "Id": 54321,
    "PropertyId": 111,
    "UnitId": 222,
    "UnitNumber": "4B",
    "LeaseFromDate": "2024-01-01",
    "LeaseToDate": "2024-12-31",
    "LeaseType": "Fixed",
    "LeaseStatus": "Active",
    "IsEvictionPending": false,
    "TermType": "Fixed",
    "RenewalOfferStatus": "NotSet",
    "CurrentTenants": [
      {
        "Id": 12345,
        "FirstName": "John",
        "LastName": "Doe",
        "Email": "john.doe@example.com"
      }
    ],
    "CurrentNumberOfOccupants": 2,
    "AccountDetails": {
      "SecurityDeposit": 1500.00,
      "Rent": 2000.00
    },
    "PaymentDueDay": 1,
    "AutomaticallyMoveOutTenants": true,
    "CreatedDateTime": "2023-12-01T09:00:00Z",
    "LastUpdatedDateTime": "2024-01-15T14:30:00Z"
  }
]
```

### Get Leases for Specific Property
```http
GET https://api.buildium.com/v1/leases?propertyids={propertyId}
```

### Get Leases for Specific Tenant
```http
GET https://api.buildium.com/v1/leases?tenantids={tenantId}
```

---

## Common API Parameters

### Pagination
- `limit`: Number of records to return (default: 50, max: 100)
- `offset`: Number of records to skip

### Filtering
- `lastupdatedfrom`: Filter records updated after this date (YYYY-MM-DD format)
- `lastupdatedto`: Filter records updated before this date
- `propertyids`: Comma-separated list of property IDs
- `tenantids`: Comma-separated list of tenant IDs
- `unitids`: Comma-separated list of unit IDs

### Example with Parameters
```http
GET https://api.buildium.com/v1/tenants?limit=25&offset=0&lastupdatedfrom=2024-01-01&propertyids=111,222
```

---

## Code Examples

### JavaScript/Node.js Example
```javascript
const axios = require('axios');

const buildiumAPI = {
  baseURL: 'https://api.buildium.com/v1',
  headers: {
    'x-buildium-client-id': 'YOUR_CLIENT_ID',
    'x-buildium-client-secret': 'YOUR_CLIENT_SECRET',
    'Content-Type': 'application/json'
  }
};

// Get all tenants
async function getAllTenants() {
  try {
    const response = await axios.get(`${buildiumAPI.baseURL}/tenants`, {
      headers: buildiumAPI.headers
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching tenants:', error.response?.data || error.message);
    throw error;
  }
}

// Get all properties
async function getAllProperties() {
  try {
    const response = await axios.get(`${buildiumAPI.baseURL}/rentals`, {
      headers: buildiumAPI.headers
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching properties:', error.response?.data || error.message);
    throw error;
  }
}

// Get units for a specific property
async function getUnitsForProperty(propertyId) {
  try {
    const response = await axios.get(`${buildiumAPI.baseURL}/rentals/${propertyId}/units`, {
      headers: buildiumAPI.headers
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching units:', error.response?.data || error.message);
    throw error;
  }
}

// Usage example
async function main() {
  try {
    const tenants = await getAllTenants();
    console.log('Tenants:', tenants);
    
    const properties = await getAllProperties();
    console.log('Properties:', properties);
    
    if (properties.length > 0) {
      const units = await getUnitsForProperty(properties[0].Id);
      console.log('Units for first property:', units);
    }
  } catch (error) {
    console.error('API Error:', error);
  }
}
```

### Python Example
```python
import requests
import json

class BuildiumAPI:
    def __init__(self, client_id, client_secret):
        self.base_url = 'https://api.buildium.com/v1'
        self.headers = {
            'x-buildium-client-id': client_id,
            'x-buildium-client-secret': client_secret,
            'Content-Type': 'application/json'
        }
    
    def get_all_tenants(self):
        """Get all tenants"""
        response = requests.get(f'{self.base_url}/tenants', headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def get_all_properties(self):
        """Get all rental properties"""
        response = requests.get(f'{self.base_url}/rentals', headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def get_units_for_property(self, property_id):
        """Get all units for a specific property"""
        response = requests.get(f'{self.base_url}/rentals/{property_id}/units', headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def get_tenant_by_id(self, tenant_id):
        """Get specific tenant by ID"""
        response = requests.get(f'{self.base_url}/tenants/{tenant_id}', headers=self.headers)
        response.raise_for_status()
        return response.json()

# Usage example
if __name__ == "__main__":
    api = BuildiumAPI('YOUR_CLIENT_ID', 'YOUR_CLIENT_SECRET')
    
    try:
        # Get all tenants
        tenants = api.get_all_tenants()
        print(f"Found {len(tenants)} tenants")
        
        # Get all properties
        properties = api.get_all_properties()
        print(f"Found {len(properties)} properties")
        
        # Get units for first property
        if properties:
            units = api.get_units_for_property(properties[0]['Id'])
            print(f"Property '{properties[0]['Name']}' has {len(units)} units")
            
    except requests.exceptions.RequestException as e:
        print(f"API Error: {e}")
```

---

## Required Permissions

To access different endpoints, your API key needs appropriate permissions:

### Tenants
- **Rentals > Tenants** - View (required for GET operations)
- **Rentals > Tenants** - Edit (required for POST/PUT operations)

### Properties & Units
- **Rentals > Rental properties and units** - View (required for GET operations)
- **Rentals > Rental properties and units** - Edit (required for POST/PUT operations)

### Leases
- **Rentals > Leases** - View Edit (required for lease operations)

---

## Rate Limiting and Best Practices

1. **API Rate Limits**: Buildium implements rate limiting (specific limits not publicly documented)
2. **Pagination**: Use pagination for large datasets to avoid timeouts
3. **Caching**: Cache frequently accessed data to reduce API calls
4. **Error Handling**: Always implement proper error handling for HTTP status codes
5. **Secure Storage**: Never hardcode API credentials in source code

---

## Common HTTP Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request syntax or parameters
- **401 Unauthorized**: Invalid API credentials
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **422 Unprocessable Entity**: Request data validation failed

---

## Additional Resources

- **Buildium Developer Portal**: https://developer.buildium.com/
- **API Documentation**: Available in the developer portal
- **Support**: Submit support requests through your Buildium account

---

*Last Updated: August 21, 2025*  
*Source: Buildium Developer Documentation*

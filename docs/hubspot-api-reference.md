# HubSpot API Reference: Contacts and Native Listings Integration

## Overview

This document provides the latest syntax and examples for creating Contact objects and working with HubSpot's **native Listings object** using the HubSpot API v3. The information is updated to reflect that HubSpot has a native Listings object (ID: `0-420`) instead of requiring custom objects.

---

## Native Listings Object

### HubSpot Native Listings Object (ID: 0-420)
HubSpot has a **native Listings object** with object type ID `0-420`. This should be used instead of creating custom objects for property listings.

#### Key Information
- **Object Type ID**: `0-420`
- **Base Endpoint**: `/crm/v3/objects/0-420`
- **Required Scopes**: `crm.objects.listings.read`, `crm.objects.listings.write`
- **Supports**: CRUD operations, batch operations, associations

#### REST API Endpoints
```http
# Create a listing
POST https://api.hubapi.com/crm/v3/objects/0-420

# Get listings
GET https://api.hubapi.com/crm/v3/objects/0-420

# Update a listing
PATCH https://api.hubapi.com/crm/v3/objects/0-420/{listingId}

# Delete a listing
DELETE https://api.hubapi.com/crm/v3/objects/0-420/{listingId}

# Batch operations
POST https://api.hubapi.com/crm/v3/objects/0-420/batch/create
POST https://api.hubapi.com/crm/v3/objects/0-420/batch/read
POST https://api.hubapi.com/crm/v3/objects/0-420/batch/update
```

#### Creating a Listing Record
```javascript
const listingObj = {
  properties: {
    name: "123 Main Street Apartment",
    address: "123 Main Street, Anytown, ST 12345",
    property_type: "apartment",
    bedrooms: "2",
    bathrooms: "1",
    rent_amount: "1500",
    availability_date: "2024-02-01",
    description: "Beautiful 2-bedroom apartment in downtown area"
  }
}

const createListingResponse = await hubspotClient.crm.objects.basicApi.create("0-420", listingObj)
console.log(createListingResponse)
```

#### Listing Properties (Common Examples)
Based on typical real estate/property management needs:
```json
{
  "properties": {
    "name": "Property display name",
    "address": "Full property address",
    "property_type": "apartment|house|condo|commercial",
    "bedrooms": "Number of bedrooms",
    "bathrooms": "Number of bathrooms", 
    "square_footage": "Property size in sq ft",
    "rent_amount": "Monthly rent amount",
    "deposit_amount": "Security deposit",
    "availability_date": "Date available for rent",
    "lease_term": "Lease duration in months",
    "pet_policy": "Pet policy details",
    "parking": "Parking availability",
    "amenities": "Property amenities",
    "description": "Property description",
    "status": "available|rented|maintenance"
  }
}
```

---

## Creating Contact Objects

### Basic Contact Creation

#### REST API Endpoint
```http
POST https://api.hubapi.com/crm/v3/objects/contacts
```

#### Headers
```http
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

#### Basic Request Body
```json
{
  "properties": {
    "email": "contact@example.com",
    "firstname": "John",
    "lastname": "Doe",
    "phone": "+1234567890",
    "company": "Example Company"
  }
}
```

### Language-Specific Examples

#### JavaScript/Node.js
```javascript
const contactObj = {
  properties: {
    firstname: "Jane",
    lastname: "Smith",
    email: "jane.smith@example.com"
  }
}

const createContactResponse = await hubspotClient.crm.contacts.basicApi.create(contactObj)
console.log(createContactResponse)
```

#### Python
```python
from hubspot.crm.contacts import SimplePublicObjectInputForCreate
from hubspot.crm.contacts.exceptions import ApiException

try:
    simple_public_object_input_for_create = SimplePublicObjectInputForCreate(
        properties={"email": "email@example.com", "firstname": "John", "lastname": "Doe"}
    )
    api_response = api_client.crm.contacts.basic_api.create(
        simple_public_object_input_for_create=simple_public_object_input_for_create
    )
except ApiException as e:
    print("Exception when creating contact: %s\n" % e)
```

#### PHP
```php
$contactInput = new \HubSpot\Client\Crm\Contacts\Model\SimplePublicObjectInput();
$contactInput->setProperties([
    'email' => 'example@example.com',
    'firstname' => 'Jane',
    'lastname' => 'Doe'
]);

$contact = $hubspot->crm()->contacts()->basicApi()->create($contactInput);
```

#### Ruby
```ruby
require 'hubspot-api-client'

client = Hubspot::Client.new(access_token: 'your_access_token')

options = {
  method: "POST",
  path: "/crm/v3/objects/contacts",
  body: {
    "properties": {
      "email": "some_email@some.com",
      "lastname": "some_last_name"
    }
  }
}

contacts = client.api_request(options)
p JSON.parse(contacts.body)
```

### Advanced Contact Operations

#### Batch Contact Creation
```javascript
const contactsToCreate = [
  {
    properties: {
      email: "contact1@example.com",
      firstname: "John",
      lastname: "Doe"
    }
  },
  {
    properties: {
      email: "contact2@example.com", 
      firstname: "Jane",
      lastname: "Smith"
    }
  }
];

await hubspotClient.crm.contacts.batchApi.create({ inputs: contactsToCreate });
```

#### Contact Search
```javascript
const publicObjectSearchRequest = {
  filterGroups: [
    {
      filters: [
        {
          propertyName: 'createdate',
          operator: 'GTE',
          value: `${Date.now() - 30 * 60000}` // Last 30 minutes
        }
      ]
    }
  ],
  sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
  properties: ['createdate', 'firstname', 'lastname', 'email'],
  limit: 100,
  after: 0
}

const response = await hubspotClient.crm.contacts.searchApi.doSearch(publicObjectSearchRequest)
```

---

## Creating Custom Objects (Listings)

### Step 1: Create Custom Object Schema

Before creating custom objects (like listings), you must first define the schema.

#### REST API Endpoint
```http
POST https://api.hubapi.com/crm/v3/schemas
```

#### Headers
```http
Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN
Content-Type: application/json
```

#### Example: Property Listings Schema
```json
{
  "name": "property_listings",
  "labels": {
    "singular": "Property Listing",
    "plural": "Property Listings"
  },
  "requiredProperties": ["address", "price"],
  "searchableProperties": ["address", "city", "state", "price"],
  "primaryDisplayProperty": "address",
  "secondaryDisplayProperties": ["city", "price"],
  "metaType": "PORTAL_SPECIFIC",
  "associatedObjects": ["CONTACT", "COMPANY"],
  "properties": [
    {
      "name": "address",
      "label": "Address",
      "type": "string",
      "fieldType": "text",
      "description": "Property address"
    },
    {
      "name": "city",
      "label": "City", 
      "type": "string",
      "fieldType": "text",
      "description": "City where property is located"
    },
    {
      "name": "state",
      "label": "State",
      "type": "string",
      "fieldType": "text", 
      "description": "State where property is located"
    },
    {
      "name": "price",
      "label": "Price",
      "type": "number",
      "fieldType": "number",
      "description": "Listing price"
    },
    {
      "name": "listing_type",
      "label": "Listing Type",
      "type": "enumeration",
      "fieldType": "select",
      "description": "Type of listing",
      "options": [
        {
          "label": "For Sale",
          "value": "sale",
          "displayOrder": 0,
          "hidden": false
        },
        {
          "label": "For Rent", 
          "value": "rent",
          "displayOrder": 1,
          "hidden": false
        }
      ]
    },
    {
      "name": "bedrooms",
      "label": "Bedrooms",
      "type": "number",
      "fieldType": "number",
      "description": "Number of bedrooms"
    },
    {
      "name": "bathrooms", 
      "label": "Bathrooms",
      "type": "number",
      "fieldType": "number",
      "description": "Number of bathrooms"
    },
    {
      "name": "square_feet",
      "label": "Square Feet",
      "type": "number", 
      "fieldType": "number",
      "description": "Square footage of property"
    },
    {
      "name": "description",
      "label": "Description",
      "type": "string",
      "fieldType": "textarea", 
      "description": "Property description"
    }
  ]
}
```

### Step 2: Create Custom Object Records

Once the schema is created, you can create individual listing records.

#### REST API Endpoint
```http
POST https://api.hubapi.com/crm/v3/objects/{objectType}
```

Where `{objectType}` is the object type ID returned from schema creation.

#### JavaScript Example
```javascript
const listingObj = {
  properties: {
    address: "123 Main Street",
    city: "Anytown", 
    state: "CA",
    price: "500000",
    listing_type: "sale",
    bedrooms: "3",
    bathrooms: "2",
    square_feet: "1800",
    description: "Beautiful 3-bedroom home in quiet neighborhood"
  }
}

const createListingResponse = await hubspotClient.crm.objects.basicApi.create(
  objectType, // Use the object type ID from schema creation
  listingObj
)
```

#### Python Example
```python
from hubspot.crm.objects import SimplePublicObjectInputForCreate
from hubspot.crm.objects.exceptions import ApiException

try:
    listing_input = SimplePublicObjectInputForCreate(
        properties={
            "address": "123 Main Street",
            "city": "Anytown",
            "state": "CA", 
            "price": "500000",
            "listing_type": "sale",
            "bedrooms": "3",
            "bathrooms": "2"
        }
    )
    api_response = api_client.crm.objects.basic_api.create(
        object_type="property_listings",
        simple_public_object_input_for_create=listing_input
    )
except ApiException as e:
    print("Exception when creating listing: %s\n" % e)
```

### HubSpot CLI Commands

#### Create Schema from JSON File
```bash
# Create schema
hs custom-object schema create ./schemas/property_listings.json

# List existing schemas to get object type ID
hs custom-object schema list

# Create sample data from JSON file
hs custom-object create property_listings ./data/listing_data.json
```

---

## Required API Scopes

To work with contacts and custom objects, your HubSpot app needs these scopes:

### For Contacts
- `crm.objects.contacts.read`
- `crm.objects.contacts.write`

### For Custom Objects
- `crm.objects.custom.read`
- `crm.objects.custom.write`
- `crm.schemas.custom.read`
- `crm.schemas.custom.write`

---

## Creating Associations

### Associate Contact with Listing
```javascript
// After creating both contact and listing
await hubspotClient.crm.associations.v4.basicApi.create(
  'contacts',
  createContactResponse.id,
  'property_listings', // Your custom object type
  createListingResponse.id,
  [
    {
      "associationCategory": "HUBSPOT_DEFINED",
      "associationTypeId": "contact_to_custom_object"
    }
  ]
)
```

---

## Error Handling Best Practices

### JavaScript
```javascript
try {
  const response = await hubspotClient.crm.contacts.basicApi.create(contactObj);
  console.log('Contact created:', response.id);
} catch (error) {
  console.error('Error creating contact:', error.message);
  if (error.response) {
    console.error('API Error:', error.response.data);
  }
}
```

### Python
```python
from hubspot.crm.contacts.exceptions import ApiException

try:
    api_response = api_client.crm.contacts.basic_api.create(contact_input)
    print(f"Contact created with ID: {api_response.id}")
except ApiException as e:
    print(f"Exception when creating contact: {e}")
    print(f"Status code: {e.status}")
    print(f"Reason: {e.reason}")
```

---

## Additional Resources

- **HubSpot API Documentation**: https://developers.hubspot.com/docs/api/crm/objects
- **Custom Objects Guide**: https://developers.hubspot.com/docs/api/crm/custom-objects
- **API Rate Limits**: https://developers.hubspot.com/docs/api/usage-details

---

*Last Updated: August 21, 2025*  
*Source: HubSpot Developer Documentation via Context7 MCP Server*

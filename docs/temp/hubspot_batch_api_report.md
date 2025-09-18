# HubSpot API Batch Operations: Findings for Sync Optimization

## Summary
This report summarizes the findings on HubSpot API batch operations, focusing on how to optimize the sync process between Buildium and HubSpot by leveraging batch endpoints and efficient retrieval methods.

---

## 1. Batch Create/Update/Delete
- HubSpot API v3 supports batch operations for most CRM objects (contacts, companies, deals, tickets, custom objects).
- Endpoints:
  - `POST /crm/v3/objects/{objectType}/batch/create`
  - `POST /crm/v3/objects/{objectType}/batch/update`
  - `POST /crm/v3/objects/{objectType}/batch/archive`
- Batch input schema: `SimplePublicObjectBatchInput` (array of objects with properties and optional associations).
- This allows creating, updating, or deleting many records in a single request, improving performance and reducing API rate limits.

---

## 2. Batch Get (Read)
- HubSpot API v3 now supports batch read for some objects (e.g., contacts):
  - `POST /crm/v3/objects/contacts/batch/read` (retrieve multiple contacts by ID)
- For other objects, use the Search API:
  - `POST /crm/v3/objects/{objectType}/search` (filter and retrieve many records in one call)
- Legacy v1 APIs also support batch get for contacts, lists, and line items, but v3 is recommended for new integrations.

---

## 3. Implementation Recommendations
- Use batch create/update/delete endpoints for all supported objects in the sync process.
- For batch retrieval:
  - Use `/batch/read` if available for the object type.
  - Otherwise, use the Search API to retrieve records in bulk.
- This approach will:
  - Reduce the number of API calls
  - Improve sync speed and reliability
  - Lower the risk of hitting rate limits

---

## 4. Example Endpoints
- Batch Create: `POST /crm/v3/objects/contacts/batch/create`
- Batch Update: `POST /crm/v3/objects/contacts/batch/update`
- Batch Read: `POST /crm/v3/objects/contacts/batch/read`
- Search: `POST /crm/v3/objects/contacts/search`

---

## 5. References
- [HubSpot Developer Docs: CRM API v3](https://developers.hubspot.com/docs/api/crm)
- [HubSpot Community: Batch Read Discussion](https://community.hubspot.com/t5/APIs-Integrations/How-to-use-crm-v3-objects-contacts-batch-read/m-p/669186)

---

## 6. Next Steps
- Refactor sync logic to use batch endpoints for all supported operations.
- Use search or batch read for efficient data retrieval.
- Validate object type support for batch read before implementation.

---

Prepared by: GitHub Copilot
Date: September 17, 2025

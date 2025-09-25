require('dotenv').config({ path: '../.env' });
const { BuildiumClient, HubSpotClient, DataTransformer } = require('../index.js');

/**
 * Test script to create a single contact and verify the fixes
 */
async function testContactCreation() {
    try {
        console.log('[TEST] Testing contact creation with fixes...');
        
        // Debug environment variables
        console.log('Environment check:');
        console.log('- BUILDIUM_BASE_URL:', process.env.BUILDIUM_BASE_URL ? '[OK] Set' : '[FAIL] Missing');
        console.log('- BUILDIUM_CLIENT_ID:', process.env.BUILDIUM_CLIENT_ID ? '[OK] Set' : '[FAIL] Missing');
        console.log('- HUBSPOT_ACCESS_TOKEN:', process.env.HUBSPOT_ACCESS_TOKEN ? '[OK] Set' : '[FAIL] Missing');
        
        const buildiumClient = new BuildiumClient();
        const hubspotClient = new HubSpotClient();
        const transformer = new DataTransformer();
        
        // Test with the tenant that was failing: 318556
        const tenantId = 318556;
        
        console.log(`\n[SEARCH] Testing tenant ID: ${tenantId}`);
        
        // Get the tenant data
        const tenant = await buildiumClient.getTenant(tenantId);
        console.log(`[ITEM] Full tenant data: ${tenant.FirstName} ${tenant.LastName} (${tenant.Email})`);
        
        // Transform the data
        const contactData = transformer.transformTenantToContact(tenant);
        console.log(`[RETRY] Transformed contact data:`, JSON.stringify(contactData, null, 2));
        
        // Create custom properties first (skip for now - using standard fields)
        // await hubspotClient.createContactCustomProperties();
        
        // Try to create the contact
        const result = await hubspotClient.createContact(contactData);
        console.log(`[OK] Successfully created contact:`, result);
        
    } catch (error) {
        console.error('[FAIL] Test failed:', error.message);
        if (error.response?.data) {
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
testContactCreation();

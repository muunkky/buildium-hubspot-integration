/**
 * Basic HubSpot Contact Count Check
 * See if there are ANY contacts at all
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function checkContactsBasic() {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN;
    console.log('🔍 Checking if ANY contacts exist in HubSpot...\n');

    try {
        // Simple search for any contacts
        const searchRequest = {
            properties: ['firstname', 'lastname', 'email', 'hs_marketable_status'],
            limit: 10
        };

        const response = await axios.post(
            'https://api.hubapi.com/crm/v3/objects/contacts/search',
            searchRequest,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const contacts = response.data.results;
        console.log(`📊 Found ${contacts.length} contacts total\n`);

        if (contacts.length === 0) {
            console.log('❌ NO CONTACTS FOUND AT ALL!');
            console.log('This means either:');
            console.log('1. Your HubSpot account has no contacts');
            console.log('2. API permissions issue');
            console.log('3. Wrong HubSpot account/token');
            return;
        }

        console.log('📋 Sample contacts:');
        contacts.forEach((contact, index) => {
            const props = contact.properties;
            console.log(`${index + 1}. ${props.firstname || ''} ${props.lastname || ''} (${props.email || 'No email'})`);
            console.log(`   ID: ${contact.id}`);
            console.log(`   Marketing Status: ${props.hs_marketable_status || 'NOT SET'}`);
            console.log('');
        });

        // Count marketing statuses
        const marketableCount = contacts.filter(c => c.properties.hs_marketable_status === 'MARKETABLE').length;
        const nonMarketableCount = contacts.filter(c => c.properties.hs_marketable_status === 'NON_MARKETABLE').length;
        const unknownCount = contacts.filter(c => !c.properties.hs_marketable_status).length;

        console.log(`\n📊 Marketing Status Breakdown (in sample of ${contacts.length}):`);
        console.log(`   MARKETABLE: ${marketableCount}`);
        console.log(`   NON_MARKETABLE: ${nonMarketableCount}`);
        console.log(`   NOT SET/UNKNOWN: ${unknownCount}`);

    } catch (error) {
        console.error('❌ Error checking contacts:', error.response?.data?.message || error.message);
        if (error.response?.data) {
            console.error('Full error:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

checkContactsBasic();

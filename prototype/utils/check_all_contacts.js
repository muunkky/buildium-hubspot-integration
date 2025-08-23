/**
 * Simple HubSpot Contact Status Checker
 * Just find ALL marketable contacts regardless of when they were modified
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function findAllMarketableContacts() {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!apiKey) {
        console.error('❌ HUBSPOT_ACCESS_TOKEN environment variable required');
        return;
    }

    console.log('🔍 Finding ALL marketable contacts in HubSpot...\n');

    try {
        const searchRequest = {
            filterGroups: [{
                filters: [{
                    propertyName: 'hs_marketable_status',
                    operator: 'EQ',
                    value: 'MARKETABLE'
                }]
            }],
            properties: [
                'firstname', 'lastname', 'email', 
                'hs_marketable_status', 'createdate', 'lastmodifieddate'
            ],
            sorts: [{
                propertyName: 'lastmodifieddate',
                direction: 'DESCENDING'
            }],
            limit: 100
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
        console.log(`📊 Found ${contacts.length} MARKETABLE contacts total\n`);

        if (contacts.length === 0) {
            console.log('❌ No marketable contacts found at all!');
            console.log('This suggests either:');
            console.log('1. All contacts are already NON_MARKETABLE');
            console.log('2. There are no contacts in HubSpot');
            console.log('3. API permissions issue');
            return;
        }

        console.log('📋 Recent marketable contacts:');
        contacts.slice(0, 10).forEach((contact, index) => {
            const props = contact.properties;
            console.log(`${index + 1}. ${props.firstname || ''} ${props.lastname || ''} (${props.email || 'No email'})`);
            console.log(`   ID: ${contact.id}`);
            console.log(`   Status: ${props.hs_marketable_status}`);
            console.log(`   Created: ${props.createdate}`);
            console.log(`   Modified: ${props.lastmodifieddate}`);
            console.log('');
        });

        if (contacts.length > 10) {
            console.log(`... and ${contacts.length - 10} more marketable contacts`);
        }

        console.log(`\n💰 BILLING IMPACT: ${contacts.length} contacts are currently MARKETABLE (incurring charges)`);

    } catch (error) {
        console.error('❌ Error searching for contacts:', error.response?.data?.message || error.message);
        if (error.response?.data) {
            console.error('Error details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

async function findAllNonMarketableContacts() {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN;
    console.log('🔍 Finding ALL non-marketable contacts in HubSpot...\n');

    try {
        const searchRequest = {
            filterGroups: [{
                filters: [{
                    propertyName: 'hs_marketable_status',
                    operator: 'EQ',
                    value: 'NON_MARKETABLE'
                }]
            }],
            properties: ['firstname', 'lastname', 'email', 'hs_marketable_status'],
            limit: 100
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
        console.log(`📊 Found ${contacts.length} NON_MARKETABLE contacts\n`);

        return contacts.length;

    } catch (error) {
        console.error('❌ Error searching for non-marketable contacts:', error.message);
        return 0;
    }
}

async function main() {
    console.log('📊 HUBSPOT CONTACT STATUS OVERVIEW');
    console.log('==================================\n');
    
    await findAllMarketableContacts();
    console.log('\n' + '='.repeat(50) + '\n');
    const nonMarketableCount = await findAllNonMarketableContacts();
    
    console.log('\n🎯 SUMMARY:');
    console.log('If you want to switch ALL contacts to NON_MARKETABLE,');
    console.log('this will show you what you\'re working with.');
}

if (require.main === module) {
    main().catch(console.error);
}

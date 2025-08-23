/**
 * Correct HubSpot Marketing Status Checker
 * Using true/false values instead of MARKETABLE/NON_MARKETABLE strings
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function findMarketableContacts() {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN;
    console.log('🔍 Finding contacts with marketing status = true (marketable)...\n');

    try {
        const searchRequest = {
            filterGroups: [{
                filters: [{
                    propertyName: 'hs_marketable_status',
                    operator: 'EQ',
                    value: 'true'  // Note: using string 'true', not boolean
                }]
            }],
            properties: [
                'firstname', 'lastname', 'email', 
                'hs_marketable_status', 'createdate', 'lastmodifieddate',
                'hs_content_membership_notes'
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
        console.log(`📊 Found ${contacts.length} MARKETABLE (true) contacts\n`);

        contacts.forEach((contact, index) => {
            const props = contact.properties;
            const buildiumId = extractBuildiumId(props.hs_content_membership_notes || '');
            const createdDate = new Date(props.createdate);
            const modifiedDate = new Date(props.lastmodifieddate);
            const daysOld = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
            
            console.log(`${index + 1}. ${props.firstname || ''} ${props.lastname || ''} (${props.email || 'No email'})`);
            console.log(`   ID: ${contact.id}`);
            console.log(`   Marketing Status: ${props.hs_marketable_status} (MARKETABLE - incurring billing)`);
            console.log(`   Buildium ID: ${buildiumId || 'Not from Buildium'}`);
            console.log(`   Age: ${daysOld} days old`);
            console.log(`   Created: ${props.createdate}`);
            console.log(`   Modified: ${props.lastmodifieddate}`);
            console.log('');
        });

        return contacts;

    } catch (error) {
        console.error('❌ Error finding marketable contacts:', error.response?.data?.message || error.message);
        return [];
    }
}

async function findNonMarketableContacts() {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN;
    console.log('🔍 Finding contacts with marketing status = false (non-marketable)...\n');

    try {
        const searchRequest = {
            filterGroups: [{
                filters: [{
                    propertyName: 'hs_marketable_status',
                    operator: 'EQ',
                    value: 'false'  // Note: using string 'false', not boolean
                }]
            }],
            properties: ['firstname', 'lastname', 'email', 'hs_marketable_status'],
            limit: 50
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
        console.log(`📊 Found ${contacts.length} NON_MARKETABLE (false) contacts\n`);

        return contacts.length;

    } catch (error) {
        console.error('❌ Error finding non-marketable contacts:', error.message);
        return 0;
    }
}

function extractBuildiumId(notes) {
    const match = notes.match(/Buildium (?:Owner|Tenant) ID: (\\d+)/);
    return match ? match[1] : null;
}

async function main() {
    console.log('📊 CORRECT HUBSPOT MARKETING STATUS CHECK');
    console.log('========================================\n');
    
    const marketableContacts = await findMarketableContacts();
    console.log('\\n' + '='.repeat(50) + '\\n');
    const nonMarketableCount = await findNonMarketableContacts();
    
    console.log('\\n🎯 BILLING IMPACT SUMMARY:');
    console.log(`💸 Contacts currently incurring billing charges: ${marketableContacts.length}`);
    console.log(`✅ Contacts NOT incurring charges: ${nonMarketableCount}`);
    console.log('');
    console.log('🔄 If you switch ALL contacts to non-marketable:');
    console.log(`   • You will STOP billing for ${marketableContacts.length} contacts`);
    console.log(`   • You may break marketing workflows for legitimate marketing contacts`);
    console.log('');
    console.log('💡 Recommendation: Review the list above to identify which contacts should');
    console.log('   remain marketable (real leads/customers) vs operational contacts (tenants/vendors)');
}

if (require.main === module) {
    main().catch(console.error);
}

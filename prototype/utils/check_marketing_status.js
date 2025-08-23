/**
 * Check Marketing Status of Synced Contacts
 * 
 * This script identifies contacts that were changed from MARKETABLE to NON_MARKETABLE
 * during our recent sync, so we can see if any were accidentally converted.
 */

require('dotenv').config({ path: '../.env' });
const { HubSpotClient } = require('../index.js');
const axios = require('axios');

class MarketingStatusChecker {
    constructor(hubspotApiKey) {
        this.apiKey = hubspotApiKey;
        this.baseURL = 'https://api.hubapi.com';
    }

    /**
     * Find contacts that were recently modified and check their marketing status history
     */
    async checkRecentlyModifiedContacts(hoursAgo = 2) {
        console.log(`🔍 Checking contacts modified in last ${hoursAgo} hours for marketing status changes...\n`);

        try {
            const cutoffTime = new Date(Date.now() - (hoursAgo * 60 * 60 * 1000)).getTime();

            const searchRequest = {
                filterGroups: [{
                    filters: [
                        {
                            propertyName: 'lastmodifieddate',
                            operator: 'GTE',
                            value: cutoffTime.toString()
                        },
                        {
                            propertyName: 'hs_marketable_status',
                            operator: 'EQ',
                            value: 'NON_MARKETABLE'
                        }
                    ]
                }],
                properties: [
                    'firstname', 'lastname', 'email', 
                    'hs_marketable_status', 'createdate', 'lastmodifieddate',
                    'hs_content_membership_notes', // Contains Buildium ID
                    'lifecyclestage'
                ],
                sorts: [{
                    propertyName: 'lastmodifieddate',
                    direction: 'DESCENDING'
                }],
                limit: 100
            };

            const response = await axios.post(
                `${this.baseURL}/crm/v3/objects/contacts/search`,
                searchRequest,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const contacts = response.data.results;
            console.log(`📊 Found ${contacts.length} contacts set to NON_MARKETABLE in last ${hoursAgo} hours\n`);

            if (contacts.length === 0) {
                console.log('✅ No recently modified NON_MARKETABLE contacts found');
                return [];
            }

            // Analyze each contact
            const analysisResults = [];
            for (const contact of contacts) {
                const analysis = await this.analyzeContactMarketingHistory(contact);
                analysisResults.push(analysis);
            }

            // Summary
            this.printAnalysisSummary(analysisResults);
            
            return analysisResults;

        } catch (error) {
            console.error('❌ Error checking recently modified contacts:', error.response?.data?.message || error.message);
            return [];
        }
    }

    /**
     * Analyze a specific contact's marketing status history
     */
    async analyzeContactMarketingHistory(contact) {
        const props = contact.properties;
        const buildiumId = this.extractBuildiumId(props.hs_content_membership_notes || '');
        
        // Determine if this was likely a new contact or existing contact
        const createdDate = new Date(props.createdate);
        const modifiedDate = new Date(props.lastmodifieddate);
        const timeDiff = modifiedDate - createdDate;
        const isNewContact = timeDiff < (5 * 60 * 1000); // Less than 5 minutes difference = likely new

        const analysis = {
            hubspotId: contact.id,
            name: `${props.firstname || ''} ${props.lastname || ''}`.trim(),
            email: props.email,
            buildiumId,
            createdDate: props.createdate,
            modifiedDate: props.lastmodifieddate,
            currentMarketingStatus: props.hs_marketable_status,
            isNewContact,
            timeBetweenCreateAndModify: `${Math.round(timeDiff / 1000)} seconds`,
            lifecycleStage: props.lifecyclestage
        };

        // Print individual analysis
        console.log(`📋 Contact ${contact.id}: ${analysis.name}`);
        console.log(`   Email: ${analysis.email || 'No email'}`);
        console.log(`   Buildium ID: ${buildiumId || 'Not found'}`);
        console.log(`   Created: ${analysis.createdDate}`);
        console.log(`   Modified: ${analysis.modifiedDate}`);
        console.log(`   Time Diff: ${analysis.timeBetweenCreateAndModify}`);
        console.log(`   Status: ${isNewContact ? '🆕 NEW CONTACT' : '⚠️ EXISTING CONTACT - MAY HAVE BEEN MARKETING'}`);
        console.log(`   Current Marketing Status: ${analysis.currentMarketingStatus}`);
        console.log('   ---\n');

        return analysis;
    }

    /**
     * Print summary of analysis results
     */
    printAnalysisSummary(results) {
        console.log('🎯 MARKETING STATUS ANALYSIS SUMMARY');
        console.log('=====================================\n');

        const newContacts = results.filter(r => r.isNewContact);
        const existingContacts = results.filter(r => !r.isNewContact);

        console.log(`📊 Total contacts analyzed: ${results.length}`);
        console.log(`🆕 New contacts (safe): ${newContacts.length}`);
        console.log(`⚠️ Existing contacts (may have been marketing): ${existingContacts.length}\n`);

        if (existingContacts.length > 0) {
            console.log('⚠️ POTENTIALLY AFFECTED EXISTING CONTACTS:');
            console.log('==========================================');
            existingContacts.forEach((contact, index) => {
                console.log(`${index + 1}. ${contact.name} (${contact.email})`);
                console.log(`   HubSpot ID: ${contact.hubspotId}`);
                console.log(`   Buildium ID: ${contact.buildiumId}`);
                console.log(`   Created: ${contact.createdDate}`);
                console.log(`   Modified: ${contact.modifiedDate}`);
                console.log(`   ⚠️ This contact existed before sync - may have been MARKETABLE`);
                console.log('');
            });

            console.log('📋 TO CHECK THESE CONTACTS IN HUBSPOT:');
            console.log('1. Go to each contact record in HubSpot');
            console.log('2. Check Activity timeline for "Property change" events');
            console.log('3. Look for "Marketing contact status" changes');
            console.log('4. If they were MARKETABLE before, you can change them back');
            console.log('');
        }

        if (newContacts.length > 0) {
            console.log('✅ NEW CONTACTS (No risk):');
            console.log(`${newContacts.length} contacts were created new and immediately set to NON_MARKETABLE`);
            console.log('These were never marketing contacts, so no billing impact.');
        }
    }

    /**
     * Extract Buildium ID from notes field
     */
    extractBuildiumId(notes) {
        const match = notes.match(/Buildium (?:Owner|Tenant) ID: (\\d+)/);
        return match ? match[1] : null;
    }

    /**
     * Check specific contacts by their HubSpot IDs
     */
    async checkSpecificContacts(contactIds) {
        console.log(`🔍 Checking specific contacts: ${contactIds.join(', ')}\n`);

        for (const contactId of contactIds) {
            try {
                const response = await axios.get(
                    `${this.baseURL}/crm/v3/objects/contacts/${contactId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        params: {
                            properties: [
                                'firstname', 'lastname', 'email',
                                'hs_marketable_status', 'createdate', 'lastmodifieddate',
                                'hs_content_membership_notes'
                            ].join(',')
                        }
                    }
                );

                await this.analyzeContactMarketingHistory(response.data);

            } catch (error) {
                console.error(`❌ Error checking contact ${contactId}:`, error.response?.data?.message || error.message);
            }
        }
    }
}

// CLI usage
async function main() {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!apiKey) {
        console.error('❌ HUBSPOT_ACCESS_TOKEN environment variable required');
        process.exit(1);
    }

    const checker = new MarketingStatusChecker(apiKey);
    const command = process.argv[2];

    switch (command) {
        case 'recent':
            const hours = parseInt(process.argv[3]) || 2;
            await checker.checkRecentlyModifiedContacts(hours);
            break;

        case 'check':
            const contactIds = process.argv.slice(3);
            if (contactIds.length === 0) {
                console.log('Usage: node check_marketing_status.js check <contact_id1> <contact_id2> ...');
                break;
            }
            await checker.checkSpecificContacts(contactIds);
            break;

        default:
            console.log(`
Marketing Status Change Checker
===============================

Commands:
  recent [hours]           - Check contacts modified in last N hours (default: 2)
  check <id1> <id2> ...   - Check specific contact IDs

Examples:
  node check_marketing_status.js recent 1
  node check_marketing_status.js recent 24
  node check_marketing_status.js check 12345 67890

This helps identify if any existing marketing contacts were 
accidentally changed to non-marketing during the sync.
`);
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { MarketingStatusChecker };

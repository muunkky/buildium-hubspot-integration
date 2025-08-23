/**
 * Find Contacts That Were Already Marketable Before Sync
 * 
 * This script identifies contacts that were ALREADY marketable before our sync,
 * vs contacts that were changed FROM non-marketable TO marketable (which starts billing).
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

class MarketableContactAnalyzer {
    constructor(hubspotAccessToken) {
        this.apiKey = hubspotAccessToken;
        this.baseURL = 'https://api.hubapi.com';
    }

    /**
     * Find all contacts that are currently MARKETABLE and were recently modified
     */
    async findRecentlyModifiedMarketableContacts(hoursAgo = 2) {
        console.log(`🔍 Finding MARKETABLE contacts modified in last ${hoursAgo} hours...\n`);

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
                            value: 'MARKETABLE'
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
            console.log(`📊 Found ${contacts.length} MARKETABLE contacts modified in last ${hoursAgo} hours\n`);

            if (contacts.length === 0) {
                console.log('✅ No recently modified MARKETABLE contacts found');
                return [];
            }

            // Analyze each contact
            const analysisResults = [];
            for (const contact of contacts) {
                const analysis = await this.analyzeContactMarketingHistory(contact);
                analysisResults.push(analysis);
            }

            // Summary
            this.printMarketableAnalysisSummary(analysisResults);
            
            return analysisResults;

        } catch (error) {
            console.error('❌ Error finding marketable contacts:', error.response?.data?.message || error.message);
            return [];
        }
    }

    /**
     * Analyze if a contact was likely already marketable or newly made marketable
     */
    async analyzeContactMarketingHistory(contact) {
        const props = contact.properties;
        const buildiumId = this.extractBuildiumId(props.hs_content_membership_notes || '');
        
        // Determine if this was likely a new contact or existing contact
        const createdDate = new Date(props.createdate);
        const modifiedDate = new Date(props.lastmodifieddate);
        const timeDiff = modifiedDate - createdDate;
        const isNewContact = timeDiff < (5 * 60 * 1000); // Less than 5 minutes difference = likely new
        
        // Calculate how long the contact existed before being modified
        const daysExisted = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hoursExisted = Math.floor(timeDiff / (1000 * 60 * 60));

        const analysis = {
            hubspotId: contact.id,
            name: `${props.firstname || ''} ${props.lastname || ''}`.trim(),
            email: props.email,
            buildiumId,
            createdDate: props.createdate,
            modifiedDate: props.lastmodifieddate,
            currentMarketingStatus: props.hs_marketable_status,
            isNewContact,
            daysExisted,
            hoursExisted,
            timeBetweenCreateAndModify: `${Math.round(timeDiff / 1000)} seconds`,
            lifecycleStage: props.lifecyclestage,
            // Likely status before sync
            likelyAlreadyMarketable: !isNewContact && daysExisted > 0
        };

        // Print individual analysis
        console.log(`📋 Contact ${contact.id}: ${analysis.name}`);
        console.log(`   Email: ${analysis.email || 'No email'}`);
        console.log(`   Buildium ID: ${buildiumId || 'Not found'}`);
        console.log(`   Created: ${analysis.createdDate}`);
        console.log(`   Modified: ${analysis.modifiedDate}`);
        console.log(`   Existed for: ${daysExisted} days, ${hoursExisted} hours`);
        
        if (isNewContact) {
            console.log(`   Status: 🆕 NEW CONTACT - set to marketable at creation`);
            console.log(`   Billing Impact: ⚠️ NEW billing charge started`);
        } else if (daysExisted > 0) {
            console.log(`   Status: 📅 EXISTING CONTACT - likely already marketable`);
            console.log(`   Billing Impact: ✅ Probably no new billing (was already marketable)`);
        } else {
            console.log(`   Status: 🤔 UNCERTAIN - existed ${hoursExisted} hours`);
            console.log(`   Billing Impact: ❓ Unknown - need to check HubSpot timeline`);
        }
        
        console.log(`   Current Marketing Status: ${analysis.currentMarketingStatus}`);
        console.log('   ---\n');

        return analysis;
    }

    /**
     * Print summary of marketable contact analysis
     */
    printMarketableAnalysisSummary(results) {
        console.log('🎯 MARKETABLE CONTACT ANALYSIS SUMMARY');
        console.log('======================================\n');

        const newContacts = results.filter(r => r.isNewContact);
        const existingContacts = results.filter(r => r.likelyAlreadyMarketable);
        const uncertainContacts = results.filter(r => !r.isNewContact && !r.likelyAlreadyMarketable);

        console.log(`📊 Total marketable contacts analyzed: ${results.length}`);
        console.log(`🆕 New contacts (new billing): ${newContacts.length}`);
        console.log(`📅 Existing contacts (likely already marketable): ${existingContacts.length}`);
        console.log(`❓ Uncertain contacts (need manual check): ${uncertainContacts.length}\n`);

        if (existingContacts.length > 0) {
            console.log('📅 LIKELY ALREADY MARKETABLE (No new billing):');
            console.log('============================================');
            existingContacts.forEach((contact, index) => {
                console.log(`${index + 1}. ${contact.name} (${contact.email})`);
                console.log(`   HubSpot ID: ${contact.hubspotId}`);
                console.log(`   Existed for: ${contact.daysExisted} days`);
                console.log(`   ✅ Likely no new billing charge`);
                console.log('');
            });
        }

        if (newContacts.length > 0) {
            console.log('🆕 NEW MARKETABLE CONTACTS (New billing started):');
            console.log('===============================================');
            newContacts.forEach((contact, index) => {
                console.log(`${index + 1}. ${contact.name} (${contact.email})`);
                console.log(`   HubSpot ID: ${contact.hubspotId}`);
                console.log(`   Buildium ID: ${contact.buildiumId}`);
                console.log(`   ⚠️ NEW billing charge started`);
                console.log('');
            });
        }

        if (uncertainContacts.length > 0) {
            console.log('❓ UNCERTAIN CONTACTS (Manual check needed):');
            console.log('==========================================');
            uncertainContacts.forEach((contact, index) => {
                console.log(`${index + 1}. ${contact.name} (${contact.email})`);
                console.log(`   HubSpot ID: ${contact.hubspotId}`);
                console.log(`   Existed for: ${contact.hoursExisted} hours`);
                console.log(`   🔍 Check HubSpot timeline for marketing status changes`);
                console.log('');
            });

            console.log('📋 TO CHECK UNCERTAIN CONTACTS:');
            console.log('1. Go to each contact in HubSpot');
            console.log('2. Check Activity timeline');
            console.log('3. Look for "Marketing contact status" changes');
            console.log('4. See if they were non-marketable before today');
        }

        console.log('\n💰 BILLING IMPACT SUMMARY:');
        console.log(`💸 Potential new billing charges: ${newContacts.length + uncertainContacts.length} contacts`);
        console.log(`✅ No new billing charges: ${existingContacts.length} contacts`);
    }

    /**
     * Extract Buildium ID from notes field
     */
    extractBuildiumId(notes) {
        const match = notes.match(/Buildium (?:Owner|Tenant) ID: (\\d+)/);
        return match ? match[1] : null;
    }
}

// CLI usage
async function main() {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!apiKey) {
        console.error('❌ HUBSPOT_ACCESS_TOKEN environment variable required');
        process.exit(1);
    }

    const analyzer = new MarketableContactAnalyzer(apiKey);
    const command = process.argv[2];

    switch (command) {
        case 'recent':
            const hours = parseInt(process.argv[3]) || 2;
            await analyzer.findRecentlyModifiedMarketableContacts(hours);
            break;

        default:
            console.log(`
Marketable Contact Analyzer
===========================

This script finds contacts that were set to MARKETABLE during recent sync
and categorizes them as:
- Already marketable (no new billing)
- Newly marketable (new billing charges started)

Commands:
  recent [hours]     - Check marketable contacts modified in last N hours (default: 2)

Examples:
  node analyze_marketable_contacts.js recent 1
  node analyze_marketable_contacts.js recent 24

This helps identify which contacts started new billing charges.
`);
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { MarketableContactAnalyzer };

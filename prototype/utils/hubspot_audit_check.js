/**
 * HubSpot Contact Audit Trail Checker
 * 
 * This script checks what audit/history information HubSpot provides
 * for contact property changes, specifically marketing status changes.
 */

require('dotenv').config({ path: '../.env' });
const { HubSpotClient } = require('../index.js');
const axios = require('axios');

class HubSpotAuditChecker {
    constructor(hubspotApiKey) {
        this.apiKey = hubspotApiKey;
        this.baseURL = 'https://api.hubapi.com';
    }

    /**
     * Check what audit/timeline information is available for a contact
     */
    async checkContactAuditTrail(contactId) {
        console.log(`[SEARCH] Checking audit trail for contact ${contactId}...\n`);

        try {
            // 1. Get contact timeline/activity
            console.log('[ITEM] 1. Checking Contact Timeline/Activity...');
            await this.getContactTimeline(contactId);

            // 2. Get contact property history (if available)
            console.log('\n[ITEM] 2. Checking Contact Property History...');
            await this.getContactPropertyHistory(contactId);

            // 3. Get contact details with audit fields
            console.log('\n[ITEM] 3. Checking Contact Audit Fields...');
            await this.getContactAuditFields(contactId);

        } catch (error) {
            console.error('[FAIL] Error checking audit trail:', error.message);
        }
    }

    /**
     * Get contact timeline/activity data
     */
    async getContactTimeline(contactId) {
        try {
            // Try to get timeline events
            const response = await axios.get(
                `${this.baseURL}/crm/v3/objects/contacts/${contactId}/timeline`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('[OK] Timeline data available:', response.data);

        } catch (error) {
            if (error.response?.status === 404) {
                console.log('️ Timeline endpoint not available or contact not found');
            } else {
                console.log('[FAIL] Timeline access error:', error.response?.status, error.response?.data?.message || error.message);
            }
        }
    }

    /**
     * Get contact property history
     */
    async getContactPropertyHistory(contactId) {
        try {
            // Try to get property history - this might be a premium feature
            const response = await axios.get(
                `${this.baseURL}/crm/v3/objects/contacts/${contactId}/property-history`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('[OK] Property history available:', response.data);

        } catch (error) {
            if (error.response?.status === 404) {
                console.log('️ Property history endpoint not available (may require higher tier subscription)');
            } else {
                console.log('[FAIL] Property history access error:', error.response?.status, error.response?.data?.message || error.message);
            }
        }
    }

    /**
     * Get contact with audit-related fields
     */
    async getContactAuditFields(contactId) {
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
                            'hs_marketable_status',
                            'createdate', 
                            'lastmodifieddate',
                            'hs_lastmodifieddate',
                            'hs_created_by_user_id',
                            'hs_updated_by_user_id',
                            'hs_user_ids_of_all_owners',
                            'hubspot_owner_id'
                        ].join(',')
                    }
                }
            );

            const props = response.data.properties;
            console.log('[OK] Contact audit fields:');
            console.log('   Marketing Status:', props.hs_marketable_status);
            console.log('   Created Date:', props.createdate);
            console.log('   Last Modified:', props.lastmodifieddate);
            console.log('   HubSpot Last Modified:', props.hs_lastmodifieddate);
            console.log('   Created By User ID:', props.hs_created_by_user_id);
            console.log('   Updated By User ID:', props.hs_updated_by_user_id);
            console.log('   Owner ID:', props.hubspot_owner_id);

        } catch (error) {
            console.error('[FAIL] Error getting contact audit fields:', error.response?.data?.message || error.message);
        }
    }

    /**
     * Search for contacts that were recently modified (potential audit trail)
     */
    async findRecentlyModifiedContacts(hoursAgo = 24) {
        console.log(`[SEARCH] Searching for contacts modified in last ${hoursAgo} hours...\n`);

        try {
            const cutoffTime = new Date(Date.now() - (hoursAgo * 60 * 60 * 1000)).getTime();

            const searchRequest = {
                filterGroups: [{
                    filters: [{
                        propertyName: 'lastmodifieddate',
                        operator: 'GTE',
                        value: cutoffTime.toString()
                    }]
                }],
                properties: [
                    'firstname', 'lastname', 'email', 
                    'hs_marketable_status', 'lastmodifieddate',
                    'hs_updated_by_user_id'
                ],
                sorts: [{
                    propertyName: 'lastmodifieddate',
                    direction: 'DESCENDING'
                }],
                limit: 10
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
            console.log(`[STATS] Found ${contacts.length} recently modified contacts:`);

            contacts.forEach((contact, index) => {
                const props = contact.properties;
                console.log(`\\n${index + 1}. Contact ${contact.id}:`);
                console.log(`   Name: ${props.firstname || ''} ${props.lastname || ''}`);
                console.log(`   Email: ${props.email || 'No email'}`);
                console.log(`   Marketing Status: ${props.hs_marketable_status}`);
                console.log(`   Last Modified: ${props.lastmodifieddate}`);
                console.log(`   Modified By User: ${props.hs_updated_by_user_id || 'System/API'}`);
            });

        } catch (error) {
            console.error('[FAIL] Error searching for recent contacts:', error.response?.data?.message || error.message);
        }
    }

    /**
     * Check what HubSpot audit capabilities are available for your account
     */
    async checkAuditCapabilities() {
        console.log('[SEARCH] Checking HubSpot audit capabilities for your account...\n');

        const capabilities = {
            timeline: await this.testEndpoint('/timeline'),
            propertyHistory: await this.testEndpoint('/property-history'),
            auditLogs: await this.testEndpoint('/audit-logs'),
            activities: await this.testEndpoint('/activities')
        };

        console.log('[STATS] Available audit capabilities:');
        Object.entries(capabilities).forEach(([feature, available]) => {
            console.log(`   ${feature}: ${available ? '[OK] Available' : '[FAIL] Not available'}`);
        });

        console.log('\\n What this means:');
        console.log('   • Timeline: Shows contact activity and changes in HubSpot UI');
        console.log('   • Property History: Detailed change log for each property');
        console.log('   • Audit Logs: System-level audit trail (Enterprise feature)');
        console.log('   • Activities: API activities and integrations');

        return capabilities;
    }

    async testEndpoint(path) {
        try {
            // Test with a dummy contact ID to see if endpoint exists
            await axios.get(`${this.baseURL}/crm/v3/objects/contacts/1${path}`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            return true;
        } catch (error) {
            // 404 means endpoint doesn't exist, 403 might mean no permission
            return error.response?.status !== 404;
        }
    }
}

// CLI usage
async function main() {
    const apiKey = process.env.HUBSPOT_API_KEY;
    if (!apiKey) {
        console.error('[FAIL] HUBSPOT_API_KEY environment variable required');
        process.exit(1);
    }

    const checker = new HubSpotAuditChecker(apiKey);
    const command = process.argv[2];
    const contactId = process.argv[3];

    switch (command) {
        case 'check':
            if (!contactId) {
                console.log('Usage: node hubspot_audit_check.js check <contact_id>');
                break;
            }
            await checker.checkContactAuditTrail(contactId);
            break;

        case 'recent':
            const hours = parseInt(process.argv[3]) || 24;
            await checker.findRecentlyModifiedContacts(hours);
            break;

        case 'capabilities':
            await checker.checkAuditCapabilities();
            break;

        default:
            console.log(`
HubSpot Audit Trail Checker
============================

Commands:
  check <contact_id>     - Check audit trail for specific contact
  recent [hours]         - Find recently modified contacts (default: 24 hours)
  capabilities          - Check what audit features are available

Examples:
  node hubspot_audit_check.js check 12345
  node hubspot_audit_check.js recent 48  
  node hubspot_audit_check.js capabilities

This will help you understand what change tracking HubSpot provides
for marketing status and other property changes.
`);
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { HubSpotAuditChecker };

/**
 * Marketing Status Audit and Recovery Tool
 * 
 * This script helps you:
 * 1. Find contacts that were set to NON_MARKETABLE
 * 2. Generate reports of marketing status changes
 * 3. Optionally revert contacts back to MARKETABLE (with confirmation)
 */

require('dotenv').config({ path: '../.env' });
const { HubSpotClient } = require('../index.js');

class MarketingStatusAuditor {
    constructor(hubspotApiKey) {
        this.hubspot = new HubSpotClient(hubspotApiKey);
    }

    /**
     * Find all contacts with NON_MARKETABLE status
     */
    async findNonMarketableContacts() {
        console.log('🔍 Searching for NON_MARKETABLE contacts...\n');
        
        try {
            const searchRequest = {
                filterGroups: [{
                    filters: [{
                        propertyName: 'hs_marketable_status',
                        operator: 'EQ',
                        value: 'NON_MARKETABLE'
                    }]
                }],
                properties: [
                    'firstname', 'lastname', 'email', 'createdate', 
                    'lastmodifieddate', 'hs_marketable_status', 'lifecyclestage',
                    'hs_content_membership_notes' // Contains Buildium ID
                ],
                limit: 100
            };

            const response = await this.hubspot.searchContacts('', searchRequest);
            const contacts = response.results;

            if (contacts.length === 0) {
                console.log('✅ No NON_MARKETABLE contacts found');
                return [];
            }

            console.log(`📊 Found ${contacts.length} NON_MARKETABLE contacts:\n`);

            contacts.forEach((contact, index) => {
                const props = contact.properties;
                const buildiumId = this.extractBuildiumId(props.hs_content_membership_notes || '');
                
                console.log(`${index + 1}. Contact ID: ${contact.id}`);
                console.log(`   Name: ${props.firstname || ''} ${props.lastname || ''}`);
                console.log(`   Email: ${props.email || 'No email'}`);
                console.log(`   Buildium ID: ${buildiumId || 'Not found'}`);
                console.log(`   Created: ${props.createdate || 'Unknown'}`);
                console.log(`   Modified: ${props.lastmodifieddate || 'Unknown'}`);
                console.log(`   Status: ${props.hs_marketable_status}`);
                console.log('   ---');
            });

            return contacts;

        } catch (error) {
            console.error('❌ Error searching for contacts:', error.message);
            return [];
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
     * Generate a detailed audit report
     */
    async generateAuditReport() {
        console.log('📋 Generating Marketing Status Audit Report...\n');
        
        const contacts = await this.findNonMarketableContacts();
        
        if (contacts.length === 0) {
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = `marketing_audit_report_${timestamp}.json`;
        
        const report = {
            generated: new Date().toISOString(),
            totalNonMarketableContacts: contacts.length,
            contacts: contacts.map(contact => ({
                hubspotId: contact.id,
                name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
                email: contact.properties.email,
                buildiumId: this.extractBuildiumId(contact.properties.hs_content_membership_notes || ''),
                created: contact.properties.createdate,
                lastModified: contact.properties.lastmodifieddate,
                marketableStatus: contact.properties.hs_marketable_status
            })),
            instructions: {
                toRevertToMarketing: [
                    "1. Go to HubSpot Contacts",
                    "2. Search for the contact by email or name", 
                    "3. Edit the 'Marketing contact status' property",
                    "4. Change from 'Non-marketing contact' to 'Marketing contact'",
                    "5. Save the contact",
                    "WARNING: This will start billing charges!"
                ]
            }
        };

        const fs = require('fs');
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        console.log(`✅ Audit report saved to: ${reportFile}`);
        
        return report;
    }

    /**
     * Revert specific contacts back to MARKETABLE status
     * WARNING: This will incur billing charges!
     */
    async revertContactsToMarketing(contactIds, confirm = false) {
        if (!confirm) {
            console.log('⚠️ WARNING: This will make contacts MARKETABLE and incur billing charges!');
            console.log('To confirm, call this function with confirm=true');
            return;
        }

        console.log('🔄 Reverting contacts to MARKETABLE status...\n');
        
        for (const contactId of contactIds) {
            try {
                await this.hubspot.updateContact(contactId, {
                    properties: {
                        hs_marketable_status: 'MARKETABLE'
                    }
                });
                
                console.log(`✅ Contact ${contactId} reverted to MARKETABLE`);
                
            } catch (error) {
                console.error(`❌ Failed to revert contact ${contactId}:`, error.message);
            }
        }
    }

    /**
     * Search console logs for marketing status audit entries
     */
    searchConsoleLogsForAuditEntries(logFilePath = './temp.log') {
        console.log('🔍 Searching console logs for marketing status audit entries...\n');
        
        const fs = require('fs');
        
        try {
            if (!fs.existsSync(logFilePath)) {
                console.log('❌ Log file not found:', logFilePath);
                return;
            }

            const logContent = fs.readFileSync(logFilePath, 'utf8');
            const auditLines = logContent.split('\\n').filter(line => 
                line.includes('📊 MARKETING STATUS AUDIT:')
            );

            if (auditLines.length === 0) {
                console.log('ℹ️ No marketing status audit entries found in logs');
                return;
            }

            console.log(`📊 Found ${auditLines.length} marketing status audit entries:\\n`);
            auditLines.forEach((line, index) => {
                console.log(`${index + 1}. ${line.trim()}`);
            });

        } catch (error) {
            console.error('❌ Error reading log file:', error.message);
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

    const auditor = new MarketingStatusAuditor(apiKey);

    const command = process.argv[2];
    
    switch (command) {
        case 'find':
            await auditor.findNonMarketableContacts();
            break;
            
        case 'report':
            await auditor.generateAuditReport();
            break;
            
        case 'search-logs':
            const logFile = process.argv[3] || './temp.log';
            auditor.searchConsoleLogsForAuditEntries(logFile);
            break;
            
        case 'revert':
            const contactIds = process.argv.slice(3);
            if (contactIds.length === 0) {
                console.log('Usage: node marketing_audit.js revert <contact_id1> <contact_id2> ...');
                break;
            }
            await auditor.revertContactsToMarketing(contactIds, false);
            break;
            
        case 'revert-confirm':
            const contactIdsConfirm = process.argv.slice(3);
            if (contactIdsConfirm.length === 0) {
                console.log('Usage: node marketing_audit.js revert-confirm <contact_id1> <contact_id2> ...');
                break;
            }
            await auditor.revertContactsToMarketing(contactIdsConfirm, true);
            break;
            
        default:
            console.log(`
Marketing Status Audit Tool
===========================

Commands:
  find                    - Find all NON_MARKETABLE contacts
  report                  - Generate detailed audit report (JSON)
  search-logs [file]      - Search console logs for audit entries
  revert <ids...>         - Show revert instructions (safe)
  revert-confirm <ids...> - Actually revert contacts (BILLING WARNING!)

Examples:
  node marketing_audit.js find
  node marketing_audit.js report
  node marketing_audit.js search-logs temp.log
  node marketing_audit.js revert 12345 67890
  node marketing_audit.js revert-confirm 12345 67890
`);
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { MarketingStatusAuditor };

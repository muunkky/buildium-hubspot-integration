/**
 * Verify contacts were CREATED by ticket-handler (not just edited)
 * Check hs_object_source and hs_object_source_detail_1 to confirm creation source
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

class TicketHandlerCreationVerifier {
    constructor() {
        this.baseURL = process.env.HUBSPOT_BASE_URL;
        this.accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
    }

    async makeRequest(url, options = {}) {
        try {
            const response = await axios({
                url: `${this.baseURL}${url}`,
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                ...options
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async verifyTicketHandlerCreation() {
        console.log('🔍 VERIFYING: Contacts CREATED by ticket-handler (not just edited)\n');

        try {
            // Search for contacts with ticket-handler as the creation source
            const searchBody = {
                filterGroups: [
                    {
                        filters: [
                            {
                                propertyName: 'hs_object_source_detail_1',
                                operator: 'EQ',
                                value: 'ticket-handler'
                            }
                        ]
                    }
                ],
                properties: [
                    'email',
                    'firstname', 
                    'lastname',
                    'createdate',
                    'lastmodifieddate',
                    'hs_object_source',           // Main source (should be "INTEGRATION")
                    'hs_object_source_label',     // Human readable source
                    'hs_object_source_detail_1',  // Should be "ticket-handler"
                    'hs_object_source_detail_2',  // Additional details
                    'hs_object_source_id',        // Source ID
                    'hs_object_source_user_id',   // User who created it
                    'hs_created_by_user_id',      // HubSpot user who created
                    'hs_marketable_status'        // Current marketing status
                ],
                limit: 10  // Get first 10 for detailed verification
            };

            const contacts = await this.makeRequest('/crm/v3/objects/contacts/search', {
                method: 'POST',
                data: searchBody
            });

            console.log(`📊 Found ${contacts.results.length} contacts to verify (showing first 10):\n`);

            let confirmedCreatedByTicketHandler = 0;
            let needsReview = 0;

            contacts.results.forEach((contact, index) => {
                const props = contact.properties;
                
                console.log(`📋 Contact ${index + 1}: ${props.firstname || ''} ${props.lastname || ''} (${props.email})`);
                console.log(`   ID: ${contact.id}`);
                console.log(`   Created: ${new Date(props.createdate).toLocaleString()}`);
                console.log(`   Modified: ${new Date(props.lastmodifieddate).toLocaleString()}`);
                console.log(`   Marketable Status: ${props.hs_marketable_status}`);
                console.log('   SOURCE VERIFICATION:');
                console.log(`     hs_object_source: "${props.hs_object_source || 'null'}"`);
                console.log(`     hs_object_source_label: "${props.hs_object_source_label || 'null'}"`);
                console.log(`     hs_object_source_detail_1: "${props.hs_object_source_detail_1 || 'null'}"`);
                console.log(`     hs_object_source_detail_2: "${props.hs_object_source_detail_2 || 'null'}"`);
                console.log(`     hs_object_source_user_id: "${props.hs_object_source_user_id || 'null'}"`);
                console.log(`     hs_created_by_user_id: "${props.hs_created_by_user_id || 'null'}"`);
                
                // Verification logic
                if (props.hs_object_source_detail_1 === 'ticket-handler') {
                    if (props.hs_object_source === 'INTEGRATION' || 
                        props.hs_object_source === 'API' || 
                        props.hs_object_source_label?.toLowerCase().includes('integration') ||
                        props.hs_object_source_label?.toLowerCase().includes('api')) {
                        console.log('   ✅ CONFIRMED: Created by ticket-handler integration');
                        confirmedCreatedByTicketHandler++;
                    } else {
                        console.log(`   ⚠️  REVIEW NEEDED: Has ticket-handler detail but source is "${props.hs_object_source}"`);
                        needsReview++;
                    }
                } else {
                    console.log('   ❌ ERROR: Does not have ticket-handler as source detail');
                }
                
                console.log();
            });

            console.log('📈 VERIFICATION SUMMARY:');
            console.log('========================');
            console.log(`✅ Confirmed created by ticket-handler: ${confirmedCreatedByTicketHandler}`);
            console.log(`⚠️  Need manual review: ${needsReview}`);
            console.log(`❌ False positives: ${contacts.results.length - confirmedCreatedByTicketHandler - needsReview}`);

            if (confirmedCreatedByTicketHandler > 0) {
                console.log('\n🎯 CONCLUSION:');
                console.log('==============');
                console.log(`✅ YES - ${confirmedCreatedByTicketHandler} contacts were definitively CREATED by ticket-handler`);
                console.log('   These are safe to make non-marketable because:');
                console.log('   • hs_object_source_detail_1 = "ticket-handler"');
                console.log('   • hs_object_source indicates integration/API creation');
                console.log('   • They were not pre-existing marketing contacts');
                
                console.log('\n💡 RECOMMENDED ACTION:');
                console.log('======================');
                console.log('Set hs_marketable_status = false for all contacts where:');
                console.log('  hs_object_source_detail_1 = "ticket-handler"');
                console.log('  AND hs_object_source IN ("INTEGRATION", "API")');
            }

            return {
                confirmedCreated: confirmedCreatedByTicketHandler,
                needsReview: needsReview,
                totalFound: contacts.results.length
            };

        } catch (error) {
            console.error('❌ Error verifying ticket-handler creation:', error.message);
            return null;
        }
    }
}

async function main() {
    const verifier = new TicketHandlerCreationVerifier();
    await verifier.verifyTicketHandlerCreation();
}

main().catch(console.error);

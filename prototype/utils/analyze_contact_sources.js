/**
 * Analyze HubSpot Contact Sources to Distinguish Created vs Updated
 * Focus on integration-created vs integration-updated contacts
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

class ContactSourceAnalyzer {
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

    async analyzeContactSources() {
        console.log('🔍 Searching for contacts created by ticket-handler...\n');

        try {
            // Search specifically for contacts created by ticket-handler
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
                    'hs_object_source',
                    'hs_object_source_label',
                    'hs_object_source_detail_1',
                    'hs_object_source_detail_2',
                    'hs_object_source_id',
                    'hs_object_source_user_id',
                    'hs_created_by_user_id',
                    'hs_marketable_status',
                    'buildium_owner_id',
                    'buildium_tenant_id',
                    'buildium_property_id'
                ],
                limit: 100
            };

            const contacts = await this.makeRequest('/crm/v3/objects/contacts/search', {
                method: 'POST',
                data: searchBody
            });

            console.log(`📊 Found ${contacts.results.length} contacts created by ticket-handler\n`);

            if (contacts.results.length === 0) {
                console.log('❌ No contacts found with hs_object_source_detail_1 = "ticket-handler"');
                console.log('   This could mean:');
                console.log('   1. Your integration isn\'t setting this property correctly');
                console.log('   2. The property name is different');
                console.log('   3. No contacts have been created by the integration yet');
                console.log('\n🔍 Let me search for contacts with Buildium properties instead...\n');
                
                // Fallback search for any contacts with Buildium data
                const fallbackSearch = {
                    filterGroups: [
                        {
                            filters: [
                                {
                                    propertyName: 'buildium_owner_id',
                                    operator: 'HAS_PROPERTY'
                                }
                            ]
                        }
                    ],
                    properties: [
                        'email', 'firstname', 'lastname', 'createdate', 'lastmodifieddate',
                        'hs_object_source', 'hs_object_source_detail_1', 'hs_marketable_status',
                        'buildium_owner_id', 'buildium_tenant_id', 'buildium_property_id'
                    ],
                    limit: 10
                };
                
                const fallbackContacts = await this.makeRequest('/crm/v3/objects/contacts/search', {
                    method: 'POST',
                    data: fallbackSearch
                });
                
                console.log(`📋 Found ${fallbackContacts.results.length} contacts with Buildium owner data:`);
                fallbackContacts.results.forEach((contact, index) => {
                    const props = contact.properties;
                    console.log(`   ${index + 1}. ${props.firstname || ''} ${props.lastname || ''} (${props.email})`);
                    console.log(`      Source: ${props.hs_object_source || 'unknown'}`);
                    console.log(`      Source Detail: ${props.hs_object_source_detail_1 || 'none'}`);
                    console.log(`      Created: ${new Date(props.createdate).toLocaleDateString()}`);
                    console.log(`      Marketable: ${props.hs_marketable_status}`);
                    console.log();
                });
                
                return { ticketHandlerContacts: [], buildiumContacts: fallbackContacts.results };
            }

            const ticketHandlerContacts = [];

            contacts.results.forEach(contact => {
                const props = contact.properties;
                const hasBuildiumData = props.buildium_owner_id || props.buildium_tenant_id;
                
                ticketHandlerContacts.push({
                    id: contact.id,
                    email: props.email,
                    name: `${props.firstname || ''} ${props.lastname || ''}`.trim(),
                    createDate: props.createdate,
                    source: props.hs_object_source,
                    sourceDetail: props.hs_object_source_detail_1,
                    marketableStatus: props.hs_marketable_status,
                    buildiumType: props.buildium_owner_id ? 'owner' : (props.buildium_tenant_id ? 'tenant' : 'none'),
                    hasBuildiumData
                });
            });

            this.printTicketHandlerAnalysis(ticketHandlerContacts);
            return { ticketHandlerContacts };

        } catch (error) {
            console.error('❌ Error analyzing contact sources:', error.message);
            return null;
        }
    }

    printTicketHandlerAnalysis(contacts) {
        console.log('📋 TICKET-HANDLER CREATED CONTACTS:');
        console.log('===================================\n');

        if (contacts.length === 0) {
            console.log('❌ No contacts found with ticket-handler as source detail');
            return;
        }

        const withBuildium = contacts.filter(c => c.hasBuildiumData);
        const withoutBuildium = contacts.filter(c => !c.hasBuildiumData);
        const marketable = contacts.filter(c => c.marketableStatus === 'true' || c.marketableStatus === true);
        const nonMarketable = contacts.filter(c => c.marketableStatus === 'false' || c.marketableStatus === false);

        console.log(`🎯 SUMMARY:`);
        console.log(`   Total contacts created by ticket-handler: ${contacts.length}`);
        console.log(`   With Buildium data: ${withBuildium.length}`);
        console.log(`   Without Buildium data: ${withoutBuildium.length}`);
        console.log(`   Currently marketable: ${marketable.length}`);
        console.log(`   Currently non-marketable: ${nonMarketable.length}\n`);

        if (withBuildium.length > 0) {
            console.log(`🏢 BUILDIUM CONTACTS (${withBuildium.length}):`);
            withBuildium.slice(0, 10).forEach((contact, index) => {
                console.log(`   ${index + 1}. ${contact.name || contact.email} (${contact.buildiumType})`);
                console.log(`      Created: ${new Date(contact.createDate).toLocaleDateString()}`);
                console.log(`      Marketable: ${contact.marketableStatus}`);
                console.log(`      Source: ${contact.source} / ${contact.sourceDetail}`);
                console.log();
            });
            if (withBuildium.length > 10) {
                console.log(`      ... and ${withBuildium.length - 10} more\n`);
            }
        }

        if (withoutBuildium.length > 0) {
            console.log(`❓ NON-BUILDIUM CONTACTS (${withoutBuildium.length}):`);
            withoutBuildium.slice(0, 5).forEach((contact, index) => {
                console.log(`   ${index + 1}. ${contact.name || contact.email}`);
                console.log(`      Created: ${new Date(contact.createDate).toLocaleDateString()}`);
                console.log(`      Marketable: ${contact.marketableStatus}`);
                console.log();
            });
            if (withoutBuildium.length > 5) {
                console.log(`      ... and ${withoutBuildium.length - 5} more\n`);
            }
        }

        console.log('💡 RECOMMENDATION:');
        console.log('==================');
        if (withBuildium.length > 0) {
            const needsUpdate = withBuildium.filter(c => c.marketableStatus !== 'false' && c.marketableStatus !== false);
            if (needsUpdate.length > 0) {
                console.log(`✅ Safe to make ${needsUpdate.length} Buildium contacts non-marketable`);
                console.log('   These were definitively created by your ticket-handler integration');
            } else {
                console.log('✅ All Buildium contacts are already non-marketable');
            }
        }
        
        if (withoutBuildium.length > 0) {
            console.log(`⚠️  ${withoutBuildium.length} contacts created by ticket-handler but no Buildium data`);
            console.log('   These may need manual review to determine if they should be non-marketable');
        }
    }
}

async function main() {
    const analyzer = new ContactSourceAnalyzer();
    await analyzer.analyzeContactSources();
}

main().catch(console.error);

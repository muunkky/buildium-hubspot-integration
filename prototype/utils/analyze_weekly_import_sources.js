/**
 * Analyze contacts created during the bulk import period (~1 week ago)
 * Check their sources to understand the 1,555 contact spike
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

class BulkImportSourceAnalyzer {
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

    async analyzeWeeklyImportSources() {
        console.log('🔍 Analyzing contacts created during bulk import period...\n');

        try {
            // Define the bulk import period (approximately 1 week ago based on our previous analysis)
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const oneWeekAgoTimestamp = oneWeekAgo.getTime();

            console.log(`📅 Analyzing contacts created since: ${oneWeekAgo.toLocaleDateString()}\n`);

            const allContacts = [];
            let after = 0;
            let hasMore = true;

            while (hasMore) {
                try {
                    const searchBody = {
                        filterGroups: [
                            {
                                filters: [
                                    {
                                        propertyName: 'createdate',
                                        operator: 'GTE',
                                        value: oneWeekAgoTimestamp.toString()
                                    }
                                ]
                            }
                        ],
                        properties: [
                            'email',
                            'firstname', 
                            'lastname',
                            'createdate',
                            'hs_object_source',
                            'hs_object_source_label',
                            'hs_object_source_detail_1',
                            'hs_object_source_detail_2',
                            'hs_marketable_status',
                            'buildium_owner_id',
                            'buildium_tenant_id',
                            'buildium_property_id'
                        ],
                        sorts: [
                            {
                                propertyName: 'createdate',
                                direction: 'DESCENDING'
                            }
                        ],
                        limit: 100,
                        after: after
                    };

                    const response = await this.makeRequest('/crm/v3/objects/contacts/search', {
                        method: 'POST',
                        data: searchBody
                    });

                    if (response.results && response.results.length > 0) {
                        allContacts.push(...response.results);
                        console.log(`📋 Found ${response.results.length} more contacts (total: ${allContacts.length})`);
                        
                        // Check if there are more results
                        if (response.paging && response.paging.next && response.paging.next.after) {
                            after = response.paging.next.after;
                        } else {
                            hasMore = false;
                        }
                    } else {
                        hasMore = false;
                    }

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 200));

                } catch (error) {
                    console.error(`❌ Error fetching batch starting at ${after}:`, error.message);
                    hasMore = false;
                }
            }

            console.log(`\n📊 Total contacts created in last week: ${allContacts.length}\n`);

            this.analyzeSourceDistribution(allContacts);
            return allContacts;

        } catch (error) {
            console.error('❌ Error analyzing bulk import sources:', error.message);
            return null;
        }
    }

    analyzeSourceDistribution(contacts) {
        console.log('📈 SOURCE ANALYSIS:');
        console.log('==================\n');

        // Group by source
        const sourceGroups = {};
        const sourceDetailGroups = {};
        const buildiumContacts = [];
        const marketableCount = { true: 0, false: 0 };

        contacts.forEach(contact => {
            const props = contact.properties;
            
            // Group by main source
            const source = props.hs_object_source || 'UNKNOWN';
            if (!sourceGroups[source]) {
                sourceGroups[source] = [];
            }
            sourceGroups[source].push(contact);

            // Group by source detail
            const sourceDetail = props.hs_object_source_detail_1 || 'none';
            if (!sourceDetailGroups[sourceDetail]) {
                sourceDetailGroups[sourceDetail] = [];
            }
            sourceDetailGroups[sourceDetail].push(contact);

            // Check for Buildium data
            if (props.buildium_owner_id || props.buildium_tenant_id || props.buildium_property_id) {
                buildiumContacts.push(contact);
            }

            // Count marketable status
            if (props.hs_marketable_status === 'true' || props.hs_marketable_status === true) {
                marketableCount.true++;
            } else {
                marketableCount.false++;
            }
        });

        // Print main source breakdown
        console.log('🎯 BY MAIN SOURCE:');
        Object.entries(sourceGroups)
            .sort(([,a], [,b]) => b.length - a.length)
            .forEach(([source, contacts]) => {
                console.log(`   ${source}: ${contacts.length} contacts`);
            });

        console.log('\n🔍 BY SOURCE DETAIL:');
        Object.entries(sourceDetailGroups)
            .sort(([,a], [,b]) => b.length - a.length)
            .forEach(([detail, contacts]) => {
                console.log(`   "${detail}": ${contacts.length} contacts`);
            });

        console.log('\n🏢 BUILDIUM DATA ANALYSIS:');
        console.log(`   Contacts with Buildium properties: ${buildiumContacts.length}`);
        console.log(`   Contacts without Buildium properties: ${contacts.length - buildiumContacts.length}`);

        console.log('\n💰 MARKETABLE STATUS:');
        console.log(`   Marketable: ${marketableCount.true}`);
        console.log(`   Non-marketable: ${marketableCount.false}`);

        // Detailed breakdown of interesting sources
        console.log('\n📋 DETAILED SOURCE BREAKDOWN:');
        console.log('=============================');

        Object.entries(sourceGroups).forEach(([source, sourceContacts]) => {
            if (sourceContacts.length > 10) { // Only show significant sources
                console.log(`\n📊 ${source} (${sourceContacts.length} contacts):`);
                
                // Group by source detail within this source
                const detailGroups = {};
                sourceContacts.forEach(contact => {
                    const detail = contact.properties.hs_object_source_detail_1 || 'none';
                    if (!detailGroups[detail]) {
                        detailGroups[detail] = [];
                    }
                    detailGroups[detail].push(contact);
                });

                Object.entries(detailGroups).forEach(([detail, detailContacts]) => {
                    const withBuildium = detailContacts.filter(c => 
                        c.properties.buildium_owner_id || c.properties.buildium_tenant_id || c.properties.buildium_property_id
                    ).length;
                    const marketable = detailContacts.filter(c => 
                        c.properties.hs_marketable_status === 'true' || c.properties.hs_marketable_status === true
                    ).length;

                    console.log(`   Detail "${detail}": ${detailContacts.length} contacts`);
                    console.log(`     With Buildium data: ${withBuildium}`);
                    console.log(`     Marketable: ${marketable}`);
                    
                    // Show a few examples
                    if (detailContacts.length > 0) {
                        const examples = detailContacts.slice(0, 3);
                        console.log(`     Examples:`);
                        examples.forEach(contact => {
                            const props = contact.properties;
                            const name = `${props.firstname || ''} ${props.lastname || ''}`.trim() || props.email;
                            const created = new Date(props.createdate).toLocaleDateString();
                            console.log(`       • ${name} (${created})`);
                        });
                    }
                    console.log();
                });
            }
        });

        console.log('\n💡 INSIGHTS:');
        console.log('============');
        if (buildiumContacts.length > 0) {
            console.log(`• ${buildiumContacts.length} contacts have Buildium data - likely from your integration`);
        }
        if (marketableCount.true > marketableCount.false) {
            console.log(`• ${marketableCount.true} contacts are still marketable - potential cost savings if they're operational`);
        }
        console.log(`• Most contacts came from: ${Object.entries(sourceGroups).sort(([,a], [,b]) => b.length - a.length)[0][0]}`);
    }
}

async function main() {
    const analyzer = new BulkImportSourceAnalyzer();
    await analyzer.analyzeWeeklyImportSources();
}

main().catch(console.error);

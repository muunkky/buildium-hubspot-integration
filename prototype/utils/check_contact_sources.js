/**
 * Check HubSpot Contact Record Sources
 * Look for source tracking fields that can help identify Buildium vs marketing contacts
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

class HubSpotSourceChecker {
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

    async checkContactProperties() {
        console.log('[SEARCH] Checking HubSpot contact properties for source tracking...\n');

        try {
            // Get all contact properties
            const properties = await this.makeRequest('/crm/v3/properties/contacts');
            
            console.log(`[STATS] Found ${properties.results.length} total contact properties\n`);

            // Look for source-related properties
            const sourceProperties = properties.results.filter(prop => 
                prop.name.toLowerCase().includes('source') ||
                prop.name.toLowerCase().includes('origin') ||
                prop.name.toLowerCase().includes('created') ||
                prop.name.toLowerCase().includes('import') ||
                prop.name.toLowerCase().includes('sync') ||
                prop.name.toLowerCase().includes('buildium') ||
                prop.label.toLowerCase().includes('source') ||
                prop.label.toLowerCase().includes('origin')
            );

            console.log('[TARGET] SOURCE-RELATED PROPERTIES:');
            console.log('=============================');
            
            sourceProperties.forEach(prop => {
                console.log(`[ITEM] ${prop.name}: ${prop.label}`);
                console.log(`   Description: ${prop.description || 'No description'}`);
                console.log(`   Type: ${prop.type} | Group: ${prop.groupName}`);
                if (prop.options && prop.options.length > 0) {
                    console.log(`   Options: ${prop.options.map(opt => opt.label).join(', ')}`);
                }
                console.log();
            });

            return sourceProperties;

        } catch (error) {
            console.error('[FAIL] Error fetching contact properties:', error.message);
            return [];
        }
    }

    async checkSampleContacts() {
        console.log('[SEARCH] Checking sample contacts for source information...\n');

        try {
            // Get a sample of contacts with all available properties
            const contacts = await this.makeRequest('/crm/v3/objects/contacts', {
                method: 'GET',
                params: {
                    limit: 10,
                    properties: [
                        'email',
                        'firstname',
                        'lastname',
                        'hs_object_source',
                        'hs_object_source_id',
                        'hs_object_source_label',
                        'hs_object_source_user_id',
                        'hs_object_source_detail_1',
                        'hs_object_source_detail_2',
                        'hs_object_source_detail_3',
                        'hs_created_by_user_id',
                        'createdate',
                        'lastmodifieddate',
                        'hs_analytics_source',
                        'hs_analytics_source_data_1',
                        'hs_analytics_source_data_2',
                        'hs_latest_source',
                        'hs_latest_source_data_1',
                        'hs_latest_source_data_2',
                        'hs_original_source',
                        'hs_original_source_data_1',
                        'hs_original_source_data_2',
                        'buildium_owner_id',  // Our custom property
                        'buildium_tenant_id', // Our custom property
                        'buildium_property_id' // Our custom property
                    ].join(',')
                }
            });

            console.log('[STATS] SAMPLE CONTACT SOURCE DATA:');
            console.log('==============================');

            contacts.results.forEach((contact, index) => {
                const props = contact.properties;
                console.log(`\n[ITEM] Contact ${index + 1}: ${props.firstname || ''} ${props.lastname || ''} (${props.email || 'No email'})`);
                console.log(`   Created: ${props.createdate}`);
                console.log(`   Modified: ${props.lastmodifieddate}`);
                
                // Check for HubSpot's built-in source tracking
                if (props.hs_object_source) {
                    console.log(`   [TARGET] Object Source: ${props.hs_object_source}`);
                }
                if (props.hs_object_source_label) {
                    console.log(`   ️ Source Label: ${props.hs_object_source_label}`);
                }
                if (props.hs_object_source_detail_1) {
                    console.log(`    Source Detail 1: ${props.hs_object_source_detail_1}`);
                }
                if (props.hs_original_source) {
                    console.log(`   [SEARCH] Original Source: ${props.hs_original_source}`);
                }
                if (props.hs_latest_source) {
                    console.log(`    Latest Source: ${props.hs_latest_source}`);
                }

                // Check for our Buildium-specific properties
                const hasBuildiumData = props.buildium_owner_id || props.buildium_tenant_id || props.buildium_property_id;
                if (hasBuildiumData) {
                    console.log(`    BUILDIUM CONTACT DETECTED!`);
                    if (props.buildium_owner_id) console.log(`      Owner ID: ${props.buildium_owner_id}`);
                    if (props.buildium_tenant_id) console.log(`      Tenant ID: ${props.buildium_tenant_id}`);
                    if (props.buildium_property_id) console.log(`      Property ID: ${props.buildium_property_id}`);
                } else {
                    console.log(`    Likely marketing contact (no Buildium data)`);
                }
            });

            return contacts.results;

        } catch (error) {
            console.error('[FAIL] Error fetching sample contacts:', error.message);
            return [];
        }
    }

    async analyzeSourceDistribution() {
        console.log('\n[SEARCH] Analyzing source distribution across all contacts...\n');

        try {
            // Get source distribution
            const searchBody = {
                filterGroups: [],
                properties: ['hs_object_source', 'hs_object_source_label', 'buildium_owner_id', 'buildium_tenant_id'],
                limit: 100
            };

            const searchResults = await this.makeRequest('/crm/v3/objects/contacts/search', {
                method: 'POST',
                data: searchBody
            });

            const sourceCounts = {};
            const buildiumCount = {
                owners: 0,
                tenants: 0,
                total: 0
            };
            let marketingCount = 0;

            searchResults.results.forEach(contact => {
                const props = contact.properties;
                
                // Count by source
                const source = props.hs_object_source || 'Unknown';
                sourceCounts[source] = (sourceCounts[source] || 0) + 1;

                // Count Buildium vs marketing
                if (props.buildium_owner_id || props.buildium_tenant_id) {
                    buildiumCount.total++;
                    if (props.buildium_owner_id) buildiumCount.owners++;
                    if (props.buildium_tenant_id) buildiumCount.tenants++;
                } else {
                    marketingCount++;
                }
            });

            console.log('[STATS] SOURCE DISTRIBUTION (sample of 100):');
            console.log('======================================');
            Object.entries(sourceCounts).forEach(([source, count]) => {
                console.log(`   ${source}: ${count} contacts`);
            });

            console.log('\n BUILDIUM vs MARKETING BREAKDOWN:');
            console.log('===================================');
            console.log(`    Buildium Contacts: ${buildiumCount.total}`);
            console.log(`      [ITEM] Owners: ${buildiumCount.owners}`);
            console.log(`       Tenants: ${buildiumCount.tenants}`);
            console.log(`    Marketing Contacts: ${marketingCount}`);

            return {
                sourceCounts,
                buildiumCount,
                marketingCount
            };

        } catch (error) {
            console.error('[FAIL] Error analyzing source distribution:', error.message);
            return null;
        }
    }
}

async function main() {
    const checker = new HubSpotSourceChecker();
    
    // Step 1: Check what source properties are available
    const sourceProperties = await checker.checkContactProperties();
    
    // Step 2: Look at sample contact data
    await checker.checkSampleContacts();
    
    // Step 3: Analyze overall distribution
    await checker.analyzeSourceDistribution();
    
    console.log('\n[OK] Source analysis complete!');
    console.log('\n RECOMMENDATIONS:');
    console.log('===================');
    console.log('1. Use Buildium custom properties (buildium_owner_id, buildium_tenant_id) to identify Buildium contacts');
    console.log('2. Check hs_object_source and hs_object_source_label for HubSpot\'s built-in source tracking');
    console.log('3. Contacts without Buildium properties are likely your existing marketing database');
    console.log('4. Use creation date to identify contacts added during the bulk import period');
}

main().catch(console.error);

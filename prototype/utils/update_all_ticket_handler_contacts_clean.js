/**
 * Make ALL ticket-handler created contacts non-marketable
 * Clean version without emojis for PowerShell compatibility
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

class TicketHandlerMarketableUpdater {
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

    async getAllTicketHandlerContacts() {
        console.log('Finding ALL contacts created by ticket-handler...\n');

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
                        'hs_object_source',
                        'hs_object_source_detail_1',
                        'hs_marketable_status',
                        'createdate'
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
                    console.log(`Found ${response.results.length} more contacts (total: ${allContacts.length})`);
                    
                    // Check if there are more results
                    if (response.paging && response.paging.next && response.paging.next.after) {
                        after = response.paging.next.after;
                    } else {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }

                // Rate limiting - be nice to HubSpot API
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`Error fetching batch starting at ${after}:`, error.message);
                hasMore = false;
            }
        }

        console.log(`\nTotal contacts found: ${allContacts.length}\n`);
        return allContacts;
    }

    async updateContactsToNonMarketable(contacts) {
        console.log('Updating contacts to non-marketable...\n');

        // Filter for contacts that are currently marketable
        const marketableContacts = contacts.filter(contact => {
            const props = contact.properties;
            return props.hs_marketable_status === 'true' || props.hs_marketable_status === true;
        });

        if (marketableContacts.length === 0) {
            console.log('All ticket-handler contacts are already non-marketable!');
            return { updated: 0, skipped: contacts.length };
        }

        console.log(`Found ${marketableContacts.length} contacts that need to be updated`);
        console.log(`Skipping ${contacts.length - marketableContacts.length} already non-marketable contacts\n`);

        let updated = 0;
        let errors = 0;

        // Process in batches for better API handling
        const batchSize = 10;
        for (let i = 0; i < marketableContacts.length; i += batchSize) {
            const batch = marketableContacts.slice(i, i + batchSize);
            
            console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(marketableContacts.length/batchSize)} (contacts ${i + 1}-${Math.min(i + batchSize, marketableContacts.length)})`);

            const batchPromises = batch.map(async (contact) => {
                try {
                    const updateData = {
                        properties: {
                            hs_marketable_status: 'NON_MARKETABLE'  // String value as used in main code
                        }
                    };

                    await this.makeRequest(`/crm/v3/objects/contacts/${contact.id}`, {
                        method: 'PATCH',
                        data: updateData
                    });

                    const props = contact.properties;
                    const name = `${props.firstname || ''} ${props.lastname || ''}`.trim() || props.email;
                    console.log(`   Updated: ${name}`);
                    return { success: true, contact };

                } catch (error) {
                    const props = contact.properties;
                    const name = `${props.firstname || ''} ${props.lastname || ''}`.trim() || props.email;
                    console.error(`   Failed: ${name} - ${error.message}`);
                    return { success: false, contact, error };
                }
            });

            const results = await Promise.all(batchPromises);
            
            const batchUpdated = results.filter(r => r.success).length;
            const batchErrors = results.filter(r => !r.success).length;
            
            updated += batchUpdated;
            errors += batchErrors;

            console.log(`   Batch complete: ${batchUpdated} updated, ${batchErrors} errors\n`);

            // Rate limiting between batches
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return { updated, errors, total: marketableContacts.length };
    }

    async processAllTicketHandlerContacts() {
        console.log('MAKING ALL TICKET-HANDLER CONTACTS NON-MARKETABLE');
        console.log('====================================================\n');

        try {
            // Step 1: Get all ticket-handler contacts
            const allContacts = await this.getAllTicketHandlerContacts();

            if (allContacts.length === 0) {
                console.log('No contacts found with ticket-handler source');
                return;
            }

            // Step 2: Verify they're integration-created
            const integrationContacts = allContacts.filter(contact => {
                const props = contact.properties;
                return props.hs_object_source === 'INTEGRATION' && 
                       props.hs_object_source_detail_1 === 'ticket-handler';
            });

            console.log(`VERIFICATION:`);
            console.log(`   Total with ticket-handler detail: ${allContacts.length}`);
            console.log(`   Confirmed integration-created: ${integrationContacts.length}`);
            console.log(`   Non-integration sources: ${allContacts.length - integrationContacts.length}\n`);

            if (integrationContacts.length === 0) {
                console.log('No confirmed integration-created contacts found');
                return;
            }

            // Step 3: Update to non-marketable
            const results = await this.updateContactsToNonMarketable(integrationContacts);

            // Step 4: Summary
            console.log('FINAL SUMMARY:');
            console.log('=================');
            console.log(`Successfully updated: ${results.updated} contacts`);
            console.log(`Already non-marketable: ${integrationContacts.length - results.total} contacts`);
            console.log(`Errors: ${results.errors} contacts`);
            console.log(`Total processed: ${integrationContacts.length} contacts`);

            if (results.updated > 0) {
                console.log(`\nCOST SAVINGS: You just saved money by removing ${results.updated} contacts from marketing billing!`);
            }

        } catch (error) {
            console.error('Process failed:', error.message);
        }
    }
}

async function main() {
    const updater = new TicketHandlerMarketableUpdater();
    await updater.processAllTicketHandlerContacts();
}

main().catch(console.error);

/**
 * Create Next Lease Properties
 * Add properties for tracking the next upcoming lease
 */

require('dotenv').config({ path: '../.env' });
const { HubSpotClient } = require('../index.js');
const axios = require('axios');

class NextLeasePropertyCreator {
    constructor() {
        this.hubspotClient = new HubSpotClient();
    }

    /**
     * Define next lease properties
     */
    getNextLeaseProperties() {
        return [
            {
                name: 'next_lease_start',
                label: 'Next Lease Start Date',
                type: 'date',
                fieldType: 'date',
                description: 'Start date of the next upcoming lease for this unit'
            },
            {
                name: 'next_lease_id',
                label: 'Next Lease ID',
                type: 'string',
                fieldType: 'text',
                description: 'Buildium ID of the next upcoming lease'
            },
            {
                name: 'next_lease_tenant',
                label: 'Next Lease Tenant',
                type: 'string',
                fieldType: 'text',
                description: 'Primary tenant name for the next upcoming lease'
            }
        ];
    }

    /**
     * Create the next lease properties
     */
    async createNextLeaseProperties() {
        console.log('🔮 CREATING NEXT LEASE PROPERTIES');
        console.log('='.repeat(35));
        
        const properties = this.getNextLeaseProperties();
        const results = { created: 0, existing: 0, failed: 0 };

        for (const property of properties) {
            try {
                console.log(`🔧 Creating property: ${property.name}`);
                
                // Use the same pattern as existing property creation
                try {
                    // Check if property already exists
                    const existingResponse = await this.hubspotClient.makeRequestWithRetry(() =>
                        axios.get(`${this.hubspotClient.baseURL}/crm/v3/properties/0-420/${property.name}`, {
                            headers: this.hubspotClient.getHeaders()
                        })
                    );
                    
                    console.log(`✅ Property '${property.name}' already exists`);
                    results.existing++;
                } catch (error) {
                    if (error.response?.status === 404) {
                        // Property doesn't exist, create it
                        const createData = {
                            name: property.name,
                            label: property.label,
                            type: property.type,
                            fieldType: property.fieldType,
                            groupName: 'listing_information',
                            description: property.description
                        };

                        const createResponse = await this.hubspotClient.makeRequestWithRetry(() =>
                            axios.post(`${this.hubspotClient.baseURL}/crm/v3/properties/0-420`, createData, {
                                headers: this.hubspotClient.getHeaders()
                            })
                        );
                        
                        console.log(`✅ Created: ${property.name}`);
                        results.created++;
                    } else {
                        throw error;
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                results.failed++;
                console.error(`❌ Failed to create ${property.name}:`, error.response?.data || error.message);
            }
        }

        console.log('\n📊 NEXT LEASE PROPERTIES SUMMARY');
        console.log('='.repeat(30));
        console.log(`✅ Created: ${results.created}`);
        console.log(`⚠️  Already existed: ${results.existing}`);
        console.log(`❌ Failed: ${results.failed}`);
        
        if (results.failed === 0) {
            console.log('\n🎉 Next lease properties ready!');
        }

        return results;
    }
}

// Run the creation
async function main() {
    try {
        const creator = new NextLeasePropertyCreator();
        await creator.createNextLeaseProperties();
    } catch (error) {
        console.error('❌ Failed to create next lease properties:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { NextLeasePropertyCreator };

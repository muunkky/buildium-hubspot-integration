/**
 * End-to-End Test: Buildium → HubSpot Owner Sync Validation
 * 
 * This test performs a complete validation of the data sync process:
 * 1. Get source data from Buildium
 * 2. Perform sync operation
 * 3. Verify data as pushed to HubSpot
 * 4. Validate associations and data integrity
 */

const axios = require('axios');
require('dotenv').config();

class EndToEndTest {
    constructor() {
        // Buildium API configuration
        this.buildiumBaseURL = 'https://api.buildium.com';
        this.buildiumAuth = Buffer.from(`${process.env.BUILDIUM_CLIENT_ID}:${process.env.BUILDIUM_CLIENT_SECRET}`).toString('base64');
        
        // HubSpot API configuration
        this.hubspotBaseURL = 'https://api.hubapi.com';
        this.hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;
        
        // Test configuration
        this.testPropertyId = 140054; // Property we know has data
        this.testResults = {
            buildiumData: null,
            syncResults: null,
            hubspotData: null,
            associations: null,
            validation: []
        };
    }

    /**
     * Step 1: Get source data from Buildium
     */
    async getBuildiumSourceData() {
        console.log('🔍 STEP 1: Fetching source data from Buildium...');
        console.log('=' .repeat(60));
        
        try {
            // Get property details
            const propertyResponse = await axios.get(
                `${this.buildiumBaseURL}/v1/rentals/${this.testPropertyId}`,
                {
                    headers: {
                        'Authorization': `Basic ${this.buildiumAuth}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            const property = propertyResponse.data;
            console.log(`📋 Property: ${property.Name} (ID: ${property.Id})`);
            console.log(`   Address: ${property.Address.AddressLine1}, ${property.Address.City}`);
            
            // Get owners for this property
            const ownersResponse = await axios.get(
                `${this.buildiumBaseURL}/v1/rentalowners`,
                {
                    headers: {
                        'Authorization': `Basic ${this.buildiumAuth}`,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        propertyids: this.testPropertyId
                    }
                }
            );
            
            const owners = ownersResponse.data;
            console.log(`👥 Found ${owners.length} owner(s) for property ${this.testPropertyId}:`);
            
            owners.forEach(owner => {
                console.log(`   - ${owner.FirstName} ${owner.LastName} (ID: ${owner.Id})`);
                console.log(`     Email: ${owner.Email || 'No email'}`);
                console.log(`     Properties: ${owner.PropertyIds ? owner.PropertyIds.join(', ') : 'None listed'}`);
            });
            
            // Get units for this property
            const unitsResponse = await axios.get(
                `${this.buildiumBaseURL}/v1/rentals/${this.testPropertyId}/units`,
                {
                    headers: {
                        'Authorization': `Basic ${this.buildiumAuth}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            const units = unitsResponse.data;
            console.log(`🏠 Found ${units.length} unit(s) for property ${this.testPropertyId}:`);
            units.forEach(unit => {
                console.log(`   - Unit ${unit.UnitNumber} (ID: ${unit.Id})`);
            });
            
            this.testResults.buildiumData = {
                property,
                owners,
                units
            };
            
            console.log('✅ Step 1 Complete: Source data retrieved from Buildium\n');
            return this.testResults.buildiumData;
            
        } catch (error) {
            console.error('❌ Error fetching Buildium data:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Step 2: Perform sync operation
     */
    async performSync() {
        console.log('🔄 STEP 2: Performing sync operation...');
        console.log('=' .repeat(60));
        
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        try {
            console.log(`🚀 Running: node index.js owners --property-ids ${this.testPropertyId} --force`);
            
            const { stdout, stderr } = await execAsync(
                `node index.js owners --property-ids ${this.testPropertyId} --force`
            );
            
            console.log('📊 Sync Output:');
            console.log(stdout);
            
            if (stderr) {
                console.log('⚠️ Sync Warnings/Errors:');
                console.log(stderr);
            }
            
            // Parse sync results from output
            const syncResults = this.parseSyncOutput(stdout);
            this.testResults.syncResults = syncResults;
            
            console.log('✅ Step 2 Complete: Sync operation performed\n');
            return syncResults;
            
        } catch (error) {
            console.error('❌ Error during sync:', error.message);
            throw error;
        }
    }

    /**
     * Step 3: Verify data as pushed to HubSpot
     */
    async verifyHubSpotData() {
        console.log('🔍 STEP 3: Verifying data in HubSpot...');
        console.log('=' .repeat(60));
        
        try {
            const owners = this.testResults.buildiumData.owners;
            const hubspotData = {};
            
            for (const owner of owners) {
                if (!owner.Email) {
                    console.log(`⚠️ Skipping owner ${owner.Id} - no email to search with`);
                    continue;
                }
                
                console.log(`🔍 Searching for contact: ${owner.Email}`);
                
                // Search for contact by email
                const contactResponse = await axios.post(
                    `${this.hubspotBaseURL}/crm/v3/objects/contacts/search`,
                    {
                        filterGroups: [{
                            filters: [{
                                propertyName: 'email',
                                operator: 'EQ',
                                value: owner.Email
                            }]
                        }],
                        limit: 1,
                        properties: ['firstname', 'lastname', 'email', 'phone', 'address', 'city', 'state', 'zip']
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.hubspotToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                if (contactResponse.data.results.length > 0) {
                    const contact = contactResponse.data.results[0];
                    console.log(`✅ Found contact: ${contact.properties.firstname} ${contact.properties.lastname} (ID: ${contact.id})`);
                    
                    hubspotData[owner.Id] = {
                        contact,
                        associations: await this.getContactAssociations(contact.id)
                    };
                } else {
                    console.log(`❌ Contact not found for email: ${owner.Email}`);
                }
            }
            
            // Search for listings related to our property
            console.log(`\n🏠 Searching for listings with Buildium Property ID: ${this.testPropertyId}`);
            const listingsResponse = await axios.post(
                `${this.hubspotBaseURL}/crm/v3/objects/2-4002138/search`,
                {
                    filterGroups: [{
                        filters: [{
                            propertyName: 'buildium_property_id',
                            operator: 'EQ',
                            value: this.testPropertyId.toString()
                        }]
                    }],
                    properties: ['name', 'buildium_property_id', 'buildium_unit_id', 'unit_number']
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.hubspotToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log(`✅ Found ${listingsResponse.data.results.length} listing(s) for property ${this.testPropertyId}`);
            listingsResponse.data.results.forEach(listing => {
                console.log(`   - ${listing.properties.name} (ID: ${listing.id})`);
                console.log(`     Unit: ${listing.properties.unit_number || 'N/A'}`);
            });
            
            this.testResults.hubspotData = {
                contacts: hubspotData,
                listings: listingsResponse.data.results
            };
            
            console.log('✅ Step 3 Complete: HubSpot data verified\n');
            return this.testResults.hubspotData;
            
        } catch (error) {
            console.error('❌ Error verifying HubSpot data:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get associations for a contact
     */
    async getContactAssociations(contactId) {
        try {
            console.log(`🔗 Getting associations for contact ${contactId}...`);
            
            const response = await axios.get(
                `${this.hubspotBaseURL}/crm/v4/objects/contacts/${contactId}/associations/2-4002138`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.hubspotToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            const associations = response.data.results;
            console.log(`   Found ${associations.length} listing association(s)`);
            
            return associations;
            
        } catch (error) {
            console.log(`   ⚠️ No associations found or error: ${error.response?.status}`);
            return [];
        }
    }

    /**
     * Step 4: Validate data integrity and associations
     */
    async validateDataIntegrity() {
        console.log('✅ STEP 4: Validating data integrity and associations...');
        console.log('=' .repeat(60));
        
        const validationResults = [];
        
        // Validate each owner
        for (const buildiumOwner of this.testResults.buildiumData.owners) {
            const validation = {
                ownerId: buildiumOwner.Id,
                ownerName: `${buildiumOwner.FirstName} ${buildiumOwner.LastName}`,
                checks: []
            };
            
            console.log(`👤 Validating owner: ${validation.ownerName} (ID: ${buildiumOwner.Id})`);
            
            // Check if contact exists in HubSpot
            const hubspotOwnerData = this.testResults.hubspotData.contacts[buildiumOwner.Id];
            if (hubspotOwnerData) {
                validation.checks.push({ check: 'Contact exists in HubSpot', status: 'PASS' });
                
                // Validate contact data
                const contact = hubspotOwnerData.contact;
                const props = contact.properties;
                
                // Check name
                if (props.firstname === buildiumOwner.FirstName && props.lastname === buildiumOwner.LastName) {
                    validation.checks.push({ check: 'Name matches', status: 'PASS' });
                } else {
                    validation.checks.push({ 
                        check: 'Name matches', 
                        status: 'FAIL', 
                        details: `Expected: ${buildiumOwner.FirstName} ${buildiumOwner.LastName}, Got: ${props.firstname} ${props.lastname}` 
                    });
                }
                
                // Check email
                if (props.email === buildiumOwner.Email) {
                    validation.checks.push({ check: 'Email matches', status: 'PASS' });
                } else {
                    validation.checks.push({ 
                        check: 'Email matches', 
                        status: 'FAIL', 
                        details: `Expected: ${buildiumOwner.Email}, Got: ${props.email}` 
                    });
                }
                
                // Check associations
                const associations = hubspotOwnerData.associations;
                const expectedListings = this.testResults.hubspotData.listings.length;
                
                if (associations.length >= expectedListings) {
                    validation.checks.push({ 
                        check: 'Has property associations', 
                        status: 'PASS',
                        details: `${associations.length} association(s) found`
                    });
                } else {
                    validation.checks.push({ 
                        check: 'Has property associations', 
                        status: 'FAIL', 
                        details: `Expected at least ${expectedListings}, got ${associations.length}` 
                    });
                }
                
            } else {
                validation.checks.push({ check: 'Contact exists in HubSpot', status: 'FAIL' });
            }
            
            // Print validation results for this owner
            validation.checks.forEach(check => {
                const icon = check.status === 'PASS' ? '✅' : '❌';
                console.log(`   ${icon} ${check.check}: ${check.status}`);
                if (check.details) {
                    console.log(`      ${check.details}`);
                }
            });
            
            validationResults.push(validation);
        }
        
        this.testResults.validation = validationResults;
        console.log('\n✅ Step 4 Complete: Data integrity validation performed\n');
        return validationResults;
    }

    /**
     * Parse sync output to extract results
     */
    parseSyncOutput(output) {
        const results = {
            mode: null,
            processed: 0,
            synced: 0,
            enriched: 0,
            errors: 0,
            associations: 0
        };
        
        // Extract key metrics from output
        if (output.includes('FORCE MODE')) results.mode = 'force';
        
        const processedMatch = output.match(/Total processed: (\d+)/);
        if (processedMatch) results.processed = parseInt(processedMatch[1]);
        
        const syncedMatch = output.match(/Successfully synced: (\d+)/);
        if (syncedMatch) results.synced = parseInt(syncedMatch[1]);
        
        const enrichedMatch = output.match(/Enriched existing: (\d+)/);
        if (enrichedMatch) results.enriched = parseInt(enrichedMatch[1]);
        
        const errorsMatch = output.match(/Errors: (\d+)/);
        if (errorsMatch) results.errors = parseInt(errorsMatch[1]);
        
        const associationsMatch = output.match(/Associations Created: (\d+)/);
        if (associationsMatch) results.associations = parseInt(associationsMatch[1]);
        
        return results;
    }

    /**
     * Generate comprehensive test report
     */
    generateReport() {
        console.log('📊 END-TO-END TEST REPORT');
        console.log('=' .repeat(60));
        
        console.log('\n🔍 Source Data (Buildium):');
        console.log(`   Property: ${this.testResults.buildiumData.property.Name} (ID: ${this.testResults.buildiumData.property.Id})`);
        console.log(`   Owners: ${this.testResults.buildiumData.owners.length}`);
        console.log(`   Units: ${this.testResults.buildiumData.units.length}`);
        
        console.log('\n🔄 Sync Results:');
        const sync = this.testResults.syncResults;
        console.log(`   Mode: ${sync.mode || 'standard'}`);
        console.log(`   Processed: ${sync.processed}`);
        console.log(`   Synced: ${sync.synced}`);
        console.log(`   Enriched: ${sync.enriched}`);
        console.log(`   Associations: ${sync.associations}`);
        console.log(`   Errors: ${sync.errors}`);
        
        console.log('\n📞 HubSpot Data:');
        console.log(`   Contacts Found: ${Object.keys(this.testResults.hubspotData.contacts).length}`);
        console.log(`   Listings Found: ${this.testResults.hubspotData.listings.length}`);
        
        console.log('\n✅ Validation Summary:');
        let totalChecks = 0;
        let passedChecks = 0;
        
        this.testResults.validation.forEach(ownerValidation => {
            ownerValidation.checks.forEach(check => {
                totalChecks++;
                if (check.status === 'PASS') passedChecks++;
            });
        });
        
        console.log(`   Total Checks: ${totalChecks}`);
        console.log(`   Passed: ${passedChecks}`);
        console.log(`   Failed: ${totalChecks - passedChecks}`);
        console.log(`   Success Rate: ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);
        
        const overallSuccess = (sync.errors === 0 && totalChecks === passedChecks);
        console.log(`\n🏆 Overall Test Result: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
        
        return {
            success: overallSuccess,
            summary: {
                sourceData: this.testResults.buildiumData,
                syncResults: this.testResults.syncResults,
                hubspotData: this.testResults.hubspotData,
                validation: this.testResults.validation,
                successRate: (passedChecks / totalChecks) * 100
            }
        };
    }

    /**
     * Run complete end-to-end test
     */
    async runTest() {
        try {
            console.log('🚀 STARTING END-TO-END TEST');
            console.log('=' .repeat(60));
            console.log(`🎯 Test Target: Property ${this.testPropertyId}`);
            console.log(`📅 Test Date: ${new Date().toISOString()}\n`);
            
            // Step 1: Get source data
            await this.getBuildiumSourceData();
            
            // Step 2: Perform sync
            await this.performSync();
            
            // Step 3: Verify HubSpot data
            await this.verifyHubSpotData();
            
            // Step 4: Validate integrity
            await this.validateDataIntegrity();
            
            // Generate report
            return this.generateReport();
            
        } catch (error) {
            console.error('❌ End-to-end test failed:', error.message);
            throw error;
        }
    }
}

// Run the test
if (require.main === module) {
    const test = new EndToEndTest();
    test.runTest()
        .then(result => {
            console.log('\n🎉 End-to-end test completed!');
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = EndToEndTest;

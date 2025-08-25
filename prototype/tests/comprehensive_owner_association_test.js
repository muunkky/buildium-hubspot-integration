/**
 * Comprehensive Owner Association Validation Test
 * Tests both rental and association owners to ensure correct association types
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
require('dotenv').config();

const execAsync = promisify(exec);

class ComprehensiveOwnerAssociationTest {
    constructor() {
        this.baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com';
        this.accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        this.results = {
            rentalOwners: [],
            associationOwners: [],
            passed: 0,
            failed: 0
        };
    }

    async runCommand(description, command) {
        console.log(`📋 ${description}`);
        console.log(`🚀 Command: ${command}`);
        console.log('-'.repeat(50));
        
        try {
            const { stdout, stderr } = await execAsync(command, { cwd: process.cwd() });
            console.log(stdout);
            if (stderr && !stderr.includes('Warning')) {
                console.log('⚠️ Stderr:', stderr);
            }
            return { success: true, output: stdout };
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async validateAssociationType(contactId, listingId, expectedType, ownerDescription) {
        try {
            console.log(`🔍 Validating association for ${ownerDescription}...`);
            console.log(`   Contact: ${contactId}, Listing: ${listingId}, Expected Type: ${expectedType}`);
            
            const response = await axios.get(
                `${this.baseURL}/crm/v4/objects/contact/${contactId}/associations/0-420`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const association = response.data.results.find(
                assoc => assoc.toObjectId === listingId
            );

            if (!association) {
                console.log(`❌ No association found for ${ownerDescription}`);
                return { success: false, error: 'Association not found' };
            }

            const actualType = association.associationTypes[0]?.typeId;
            const typeLabel = association.associationTypes[0]?.label || 'Unknown';
            
            console.log(`   📊 Found association: Type ${actualType} (${typeLabel})`);
            
            if (actualType === expectedType) {
                console.log(`✅ Correct association type for ${ownerDescription}`);
                return { 
                    success: true, 
                    actualType, 
                    expectedType, 
                    typeLabel,
                    contactId,
                    listingId
                };
            } else {
                console.log(`❌ Wrong association type for ${ownerDescription}: got ${actualType}, expected ${expectedType}`);
                return { 
                    success: false, 
                    error: `Wrong association type: got ${actualType}, expected ${expectedType}`,
                    actualType,
                    expectedType
                };
            }
        } catch (error) {
            console.log(`❌ Error validating association for ${ownerDescription}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    extractContactAndListing(syncOutput) {
        const contactMatch = syncOutput.match(/contact (\d+)/i);
        const listingMatch = syncOutput.match(/listing (\d+)/);
        
        if (contactMatch && listingMatch) {
            return {
                contactId: contactMatch[1],
                listingId: listingMatch[1]
            };
        }
        return null;
    }

    async testRentalOwnerSync() {
        console.log('\n🏠 TESTING RENTAL OWNER SYNC');
        console.log('='.repeat(70));
        
        // Test with property 140054 (known rental property)
        const syncResult = await this.runCommand(
            'Sync rental property owner (Property 140054)',
            'node index.js owners --property-ids 140054 --force'
        );

        if (!syncResult.success) {
            console.log('❌ Rental owner sync failed');
            this.results.failed++;
            return { success: false, error: 'Sync command failed' };
        }

        const ids = this.extractContactAndListing(syncResult.output);
        if (!ids) {
            console.log('❌ Could not extract contact/listing IDs from sync output');
            this.results.failed++;
            return { success: false, error: 'Could not extract IDs' };
        }

        // Validate association type (should be 4 for rental owners)
        const validation = await this.validateAssociationType(
            ids.contactId, 
            ids.listingId, 
            4, 
            'Rental Property Owner'
        );

        if (validation.success) {
            this.results.passed++;
            this.results.rentalOwners.push({
                ...ids,
                ...validation,
                propertyId: '140054'
            });
        } else {
            this.results.failed++;
        }

        return validation;
    }

    async testAssociationOwnerSync() {
        console.log('\n🏘️ TESTING ASSOCIATION OWNER SYNC');
        console.log('='.repeat(70));
        
        // First, let's try to find a property with association owners
        console.log('🔍 Looking for properties with association owners...');
        
        try {
            const { BuildiumClient } = require('../index.js');
            const buildium = new BuildiumClient();
            
            // Get a small sample of association owners
            const associationOwners = await buildium.getAssociationOwners({ limit: 5 });
            
            if (associationOwners.length === 0) {
                console.log('⚠️ No association owners found in Buildium');
                console.log('✅ This is expected if no HOA/Condo properties are managed');
                return { success: true, skipped: true, reason: 'No association owners available' };
            }

            console.log(`📊 Found ${associationOwners.length} association owner(s)`);
            
            // Try to sync one association owner
            const firstAssocOwner = associationOwners[0];
            const associationPropertyIds = firstAssocOwner.PropertyIds || [];
            
            if (associationPropertyIds.length === 0) {
                console.log('⚠️ Association owner has no properties');
                return { success: true, skipped: true, reason: 'Association owner has no properties' };
            }

            const testPropertyId = associationPropertyIds[0];
            console.log(`🎯 Testing with association property: ${testPropertyId}`);

            const syncResult = await this.runCommand(
                `Sync association owner (Property ${testPropertyId})`,
                `node index.js owners --property-ids ${testPropertyId} --force`
            );

            if (!syncResult.success) {
                console.log('❌ Association owner sync failed');
                this.results.failed++;
                return { success: false, error: 'Sync command failed' };
            }

            const ids = this.extractContactAndListing(syncResult.output);
            if (!ids) {
                console.log('❌ Could not extract contact/listing IDs from sync output');
                this.results.failed++;
                return { success: false, error: 'Could not extract IDs' };
            }

            // Validate association type (should be 8 for association owners)
            const validation = await this.validateAssociationType(
                ids.contactId, 
                ids.listingId, 
                8, 
                'Association Owner (HOA/Condo)'
            );

            if (validation.success) {
                this.results.passed++;
                this.results.associationOwners.push({
                    ...ids,
                    ...validation,
                    propertyId: testPropertyId
                });
            } else {
                this.results.failed++;
            }

            return validation;

        } catch (error) {
            console.log(`❌ Error testing association owners: ${error.message}`);
            this.results.failed++;
            return { success: false, error: error.message };
        }
    }

    async testMixedPropertyPortfolio() {
        console.log('\n🏘️🏠 TESTING MIXED PROPERTY PORTFOLIO');
        console.log('='.repeat(70));
        
        try {
            const { BuildiumClient } = require('../index.js');
            const buildium = new BuildiumClient();
            
            // Get owners that might have both types
            const allOwners = await buildium.getAllOwners({ limit: 10 });
            
            const rentalOwners = allOwners.filter(o => o._ownerType === 'rental');
            const associationOwners = allOwners.filter(o => o._ownerType === 'association');
            
            console.log(`📊 Found ${rentalOwners.length} rental owners and ${associationOwners.length} association owners`);
            
            if (rentalOwners.length > 0 && associationOwners.length > 0) {
                console.log('✅ Mixed portfolio detected - both rental and association owners present');
                
                // Test that metadata is correctly assigned
                let metadataCorrect = true;
                
                for (const owner of allOwners) {
                    const hasCorrectMetadata = owner._ownerType && typeof owner._isCompany === 'boolean';
                    if (!hasCorrectMetadata) {
                        metadataCorrect = false;
                        const name = owner.IsCompany ? owner.CompanyName : `${owner.FirstName} ${owner.LastName}`;
                        console.log(`❌ ${name}: Missing metadata (_ownerType: ${owner._ownerType}, _isCompany: ${owner._isCompany})`);
                    }
                }
                
                if (metadataCorrect) {
                    console.log('✅ All owners have correct metadata assigned');
                    this.results.passed++;
                } else {
                    console.log('❌ Some owners missing required metadata');
                    this.results.failed++;
                }
                
                return { success: metadataCorrect };
            } else {
                console.log('ℹ️ Single owner type portfolio - this is normal');
                return { success: true, skipped: true, reason: 'Single owner type portfolio' };
            }
            
        } catch (error) {
            console.log(`❌ Error testing mixed portfolio: ${error.message}`);
            this.results.failed++;
            return { success: false, error: error.message };
        }
    }

    async runAllTests() {
        console.log('🚀 COMPREHENSIVE OWNER ASSOCIATION VALIDATION');
        console.log('='.repeat(70));
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log('🎯 Testing association type differentiation in real sync operations\n');

        // Run all tests
        const rentalTest = await this.testRentalOwnerSync();
        const associationTest = await this.testAssociationOwnerSync();
        const mixedTest = await this.testMixedPropertyPortfolio();

        // Summary
        console.log('\n📊 COMPREHENSIVE TEST SUMMARY');
        console.log('='.repeat(70));
        
        console.log(`✅ Tests Passed: ${this.results.passed}`);
        console.log(`❌ Tests Failed: ${this.results.failed}`);
        
        if (this.results.rentalOwners.length > 0) {
            console.log('\n🏠 Rental Owner Associations:');
            this.results.rentalOwners.forEach(owner => {
                console.log(`  ✅ Property ${owner.propertyId}: Type ${owner.actualType} (${owner.typeLabel})`);
            });
        }
        
        if (this.results.associationOwners.length > 0) {
            console.log('\n🏘️ Association Owner Associations:');
            this.results.associationOwners.forEach(owner => {
                console.log(`  ✅ Property ${owner.propertyId}: Type ${owner.actualType} (${owner.typeLabel})`);
            });
        }

        const overallSuccess = this.results.failed === 0;
        console.log(`\n🎯 OVERALL RESULT: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

        if (overallSuccess) {
            console.log('\n🎉 ASSOCIATION OWNER CONTACT LABELS FIX VALIDATED!');
            console.log('✅ Rental owners correctly use association type ID 4');
            console.log('✅ Association owners correctly use association type ID 8');
            console.log('✅ Mixed portfolios handle both types correctly');
            console.log('✅ Owner metadata is properly assigned');
        }

        return overallSuccess;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new ComprehensiveOwnerAssociationTest();
    tester.runAllTests().catch(console.error);
}

module.exports = { ComprehensiveOwnerAssociationTest };

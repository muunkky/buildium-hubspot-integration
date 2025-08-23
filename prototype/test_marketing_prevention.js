/**
 * Test Marketing Contact Prevention
 * Verify that all contact transformation functions include hs_marketable_status: 'NON_MARKETABLE'
 */

const { IntegrationPrototype } = require('./index.js');

async function testMarketingContactPrevention() {
    console.log('🧪 Testing Marketing Contact Prevention...\n');
    
    const integration = new IntegrationPrototype(process.env.HUBSPOT_API_KEY, process.env.BUILDIUM_API_KEY);
    
    // Sample tenant data for testing
    const sampleTenant = {
        Id: 12345,
        FirstName: 'Test',
        LastName: 'Tenant',
        Email: 'test.tenant@example.com',
        PhoneNumbers: [{ Number: '555-123-4567' }],
        Address: {
            AddressLine1: '123 Test St',
            City: 'Test City',
            State: 'TS',
            PostalCode: '12345'
        },
        ContactType: 'Primary Tenant',
        LastModifiedDateTime: new Date().toISOString()
    };

    // Sample owner data for testing
    const sampleOwner = {
        Id: 67890,
        FirstName: 'Test',
        LastName: 'Owner',
        Email: 'test.owner@example.com',
        PhoneNumbers: [{ Number: '555-987-6543' }],
        PrimaryAddress: {
            AddressLine1: '456 Owner Ave',
            City: 'Owner City',
            State: 'OS',
            PostalCode: '67890'
        },
        IsCompany: false,
        LastModifiedDateTime: new Date().toISOString()
    };

    try {
        console.log('📋 Test 1: transformTenantToContact');
        const tenantContact = integration.transformer.transformTenantToContact(sampleTenant);
        const hasMarketableStatus1 = tenantContact.properties.hasOwnProperty('hs_marketable_status');
        const isNonMarketable1 = tenantContact.properties.hs_marketable_status === 'NON_MARKETABLE';
        
        console.log(`   ✅ Has hs_marketable_status: ${hasMarketableStatus1}`);
        console.log(`   ✅ Is NON_MARKETABLE: ${isNonMarketable1}`);
        console.log(`   📄 Value: ${tenantContact.properties.hs_marketable_status}\n`);

        console.log('📋 Test 2: transformTenantToContactSafeUpdate');
        const tenantContactSafe = integration.transformer.transformTenantToContactSafeUpdate(sampleTenant);
        const hasMarketableStatus2 = tenantContactSafe.properties.hasOwnProperty('hs_marketable_status');
        const isNonMarketable2 = tenantContactSafe.properties.hs_marketable_status === 'NON_MARKETABLE';
        
        console.log(`   ✅ Has hs_marketable_status: ${hasMarketableStatus2}`);
        console.log(`   ✅ Is NON_MARKETABLE: ${isNonMarketable2}`);
        console.log(`   📄 Value: ${tenantContactSafe.properties.hs_marketable_status}\n`);

        console.log('📋 Test 3: transformOwnerToContact');
        const ownerContact = integration.transformer.transformOwnerToContact(sampleOwner);
        const hasMarketableStatus3 = ownerContact.properties.hasOwnProperty('hs_marketable_status');
        const isNonMarketable3 = ownerContact.properties.hs_marketable_status === 'NON_MARKETABLE';
        
        console.log(`   ✅ Has hs_marketable_status: ${hasMarketableStatus3}`);
        console.log(`   ✅ Is NON_MARKETABLE: ${isNonMarketable3}`);
        console.log(`   📄 Value: ${ownerContact.properties.hs_marketable_status}\n`);

        // Summary
        const allTestsPassed = hasMarketableStatus1 && isNonMarketable1 && 
                              hasMarketableStatus2 && isNonMarketable2 && 
                              hasMarketableStatus3 && isNonMarketable3;

        console.log('🎯 SUMMARY:');
        console.log('===========');
        console.log(`transformTenantToContact: ${hasMarketableStatus1 && isNonMarketable1 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`transformTenantToContactSafeUpdate: ${hasMarketableStatus2 && isNonMarketable2 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`transformOwnerToContact: ${hasMarketableStatus3 && isNonMarketable3 ? '✅ PASS' : '❌ FAIL'}`);
        console.log('');
        console.log(`🎉 OVERALL RESULT: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
        console.log('');
        
        if (allTestsPassed) {
            console.log('💰 Marketing Contact Prevention: ACTIVE');
            console.log('🚫 No billing charges will be incurred');
            console.log('✅ All contacts will be created as NON_MARKETABLE');
        } else {
            console.log('⚠️ Warning: Some transformation functions missing marketing protection!');
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the test
testMarketingContactPrevention().catch(console.error);

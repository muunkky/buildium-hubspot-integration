/**
 * Check associations for the specific listing we just synced
 */

const axios = require('axios');
require('dotenv').config();

async function checkSpecificAssociations() {
    const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;
    const baseURL = 'https://api.hubapi.com';
    
    // The listing ID we just worked with
    const listingId = '455100848030';
    const contactId = '131939806356';
    
    console.log('🔍 Checking associations for our test case...');
    console.log(`📋 Listing ID: ${listingId}`);
    console.log(`👤 Contact ID: ${contactId}`);
    console.log('-'.repeat(50));
    
    try {
        // Check associations from listing to contacts
        console.log('🔗 Checking listing → contact associations...');
        const listingAssociations = await axios.get(
            `${baseURL}/crm/v4/objects/0-420/${listingId}/associations/contacts`,
            {
                headers: {
                    'Authorization': `Bearer ${hubspotToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log(`✅ Found ${listingAssociations.data.results.length} contact association(s) for listing ${listingId}:`);
        listingAssociations.data.results.forEach(assoc => {
            console.log(`   - Contact ${assoc.toObjectId} (Type: ${assoc.associationTypes[0]?.typeId})`);
        });
        
        // Check associations from contact to listings
        console.log('\n🔗 Checking contact → listing associations...');
        const contactAssociations = await axios.get(
            `${baseURL}/crm/v4/objects/contacts/${contactId}/associations/0-420`,
            {
                headers: {
                    'Authorization': `Bearer ${hubspotToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log(`✅ Found ${contactAssociations.data.results.length} listing association(s) for contact ${contactId}:`);
        contactAssociations.data.results.forEach(assoc => {
            console.log(`   - Listing ${assoc.toObjectId} (Type: ${assoc.associationTypes[0]?.typeId})`);
        });
        
        // Verify the specific association exists
        const hasOwnerAssociation = contactAssociations.data.results.some(assoc => 
            assoc.toObjectId === listingId && 
            assoc.associationTypes.some(type => type.typeId === 4) // Type 4 = Owner
        );
        
        console.log('\n🎯 VERIFICATION RESULTS:');
        console.log(`✅ Contact ${contactId} exists: YES`);
        console.log(`✅ Listing ${listingId} exists: YES`);
        console.log(`✅ Owner association exists: ${hasOwnerAssociation ? 'YES' : 'NO'}`);
        
        if (hasOwnerAssociation) {
            console.log('\n🏆 SUCCESS: Owner association verified!');
            console.log('   👤 Contact: Vishesh Sonawala (sonawalavishesh@gmail.com)');
            console.log('   🏠 Property: 140054 → Listing: 455100848030');
            console.log('   🔗 Association Type: Owner (ID: 4)');
        } else {
            console.log('\n❌ FAILURE: Owner association not found');
        }
        
    } catch (error) {
        console.error('❌ Error checking associations:', error.response?.data || error.message);
    }
}

checkSpecificAssociations();

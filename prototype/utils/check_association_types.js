const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function checkAssociationTypes() {
    try {
        console.log('🔍 Checking available association types for Contacts <-> Listings...');
        
        // Check Contact → Listing associations
        console.log('\n📋 Contact → Listing Association Types:');
        console.log('=' .repeat(60));
        
        const contactToListingResponse = await axios.get('https://api.hubapi.com/crm/v4/associations/0-1/0-420/labels', {
            headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        contactToListingResponse.data.results.forEach(assoc => {
            console.log(`ID: ${assoc.typeId} | Label: "${assoc.label}" | Category: ${assoc.category}`);
        });
        
        console.log(`Total contact → listing types: ${contactToListingResponse.data.results.length}`);
        
        // Check Listing → Contact associations (reverse direction)
        console.log('\n📋 Listing → Contact Association Types:');
        console.log('=' .repeat(60));
        
        const listingToContactResponse = await axios.get('https://api.hubapi.com/crm/v4/associations/0-420/0-1/labels', {
            headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        listingToContactResponse.data.results.forEach(assoc => {
            console.log(`ID: ${assoc.typeId} | Label: "${assoc.label}" | Category: ${assoc.category}`);
        });
        
        console.log(`Total listing → contact types: ${listingToContactResponse.data.results.length}`);
        
        // Compare bidirectional associations
        console.log('\n🔄 BIDIRECTIONAL ASSOCIATION MAPPING:');
        console.log('=' .repeat(60));
        
        contactToListingResponse.data.results.forEach(contactAssoc => {
            const reverseAssoc = listingToContactResponse.data.results.find(
                listingAssoc => listingAssoc.label === contactAssoc.label
            );
            
            if (reverseAssoc) {
                console.log(`"${contactAssoc.label}": Contact→Listing ID ${contactAssoc.typeId} ↔ Listing→Contact ID ${reverseAssoc.typeId}`);
            } else {
                console.log(`"${contactAssoc.label}": Contact→Listing ID ${contactAssoc.typeId} (no reverse found)`);
            }
        });
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

checkAssociationTypes();

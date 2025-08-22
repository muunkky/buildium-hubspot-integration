const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function checkAssociationTypes() {
    try {
        console.log('🔍 Checking available association types for Contacts <-> Listings...');
        
        const response = await axios.get('https://api.hubapi.com/crm/v4/associations/0-1/0-420/labels', {
            headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\n📋 Available Contact → Listing Association Types:');
        console.log('=' .repeat(60));
        
        response.data.results.forEach(assoc => {
            console.log(`ID: ${assoc.typeId} | Label: "${assoc.label}" | Category: ${assoc.category}`);
        });
        
        console.log(`\nTotal association types: ${response.data.results.length}`);
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

checkAssociationTypes();

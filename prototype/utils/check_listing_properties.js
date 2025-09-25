const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function checkListingProperties() {
    try {
        console.log('[SEARCH] Checking available Listing (0-420) properties...');
        
        const response = await axios.get('https://api.hubapi.com/crm/v3/properties/0-420', {
            headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\n[ITEM] Available Listing Properties:');
        console.log('=' .repeat(60));
        
        response.data.results
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(prop => {
                console.log(`${prop.name.padEnd(25)} | ${prop.type.padEnd(10)} | ${prop.label}`);
            });
            
        console.log(`\n[STATS] Total: ${response.data.results.length} properties`);
        
    } catch (error) {
        console.error('[FAIL] Error:', error.response?.data || error.message);
    }
}

checkListingProperties();

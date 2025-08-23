const axios = require('axios');

async function testDirectAPI() {
    const clientId = process.env.BUILDIUM_CLIENT_ID;
    const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        console.error('Missing Buildium credentials');
        return;
    }
    
    try {
        console.log('🔍 Testing direct Buildium API call...');
        
        const params = { 
            limit: 10, 
            offset: 0,
            propertyids: [140054]
        };
        
        console.log('📋 Request params:', params);
        
        const response = await axios.get('https://api.buildium.com/v1/rentals/units', {
            headers: {
                'x-buildium-client-id': clientId,
                'x-buildium-client-secret': clientSecret,
                'Content-Type': 'application/json'
            },
            params
        });
        
        console.log(`✅ API Response: ${response.data.length} units returned`);
        
        if (response.data.length > 0) {
            console.log('🏠 Sample units:');
            response.data.slice(0, 5).forEach((unit, i) => {
                console.log(`  ${i+1}. Unit ${unit.UnitNumber} (ID: ${unit.Id}) - Property: ${unit.PropertyId}`);
            });
            
            const property140054Units = response.data.filter(unit => unit.PropertyId === 140054);
            console.log(`🎯 Units actually from property 140054: ${property140054Units.length}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testDirectAPI();

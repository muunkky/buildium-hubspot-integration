require('dotenv').config();
const axios = require('axios');

async function checkBuildiumUnitIds() {
    try {
        const baseURL = process.env.BUILDIUM_BASE_URL || 'https://api.buildium.com/v1';
        const headers = {
            'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID,
            'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET,
            'Content-Type': 'application/json'
        };
        
        console.log('=== Checking Buildium Unit ID Types ===\n');
        
        // Get some tenants to see their lease data
        console.log('1. Checking tenant lease data for property IDs...');
        const tenantsResponse = await axios.get(`${baseURL}/leases/tenants`, {
            headers,
            params: { limit: 5 }
        });
        
        console.log(`Found ${tenantsResponse.data.length} tenants\n`);
        
        tenantsResponse.data.forEach((tenant, index) => {
            console.log(`Tenant ${index + 1}: ${tenant.FirstName} ${tenant.LastName}`);
            console.log(`  Email: ${tenant.Email}`);
            console.log(`  Tenant ID: ${tenant.Id} (type: ${typeof tenant.Id})`);
            
            if (tenant.Leases && tenant.Leases.length > 0) {
                tenant.Leases.forEach((lease, leaseIndex) => {
                    console.log(`  Lease ${leaseIndex + 1}:`);
                    console.log(`    Property ID: ${lease.PropertyId} (type: ${typeof lease.PropertyId})`);
                    if (lease.UnitId) {
                        console.log(`    Unit ID: ${lease.UnitId} (type: ${typeof lease.UnitId})`);
                    }
                });
            }
            console.log('');
        });
        
        // Also check a specific property to see its units
        console.log('2. Checking property details for unit structure...');
        try {
            const propertyResponse = await axios.get(`${baseURL}/rentals/57529`, {
                headers
            });
            
            console.log('Property 57529 details:');
            console.log(`  Name: ${propertyResponse.data.Name}`);
            console.log(`  Property ID: ${propertyResponse.data.Id} (type: ${typeof propertyResponse.data.Id})`);
            
            // Check if there are units listed
            if (propertyResponse.data.Units) {
                console.log(`  Units: ${propertyResponse.data.Units.length} units found`);
                propertyResponse.data.Units.forEach((unit, index) => {
                    console.log(`    Unit ${index + 1}: ID ${unit.Id} (type: ${typeof unit.Id}), Name: ${unit.UnitNumber || unit.Name}`);
                });
            } else if (propertyResponse.data.UnitNumber) {
                console.log(`  Single Unit: ${propertyResponse.data.UnitNumber}`);
            } else {
                console.log('  No specific unit structure found');
            }
            
        } catch (error) {
            console.log('Error fetching property details:', error.response?.data?.UserMessage || error.message);
        }
        
        // Check rentals endpoint for unit information
        console.log('\n3. Checking rentals endpoint for more unit data...');
        try {
            const rentalsResponse = await axios.get(`${baseURL}/rentals`, {
                headers,
                params: { limit: 5 }
            });
            
            console.log(`Found ${rentalsResponse.data.length} rental properties\n`);
            
            rentalsResponse.data.forEach((property, index) => {
                console.log(`Property ${index + 1}: ${property.Name}`);
                console.log(`  Property ID: ${property.Id} (type: ${typeof property.Id})`);
                if (property.UnitNumber) {
                    console.log(`  Unit Number: ${property.UnitNumber}`);
                }
                if (property.Units && property.Units.length > 0) {
                    console.log(`  Units: ${property.Units.length} units`);
                    property.Units.slice(0, 2).forEach((unit, unitIndex) => {
                        console.log(`    Unit ${unitIndex + 1}: ID ${unit.Id} (type: ${typeof unit.Id}), Number: ${unit.UnitNumber}`);
                    });
                }
                console.log('');
            });
            
        } catch (error) {
            console.log('Error fetching rentals:', error.response?.data?.UserMessage || error.message);
        }
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

checkBuildiumUnitIds();

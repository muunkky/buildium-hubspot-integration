const { HubSpotClient } = require('./index.js');
const axios = require('axios');

async function updateLeaseStatusProperty() {
    try {
        const hubspotClient = new HubSpotClient();
        
        console.log('🔧 Updating lease_status property to add "No Current Lease" option...');
        
        // Update the property to include the new option
        const response = await hubspotClient.makeRequestWithRetry(() =>
            axios.patch(`${hubspotClient.baseURL}/crm/v3/properties/0-420/lease_status`, {
                options: [
                    { label: "Active", value: "Active" },
                    { label: "Future", value: "Future" },
                    { label: "Past", value: "Past" },
                    { label: "Terminated", value: "Terminated" },
                    { label: "No Current Lease", value: "No Current Lease" }
                ]
            }, {
                headers: hubspotClient.getHeaders()
            }),
            3, 200, false
        );
        
        console.log('✅ Successfully updated lease_status property!');
        console.log('New options:', response.data.options.map(o => o.value).join(', '));
        
    } catch (error) {
        console.error('❌ Error updating property:', error.response?.data || error.message);
    }
}

updateLeaseStatusProperty();

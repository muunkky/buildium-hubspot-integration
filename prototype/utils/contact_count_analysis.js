/**
 * Get Total Contact Count in HubSpot
 * Compare with known Buildium data
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function getTotalContactCount() {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN;
    console.log('[STATS] Getting total contact count in HubSpot...\n');

    try {
        // Get total count by searching for all contacts
        const searchRequest = {
            properties: ['firstname', 'lastname', 'email'],
            limit: 100  // We just want the total count, not all records
        };

        const response = await axios.post(
            'https://api.hubapi.com/crm/v3/objects/contacts/search',
            searchRequest,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const totalCount = response.data.total;
        const results = response.data.results;
        
        console.log(` TOTAL CONTACTS IN HUBSPOT: ${totalCount}`);
        console.log(`[ITEM] Sample returned: ${results.length} contacts\n`);

        // Break down by marketing status
        console.log('[SEARCH] Getting marketing status breakdown...\n');
        
        // Count marketable contacts
        const marketableResponse = await axios.post(
            'https://api.hubapi.com/crm/v3/objects/contacts/search',
            {
                filterGroups: [{
                    filters: [{ propertyName: 'hs_marketable_status', operator: 'EQ', value: 'true' }]
                }],
                properties: ['hs_marketable_status'],
                limit: 1
            },
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
        );

        // Count non-marketable contacts  
        const nonMarketableResponse = await axios.post(
            'https://api.hubapi.com/crm/v3/objects/contacts/search',
            {
                filterGroups: [{
                    filters: [{ propertyName: 'hs_marketable_status', operator: 'EQ', value: 'false' }]
                }],
                properties: ['hs_marketable_status'],
                limit: 1
            },
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
        );

        const marketableCount = marketableResponse.data.total;
        const nonMarketableCount = nonMarketableResponse.data.total;
        
        console.log('[STATS] MARKETING STATUS BREAKDOWN:');
        console.log(`    Marketable (billing): ${marketableCount}`);
        console.log(`   [OK] Non-marketable (free): ${nonMarketableCount}`);
        console.log(`   [STATS] Total: ${marketableCount + nonMarketableCount}`);
        
        if (totalCount !== marketableCount + nonMarketableCount) {
            const unknown = totalCount - marketableCount - nonMarketableCount;
            console.log(`    Unknown/unset status: ${unknown}`);
        }

        console.log('\n COMPARISON WITH BUILDIUM DATA:');
        console.log('================================');
        console.log('Based on previous analysis:');
        console.log('   • Buildium Owners: 657');
        console.log('   • Buildium Units: ~several hundred (exact count varies)');
        console.log('   • Buildium Tenants: Unknown count');
        console.log('');
        console.log(`   [TARGET] HubSpot Total: ${totalCount} contacts`);
        
        if (totalCount > 1000) {
            console.log('    HubSpot has SIGNIFICANTLY MORE contacts than Buildium data');
            console.log('    This suggests most contacts are NOT from Buildium');
            console.log('   [TARGET] These are likely your real marketing leads/customers');
        } else if (totalCount > 700) {
            console.log('   [STATS] HubSpot has more contacts than just Buildium owners');
            console.log('    Mix of Buildium data + real marketing contacts');
        } else {
            console.log('   [STATS] Contact count is similar to Buildium data');
            console.log('    Most contacts might be from Buildium integration');
        }

        console.log('\n BILLING IMPACT:');
        console.log(`   • Current monthly cost: ~$${marketableCount * 0.50} (at ~$0.50 per marketable contact)`);
        console.log(`   • If all made non-marketable: $0`);
        console.log(`   • Potential savings: ~$${marketableCount * 0.50}/month`);

        return {
            total: totalCount,
            marketable: marketableCount,
            nonMarketable: nonMarketableCount
        };

    } catch (error) {
        console.error('[FAIL] Error getting contact count:', error.response?.data?.message || error.message);
        return null;
    }
}

getTotalContactCount();

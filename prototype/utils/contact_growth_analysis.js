/**
 * HubSpot Contact Growth Analysis
 * Shows how many contacts existed at different points in time
 */

require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function analyzeContactGrowth() {
    const apiKey = process.env.HUBSPOT_ACCESS_TOKEN;
    console.log('📈 Analyzing contact growth over time...\n');

    try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        console.log('🕐 Reference Times:');
        console.log(`   Now: ${now.toISOString()}`);
        console.log(`   1 day ago: ${oneDayAgo.toISOString()}`);
        console.log(`   1 week ago: ${oneWeekAgo.toISOString()}`);
        console.log(`   1 month ago: ${oneMonthAgo.toISOString()}\n`);

        // Count contacts created before different time periods
        const periods = [
            { name: '1 month ago', date: oneMonthAgo },
            { name: '1 week ago', date: oneWeekAgo },
            { name: '1 day ago', date: oneDayAgo },
            { name: 'now', date: now }
        ];

        const results = {};

        for (const period of periods) {
            try {
                const searchRequest = {
                    filterGroups: [{
                        filters: [{
                            propertyName: 'createdate',
                            operator: 'LT',
                            value: period.date.getTime().toString()
                        }]
                    }],
                    properties: ['createdate'],
                    limit: 1  // We just want the count
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

                results[period.name] = response.data.total;
                console.log(`📊 Contacts that existed ${period.name}: ${response.data.total}`);

            } catch (error) {
                console.error(`❌ Error counting contacts for ${period.name}:`, error.message);
                results[period.name] = 'Error';
            }
        }

        // Get total current count
        const totalResponse = await axios.post(
            'https://api.hubapi.com/crm/v3/objects/contacts/search',
            { properties: ['createdate'], limit: 1 },
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
        );
        const currentTotal = totalResponse.data.total;
        results['current total'] = currentTotal;

        console.log('\n📈 GROWTH ANALYSIS:');
        console.log('==================');
        
        if (results['1 month ago'] !== 'Error' && results['1 week ago'] !== 'Error' && results['1 day ago'] !== 'Error') {
            const addedLastMonth = currentTotal - results['1 month ago'];
            const addedLastWeek = currentTotal - results['1 week ago'];
            const addedLastDay = currentTotal - results['1 day ago'];

            console.log(`📊 Current Total: ${currentTotal}`);
            console.log(`📈 Added in last month: ${addedLastMonth}`);
            console.log(`📈 Added in last week: ${addedLastWeek}`);
            console.log(`📈 Added in last day: ${addedLastDay}`);

            console.log('\n🎯 GROWTH INSIGHTS:');
            if (addedLastDay > 100) {
                console.log(`⚡ HIGH activity: ${addedLastDay} contacts added in last 24 hours`);
                console.log('   This suggests a recent bulk import or sync');
            } else if (addedLastDay > 10) {
                console.log(`📊 MODERATE activity: ${addedLastDay} contacts added in last 24 hours`);
            } else {
                console.log(`📊 LOW activity: ${addedLastDay} contacts added in last 24 hours`);
            }

            if (addedLastWeek > 500) {
                console.log(`⚡ MAJOR import: ${addedLastWeek} contacts added in last week`);
                console.log('   This likely includes bulk data import');
            }

            // Daily average
            const dailyAverage = Math.round(addedLastMonth / 30);
            console.log(`📊 Average daily additions (last month): ${dailyAverage} contacts/day`);
        }

        // Also check contacts modified recently (not just created)
        console.log('\n🔄 RECENT MODIFICATIONS:');
        console.log('========================');

        const modifiedLastDay = await getContactsModifiedSince(apiKey, oneDayAgo);
        const modifiedLastWeek = await getContactsModifiedSince(apiKey, oneWeekAgo);

        console.log(`🔄 Modified in last day: ${modifiedLastDay}`);
        console.log(`🔄 Modified in last week: ${modifiedLastWeek}`);

        if (modifiedLastDay > 1000) {
            console.log('⚡ BULK MODIFICATION detected in last 24 hours');
            console.log('   This suggests a recent sync or mass update operation');
        }

        return results;

    } catch (error) {
        console.error('❌ Error analyzing contact growth:', error.response?.data?.message || error.message);
        return null;
    }
}

async function getContactsModifiedSince(apiKey, sinceDate) {
    try {
        const searchRequest = {
            filterGroups: [{
                filters: [{
                    propertyName: 'lastmodifieddate',
                    operator: 'GTE',
                    value: sinceDate.getTime().toString()
                }]
            }],
            properties: ['lastmodifieddate'],
            limit: 1
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

        return response.data.total;
    } catch (error) {
        return 'Error';
    }
}

analyzeContactGrowth();

require('dotenv').config({ path: '../.env' });
const { BuildiumClient } = require('../index.js');

/**
 * Test duplicate owner handling and field mapping
 */
async function testOwnerDuplicatesAndFields() {
    console.log('🧪 Testing Owner Duplicates and Field Mapping');
    console.log('=' .repeat(60));
    
    const buildium = new BuildiumClient();
    
    try {
        // Get sample owners to analyze
        console.log('\n📊 Analyzing owner data structure and duplicates...');
        const sampleOwners = await buildium.getRentalOwners({ limit: 50 });
        
        console.log(`Sample size: ${sampleOwners.length} owners`);
        
        // 1. Check for duplicate IDs
        const ownerIds = sampleOwners.map(owner => owner.Id);
        const uniqueIds = [...new Set(ownerIds)];
        const duplicateIds = ownerIds.filter((id, index) => ownerIds.indexOf(id) !== index);
        
        console.log(`\n🆔 ID Analysis:`);
        console.log(`  Unique owner IDs: ${uniqueIds.length}`);
        console.log(`  Duplicate IDs: ${duplicateIds.length}`);
        
        // 2. Check for duplicate emails
        const ownersWithEmail = sampleOwners.filter(owner => owner.Email);
        const emails = ownersWithEmail.map(owner => owner.Email.toLowerCase());
        const uniqueEmails = [...new Set(emails)];
        const duplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index);
        
        console.log(`\n📧 Email Analysis:`);
        console.log(`  Owners with emails: ${ownersWithEmail.length}`);
        console.log(`  Unique emails: ${uniqueEmails.length}`);
        console.log(`  Duplicate emails: ${duplicateEmails.length}`);
        
        if (duplicateEmails.length > 0) {
            console.log('⚠️ Duplicate emails found:');
            [...new Set(duplicateEmails)].forEach(email => {
                const duplicates = sampleOwners.filter(owner => 
                    owner.Email && owner.Email.toLowerCase() === email
                );
                console.log(`  📧 "${email}":`);
                duplicates.forEach(owner => {
                    const name = owner.IsCompany ? owner.CompanyName : `${owner.FirstName} ${owner.LastName}`;
                    console.log(`    - ${name} (ID: ${owner.Id}, Type: ${owner.IsCompany ? 'Company' : 'Individual'})`);
                });
            });
        }
        
        // 3. Analyze all available fields
        console.log(`\n📋 Field Analysis:`);
        const allFields = new Set();
        const fieldStats = {};
        
        sampleOwners.forEach(owner => {
            Object.keys(owner).forEach(field => {
                allFields.add(field);
                if (!fieldStats[field]) {
                    fieldStats[field] = { present: 0, values: new Set() };
                }
                if (owner[field] !== null && owner[field] !== undefined && owner[field] !== '') {
                    fieldStats[field].present++;
                    // Store sample values for analysis
                    if (fieldStats[field].values.size < 3) {
                        fieldStats[field].values.add(String(owner[field]).substring(0, 50));
                    }
                }
            });
        });
        
        console.log(`  Total fields available: ${allFields.size}`);
        console.log(`  Field coverage:`);
        
        Object.entries(fieldStats)
            .sort((a, b) => b[1].present - a[1].present)
            .forEach(([field, stats]) => {
                const percentage = ((stats.present / sampleOwners.length) * 100).toFixed(1);
                const samples = Array.from(stats.values).join(', ');
                console.log(`    ${field}: ${stats.present}/${sampleOwners.length} (${percentage}%) - ${samples}`);
            });
        
        // 4. Check individual vs company breakdown
        const individuals = sampleOwners.filter(owner => !owner.IsCompany);
        const companies = sampleOwners.filter(owner => owner.IsCompany);
        
        console.log(`\n👥 Owner Type Breakdown:`);
        console.log(`  Individuals: ${individuals.length} (${((individuals.length / sampleOwners.length) * 100).toFixed(1)}%)`);
        console.log(`  Companies: ${companies.length} (${((companies.length / sampleOwners.length) * 100).toFixed(1)}%)`);
        
        // 5. Show sample individual and company records
        if (individuals.length > 0) {
            console.log(`\n👤 Sample Individual Owner:`);
            const sampleIndividual = individuals[0];
            Object.entries(sampleIndividual).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    console.log(`    ${key}: ${value}`);
                }
            });
        }
        
        if (companies.length > 0) {
            console.log(`\n🏢 Sample Company Owner:`);
            const sampleCompany = companies[0];
            Object.entries(sampleCompany).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    console.log(`    ${key}: ${value}`);
                }
            });
        }
        
        return {
            totalOwners: sampleOwners.length,
            duplicateIds: duplicateIds.length,
            duplicateEmails: duplicateEmails.length,
            individuals: individuals.length,
            companies: companies.length,
            availableFields: Array.from(allFields)
        };
        
    } catch (error) {
        console.error('❌ Error analyzing owners:', error.message);
        return null;
    }
}

// Run the analysis
testOwnerDuplicatesAndFields();

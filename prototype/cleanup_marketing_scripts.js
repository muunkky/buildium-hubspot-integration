/**
 * Cleanup Script: Remove Marketing Contact Investigation Files
 * 
 * This script removes the temporary files created during the marketing contact
 * investigation and troubleshooting session.
 */

const fs = require('fs');
const path = require('path');

// Files to remove (created during marketing contact investigation)
const filesToRemove = [
    // Marketing analysis scripts
    'utils/marketing_audit.js',
    'utils/analyze_contact_sources.js',
    'utils/contact_growth_analysis.js',
    'utils/analyze_weekly_import_sources.js',
    
    // Verification and update scripts
    'utils/verify_ticket_handler_creation.js',
    'utils/update_all_ticket_handler_contacts.js',
    'utils/update_all_ticket_handler_contacts_clean.js',
    'utils/verify_updates.js',
    'utils/verify_specific_contacts.js',
    'utils/test_marketable_values.js',
    
    // Any JSON result files that might exist
    'utils/contact_sources_analysis_*.json',
    'utils/ticket_handler_contacts_*.json',
    'utils/verify_*_results.json',
    'utils/update_*_results.json'
];

// Additional patterns to check for
const logFiles = [
    'marketing_*.log',
    'contact_*.log',
    'verify_*.log',
    'update_*.log'
];

console.log('🧹 Cleaning up marketing contact investigation files...\n');

let removedCount = 0;
let notFoundCount = 0;

// Remove specific files
for (const file of filesToRemove) {
    const fullPath = path.join(__dirname, file);
    
    try {
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`✅ Removed: ${file}`);
            removedCount++;
        } else {
            console.log(`⚪ Not found: ${file}`);
            notFoundCount++;
        }
    } catch (error) {
        console.error(`❌ Error removing ${file}:`, error.message);
    }
}

// Check for and remove log files and JSON result files
const checkDirectories = ['utils', 'scripts', '.'];

for (const dir of checkDirectories) {
    const dirPath = path.join(__dirname, dir);
    
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            // Check for marketing-related temporary files
            if (file.includes('marketing_') || 
                file.includes('contact_growth_') ||
                file.includes('verify_ticket_handler_') ||
                file.includes('update_all_ticket_handler_') ||
                file.includes('analyze_contact_sources_') ||
                file.includes('analyze_weekly_import_') ||
                (file.endsWith('.json') && (
                    file.includes('marketing_') ||
                    file.includes('contact_sources_') ||
                    file.includes('ticket_handler_') ||
                    file.includes('verify_') ||
                    file.includes('update_')
                ))
            ) {
                const fullPath = path.join(dirPath, file);
                try {
                    fs.unlinkSync(fullPath);
                    console.log(`✅ Removed temp file: ${dir}/${file}`);
                    removedCount++;
                } catch (error) {
                    console.error(`❌ Error removing ${dir}/${file}:`, error.message);
                }
            }
        }
    }
}

console.log('\n' + '='.repeat(50));
console.log('CLEANUP SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Files removed: ${removedCount}`);
console.log(`⚪ Files not found: ${notFoundCount}`);

console.log('\n📝 Files that should remain:');
console.log('✓ Core integration files (index.js, package.json, etc.)');
console.log('✓ Original utility scripts (for actual Buildium integration)');
console.log('✓ Test files for the main integration');
console.log('✓ .env and configuration files');

console.log('\n🎯 The main solution is now in:');
console.log('   utils/marketing_status_workflow_solution.js');
console.log('   docs/workflow-setup-guide.md');

console.log('\n✨ Cleanup complete!');

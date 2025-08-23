/**
 * LEASE-CENTRIC SYNC - READY TO RUN
 * Complete implementation with real API integration
 */

const { LeaseCentricSyncManager } = require('./LeaseCentricSyncManager.js');
require('dotenv').config();

async function runLeaseCentricSync() {
    console.log('🚀 LEASE-CENTRIC SYNC - FULL IMPLEMENTATION');
    console.log('='.repeat(70));
    console.log(`📅 ${new Date().toLocaleString()}`);
    console.log('🎯 Complete workflow: Buildium leases → HubSpot listings\n');

    try {
        const syncManager = new LeaseCentricSyncManager();
        
        // Parse command line arguments for force and dry run
        const args = process.argv.slice(2);
        const dryRun = args.includes('--dry-run') || process.env.DRY_RUN === 'true';
        const force = args.includes('--force');
        
        // Parse limit flag
        let limit = null;
        const limitIndex = args.findIndex(arg => arg === '--limit');
        if (limitIndex !== -1 && args[limitIndex + 1]) {
            limit = parseInt(args[limitIndex + 1]);
            if (isNaN(limit) || limit <= 0) {
                console.error('❌ --limit must be a positive number');
                process.exit(1);
            }
        }
        
        if (dryRun) {
            console.log('🔄 DRY RUN MODE - Preview only, no actual changes');
        }
        if (force) {
            console.log('⚡ FORCE MODE - Will update existing listings with new lease data');
        }
        if (limit) {
            console.log(`🔢 LIMIT MODE - Process until ${limit} successful operations`);
        }

        const stats = await syncManager.syncLeases(dryRun, force, 7, 50, limit);
        
        console.log('\n🎉 SYNC SUMMARY');
        console.log('='.repeat(30));
        console.log(`📊 Leases processed: ${stats.leasesChecked}`);
        console.log(`✅ Listings created: ${stats.listingsCreated}`);
        console.log(`🔄 Listings updated: ${stats.listingsUpdated}`);
        console.log(`⏭️  Listings skipped: ${stats.listingsSkipped}`);
        console.log(`❌ Errors: ${stats.errors || 0}`);
        
        if (stats.leasesChecked > 0) {
            const processed = stats.listingsCreated + stats.listingsUpdated + stats.listingsSkipped;
            const efficiency = (processed / stats.leasesChecked * 100).toFixed(1);
            console.log(`⚡ Efficiency: ${efficiency}% of leases processed`);
        }

        if (dryRun) {
            console.log('\n💡 This was a DRY RUN. Remove --dry-run to actually create/update listings.');
        }

    } catch (error) {
        console.error('\n❌ SYNC FAILED:', error.message);
        if (error.response?.status === 401) {
            console.error('🔑 Check your API credentials in .env file');
        }
        process.exit(1);
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log('🔧 LEASE-CENTRIC SYNC USAGE');
        console.log('============================');
        console.log('node lease_centric_sync.js [options]');
        console.log('');
        console.log('Options:');
        console.log('  --dry-run        - Preview mode (no actual changes)');
        console.log('  --force          - Update existing listings with new lease data');
        console.log('  --help, -h       - Show this help message');
        console.log('');
        console.log('Environment variables:');
        console.log('  DRY_RUN=true     - Same as --dry-run flag');
        console.log('');
        console.log('Examples:');
        console.log('  node lease_centric_sync.js --dry-run       # Safe preview');
        console.log('  node lease_centric_sync.js                 # Live sync (skip existing)');
        console.log('  node lease_centric_sync.js --force         # Live sync (update existing)');
        console.log('  node lease_centric_sync.js --dry-run --force # Preview force mode');
        return;
    }

    await runLeaseCentricSync();
}

if (require.main === module) {
    main();
}

module.exports = { runLeaseCentricSync };

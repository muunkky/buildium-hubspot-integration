#!/usr/bin/env node

/**
 * TENANT LIFECYCLE CLI
 * Command-line interface for managing tenant association transitions
 */

const TenantLifecycleManager = require('./TenantLifecycleManager.js');

async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const help = args.includes('--help') || args.includes('-h');

    if (help) {
        console.log(`
🔄 TENANT LIFECYCLE MANAGER
========================

Automatically updates tenant associations based on lease status changes:
- Future → Active (when lease start date is reached)
- Active → Inactive (when lease ends or is terminated)
- Future → Inactive (when future lease is cancelled)

Usage:
  node tenant_lifecycle.js [options]

Options:
  --dry-run    Show what would be changed without making updates
  --help, -h   Show this help message

Examples:
  node tenant_lifecycle.js --dry-run     # Preview changes
  node tenant_lifecycle.js              # Apply changes
        `);
        return;
    }

    try {
        console.log('🔄 TENANT LIFECYCLE MANAGEMENT SYSTEM');
        console.log('=' .repeat(60));
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log(`🎯 Mode: ${dryRun ? 'DRY RUN - Preview only' : 'LIVE - Will make changes'}`);
        console.log('');

        const manager = new TenantLifecycleManager();
        const stats = await manager.updateTenantAssociations(dryRun);

        console.log('\n🎉 LIFECYCLE MANAGEMENT COMPLETE');
        console.log('=' .repeat(40));
        
        const totalUpdates = stats.futureToActive + stats.activeToInactive + stats.futureToInactive;
        if (totalUpdates === 0) {
            console.log('✨ All tenant associations are up to date!');
        } else {
            console.log(`📊 Total transitions: ${totalUpdates}`);
            if (dryRun) {
                console.log('💡 Run without --dry-run to apply these changes');
            }
        }

        if (stats.errors > 0) {
            console.log(`⚠️  Encountered ${stats.errors} errors - check logs above`);
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ LIFECYCLE MANAGEMENT FAILED');
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error.message);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error.message);
    process.exit(1);
});

main();

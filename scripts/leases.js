#!/usr/bin/env node
const { spawn } = require('child_process');

const rawArgs = process.argv.slice(2);
let dryRun = false;
let force = false;
let limit = null;
let unitId = null;
const passthrough = [];

for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--dry-run') {
        dryRun = true;
    } else if (arg.startsWith('--dry-run=')) {
        const value = arg.split('=', 1)[1];
        dryRun = value !== 'false' && value !== '0';
    } else if (arg === '--limit') {
        if (i + 1 < rawArgs.length) {
            limit = rawArgs[i + 1];
            i += 1;
        }
    } else if (arg.startsWith('--limit=')) {
        limit = arg.split('=', 1)[1];
    } else if (arg === '--unit-id') {
        if (i + 1 < rawArgs.length) {
            unitId = rawArgs[i + 1];
            i += 1;
        }
    } else if (arg.startsWith('--unit-id=')) {
        unitId = arg.split('=', 1)[1];
    } else if (arg === '--force' || arg === '--force=true' || arg === '--force=1') {
        force = true;
    } else if (/^\d+$/.test(arg) && limit == null) {
        limit = arg;
    } else {
        passthrough.push(arg);
    }
}

if (limit == null && process.env.npm_config_limit) {
    limit = process.env.npm_config_limit;
}
if (!dryRun && process.env.npm_config_dry_run === 'true') {
    dryRun = true;
}
if (!force && process.env.npm_config_force === 'true') {
    force = true;
}
if (!unitId && process.env.npm_config_unit_id) {
    unitId = process.env.npm_config_unit_id;
}

const finalArgs = ['leases'];
if (dryRun) {
    finalArgs.push('--dry-run');
}
if (force) {
    finalArgs.push('--force');
}
if (limit != null) {
    finalArgs.push('--limit', String(limit));
}
if (unitId) {
    finalArgs.push('--unit-id', unitId);
}
finalArgs.push(...passthrough);

const child = spawn(process.execPath, ['prototype/index.js', ...finalArgs], { stdio: 'inherit' });
child.on('exit', (code) => {
    process.exit(code);
});

#!/usr/bin/env node
// Wrapper to normalize npm CLI arguments so limit/dry-run flags survive before we hand
// control to the lease-centric sync entrypoint. This version also captures a run log
// per invocation and performs simple rotation (gzip older logs) and retention cleanup.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Config: adjust retention/rotation here
const LOG_DIR = path.join(__dirname, '..', 'log', 'sync');
const COMPRESS_AFTER_DAYS = 7; // compress logs older than this
const DELETE_AFTER_DAYS = 30; // delete logs older than this

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

// Test-only helper: create a fake log then run rotation/cleanup without spawning child.
if (passthrough.includes('--no-spawn-test') || process.env.NO_SPAWN_TEST === '1') {
    // Create the three artifacts using the same naming convention used for real runs.
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const parts = ['sync_leases', ts];
    if (dryRun) parts.push('dry');
    if (force) parts.push('force');
    if (limit != null) parts.push(`limit-${limit}`);
    if (unitId) parts.push(`unit-${unitId}`);
    const base = parts.join('_');

    const rawPath = path.join(LOG_DIR, `${base}.raw.log`);
    const sanitizedPath = path.join(LOG_DIR, `${base}.sanitized.log`);
    const jsonlPath = path.join(LOG_DIR, `${base}.jsonl`);

    const sampleLines = [
        `TEST RUN ${new Date().toISOString()}`,
        `Command: node prototype/index.js ${finalArgs.join(' ')}`,
        'Sample stdout line: tenant@example.com created',
        'Sample stderr line: failed to fetch unit 123-456-7890'
    ];

    fs.writeFileSync(rawPath, sampleLines.join('\n') + '\n');
    // apply sanitizer to sample output
    const sanitizeLineLocal = (ln) => {
        return ln
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
            .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g, '[REDACTED_PHONE]')
            .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
    };
    fs.writeFileSync(sanitizedPath, sampleLines.map(sanitizeLineLocal).join('\n') + '\n');

    const jsonLines = [];
    sampleLines.forEach((ln, i) => {
        const stream = i >= 2 && ln.startsWith('Sample stderr') ? 'stderr' : 'stdout';
        jsonLines.push(JSON.stringify({ ts: new Date().toISOString(), stream, message: ln }));
    });
    fs.writeFileSync(jsonlPath, jsonLines.join('\n') + '\n');

    console.log(`Wrote test artifacts:\n  ${rawPath}\n  ${sanitizedPath}\n  ${jsonlPath}`);
    try { rotateAndCleanupLogs(); } catch (e) { console.error('cleanup failed', e && e.message ? e.message : e); }
    process.exit(0);
}

// Ensure log dir exists
try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (err) {
    // ignore
}

// Build a descriptive filename
function makeLogFileName() {
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const parts = ['sync_leases', ts];
    if (dryRun) parts.push('dry');
    if (force) parts.push('force');
    if (limit != null) parts.push(`limit-${limit}`);
    if (unitId) parts.push(`unit-${unitId}`);
    return parts.join('_') + '.log';
}

const logFileName = path.join(LOG_DIR, makeLogFileName());

// Start child and tee output to both terminal and log file
const child = spawn(process.execPath, ['prototype/index.js', ...finalArgs], { stdio: ['ignore', 'pipe', 'pipe'] });

// Prepare three artifacts: raw, sanitized, and jsonl
const baseName = path.basename(logFileName, '.log');
const rawPath = path.join(LOG_DIR, `${baseName}.raw.log`);
const sanitizedPath = path.join(LOG_DIR, `${baseName}.sanitized.log`);
const jsonlPath = path.join(LOG_DIR, `${baseName}.jsonl`);

const rawStream = fs.createWriteStream(rawPath, { flags: 'a' });
const sanitizedStream = fs.createWriteStream(sanitizedPath, { flags: 'a' });
const jsonlStream = fs.createWriteStream(jsonlPath, { flags: 'a' });

// Simple sanitizer: redact emails, phones, and credit-card-like sequences.
function sanitizeLine(line) {
    if (!line) return line;
    let s = String(line);
    // emails
    s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
    // phones (simple patterns)
    s = s.replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g, '[REDACTED_PHONE]');
    // credit-card-ish
    s = s.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[REDACTED_CC]');
    // basic SSN-ish
    s = s.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
    return s;
}

// Write header metadata to artifacts
const header = `Run started: ${new Date().toISOString()}\nCommand: node prototype/index.js ${finalArgs.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')}\n\n`;
rawStream.write(header);
sanitizedStream.write(header.replace(/Command:.+\n/, 'Command: (sanitized)\n'));
jsonlStream.write('');

child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    const text = chunk.toString();
    rawStream.write(text);
    sanitizedStream.write(sanitizeLine(text));
    // Emit JSON lines per newline
    text.split(/\r?\n/).forEach((line) => {
        if (!line) return;
        const ev = { ts: new Date().toISOString(), stream: 'stdout', message: line };
        jsonlStream.write(JSON.stringify(ev) + '\n');
    });
});
child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    const text = chunk.toString();
    rawStream.write(text);
    sanitizedStream.write(sanitizeLine(text));
    text.split(/\r?\n/).forEach((line) => {
        if (!line) return;
        const ev = { ts: new Date().toISOString(), stream: 'stderr', message: line };
        jsonlStream.write(JSON.stringify(ev) + '\n');
    });
});

child.on('exit', (code, signal) => {
    const endedAt = new Date().toISOString();
    const footer = `\nRun ended: ${endedAt}\nExit code: ${code}\nSignal: ${signal || 'none'}\n`;
    try { rawStream.write(footer); } catch (e) {}
    try { sanitizedStream.write(footer); } catch (e) {}
    try { jsonlStream.write(JSON.stringify({ ts: endedAt, event: 'exit', code: code, signal: signal || null }) + '\n'); } catch (e) {}

    // Close streams
    rawStream.end(() => {});
    sanitizedStream.end(() => {});
    jsonlStream.end(() => {
        // After artifacts closed, run cleanup/rotation in background
        try {
            rotateAndCleanupLogs();
        } catch (err) {
            console.error('Log rotation/cleanup failed:', err && err.message ? err.message : err);
        }
        process.exit(typeof code === 'number' ? code : 0);
    });
});

child.on('error', (err) => {
    const msg = `\nProcess spawn error: ${err.message}\n`;
    try { rawStream.write(msg); } catch (e) {}
    try { sanitizedStream.write(sanitizeLine(msg)); } catch (e) {}
    try { jsonlStream.write(JSON.stringify({ ts: new Date().toISOString(), event: 'spawn_error', message: err.message }) + '\n'); } catch (e) {}
    rawStream.end(() => {});
    sanitizedStream.end(() => {});
    jsonlStream.end(() => process.exit(1));
});

// Rotation/cleanup: compress older logs and delete very old
function rotateAndCleanupLogs() {
    const files = fs.readdirSync(LOG_DIR);
    const now = Date.now();
    const compressAfter = COMPRESS_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const deleteAfter = DELETE_AFTER_DAYS * 24 * 60 * 60 * 1000;

    files.forEach((file) => {
        const full = path.join(LOG_DIR, file);
        try {
            const stat = fs.statSync(full);
            if (!stat.isFile()) return;

            const age = now - stat.mtimeMs;

            // Skip already-compressed files
            if (file.endsWith('.gz')) {
                // Delete gz files older than deleteAfter
                if (age > deleteAfter) {
                    fs.unlinkSync(full);
                }
                return;
            }

            if (age > deleteAfter) {
                fs.unlinkSync(full);
                return;
            }

            if (age > compressAfter) {
                // compress to .gz and remove original
                const source = fs.createReadStream(full);
                const dest = fs.createWriteStream(full + '.gz');
                const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });
                source.pipe(gzip).pipe(dest);
                dest.on('finish', () => {
                    try { fs.unlinkSync(full); } catch (e) { /* ignore */ }
                });
            }
        } catch (err) {
            // ignore individual file errors
        }
    });
}

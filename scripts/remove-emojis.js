// Simple emoji remover/fixer
// Replaces emoji glyphs in source files with configurable plain-text equivalents or removes them.
// Usage: node scripts/remove-emojis.js [path] [--inplace] [--keep-docs]

const fs = require('fs');
const path = require('path');

const root = process.argv[2] || '.';
const inPlace = process.argv.includes('--inplace');
const keepDocs = process.argv.includes('--keep-docs');

const exclude = ['node_modules', '.git', 'log', 'logs', '.github'];
if (keepDocs) {
  // keep docs when requested
  // note: keepDocs=true means we should not modify docs; so do not add 'docs' to excludes
} else {
  // by default we do not touch docs during in-place removal
  // but they are allowed to be scanned in dry-run; no-op here
}

// Regex matching most emoji pictographs and common symbols
const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u2600-\u27BF]/gu;

// A small mapping of friendly replacements for common emojis used in the repo
const replacements = {
  '': '', // remove
  '[OK]': '[OK]',
  '[FAIL]': '[FAIL]',
  '[WARN]️': '[WARN]',
  '[WARN]': '[WARN]',
  '[SEARCH]': '[SEARCH]',
  '[ITEM]': '[ITEM]',
  '[STATS]': '[STATS]',
  '[RETRY]': '[RETRY]',
  '[FAST]': '[FAST]',
  '[SKIP]️': '[SKIP]',
  '[SKIP]': '[SKIP]',
  '[DATE]': '[DATE]',
  '[LIMIT]': '[LIMIT]',
  '[TEST]': '[TEST]',
  '[TARGET]': '[TARGET]',
  '[TOOL]': '[TOOL]',
  '[COMPLETE]': '[COMPLETE]',
  '[DURATION]️': '[DURATION]',
  '[DURATION]': '[DURATION]'
};

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    // compute first path segment relative to root
  const rel = path.relative(root, full);
  const parts = rel.split(path.sep);
  if (parts.some(p => exclude.includes(p))) continue;
    if (e.isDirectory()) {
      walk(full);
    } else {
      if (!/\.(js|ts|json|md|txt|log|jsx|html|py)$/i.test(e.name)) continue;
      try {
        let content = fs.readFileSync(full, 'utf8');
        if (!emojiRegex.test(content)) continue; // skip files with no emojis
        const newContent = content.replace(emojiRegex, (m) => replacements[m] !== undefined ? replacements[m] : '');
        if (inPlace) {
          fs.writeFileSync(full, newContent, 'utf8');
          console.log(`Patched ${full}`);
        } else {
          console.log(`Would patch ${full} (run with --inplace to modify)`);
        }
      } catch (err) {
        // ignore binary/unreadable files
        continue;
      }
      // continue scanning other files
    }
  }
}

console.log(`Scanning ${root} to remove emojis. inPlace=${inPlace} keepDocs=${keepDocs}`);
walk(root);
console.log('Done.');

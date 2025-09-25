// Lightweight emoji finder
// Scans files under the repo (default: .) for emoji characters and prints matches.
// Usage: node scripts/find-emojis.js [path]

const fs = require('fs');
const path = require('path');

const root = process.argv[2] || '.';
// Exclude node_modules, .git, and log directories by default
const exclude = ['node_modules', '.git', 'log', 'logs', '.github'];

// Emoji regex using Unicode property (works in Node 12+ with u flag).
// This is a pragmatic regex covering most pictographs and symbols.
const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u2600-\u27BF]/gu;

let totalMatches = 0;

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
      // Only scan text-like files
      if (!/\.(js|ts|json|md|txt|log|jsx|html|py)$/i.test(e.name)) continue;
      try {
        const content = fs.readFileSync(full, 'utf8');
        const lines = content.split(/\r?\n/);
        lines.forEach((line, idx) => {
          const matches = line.match(emojiRegex);
          if (matches && matches.length) {
            totalMatches += matches.length;
            console.log(`${full}:${idx+1}: ${matches.join(' ')}  --> ${line.trim()}`);
          }
        });
      } catch (err) {
        // binary or unreadable
      }
    }
  }
}

console.log(`Scanning ${root} for emojis (excluding ${exclude.join(', ')})...`);
walk(root);
console.log(`Done. Found ${totalMatches} emoji glyphs.`);

if (totalMatches > 0) process.exitCode = 2;

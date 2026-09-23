const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.includes('node_modules')) walk(fullPath, callback);
    } else if (entry.name === 'route.ts') {
      callback(fullPath);
    }
  }
}

const apiPath = path.join(__dirname, '..', 'apps/web/src/app/api');
let updated = 0;
let skipped = 0;

walk(apiPath, (file) => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes("export const dynamic")) {
    skipped++;
    return;
  }

  // Find last import line
  const lines = content.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) lastImport = i;
  }

  // Insert after last import
  const insertIdx = lastImport + 1;
  lines.splice(insertIdx, 0, "", "export const dynamic = 'force-dynamic';", "");
  fs.writeFileSync(file, lines.join('\n'));
  updated++;
});

console.log(`Updated: ${updated}, Skipped: ${skipped}`);

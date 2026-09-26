const fs = require('fs');
const code = fs.readFileSync('apps/web/src/app/dashboard/media/page.tsx', 'utf8');
const lines = code.split('\n');
let depth = 0;
const stack = [];
let inS = false, sc = '';
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (inS) { if (c === '\\') { j++; continue; } if (c === sc) inS = false; continue; }
    if (c === '"' || c === "'" || c === '`') { inS = true; sc = c; continue; }
    if (c === '{') { depth++; stack.push({line: i+1, col: j+1, depth, snip: line.trim().slice(0, 80)}); }
    else if (c === '}') { depth--; stack.pop(); }
  }
}
console.log('Final depth:', depth);
console.log('Last 5 unclosed {');
for (const s of stack.slice(-5)) console.log('  L' + s.line, 'd=' + s.depth, '|', s.snip);

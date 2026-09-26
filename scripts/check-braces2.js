const code = require('fs').readFileSync('apps/web/src/app/dashboard/media/page.tsx', 'utf8');
const lines = code.split('\n');
let depth = 0, maxLine = 0, maxDepth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let inS = false, sc = '';
  let inLine = false, inBlk = false;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (inLine) break;
    if (inBlk) { if (c === '*' && line[j+1] === '/') { inBlk = false; j++; } continue; }
    if (inS) { if (c === sc) inS = false; continue; }
    if (c === '/' && line[j+1] === '/') break;
    if (c === '/' && line[j+1] === '*') { inBlk = true; j++; continue; }
    if (c === '"' || c === "'" || c === '`') { inS = true; sc = c; continue; }
    if (c === '{') { depth++; if (depth > maxDepth) { maxDepth = depth; maxLine = i+1; } }
    else if (c === '}') { depth--; }
  }
}
console.log('Final depth:', depth, 'Max depth:', maxDepth, 'at line', maxLine);

// Stack-trace style: print all unclosed opens with context
const stack = [];
let depth2 = 0;
let inS2 = false, sc2 = '', inLine2 = false, inBlk2 = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (inLine2) break;
    if (inBlk2) { if (c === '*' && line[j+1] === '/') { inBlk2 = false; j++; } continue; }
    if (inS2) { if (c === sc2) inS2 = false; continue; }
    if (c === '/' && line[j+1] === '/') break;
    if (c === '/' && line[j+1] === '*') { inBlk2 = true; j++; continue; }
    if (c === '"' || c === "'" || c === '`') { inS2 = true; sc2 = c; continue; }
    if (c === '{') { depth2++; stack.push({line: i+1, col: j+1, depth: depth2}); }
    else if (c === '}') { depth2--; stack.pop(); }
  }
}
console.log('\nCurrently open ({) positions:');
const open = stack.slice(-5);
for (const o of open) console.log('  Line', o.line, 'col', o.col, 'depth', o.depth);

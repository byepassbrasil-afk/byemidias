const code = require('fs').readFileSync('apps/web/src/app/dashboard/media/page.tsx', 'utf8');
let depth = 0;
const stack = [];
let inS = false, sc = '', inLine = false, inBlk = false;
let inJ = false; // JSX expression { }
for (let i = 0; i < code.length; i++) {
  const c = code[i];
  const prev = code[i-1];
  if (inLine) {
    if (c === '\n') inLine = false;
    continue;
  }
  if (inBlk) {
    if (c === '*' && code[i+1] === '/') { inBlk = false; i++; }
    continue;
  }
  if (inS) {
    if (c === '\\') { i++; continue; }
    if (c === sc) inS = false;
    continue;
  }
  if (c === '/' && code[i+1] === '/') { inLine = true; i++; continue; }
  if (c === '/' && code[i+1] === '*') { inBlk = true; i++; continue; }
  if (c === '"' || c === "'" || c === '`') { inS = true; sc = c; continue; }
  if (c === '{') { depth++; stack.push({pos: i, depth, ctx: code.slice(Math.max(0,i-30), i+20)}); }
  else if (c === '}') { depth--; stack.pop(); }
}

console.log('Final depth:', depth);

// Print last 10 stack entries
console.log('\nLast 10 stack entries:');
for (const s of stack.slice(-10)) {
  const line = code.slice(0, s.pos).split('\n').length;
  console.log('  Line', line, 'depth', s.depth, '|', s.ctx.replace(/\n/g, ' '));
}

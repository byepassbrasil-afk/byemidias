const fs = require('fs');
const code = fs.readFileSync('apps/web/src/app/dashboard/media/page.tsx', 'utf8');
let inS = false, sc = '';
let depth = 0;
let i = 0;
let lineNum = 1;
const out = [];
while (i < code.length) {
  const c = code[i];
  if (c === '\n') { lineNum++; }
  if (inS) {
    if (c === '\\') { i += 2; continue; }
    if (c === sc) inS = false;
    i++; continue;
  }
  if (c === '"' || c === "'" || c === '`') { inS = true; sc = c; i++; continue; }
  if (c === '{') {
    depth++;
    const lineStart = code.lastIndexOf('\n', i) + 1;
    let lineEnd = code.indexOf('\n', i);
    if (lineEnd === -1) lineEnd = code.length;
    const line = code.slice(lineStart, lineEnd);
    out.push('L' + lineNum + ' d=' + depth + ' | ' + line.trim().slice(0, 100));
  } else if (c === '}') {
    depth--;
    const lineStart = code.lastIndexOf('\n', i) + 1;
    let lineEnd = code.indexOf('\n', i);
    if (lineEnd === -1) lineEnd = code.length;
    const line = code.slice(lineStart, lineEnd);
    out.push('L' + lineNum + ' d=' + depth + ' | ' + line.trim().slice(0, 100));
  }
  i++;
}
fs.writeFileSync('scripts/_braces.txt', out.join('\n'));
console.log('Wrote', out.length, 'lines');

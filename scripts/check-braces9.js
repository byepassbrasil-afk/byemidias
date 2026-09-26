// Validador de JSX/TSX — considera type assertions e generics
const fs = require('fs');
const code = fs.readFileSync('apps/web/src/app/dashboard/media/page.tsx', 'utf8');
let depth = 0;
const stack = [];
let inS = false, sc = '';
let inLine = false, inBlk = false;
let i = 0;
let lineNum = 1;
const out = [];

function pushOp(c, depth, type) {
  const lineStart = code.lastIndexOf('\n', i) + 1;
  let lineEnd = code.indexOf('\n', i);
  if (lineEnd === -1) lineEnd = code.length;
  const line = code.slice(lineStart, lineEnd);
  out.push(`L${lineNum} d=${depth}${type} | ${line.trim().slice(0, 100)}`);
}

while (i < code.length) {
  const c = code[i];
  if (c === '\n') { lineNum++; i++; continue; }
  if (inLine) { i++; continue; }
  if (inBlk) { if (c === '*' && code[i+1] === '/') { inBlk = false; i += 2; continue; } i++; continue; }
  if (inS) {
    if (c === '\\') { i += 2; continue; }
    if (c === sc) inS = false;
    i++; continue;
  }
  if (c === '/' && code[i+1] === '/') { inLine = true; i += 2; continue; }
  if (c === '/' && code[i+1] === '*') { inBlk = true; i += 2; continue; }
  if (c === '"' || c === "'" || c === '`') { inS = true; sc = c; i++; continue; }

  // === Detecção de "as { }" type assertion e generics ===
  // Pula tipo dentro de "<>" ou "as { }"
  // simples heurística: quando encontramos "<" depois de identifier, ou "as {"
  // vamos apenas contar braces corretamente

  if (c === '{') {
    depth++;
    stack.push({ line: lineNum, col: i, depth, snip: code.slice(Math.max(0, i-30), Math.min(code.length, i+50)) });
    const lineStart = code.lastIndexOf('\n', i) + 1;
    let lineEnd = code.indexOf('\n', i);
    if (lineEnd === -1) lineEnd = code.length;
    const line = code.slice(lineStart, lineEnd);
    out.push(`L${lineNum} + d=${depth} | ${line.trim().slice(0, 100)}`);
  } else if (c === '}') {
    depth--;
    stack.pop();
    const lineStart = code.lastIndexOf('\n', i) + 1;
    let lineEnd = code.indexOf('\n', i);
    if (lineEnd === -1) lineEnd = code.length;
    const line = code.slice(lineStart, lineEnd);
    out.push(`L${lineNum} - d=${depth} | ${line.trim().slice(0, 100)}`);
  }
  i++;
}

fs.writeFileSync('scripts/_braces.txt', out.join('\n'));
console.log('Total ops:', out.length, 'Final depth:', depth);
if (stack.length > 0) {
  console.log('Unclosed:');
  for (const s of stack) console.log('  L', s.line, '|', s.snip.replace(/\n/g, ' '));
}

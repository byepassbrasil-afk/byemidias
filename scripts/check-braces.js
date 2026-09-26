const code = require('fs').readFileSync('apps/web/src/app/dashboard/media/page.tsx', 'utf8');
let open = 0, close = 0, pOpen = 0, pClose = 0, cOpen = 0, cClose = 0;
let inString = false, stringChar = '', inLine = false, inBlock = false;
for (let i = 0; i < code.length; i++) {
  const c = code[i];
  const prev = code[i-1];
  if (inLine) {
    if (c === '\n') inLine = false;
    continue;
  }
  if (inBlock) {
    if (c === '*' && code[i+1] === '/') { inBlock = false; i++; }
    continue;
  }
  if (inString) {
    if (c === stringChar && prev !== '\\') inString = false;
    continue;
  }
  if (c === '/' && code[i+1] === '/') { inLine = true; i++; continue; }
  if (c === '/' && code[i+1] === '*') { inBlock = true; i++; continue; }
  if (c === '"' || c === "'" || c === '`') { inString = true; stringChar = c; continue; }
  if (c === '{') open++;
  else if (c === '}') close++;
  else if (c === '(') pOpen++;
  else if (c === ')') pClose++;
  else if (c === '[') cOpen++;
  else if (c === ']') cClose++;
}
console.log('{}:', open, '/', close, 'diff:', open - close);
console.log('():', pOpen, '/', pClose, 'diff:', pOpen - pClose);
console.log('[]:', cOpen, '/', cClose, 'diff:', cOpen - cClose);

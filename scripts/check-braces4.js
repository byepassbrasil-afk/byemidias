const code = require('fs').readFileSync('apps/web/src/app/dashboard/media/page.tsx', 'utf8');
const lines = code.split('\n');
for (let i = 770; i < 875; i++) {
  let cnt = 0;
  let inS = false, sc = '';
  for (let j = 0; j < lines[i].length; j++) {
    const c = lines[i][j];
    if (inS) { if (c === sc) inS = false; continue; }
    if (c === '"' || c === "'" || c === '`') { inS = true; sc = c; continue; }
    if (c === '{' || c === '}') cnt++;
  }
  if (cnt > 0) console.log('L' + (i+1) + ':', cnt, 'braces |', lines[i].trim().slice(0, 100));
}

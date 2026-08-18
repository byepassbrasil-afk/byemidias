const fs = require('fs');
const sql = fs.readFileSync('C:/Users/GABRIEL/Documents/ByeMidias/packages/supabase/COMPLETE_DATABASE_FIXED.sql', 'utf8');

function splitSQL(t) {
  const s = [];
  let c = '';
  let dq = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '$') {
      let dc = 0;
      let j = i;
      while (j < t.length && t[j] === '$') { dc++; j++; }
      if (!dq && dc >= 2) {
        dq = true;
        c += t.substring(i, j);
        i = j - 1;
        continue;
      } else if (dq && dc >= 2) {
        dq = false;
        c += t.substring(i, j);
        i = j - 1;
        continue;
      }
    }
    if (ch === ';' && !dq) {
      const tr = c.trim();
      if (tr.length > 3 && !tr.match(/^--/)) {
        s.push(tr);
      }
      c = '';
      continue;
    }
    c += ch;
  }
  const l = c.trim();
  if (l.length > 3 && !l.match(/^--/)) {
    s.push(l);
  }
  return s;
}

const st = splitSQL(sql);
console.log('Total:', st.length);
// Find create_default_subscription - check its idx and look before it
for (let i = 0; i < st.length; i++) {
  if (st[i].includes('create_default_subscription')) {
    console.log('create_default_subscription at index', i);
    if (i > 0) {
      console.log('\n=== BEFORE IT (index', i-1, ') ===');
      console.log(st[i-1].substring(0, 300));
    }
    break;
  }
}

const { Client } = require('pg');
const fs = require('fs');

const sql = fs.readFileSync('C:/Users/GABRIEL/Documents/ByeMidias/packages/supabase/COMPLETE_DATABASE_FIXED.sql', 'utf8');

function splitSQL(text) {
  const statements = [];
  let current = '';
  let inDollar = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '$') {
      let dollarCount = 0;
      let j = i;
      while (j < text.length && text[j] === '$') { dollarCount++; j++; }
      if (!inDollar && dollarCount >= 2) {
        inDollar = true;
        current += text.substring(i, j);
        i = j - 1;
        continue;
      } else if (inDollar && dollarCount >= 2) {
        inDollar = false;
        current += text.substring(i, j);
        i = j - 1;
        continue;
      }
    }

    if (ch === ';' && !inDollar) {
      let raw = current.trim();
      // Strip leading comment lines (lines starting with --)
      let cleaned = raw.replace(/^(--\s*[^\n]*\n)+/gm, '').trim();
      if (cleaned.length > 3) {
        statements.push(cleaned);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  let raw = current.trim();
  let cleaned = raw.replace(/^(--\s*[^\n]*\n)+/gm, '').trim();
  if (cleaned.length > 3) {
    statements.push(cleaned);
  }

  return statements;
}

const client = new Client({
  connectionString: 'postgresql://postgres.qfotxfxzgcnbmtznlhfc:DianaDamGa08%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected');

  const statements = splitSQL(sql);
  console.log(`Statements: ${statements.length}`);

  // Check that update_updated_at_column is present
  const hasUpdated = statements.some(s => s.includes('update_updated_at_column'));
  console.log('Has update_updated_at_column:', hasUpdated);

  let ok = 0, fail = 0;
  const errs = [];

  for (let i = 0; i < statements.length; i++) {
    try {
      await client.query(statements[i]);
      ok++;
    } catch(e) {
      fail++;
      errs.push(`[${i+1}] ${statements[i].split('\n')[0].substring(0,80)}\n  ${e.message.substring(0,200)}`);
    }
  }

  console.log(`\nResult: ${ok} ok, ${fail} fail`);
  if (errs.length) {
    console.log('\nErrors:');
    errs.forEach(e => console.log(e));
  }
  await client.end();
}

run().catch(e => console.error('FATAL:', e.message));

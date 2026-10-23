// Applies every file in migrations/ in order. Each file is written to be safe to apply twice.
const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('./db');

(async () => {
  const dir = path.join(__dirname, 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await pool.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    console.log(`applied ${file}`);
  }
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });

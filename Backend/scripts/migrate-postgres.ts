'use strict';

const fs = require('fs');
const path = require('path');
const { DATA_FILE } = require('../src/config/constants');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'postgres', 'schema.sql'), 'utf8');
  await pool.query(schema);

  const mode = process.argv[2] || 'up';
  if (mode === 'up') {
    if (!fs.existsSync(DATA_FILE)) throw new Error(`JSON state not found: ${DATA_FILE}`);
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    await pool.query(
      `INSERT INTO app_state (id, data, updated_at)
       VALUES ('expocraft', $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, version = app_state.version + 1, updated_at = now()`,
      [data]
    );
    await pool.query(
      `INSERT INTO state_migrations (id, name)
       VALUES ('001_json_state_snapshot', 'Import JSON state snapshot')
       ON CONFLICT (id) DO NOTHING`
    );
    console.log('Postgres migration complete.');
  }

  if (mode === 'export') {
    const result = await pool.query(`SELECT data FROM app_state WHERE id = 'expocraft'`);
    if (!result.rows[0]) throw new Error('No app_state row found.');
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(result.rows[0].data, null, 2));
    console.log(`Exported Postgres state to ${DATA_FILE}`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

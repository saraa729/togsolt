'use strict';

const fs = require('fs');
const path = require('path');

function firstExistingPath(candidates: string[]) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function schemaPath() {
  return firstExistingPath([
    path.join(__dirname, '..', 'db', 'postgres', 'schema.sql'),
    path.join(__dirname, '..', '..', 'db', 'postgres', 'schema.sql')
  ]);
}

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function ensureSchema(pool: any) {
  await pool.query(fs.readFileSync(schemaPath(), 'utf8'));
}

async function main() {
  const command = process.argv[2] || 'status';
  const id = process.argv[3] || 'expocraft';
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for postgres runtime state.');

  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (command === 'exists') {
      const table = await pool.query(`SELECT to_regclass('public.app_state') AS table_name`);
      if (!table.rows[0]?.table_name) {
        process.stdout.write(JSON.stringify({ ok: true, exists: false }));
        return;
      }
      const row = await pool.query('SELECT 1 FROM app_state WHERE id = $1 LIMIT 1', [id]);
      process.stdout.write(JSON.stringify({ ok: true, exists: row.rowCount > 0 }));
      return;
    }

    if (command === 'read') {
      await ensureSchema(pool);
      const row = await pool.query('SELECT data, version, updated_at FROM app_state WHERE id = $1', [id]);
      if (!row.rows[0]) {
        process.stdout.write(JSON.stringify({ ok: true, exists: false, data: null }));
        return;
      }
      process.stdout.write(JSON.stringify({
        ok: true,
        exists: true,
        version: row.rows[0].version,
        updatedAt: row.rows[0].updated_at,
        data: row.rows[0].data
      }));
      return;
    }

    if (command === 'write') {
      const raw = await readStdin();
      const state = JSON.parse(raw);
      await ensureSchema(pool);
      const result = await pool.query(
        `INSERT INTO app_state (id, data, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (id)
         DO UPDATE SET data = EXCLUDED.data, version = app_state.version + 1, updated_at = now()
         RETURNING version, updated_at`,
        [id, JSON.stringify(state)]
      );
      process.stdout.write(JSON.stringify({ ok: true, version: result.rows[0].version, updatedAt: result.rows[0].updated_at }));
      return;
    }

    if (command === 'status') {
      await ensureSchema(pool);
      const row = await pool.query('SELECT data, version, updated_at FROM app_state WHERE id = $1', [id]);
      const data = row.rows[0]?.data || {};
      process.stdout.write(JSON.stringify({
        ok: true,
        exists: Boolean(row.rows[0]),
        version: row.rows[0]?.version || 0,
        updatedAt: row.rows[0]?.updated_at || null,
        users: Array.isArray(data.users) ? data.users.length : 0,
        shops: Array.isArray(data.shops) ? data.shops.length : 0,
        products: Array.isArray(data.products) ? data.products.length : 0,
        orders: Array.isArray(data.orders) ? data.orders.length : 0,
        ledgerEntries: Array.isArray(data.escrowLedger) ? data.escrowLedger.length : 0
      }));
      return;
    }

    throw new Error(`Unknown postgres runtime state command: ${command}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: Error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});

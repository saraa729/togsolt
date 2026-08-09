'use strict';

const fs = require('fs');
const { DATA_FILE } = require('../config/constants');

function createJsonAdapter({ ensureDir }) {
  return {
    name: 'json',
    exists() {
      return fs.existsSync(DATA_FILE);
    },
    read() {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    },
    write(state) {
      ensureDir();
      fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    }
  };
}

function createExternalAdapter(name) {
  return {
    name,
    exists() {
      return false;
    },
    read() {
      throw new Error(`${name} adapter requires a database driver and migration step.`);
    },
    write() {
      throw new Error(`${name} adapter requires a database driver and migration step.`);
    }
  };
}

function createPostgresAdapter({ ensureDir }) {
  let Pool;
  try {
    ({ Pool } = require('pg'));
  } catch {
    return createExternalAdapter('postgres');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return {
    name: 'postgres',
    async ensureSchema() {
      const sql = fs.readFileSync(require('path').join(__dirname, '..', '..', 'db', 'postgres', 'schema.sql'), 'utf8');
      await pool.query(sql);
    },
    exists() {
      return fs.existsSync(DATA_FILE);
    },
    read() {
      if (!fs.existsSync(DATA_FILE)) return null;
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    },
    write(state) {
      ensureDir();
      fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
      pool.query(
        `INSERT INTO app_state (id, data, updated_at)
         VALUES ('expocraft', $1::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, version = app_state.version + 1, updated_at = now()`,
        [JSON.stringify(state)]
      ).catch((error) => console.error(JSON.stringify({ level: 'error', message: 'postgres.write_failed', error: error.message })));
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

function createStateAdapter(options) {
  const provider = String(process.env.EXPOCRAFT_DB_PROVIDER || 'json').toLowerCase();
  if (provider === 'postgres') return createPostgresAdapter(options);
  if (provider === 'mongodb') return createExternalAdapter(provider);
  return createJsonAdapter(options);
}

module.exports = { createStateAdapter };

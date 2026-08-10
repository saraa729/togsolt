'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { DATA_FILE } = require('../config/constants');

function firstExistingPath(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

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

function createPrismaSnapshotAdapter({ ensureDir }) {
  let getPrismaClient;
  try {
    ({ getPrismaClient } = require('./prisma'));
  } catch {
    return createExternalAdapter('prisma');
  }

  function mirrorState(state) {
    if (!process.env.DATABASE_URL) return;
    try {
      const prisma = getPrismaClient();
      prisma.appState.upsert({
        where: { id: 'expocraft' },
        create: { id: 'expocraft', data: state },
        update: { data: state, version: { increment: 1 } }
      }).catch((error) => console.error(JSON.stringify({ level: 'error', message: 'prisma.write_failed', error: error.message })));
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', message: 'prisma.write_failed', error: error.message }));
    }
  }

  return {
    name: 'prisma',
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
      mirrorState(state);
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
  const projectRoot = firstExistingPath([
    path.join(__dirname, '..', '..', '..'),
    path.join(__dirname, '..', '..')
  ]);
  const appStateSchemaPath = firstExistingPath([
    path.join(projectRoot, 'db', 'postgres', 'schema.sql'),
    path.join(__dirname, '..', '..', 'db', 'postgres', 'schema.sql')
  ]);
  const appStateSchemaSql = fs.readFileSync(appStateSchemaPath, 'utf8');
  let schemaReady = null;
  let relationalSyncTimer = null;
  let relationalSyncRunning = false;
  let relationalSyncQueued = false;

  function ensureAppStateSchema() {
    if (!schemaReady) schemaReady = pool.query(appStateSchemaSql);
    return schemaReady;
  }

  function relationalExportScript() {
    return firstExistingPath([
      path.join(projectRoot, 'dist', 'scripts', 'export-relational.js'),
      path.join(__dirname, '..', '..', 'scripts', 'export-relational.js')
    ]);
  }

  function runtimeStateScript() {
    return firstExistingPath([
      path.join(projectRoot, 'dist', 'scripts', 'postgres-state-runtime.js'),
      path.join(__dirname, '..', '..', 'scripts', 'postgres-state-runtime.js')
    ]);
  }

  function runRuntimeState(command, state = null) {
    const script = runtimeStateScript();
    if (!fs.existsSync(script)) throw new Error(`Postgres runtime state script not found: ${script}`);
    const child = spawnSync(process.execPath, [script, command, 'expocraft'], {
      cwd: projectRoot,
      env: process.env,
      input: state ? JSON.stringify(state) : undefined,
      encoding: 'utf8',
      maxBuffer: Number(process.env.EXPOCRAFT_POSTGRES_STATE_MAX_BUFFER || 128 * 1024 * 1024)
    });
    if (child.status !== 0) {
      const message = (child.stderr || child.stdout || '').trim() || `postgres state ${command} failed`;
      throw new Error(message);
    }
    return child.stdout ? JSON.parse(child.stdout) : {};
  }

  function scheduleRelationalSync() {
    if (String(process.env.EXPOCRAFT_POSTGRES_RELATIONAL_SYNC || 'true').toLowerCase() === 'false') return;
    clearTimeout(relationalSyncTimer);
    relationalSyncTimer = setTimeout(runRelationalSync, Number(process.env.EXPOCRAFT_POSTGRES_RELATIONAL_SYNC_DELAY_MS || 500));
  }

  function runRelationalSync() {
    if (relationalSyncRunning) {
      relationalSyncQueued = true;
      return;
    }
    const script = relationalExportScript();
    if (!fs.existsSync(script)) return;
    relationalSyncRunning = true;
    const child = spawn(process.execPath, [script], {
      cwd: projectRoot,
      env: { ...process.env, EXPOCRAFT_RELATIONAL_SOURCE: process.env.EXPOCRAFT_RELATIONAL_SOURCE || 'postgres' },
      stdio: ['ignore', 'ignore', 'pipe']
    });
    child.stderr.on('data', (chunk) => {
      const error = String(chunk).trim();
      if (error) console.error(JSON.stringify({ level: 'error', message: 'postgres.relational_sync_stderr', error }));
    });
    child.on('close', (code) => {
      relationalSyncRunning = false;
      if (code !== 0) {
        console.error(JSON.stringify({ level: 'error', message: 'postgres.relational_sync_failed', code }));
      }
      if (relationalSyncQueued) {
        relationalSyncQueued = false;
        scheduleRelationalSync();
      }
    });
  }

  return {
    name: 'postgres',
    async ensureSchema() {
      await ensureAppStateSchema();
    },
    exists() {
      return Boolean(runRuntimeState('exists').exists) || fs.existsSync(DATA_FILE);
    },
    read() {
      const result = runRuntimeState('read');
      if (result.exists) return result.data;
      if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return null;
    },
    write(state) {
      runRuntimeState('write', state);
      scheduleRelationalSync();
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
  if (provider === 'prisma') return createPrismaSnapshotAdapter(options);
  if (provider === 'postgres') return createPostgresAdapter(options);
  if (provider === 'mongodb') return createExternalAdapter(provider);
  return createJsonAdapter(options);
}

module.exports = { createStateAdapter };

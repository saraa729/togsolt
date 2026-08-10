'use strict';

const fs = require('fs');
const path = require('path');
const { DATA_FILE } = require('../src/config/constants');
const { getPrismaClient, disconnectPrisma } = require('../src/data/prisma');

function stateFilePath() {
  const explicitPath = process.argv[3];
  return explicitPath ? path.resolve(explicitPath) : DATA_FILE;
}

async function importState() {
  const filePath = stateFilePath();
  if (!fs.existsSync(filePath)) throw new Error(`JSON state not found: ${filePath}`);

  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const prisma = getPrismaClient();

  await prisma.appState.upsert({
    where: { id: 'expocraft' },
    create: { id: 'expocraft', data },
    update: {
      data,
      version: { increment: 1 }
    }
  });

  await prisma.stateMigration.upsert({
    where: { id: '001_prisma_json_state_snapshot' },
    create: { id: '001_prisma_json_state_snapshot', name: 'Import JSON state snapshot through Prisma' },
    update: {}
  });

  console.log(`Imported JSON state into Prisma app_state from ${filePath}`);
}

async function exportState() {
  const filePath = stateFilePath();
  const prisma = getPrismaClient();
  const row = await prisma.appState.findUnique({ where: { id: 'expocraft' } });
  if (!row) throw new Error('No app_state row found for id "expocraft".');

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(row.data, null, 2));
  console.log(`Exported Prisma app_state to ${filePath}`);
}

async function status() {
  const prisma = getPrismaClient();
  const row = await prisma.appState.findUnique({ where: { id: 'expocraft' } });
  if (!row) {
    console.log('No Prisma app_state row found.');
    return;
  }
  const data = row.data || {};
  console.log(JSON.stringify({
    id: row.id,
    version: row.version,
    updatedAt: row.updatedAt,
    users: Array.isArray(data.users) ? data.users.length : 0,
    shops: Array.isArray(data.shops) ? data.shops.length : 0,
    products: Array.isArray(data.products) ? data.products.length : 0,
    orders: Array.isArray(data.orders) ? data.orders.length : 0,
    ledgerEntries: Array.isArray(data.escrowLedger) ? data.escrowLedger.length : 0
  }, null, 2));
}

async function main() {
  const command = process.argv[2] || 'status';
  if (command === 'import') return importState();
  if (command === 'export') return exportState();
  if (command === 'status') return status();
  throw new Error(`Unknown prisma-state command: ${command}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());

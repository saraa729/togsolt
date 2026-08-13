'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, '..', '..', 'package.json'))
  ? path.join(__dirname, '..', '..')
  : path.join(__dirname, '..');
const REPO_ROOT = path.join(ROOT, '..');

function read(fullPath: string) {
  if (!fs.existsSync(fullPath)) throw new Error(`${fullPath} is missing.`);
  return fs.readFileSync(fullPath, 'utf8');
}

function assertIncludes(source: string, needle: string, label: string) {
  if (!source.includes(needle)) throw new Error(`${label} is missing ${needle}.`);
}

function main() {
  const storage = read(path.join(ROOT, 'src', 'services', 'storage.ts'));
  const phase2 = read(path.join(ROOT, 'src', 'routes', 'phase2.ts'));
  const envExample = read(path.join(ROOT, '.env.example'));
  const deployEnv = read(path.join(REPO_ROOT, 'DEPLOY_ENV.md'));
  const render = read(path.join(REPO_ROOT, 'render.yaml'));
  const contracts = read(path.join(ROOT, 'PROVIDER_CONTRACTS.md'));

  for (const name of [
    'EXPOCRAFT_R2_ENDPOINT',
    'EXPOCRAFT_R2_BUCKET',
    'EXPOCRAFT_R2_ACCESS_KEY_ID',
    'EXPOCRAFT_R2_SECRET_ACCESS_KEY',
    'EXPOCRAFT_STORAGE_PUBLIC_BASE_URL',
    'EXPOCRAFT_VIRUS_SCAN_URL',
    'EXPOCRAFT_CARRIER_API_URL',
    'EXPOCRAFT_AI_SUGGEST_URL',
    'RABBITMQ_URL'
  ]) {
    assertIncludes(envExample, name, '.env.example');
    assertIncludes(deployEnv, name, 'DEPLOY_ENV.md');
  }

  assertIncludes(storage, 'AWS4-HMAC-SHA256', 'R2/S3 storage integration');
  assertIncludes(storage, 'EXPOCRAFT_VIRUS_SCAN_REQUIRED', 'Virus scan integration');
  assertIncludes(phase2, 'EXPOCRAFT_CARRIER_API_URL', 'Carrier integration');
  assertIncludes(phase2, 'EXPOCRAFT_AI_SUGGEST_URL', 'AI integration');
  assertIncludes(phase2, 'EXPOCRAFT_PROVIDER_TIMEOUT_MS', 'Provider timeout integration');
  assertIncludes(render, 'EXPOCRAFT_PUBLIC_API_URL', 'Render backend env');
  assertIncludes(render, 'expocraft-worker', 'Render worker blueprint');
  assertIncludes(contracts, 'Carrier Rates Provider', 'Provider contracts');

  console.log('[providers:ok] Storage, virus scan, carrier, AI, RabbitMQ, and deploy env contracts are wired.');
}

main();

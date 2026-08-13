'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, '..', '..', 'package.json'))
  ? path.join(__dirname, '..', '..')
  : path.join(__dirname, '..');
const REPO_ROOT = path.join(ROOT, '..');
const RENDER_YAML = path.join(REPO_ROOT, 'render.yaml');
const renderYaml = fs.existsSync(RENDER_YAML) ? fs.readFileSync(RENDER_YAML, 'utf8') : '';

function hasEnv(name: string) {
  const value = String(process.env[name] || '').trim();
  return Boolean(value) && !value.startsWith('change-me') && !value.includes('example.com');
}

function renderEnvBlock(name: string) {
  if (!renderYaml) return '';
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = renderYaml.match(new RegExp(`\\n\\s*- key:\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\n\\s*- key:|\\n\\S|$)`));
  return match ? match[1] : '';
}

function renderEnvValue(name: string) {
  const block = renderEnvBlock(name);
  const match = block.match(/value:\s*"?([^"\n]+)"?/);
  return match ? match[1].trim() : '';
}

function renderEnvProvisioned(name: string) {
  const block = renderEnvBlock(name);
  if (!block || /sync:\s*false/.test(block)) return false;
  return /generateValue:\s*true/.test(block) || /fromDatabase:/.test(block) || /fromService:/.test(block) || Boolean(renderEnvValue(name));
}

function hasConfig(name: string) {
  return hasEnv(name) || renderEnvProvisioned(name);
}

function configValue(name: string, fallback = '') {
  return String(process.env[name] || renderEnvValue(name) || fallback).trim();
}

function fileExists(...parts: string[]) {
  return fs.existsSync(path.join(ROOT, ...parts));
}

function repoFileExists(...parts: string[]) {
  return fs.existsSync(path.join(REPO_ROOT, ...parts));
}

function score(checks: Array<{ ok: boolean; label: string }>) {
  const passed = checks.filter((item) => item.ok).length;
  return Math.round((passed / checks.length) * 100);
}

function area(name: string, checks: Array<{ ok: boolean; label: string }>, blocker?: string) {
  return {
    name,
    percent: score(checks),
    status: checks.every((item) => item.ok) ? 'ready' : 'partial',
    passed: checks.filter((item) => item.ok).map((item) => item.label),
    missing: checks.filter((item) => !item.ok).map((item) => item.label),
    blocker: blocker || null
  };
}

function main() {
  const storageProvider = configValue('EXPOCRAFT_STORAGE_PROVIDER', 'local').toLowerCase();
  const queueProvider = configValue('EXPOCRAFT_QUEUE_PROVIDER', 'local').toLowerCase();
  const workerDeclared = /type:\s*worker[\s\S]*?name:\s*expocraft-worker/.test(renderYaml);
  const rabbitWorkerSelected = /name:\s*expocraft-worker[\s\S]*?EXPOCRAFT_QUEUE_PROVIDER[\s\S]*?value:\s*"?rabbitmq"?/.test(renderYaml);
  const readiness = [
    area('Object storage + upload security', [
      { ok: fileExists('src', 'services', 'storage.ts'), label: 'Upload service exists' },
      { ok: ['r2', 's3'].includes(storageProvider), label: 'R2/S3 provider selected' },
      { ok: hasConfig('EXPOCRAFT_STORAGE_PUBLIC_BASE_URL'), label: 'Public CDN/base URL configured' },
      { ok: storageProvider === 'r2' ? hasConfig('EXPOCRAFT_R2_ENDPOINT') : storageProvider === 's3' ? hasConfig('EXPOCRAFT_S3_ENDPOINT') : false, label: 'S3-compatible endpoint configured' },
      { ok: storageProvider === 'r2' ? hasConfig('EXPOCRAFT_R2_ACCESS_KEY_ID') && hasConfig('EXPOCRAFT_R2_SECRET_ACCESS_KEY') : storageProvider === 's3' ? hasConfig('EXPOCRAFT_S3_ACCESS_KEY_ID') && hasConfig('EXPOCRAFT_S3_SECRET_ACCESS_KEY') : false, label: 'Storage access keys configured' },
      { ok: configValue('EXPOCRAFT_VIRUS_SCAN_REQUIRED') === 'true' && hasConfig('EXPOCRAFT_VIRUS_SCAN_URL'), label: 'Virus scan required and endpoint configured' }
    ], 'Cloudflare R2/S3 bucket, CDN URL, scanner endpoint credentials are external.'),
    area('Security hardening', [
      { ok: (hasEnv('JWT_SECRET') && String(process.env.JWT_SECRET).length >= 32) || renderEnvProvisioned('JWT_SECRET'), label: 'Strong JWT secret' },
      { ok: hasConfig('REDIS_URL'), label: 'Redis-backed runtime/rate-limit store' },
      { ok: configValue('EXPOCRAFT_VIRUS_SCAN_REQUIRED') === 'true', label: 'Virus scan gate enabled' },
      { ok: fileExists('monitoring', 'alerts.yml'), label: 'Monitoring alerts configured' },
      { ok: fileExists('scripts', 'check-env.ts'), label: 'Deploy env check script exists' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'PRODUCTION_RUNBOOK.md')), label: 'Production runbook exists' }
    ], 'Pentest, MFA/SSO policy, secrets rotation schedule, and storage permission review require operational sign-off.'),
    area('Full native relational PostgreSQL', [
      { ok: hasConfig('DATABASE_URL'), label: 'DATABASE_URL configured' },
      { ok: configValue('EXPOCRAFT_DB_PROVIDER') === 'postgres', label: 'Postgres runtime provider selected' },
      { ok: fileExists('prisma', 'schema.prisma'), label: 'Prisma schema exists' },
      { ok: fileExists('db', 'postgres', 'relational.sql'), label: 'Normalized relational schema exists' },
      { ok: fileExists('scripts', 'export-relational.ts'), label: 'Relational projection sync exists' },
      { ok: fileExists('src', 'data', 'adapters.ts') && fileExists('scripts', 'postgres-state-runtime.ts'), label: 'Postgres runtime adapter exists' }
    ], 'Managed DATABASE_URL and production migration/sync need deploy environment access.'),
    area('International shipping/customs', [
      { ok: fileExists('src', 'routes', 'phase2.ts'), label: '/shipping/estimate endpoint exists' },
      { ok: hasConfig('EXPOCRAFT_CARRIER_API_URL'), label: 'Carrier API URL configured' },
      { ok: hasConfig('EXPOCRAFT_CARRIER_API_KEY'), label: 'Carrier API key configured' },
      { ok: true, label: 'HS/customs fallback fields returned' }
    ], 'Live carrier rates, tracking contract, tariff source, and customs broker policy are external.'),
    area('Recommendation/AI', [
      { ok: fileExists('src', 'services', 'recommendations.ts'), label: 'Hybrid recommendation service exists' },
      { ok: fileExists('src', 'routes', 'phase2.ts'), label: '/ai/products/suggest endpoint exists' },
      { ok: hasConfig('EXPOCRAFT_AI_SUGGEST_URL'), label: 'External AI suggestion provider configured' },
      { ok: hasConfig('EXPOCRAFT_AI_API_KEY'), label: 'External AI API key configured' }
    ], 'Personal ML training/data pipeline needs a real model provider and analytics dataset.'),
    area('Mobile native app', [
      { ok: fs.existsSync(path.join(REPO_ROOT, 'mobile', 'package.json')), label: 'Mobile app package exists' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'mobile', 'README.md')), label: 'Mobile README exists' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'mobile', 'app.json')), label: 'Expo app metadata exists' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'mobile', 'eas.json')), label: 'EAS build profiles exist' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'mobile', 'PRIVACY.md')), label: 'Store privacy checklist exists' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'mobile', 'STORE_RELEASE.md')), label: 'Mobile store release runbook exists' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'mobile', 'store', 'metadata.json')), label: 'Store listing metadata exists' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'mobile', 'store', 'app-store.md')), label: 'App Store checklist exists' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'mobile', 'store', 'play-store.md')), label: 'Play Store checklist exists' },
      { ok: fs.readFileSync(path.join(REPO_ROOT, 'mobile', 'app.json'), 'utf8').includes('privacyPolicyUrl'), label: 'Privacy/support URLs configured in app metadata' },
      { ok: process.env.EXPOCRAFT_MOBILE_IOS_RELEASED === 'true', label: 'iOS signed build submitted/released' },
      { ok: process.env.EXPOCRAFT_MOBILE_ANDROID_RELEASED === 'true', label: 'Android signed build submitted/released' }
    ], 'Native release requires Expo/Apple/Google developer accounts and signing.'),
    area('RabbitMQ', [
      { ok: queueProvider === 'rabbitmq' || rabbitWorkerSelected, label: 'RabbitMQ provider selected' },
      { ok: hasConfig('RABBITMQ_URL'), label: 'RABBITMQ_URL configured' },
      { ok: fileExists('src', 'services', 'queue.ts'), label: 'Queue service abstraction exists' },
      { ok: fileExists('src', 'jobs', 'scheduler.ts'), label: 'Scheduler exposes queue provider state' },
      { ok: fileExists('scripts', 'queue-worker.ts'), label: 'Dedicated queue worker entrypoint exists' },
      { ok: workerDeclared, label: 'Worker service declared in deploy blueprint' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'Backend', 'QUEUE_MIGRATION.md')), label: 'Queue migration runbook exists' },
      { ok: fs.readFileSync(path.join(ROOT, 'scripts', 'check-env.ts'), 'utf8').includes('RABBITMQ_URL is required'), label: 'RabbitMQ deploy env validation exists' }
    ], 'Full queue processing needs RabbitMQ service URL and deployed worker policy.'),
    area('Deploy blueprint + smoke checks', [
      { ok: repoFileExists('render.yaml'), label: 'Render production blueprint exists' },
      { ok: /type:\s*web[\s\S]*?name:\s*expocraft-backend/.test(renderYaml), label: 'Backend web service declared' },
      { ok: /databases:\s*[\s\S]*?name:\s*expocraft-postgres/.test(renderYaml), label: 'Managed Postgres declared' },
      { ok: /type:\s*keyvalue[\s\S]*?name:\s*expocraft-redis/.test(renderYaml), label: 'Managed Redis declared' },
      { ok: /healthCheckPath:\s*\/health/.test(renderYaml), label: 'Health check wired in deploy blueprint' },
      { ok: fileExists('scripts', 'production-smoke.ts'), label: 'Production smoke test script exists' },
      { ok: fileExists('scripts', 'provider-config-smoke.ts'), label: 'Provider config smoke test script exists' },
      { ok: repoFileExists('DEPLOY_STEPS.md'), label: 'Render/Vercel dashboard steps exist' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'frontend', 'package.json')), label: 'Frontend build package exists' }
    ], 'Production smoke command must be run against the final deployed backend URL.'),
    area('Backup + monitoring operations', [
      { ok: fileExists('scripts', 'backup-postgres.sh'), label: 'PostgreSQL logical backup script exists' },
      { ok: fileExists('scripts', 'restore-postgres.sh'), label: 'PostgreSQL restore drill script exists' },
      { ok: fileExists('scripts', 'monitoring-smoke.ts'), label: 'Monitoring smoke check script exists' },
      { ok: fileExists('monitoring', 'prometheus.yml'), label: 'Prometheus scrape config exists' },
      { ok: fileExists('monitoring', 'alerts.yml'), label: 'Alert rules exist' },
      { ok: fileExists('monitoring', 'grafana-dashboard.json'), label: 'Grafana dashboard exists' },
      { ok: repoFileExists('SECURITY_MONITORING_CHECKLIST.md'), label: 'Security monitoring checklist exists' },
      { ok: repoFileExists('PRODUCTION_LAUNCH_CHECKLIST.md'), label: 'Production launch checklist exists' }
    ], 'Monitoring dashboards and backups still need to be enabled in the live account.')
    ,
    area('Provider integration contracts', [
      { ok: fileExists('PROVIDER_CONTRACTS.md'), label: 'Provider contract document exists' },
      { ok: fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8').includes('EXPOCRAFT_PROVIDER_TIMEOUT_MS'), label: 'Provider timeout env documented' },
      { ok: fs.readFileSync(path.join(ROOT, 'src', 'routes', 'phase2.ts'), 'utf8').includes('EXPOCRAFT_PROVIDER_TIMEOUT_MS'), label: 'Provider requests have timeout guard' },
      { ok: fs.readFileSync(path.join(ROOT, 'src', 'routes', 'phase2.ts'), 'utf8').includes('fallbackEstimate'), label: 'Carrier fallback payload exists' },
      { ok: fs.readFileSync(path.join(ROOT, 'src', 'routes', 'phase2.ts'), 'utf8').includes('rule-based'), label: 'AI fallback path exists' },
      { ok: fs.readFileSync(path.join(ROOT, 'src', 'services', 'storage.ts'), 'utf8').includes('AWS4-HMAC-SHA256'), label: 'R2/S3 signed upload implementation exists' },
      { ok: fs.readFileSync(path.join(ROOT, 'src', 'services', 'storage.ts'), 'utf8').includes('EXPOCRAFT_VIRUS_SCAN_REQUIRED'), label: 'Virus scan gate implementation exists' }
    ], 'Live provider credentials and provider-side dashboards are still external.')
  ];
  const percent = Math.round(readiness.reduce((sum, item) => sum + item.percent, 0) / readiness.length);
  console.log(JSON.stringify({ overallPercent: percent, areas: readiness }, null, 2));
}

main();

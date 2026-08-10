'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, '..', '..', 'package.json'))
  ? path.join(__dirname, '..', '..')
  : path.join(__dirname, '..');
const REPO_ROOT = path.join(ROOT, '..');

function hasEnv(name: string) {
  const value = String(process.env[name] || '').trim();
  return Boolean(value) && !value.startsWith('change-me') && !value.includes('example.com');
}

function fileExists(...parts: string[]) {
  return fs.existsSync(path.join(ROOT, ...parts));
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
  const storageProvider = String(process.env.EXPOCRAFT_STORAGE_PROVIDER || 'local').toLowerCase();
  const queueProvider = String(process.env.EXPOCRAFT_QUEUE_PROVIDER || 'local').toLowerCase();
  const readiness = [
    area('Object storage + upload security', [
      { ok: fileExists('src', 'services', 'storage.ts'), label: 'Upload service exists' },
      { ok: ['r2', 's3'].includes(storageProvider), label: 'R2/S3 provider selected' },
      { ok: hasEnv('EXPOCRAFT_STORAGE_PUBLIC_BASE_URL'), label: 'Public CDN/base URL configured' },
      { ok: storageProvider === 'r2' ? hasEnv('EXPOCRAFT_R2_ENDPOINT') : storageProvider === 's3' ? hasEnv('EXPOCRAFT_S3_ENDPOINT') : false, label: 'S3-compatible endpoint configured' },
      { ok: storageProvider === 'r2' ? hasEnv('EXPOCRAFT_R2_ACCESS_KEY_ID') && hasEnv('EXPOCRAFT_R2_SECRET_ACCESS_KEY') : storageProvider === 's3' ? hasEnv('EXPOCRAFT_S3_ACCESS_KEY_ID') && hasEnv('EXPOCRAFT_S3_SECRET_ACCESS_KEY') : false, label: 'Storage access keys configured' },
      { ok: process.env.EXPOCRAFT_VIRUS_SCAN_REQUIRED === 'true' && hasEnv('EXPOCRAFT_VIRUS_SCAN_URL'), label: 'Virus scan required and endpoint configured' }
    ], 'Cloudflare R2/S3 bucket, CDN URL, scanner endpoint credentials are external.'),
    area('Security hardening', [
      { ok: hasEnv('JWT_SECRET') && String(process.env.JWT_SECRET).length >= 32, label: 'Strong JWT secret' },
      { ok: hasEnv('REDIS_URL'), label: 'Redis-backed runtime/rate-limit store' },
      { ok: process.env.EXPOCRAFT_VIRUS_SCAN_REQUIRED === 'true', label: 'Virus scan gate enabled' },
      { ok: fileExists('monitoring', 'alerts.yml'), label: 'Monitoring alerts configured' },
      { ok: fileExists('scripts', 'check-env.ts'), label: 'Deploy env check script exists' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'PRODUCTION_RUNBOOK.md')), label: 'Production runbook exists' }
    ], 'Pentest, MFA/SSO policy, secrets rotation schedule, and storage permission review require operational sign-off.'),
    area('Full native relational PostgreSQL', [
      { ok: hasEnv('DATABASE_URL'), label: 'DATABASE_URL configured' },
      { ok: process.env.EXPOCRAFT_DB_PROVIDER === 'postgres', label: 'Postgres runtime provider selected' },
      { ok: fileExists('prisma', 'schema.prisma'), label: 'Prisma schema exists' },
      { ok: fileExists('db', 'postgres', 'relational.sql'), label: 'Normalized relational schema exists' },
      { ok: fileExists('scripts', 'export-relational.ts'), label: 'Relational projection sync exists' },
      { ok: false, label: 'Every route/service uses native table repositories' }
    ], 'Remaining work is a table-by-table repository migration, not only deploy config.'),
    area('International shipping/customs', [
      { ok: fileExists('src', 'routes', 'phase2.ts'), label: '/shipping/estimate endpoint exists' },
      { ok: hasEnv('EXPOCRAFT_CARRIER_API_URL'), label: 'Carrier API URL configured' },
      { ok: hasEnv('EXPOCRAFT_CARRIER_API_KEY'), label: 'Carrier API key configured' },
      { ok: true, label: 'HS/customs fallback fields returned' }
    ], 'Live carrier rates, tracking contract, tariff source, and customs broker policy are external.'),
    area('Recommendation/AI', [
      { ok: fileExists('src', 'services', 'recommendations.ts'), label: 'Hybrid recommendation service exists' },
      { ok: fileExists('src', 'routes', 'phase2.ts'), label: '/ai/products/suggest endpoint exists' },
      { ok: hasEnv('EXPOCRAFT_AI_SUGGEST_URL'), label: 'External AI suggestion provider configured' },
      { ok: hasEnv('EXPOCRAFT_AI_API_KEY'), label: 'External AI API key configured' }
    ], 'Personal ML training/data pipeline needs a real model provider and analytics dataset.'),
    area('Mobile native app', [
      { ok: fs.existsSync(path.join(REPO_ROOT, 'mobile', 'package.json')), label: 'Mobile app package exists' },
      { ok: fs.existsSync(path.join(REPO_ROOT, 'mobile', 'README.md')), label: 'Mobile README exists' },
      { ok: false, label: 'iOS signed build' },
      { ok: false, label: 'Android signed build' },
      { ok: false, label: 'App Store/Play Store release' }
    ], 'Native release requires Expo/Apple/Google developer accounts and signing.'),
    area('RabbitMQ', [
      { ok: queueProvider === 'rabbitmq', label: 'RabbitMQ provider selected' },
      { ok: hasEnv('RABBITMQ_URL'), label: 'RABBITMQ_URL configured' },
      { ok: false, label: 'Jobs/events migrated to RabbitMQ consumers' }
    ], 'Full queue migration needs RabbitMQ service and worker/consumer implementation.')
  ];
  const percent = Math.round(readiness.reduce((sum, item) => sum + item.percent, 0) / readiness.length);
  console.log(JSON.stringify({ overallPercent: percent, areas: readiness }, null, 2));
}

main();

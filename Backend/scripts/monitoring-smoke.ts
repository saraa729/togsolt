'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, '..', '..', 'package.json'))
  ? path.join(__dirname, '..', '..')
  : path.join(__dirname, '..');

function read(relativePath: string) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`${relativePath} is missing.`);
  return fs.readFileSync(fullPath, 'utf8');
}

function assertIncludes(source: string, needle: string, label: string) {
  if (!source.includes(needle)) throw new Error(`${label} is missing "${needle}".`);
}

function main() {
  const prometheus = read('monitoring/prometheus.yml');
  const alerts = read('monitoring/alerts.yml');
  const dashboard = read('monitoring/grafana-dashboard.json');

  assertIncludes(prometheus, '/metrics/prometheus', 'Prometheus scrape config');
  assertIncludes(alerts, 'ExpoCraftBackendDown', 'Alert rules');
  assertIncludes(alerts, 'ExpoCraftBackupStale', 'Alert rules');
  assertIncludes(alerts, 'ExpoCraftRedisMissingInProduction', 'Alert rules');

  const parsedDashboard = JSON.parse(dashboard);
  if (!parsedDashboard || typeof parsedDashboard !== 'object') {
    throw new Error('Grafana dashboard JSON is invalid.');
  }

  console.log('[monitoring:ok] Prometheus, alerts, and Grafana dashboard are present.');
}

main();

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { request: appRequest } = require('./helpers');

process.env.NODE_ENV = 'test';
process.env.EXPOCRAFT_DATA_DIR = path.join(os.tmpdir(), `expocraft-ops-${Date.now()}`);
process.env.EXPOCRAFT_SEED = 'true';

const { handle } = require('../app');

function startServer() {
  return Promise.resolve({
    address: () => ({ port: 0 }),
    close: (callback) => {
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    }
  });
}

async function request(_baseUrl, method, pathName, body, token, headers = {}) {
  return appRequest(handle, { method, pathName, body, token, headers });
}

test('secure refresh cookie, docs, metrics, search, and jobs are wired', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await request(baseUrl, 'POST', '/auth/login', { email: 'buyer@expocraft.mn', password: 'buyer12345' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /expocraft_refresh=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);

    const refreshed = await request(baseUrl, 'POST', '/auth/refresh', {}, null, { cookie, 'x-csrf-token': 'test-token' });
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.body.accessToken);

    const docs = await request(baseUrl, 'GET', '/docs/openapi.json');
    assert.equal(docs.status, 200);
    assert.equal(docs.body.openapi, '3.0.3');
    assert.ok(docs.body.paths['/conversations/stream']);

    const search = await request(baseUrl, 'GET', '/products?q=felt&currency=MNT');
    assert.equal(search.status, 200);
    assert.ok(search.body.products.length >= 1);

    const admin = await request(baseUrl, 'POST', '/auth/login', { email: 'admin@expocraft.mn', password: 'admin12345' });
    const job = await request(baseUrl, 'POST', '/admin/jobs/daily_reconciliation/run', {}, admin.body.token);
    assert.equal(job.status, 200);
    assert.ok(job.body.entryCount >= 0);

    const metrics = await request(baseUrl, 'GET', '/metrics');
    assert.equal(metrics.status, 200);
    assert.ok(metrics.body.metrics.httpRequests >= 1);

    const prometheusResponse = await request(baseUrl, 'GET', '/metrics/prometheus');
    assert.equal(prometheusResponse.status, 200);
    assert.match(prometheusResponse.text, /expocraft_http_requests_total/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

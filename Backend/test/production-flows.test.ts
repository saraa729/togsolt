'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { request: appRequest } = require('./helpers');

process.env.EXPOCRAFT_DATA_DIR = path.join(os.tmpdir(), `expocraft-prod-flows-${Date.now()}`);
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

async function request(_baseUrl: string, method: string, pathName: string, body?: unknown, token?: string | null, headers = {}) {
  return appRequest(handle, { method, pathName, body, token, headers });
}

test('auth security supports reset and email verification tokens', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const register = await request(baseUrl, 'POST', '/auth/register', {
      email: 'secure-buyer@example.com',
      password: 'buyer12345',
      name: 'Secure Buyer',
      phone: '+97699001122'
    });
    assert.equal(register.status, 200);

    const forgot = await request(baseUrl, 'POST', '/auth/forgot-password', { email: 'secure-buyer@example.com' });
    assert.equal(forgot.status, 200);
    assert.ok(forgot.body.resetToken);

    const reset = await request(baseUrl, 'POST', '/auth/reset-password', { token: forgot.body.resetToken, password: 'newpass123' });
    assert.equal(reset.status, 200);

    const login = await request(baseUrl, 'POST', '/auth/login', { email: 'secure-buyer@example.com', password: 'newpass123' });
    assert.equal(login.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('seller can upload an image and create a payout request', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const sellerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'seller@expocraft.mn', password: 'seller12345' });
    assert.equal(sellerLogin.status, 200);

    const form = new FormData();
    form.append('file', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'tiny.jpg');
    const uploadResponse = await request(baseUrl, 'POST', '/uploads/images', form, sellerLogin.body.token);
    const upload = uploadResponse.body;
    assert.equal(uploadResponse.status, 200);
    assert.match(upload.upload.url, /^\/uploads\/img_/);

    const file = await request(baseUrl, 'GET', upload.upload.url);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'image/jpeg');

    const payout = await request(baseUrl, 'POST', '/seller/payout-requests', { currency: 'MNT', amount: 1 }, sellerLogin.body.token);
    assert.equal(payout.status, 422);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

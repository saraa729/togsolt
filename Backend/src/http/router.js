'use strict';

const fs = require('fs');
const path = require('path');
const { UPLOAD_DIR } = require('../config/constants');
const logger = require('../observability/logger');
const metrics = require('../observability/metrics');

const routes = [];

function securityHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cross-origin-resource-policy': 'cross-origin'
  };
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...securityHeaders(),
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-csrf-token'
  });
  res.end(payload);
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    ...securityHeaders(),
    'content-type': contentType,
    'access-control-allow-origin': '*'
  });
  res.end(body);
}

function setCookie(res, cookie) {
  const existing = res.getHeader('set-cookie');
  const next = Array.isArray(existing) ? [...existing, cookie] : existing ? [existing, cookie] : [cookie];
  res.setHeader('set-cookie', next);
}

function routePattern(pattern) {
  const names = [];
  const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, (m) => {
    names.push(m.slice(1));
    return '([^/]+)';
  })}$`);
  return { regex, names };
}

function route(method, pattern, handler) {
  routes.push({ method, pattern, ...routePattern(pattern), handler });
}

async function handle(req, res) {
  const started = Date.now();
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  const mutates = ['POST', 'PATCH', 'DELETE'].includes(req.method);
  if (mutates && req.headers.cookie && !req.headers.authorization && !req.headers['x-csrf-token']) {
    return send(res, 403, { error: { code: 'csrf_required', message: 'CSRF token is required for cookie-authenticated requests.' } });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/uploads/')) {
    const name = path.basename(url.pathname);
    const filePath = path.join(UPLOAD_DIR, name);
    if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) return send(res, 404, { error: { code: 'not_found', message: 'File not found.' } });
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    res.writeHead(200, {
      ...securityHeaders(),
      'content-type': type,
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=31536000, immutable'
    });
    fs.createReadStream(filePath).pipe(res);
    return undefined;
  }
  const found = routes
    .filter((candidate) => candidate.method === req.method && candidate.regex.test(url.pathname))
    .sort((a, b) => a.names.length - b.names.length || b.pattern.length - a.pattern.length)[0];
  if (!found) {
    metrics.recordRequest(req.method, url.pathname, 404, Date.now() - started);
    return send(res, 404, { error: { code: 'not_found', message: 'Route not found.' } });
  }
  const match = url.pathname.match(found.regex);
  const params = {};
  found.names.forEach((name, index) => {
    params[name] = decodeURIComponent(match[index + 1]);
  });
  try {
    const result = await found.handler({ req, res, url, params, user: null, setCookie, sendText });
    metrics.recordRequest(req.method, found.pattern, res.statusCode || 200, Date.now() - started);
    logger.info('http.request', { method: req.method, path: url.pathname, route: found.pattern, status: res.statusCode || 200, durationMs: Date.now() - started });
    if (!res.writableEnded && result !== undefined) send(res, 200, result);
  } catch (error) {
    const status = error.status || 500;
    metrics.recordRequest(req.method, found.pattern, status, Date.now() - started);
    logger.error('http.error', { method: req.method, path: url.pathname, route: found.pattern, status, code: error.code, durationMs: Date.now() - started });
    send(res, status, {
      error: {
        code: error.code || 'internal_error',
        message: status === 500 ? 'Internal server error.' : error.message,
        details: error.details
      }
    });
    if (status === 500) console.error(error);
  }
}

module.exports = { route, handle, routes };

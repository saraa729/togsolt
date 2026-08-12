'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const { UPLOAD_DIR, CORS_ORIGINS, NODE_ENV } = require('../config/constants');
const logger = require('../observability/logger');
const metrics = require('../observability/metrics');
import type { NextFunction, Request, Response } from 'express';
import type { HttpMethod, RegisteredRoute, RouteHandler } from '../types';

const app = express();
const routes: RegisteredRoute[] = [];

function securityHeaders(): Record<string, string> {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cross-origin-resource-policy': 'cross-origin'
  };
}

function corsOrigin(req?: Request | { headers?: Record<string, any> }) {
  const origin = String(req?.headers?.origin || '').replace(/\/$/, '');
  if (origin && CORS_ORIGINS.includes(origin)) return origin;
  if (origin && NODE_ENV === 'production') {
    try {
      const { hostname } = new URL(origin);
      const isExpocraftDomain = hostname === 'expocraft.mn' || hostname === 'www.expocraft.mn';
      const isVercelPreview = hostname.endsWith('.vercel.app') && hostname.startsWith('togsolt-');
      if (isExpocraftDomain || isVercelPreview) return origin;
    } catch {
      return CORS_ORIGINS[0] || '*';
    }
  }
  if (origin && NODE_ENV !== 'production') {
    try {
      const { hostname } = new URL(origin);
      const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
      const isPrivateLan =
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
      if (isLocalhost || isPrivateLan) return origin;
    } catch {
      return CORS_ORIGINS[0] || '*';
    }
  }
  return CORS_ORIGINS[0] || '*';
}

function applyCommonHeaders(res: Response) {
  const headers = {
    ...securityHeaders(),
    'access-control-allow-origin': corsOrigin((res as any).req),
    'vary': 'Origin',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-csrf-token'
  };
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
}

function setStatus(res: Response, status: number) {
  if (typeof res.status === 'function') res.status(status);
  else res.statusCode = status;
}

function send(res: Response, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  applyCommonHeaders(res);
  setStatus(res, status);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(payload);
}

function sendText(res: Response, status: number, body: string, contentType = 'text/plain; charset=utf-8') {
  applyCommonHeaders(res);
  setStatus(res, status);
  res.setHeader('content-type', contentType);
  res.end(body);
}

function setCookie(res: Response, cookie: string) {
  const existing = res.getHeader('set-cookie');
  const next = Array.isArray(existing) ? [...existing.map(String), cookie] : existing ? [String(existing), cookie] : [cookie];
  res.setHeader('set-cookie', next);
}

function routePattern(pattern: string) {
  const names: string[] = [];
  const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, (match) => {
    names.push(match.slice(1));
    return '([^/]+)';
  })}$`);
  return { regex, names };
}

function orderedRoutes() {
  return [...routes].sort((a, b) => (a.names?.length || 0) - (b.names?.length || 0) || b.pattern.length - a.pattern.length);
}

function route(method: HttpMethod, pattern: string, handler: RouteHandler) {
  routes.push({ method, pattern, handler, ...routePattern(pattern) });
}

function registerExpressRoute(registered: RegisteredRoute) {
  const { method, pattern, handler } = registered;
  const expressMethod = method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete';
  app[expressMethod](pattern, async (req: Request, res: Response) => {
    const started = Date.now();
    const url = new URL(req.originalUrl || req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      const result = await handler({
        req,
        res,
        url,
        params: Object.fromEntries(Object.entries(req.params || {}).map(([key, value]) => [key, String(value)])),
        user: null,
        setCookie,
        sendText
      });
      metrics.recordRequest(method, pattern, res.statusCode || 200, Date.now() - started);
      logger.info('http.request', { method, path: url.pathname, route: pattern, status: res.statusCode || 200, durationMs: Date.now() - started });
      if (!res.writableEnded && result !== undefined) send(res, 200, result);
    } catch (error) {
      const typedError = error as Error & { status?: number; code?: string; details?: unknown };
      const status = typedError.status || 500;
      metrics.recordRequest(method, pattern, status, Date.now() - started);
      logger.error('http.error', { method, path: url.pathname, route: pattern, status, code: typedError.code, durationMs: Date.now() - started });
      send(res, status, {
        error: {
          code: typedError.code || 'internal_error',
          message: status === 500 ? 'Internal server error.' : typedError.message,
          details: typedError.details
        }
      });
      if (status === 500) console.error(error);
    }
  });
}

app.use((req: Request, res: Response, next: NextFunction) => {
  applyCommonHeaders(res);
  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }
  const mutates = ['POST', 'PATCH', 'DELETE'].includes(req.method);
  if (mutates && req.headers.cookie && !req.headers.authorization && !req.headers['x-csrf-token']) {
    send(res, 403, { error: { code: 'csrf_required', message: 'CSRF token is required for cookie-authenticated requests.' } });
    return;
  }
  next();
});

app.get('/uploads/:fileName', (req: Request, res: Response) => {
  const name = path.basename(String(req.params.fileName || ''));
  const filePath = path.join(UPLOAD_DIR, name);
  if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) {
    return send(res, 404, { error: { code: 'not_found', message: 'Route not found.' } });
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.avif' ? 'image/avif' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
  res.writeHead(200, {
    ...securityHeaders(),
    'content-type': type,
    'access-control-allow-origin': corsOrigin(req),
    'vary': 'Origin',
    'cache-control': 'public, max-age=31536000, immutable'
  });
  fs.createReadStream(filePath).pipe(res);
});

let finalized = false;

function finalizeRoutes() {
  if (finalized) return;
  finalized = true;
  for (const registered of orderedRoutes()) {
    registerExpressRoute(registered);
  }
  app.use((req: Request, res: Response) => {
    metrics.recordRequest(req.method, req.path, 404, 0);
    send(res, 404, { error: { code: 'not_found', message: 'Route not found.' } });
  });
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
    const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.avif' ? 'image/avif' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    res.writeHead(200, {
      ...securityHeaders(),
      'content-type': type,
      'access-control-allow-origin': corsOrigin(req),
      'vary': 'Origin',
      'cache-control': 'public, max-age=31536000, immutable'
    });
    fs.createReadStream(filePath).pipe(res);
    return undefined;
  }
  const found = orderedRoutes().find((candidate) => candidate.method === req.method && candidate.regex?.test(url.pathname));
  if (!found) {
    metrics.recordRequest(req.method, url.pathname, 404, Date.now() - started);
    return send(res, 404, { error: { code: 'not_found', message: 'Route not found.' } });
  }
  const match = url.pathname.match(found.regex);
  const params = {};
  (found.names || []).forEach((name, index) => {
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

module.exports = { app, route, handle, routes, finalizeRoutes };

'use strict';

const { Readable, Writable } = require('node:stream');
const { once } = require('node:events');

class MockResponse extends Writable {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = Object.create(null);
    this.chunks = [];
  }

  _write(chunk, encoding, callback) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    callback();
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    for (const [key, value] of Object.entries(headers)) {
      this.headers[key.toLowerCase()] = value;
    }
    return this;
  }

  setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value;
  }

  getHeader(name) {
    return this.headers[String(name).toLowerCase()];
  }
}

function toReadableBody(body, headers, pathName, method) {
  if (body == null) return { stream: Readable.from([]), headers };

  if (body instanceof FormData) {
    const request = new Request(`http://test.local${pathName}`, { method, body });
    return {
      stream: Readable.fromWeb(request.body),
      headers: { ...headers, ...Object.fromEntries(request.headers.entries()) }
    };
  }

  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    return { stream: Readable.from([Buffer.from(body)]), headers };
  }

  if (typeof body === 'string') {
    return { stream: Readable.from([Buffer.from(body)]), headers };
  }

  return {
    stream: Readable.from([Buffer.from(JSON.stringify(body))]),
    headers: headers['content-type'] ? headers : { ...headers, 'content-type': 'application/json' }
  };
}

async function request(handle, { method, pathName, body, token, headers = {} }) {
  const normalizedHeaders = {
    host: 'test.local',
    ...headers
  };
  if (token) normalizedHeaders.authorization = `Bearer ${token}`;

  const bodyInfo = toReadableBody(body, normalizedHeaders, pathName, method);
  const req = bodyInfo.stream;
  req.method = method;
  req.url = pathName;
  req.headers = bodyInfo.headers;

  const res = new MockResponse();
  const finished = once(res, 'finish');
  await handle(req, res);
  if (!res.writableEnded) res.end();
  await finished;

  const contentType = String(res.getHeader('content-type') || '');
  const buffer = Buffer.concat(res.chunks);
  const text = buffer.toString('utf8');
  let parsed = text;
  if (contentType.includes('application/json')) {
    parsed = text ? JSON.parse(text) : {};
  }

  const headerBag = {
    ...res.headers,
    get(name) {
      const value = this[String(name).toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    }
  };

  return {
    status: res.statusCode,
    headers: headerBag,
    body: parsed,
    text
  };
}

module.exports = { request };

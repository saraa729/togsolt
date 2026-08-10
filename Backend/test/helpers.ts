'use strict';

const { Readable, Writable } = require('node:stream');
const { once } = require('node:events');

type HeaderBag = Record<string, string | string[] | undefined>;

class MockResponse extends Writable {
  statusCode: number;
  headers: HeaderBag;
  chunks: Buffer[];

  constructor() {
    super();
    this.statusCode = 200;
    this.headers = Object.create(null);
    this.chunks = [];
  }

  _write(chunk: Buffer | string, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    callback();
  }

  writeHead(statusCode: number, headers: HeaderBag = {}) {
    this.statusCode = statusCode;
    for (const [key, value] of Object.entries(headers)) {
      this.headers[key.toLowerCase()] = value;
    }
    return this;
  }

  setHeader(name: string, value: string | string[]) {
    this.headers[String(name).toLowerCase()] = value;
  }

  getHeader(name: string) {
    return this.headers[String(name).toLowerCase()];
  }
}

function toReadableBody(body: unknown, headers: HeaderBag, pathName: string, method: string) {
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

type TestRequestOptions = {
  method: string;
  pathName: string;
  body?: unknown;
  token?: string;
  headers?: HeaderBag;
};

async function request(handle: (req: any, res: any) => Promise<void> | void, { method, pathName, body, token, headers = {} }: TestRequestOptions) {
  const normalizedHeaders: HeaderBag = {
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
    get(name: string) {
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

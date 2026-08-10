'use strict';

const net = require('net');
const tls = require('tls');

type RuntimeStore = {
  provider?: string;
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  incr(key: string, ttlMs?: number): Promise<number>;
  del(key: string): Promise<void>;
};

type PendingCommand = {
  resolve(value: unknown): void;
  reject(error: Error): void;
};

function encodeRedisCommand(parts: unknown[]): string {
  const items = parts.map((part) => String(part));
  return `*${items.length}\r\n${items.map((item) => `$${Buffer.byteLength(item)}\r\n${item}\r\n`).join('')}`;
}

function parseRedisValue(buffer: Buffer, offset = 0): { value: unknown; offset: number } | null {
  if (offset >= buffer.length) return null;
  const type = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf('\r\n', offset);
  if (lineEnd === -1) return null;
  const line = buffer.slice(offset + 1, lineEnd).toString();
  const next = lineEnd + 2;

  if (type === '+') return { value: line, offset: next };
  if (type === ':') return { value: Number(line), offset: next };
  if (type === '-') {
    const error = new Error(line);
    (error as Error & { redis?: boolean }).redis = true;
    throw error;
  }
  if (type === '$') {
    const length = Number(line);
    if (length === -1) return { value: null, offset: next };
    const end = next + length;
    if (buffer.length < end + 2) return null;
    return { value: buffer.slice(next, end).toString(), offset: end + 2 };
  }
  if (type === '*') {
    const length = Number(line);
    if (length === -1) return { value: null, offset: next };
    const values = [];
    let cursor = next;
    for (let index = 0; index < length; index += 1) {
      const parsed = parseRedisValue(buffer, cursor);
      if (!parsed) return null;
      values.push(parsed.value);
      cursor = parsed.offset;
    }
    return { value: values, offset: cursor };
  }
  throw new Error(`Unsupported Redis response type: ${type}`);
}

class RedisRuntimeClient {
  url: URL;
  socket: any;
  buffer: Buffer;
  pending: PendingCommand[];
  ready: Promise<void> | null;

  constructor(redisUrl: string) {
    this.url = new URL(redisUrl);
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.pending = [];
    this.ready = null;
  }

  async connect() {
    if (this.socket && !this.socket.destroyed) return;
    if (this.ready) return this.ready;

    this.ready = new Promise((resolve, reject) => {
      const secure = this.url.protocol === 'rediss:';
      const port = Number(this.url.port || (secure ? 6380 : 6379));
      const host = this.url.hostname || 'localhost';
      const socket = secure ? tls.connect({ host, port }) : net.connect({ host, port });
      this.socket = socket;

      socket.on('data', (chunk) => this.onData(chunk));
      socket.on('error', (error) => {
        this.rejectAll(error);
        if (this.ready) {
          reject(error);
          this.ready = null;
        }
      });
      socket.on('close', () => {
        this.socket = null;
        this.ready = null;
        this.rejectAll(new Error('Redis connection closed.'));
      });
      socket.once('connect', async () => {
        try {
          await this.authenticate();
          await this.selectDatabase();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    return this.ready;
  }

  async authenticate() {
    const username = decodeURIComponent(this.url.username || '');
    const password = decodeURIComponent(this.url.password || '');
    if (!password) return;
    if (username) await this.command(['AUTH', username, password], false);
    else await this.command(['AUTH', password], false);
  }

  async selectDatabase() {
    const db = this.url.pathname.replace(/^\//, '');
    if (!db) return;
    await this.command(['SELECT', db], false);
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.pending.length > 0) {
      let parsed;
      try {
        parsed = parseRedisValue(this.buffer);
      } catch (error) {
        const pending = this.pending.shift();
        if (pending) pending.reject(error);
        const nextLine = this.buffer.indexOf('\r\n');
        this.buffer = nextLine === -1 ? Buffer.alloc(0) : this.buffer.slice(nextLine + 2);
        continue;
      }
      if (!parsed) break;
      this.buffer = this.buffer.slice(parsed.offset);
      const pending = this.pending.shift();
      if (pending) pending.resolve(parsed.value);
    }
  }

  rejectAll(error) {
    while (this.pending.length > 0) {
      const pending = this.pending.shift();
      if (pending) pending.reject(error);
    }
  }

  async command(parts: unknown[], ensureConnected = true): Promise<unknown> {
    if (ensureConnected) await this.connect();
    if (!this.socket || this.socket.destroyed) throw new Error('Redis is not connected.');
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.socket.write(encodeRedisCommand(parts));
    });
  }
}

function createMemoryStore() {
  const values = new Map();
  const store: RuntimeStore = {
    provider: 'memory',
    async get(key) {
      const item = values.get(key);
      if (!item) return null;
      if (item.expiresAt && item.expiresAt < Date.now()) {
        values.delete(key);
        return null;
      }
      return item.value;
    },
    async set(key, value, ttlMs) {
      values.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : null });
    },
    async incr(key, ttlMs) {
      const current = Number(await this.get(key) || 0) + 1;
      await this.set(key, current, ttlMs);
      return current;
    },
    async del(key) {
      values.delete(key);
    }
  };
  return store;
}

function createRedisStore(redisUrl: string) {
  const client = new RedisRuntimeClient(redisUrl);
  const store: RuntimeStore = {
    provider: 'redis',
    async get(key) {
      const raw = await client.command(['GET', key]);
      if (raw === null || raw === undefined) return null;
      try {
        return JSON.parse(String(raw));
      } catch {
        return raw;
      }
    },
    async set(key, value, ttlMs) {
      const raw = JSON.stringify(value);
      if (ttlMs) await client.command(['SET', key, raw, 'PX', Math.max(1, Math.round(ttlMs))]);
      else await client.command(['SET', key, raw]);
    },
    async incr(key, ttlMs) {
      const value = Number(await client.command(['INCR', key]));
      if (ttlMs) await client.command(['PEXPIRE', key, Math.max(1, Math.round(ttlMs))]);
      return value;
    },
    async del(key) {
      await client.command(['DEL', key]);
    }
  };
  return store;
}

function createRuntimeStore() {
  if (process.env.REDIS_URL) return createRedisStore(process.env.REDIS_URL);
  return createMemoryStore();
}

module.exports = {
  createRuntimeStore,
  createMemoryStore,
  createRedisStore,
  RedisRuntimeClient,
  encodeRedisCommand,
  parseRedisValue
};

'use strict';

function createMemoryStore() {
  const values = new Map();
  return {
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
}

function createRuntimeStore() {
  if (process.env.REDIS_URL) {
    const memory = createMemoryStore();
    memory.provider = 'redis-ready-memory-fallback';
    return memory;
  }
  const memory = createMemoryStore();
  memory.provider = 'memory';
  return memory;
}

module.exports = { createRuntimeStore };

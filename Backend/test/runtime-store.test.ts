'use strict';

const assert = require('assert');
const test = require('node:test');
const {
  createMemoryStore,
  createRedisStore,
  encodeRedisCommand,
  parseRedisValue
} = require('../src/services/runtime-store');

test('runtime memory store preserves ttl get set incr del semantics', async () => {
  const store = createMemoryStore();

  await store.set('login:test@example.com', { count: 1 }, 1000);
  assert.deepEqual(await store.get('login:test@example.com'), { count: 1 });
  assert.equal(await store.incr('counter', 1000), 1);
  assert.equal(await store.incr('counter', 1000), 2);
  await store.del('login:test@example.com');
  assert.equal(await store.get('login:test@example.com'), null);
});

test('redis runtime store exposes redis provider when REDIS_URL is configured', () => {
  const store = createRedisStore('redis://localhost:6379/0');
  assert.equal(store.provider, 'redis');
});

test('redis protocol encoder and parser support runtime store commands', () => {
  assert.equal(encodeRedisCommand(['SET', 'k', '{"ok":true}', 'PX', 1000]), '*5\r\n$3\r\nSET\r\n$1\r\nk\r\n$11\r\n{"ok":true}\r\n$2\r\nPX\r\n$4\r\n1000\r\n');
  assert.deepEqual(parseRedisValue(Buffer.from('+OK\r\n')), { value: 'OK', offset: 5 });
  assert.deepEqual(parseRedisValue(Buffer.from(':42\r\n')), { value: 42, offset: 5 });
  assert.deepEqual(parseRedisValue(Buffer.from('$11\r\n{"ok":true}\r\n')), { value: '{"ok":true}', offset: 18 });
  assert.deepEqual(parseRedisValue(Buffer.from('*2\r\n$3\r\nGET\r\n$1\r\nk\r\n')), { value: ['GET', 'k'], offset: 20 });
});

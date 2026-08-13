'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { request: appRequest } = require('./helpers');

/*
 * Төлбөрийн урсгалын тест.
 *
 * Stripe рүү жинхэнэ дуудлага хийхгүйн тулд Checkout Session-ий хариуг л
 * дуурайсан жижиг сервер өргөж, `STRIPE_API_URL`-ээр тийш нь чиглүүлнэ.
 * Webhook-ийн гарын үсэг нь Stripe-ийн ЖИНХЭНЭ алгоритмаар (HMAC-SHA256 over
 * `${timestamp}.${rawBody}`) үүсгэгдэж шалгагдана.
 */

const STRIPE_WEBHOOK_SECRET = 'whsec_unit_test_secret';
const mockStripe = http.createServer((req: any, res: any) => {
  let body = '';
  req.on('data', (chunk: Buffer) => (body += chunk));
  req.on('end', () => {
    if (!req.url.startsWith('/v1/checkout/sessions')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: `not mocked: ${req.url}` } }));
    }
    const params = new URLSearchParams(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: `cs_test_${crypto.randomBytes(6).toString('hex')}`,
      url: 'https://checkout.stripe.com/c/pay/cs_test_mock',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
      metadata: { orderId: params.get('metadata[orderId]') },
      amount_total: Number(params.get('line_items[0][price_data][unit_amount]')),
      currency: params.get('line_items[0][price_data][currency]')
    }));
  });
});

const mockPort = 4567;
process.env.EXPOCRAFT_DATA_DIR = path.join(os.tmpdir(), `expocraft-payments-${Date.now()}`);
process.env.EXPOCRAFT_SEED = 'true';
process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
process.env.STRIPE_API_URL = `http://127.0.0.1:${mockPort}/v1`;

const { handle } = require('../app');

function call(method: string, pathName: string, body?: unknown, token?: string | null, headers = {}) {
  return appRequest(handle, { method, pathName, body, token, headers });
}

/** Stripe-ийн `Stripe-Signature` толгойг жинхэнэ томьёогоор нь бүтээнэ. */
function stripeSignature(rawBody: string, { secret = STRIPE_WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function stripeEvent(orderId: string, type = 'checkout.session.completed', eventId = `evt_${crypto.randomBytes(6).toString('hex')}`) {
  return JSON.stringify({ id: eventId, type, data: { object: { metadata: { orderId } } } });
}

async function login(email: string, password: string) {
  const response = await call('POST', '/auth/login', { email, password });
  assert.equal(response.status, 200, `login failed for ${email}`);
  return response.body.accessToken;
}

async function escrowEntryCount(adminToken: string, orderId: string) {
  const response = await call('GET', '/admin/escrow-ledger', null, adminToken);
  const entries = response.body.entries || response.body.ledger || [];
  return entries.filter((entry: any) => entry.orderId === orderId).length;
}

/**
 * Тухайн мөрийг эзэмшдэг seed урлаачийн токеныг олно. Демо урлаачид бүгд ижил
 * нууц үгтэй тул имэйлээр нь дараалан нэвтэрч `/me`-ээр таниулна.
 */
async function resolveSellerToken(sellerId: string) {
  const emails = ['seller@expocraft.mn', 'wood@expocraft.mn', 'silver@expocraft.mn', 'leather@expocraft.mn', 'deel@expocraft.mn', 'textile@expocraft.mn'];
  for (const email of emails) {
    const token = await login(email, 'seller12345');
    const profile = await call('GET', '/me', null, token);
    if (profile.body.user?.id === sellerId) return token;
  }
  assert.fail(`no seed artisan owns seller ${sellerId}`);
}

/** USD бүтээл сагсалж, төлөгдөөгүй захиалга үүсгэнэ. */
async function startUsdCheckout(buyerToken: string) {
  const catalog = await call('GET', '/products?limit=60&currency=USD');
  const product = catalog.body.products.find((item: any) => item.internationalPrice && item.shipsInternationally);
  assert.ok(product, 'seed must contain an internationally shippable USD product');

  await call('POST', '/cart/items', { productId: product.id, quantity: 1, currency: 'USD' }, buyerToken);
  const cart = await call('GET', '/cart?currency=USD', null, buyerToken);
  const checkout = await call('POST', '/checkout', {
    cartId: cart.body.cart.id,
    currency: 'USD',
    shippingAddress: { name: 'Test Buyer', phone: '99001122', country: 'US', city: 'New York', line1: '1 Craft St' },
    shippingSelections: {}
  }, buyerToken);
  return { checkout, product };
}

test.before(async () => {
  await new Promise((resolve) => mockStripe.listen(mockPort, resolve));
});

test.after(async () => {
  await new Promise((resolve) => mockStripe.close(resolve));
});

test('money keeps each currency at its own precision', () => {
  const { money, percentOfMoney, addMoney } = require('../src/utils/core');

  // Төгрөг бутархайгүй.
  assert.deepEqual(money(45000, 'MNT'), { amount: 45000, currency: 'MNT' });
  assert.deepEqual(money(45000.7, 'MNT'), { amount: 45001, currency: 'MNT' });

  // Доллар цент хадгална — өмнө нь $9.99 → $10 болж таслагддаг байсан.
  assert.deepEqual(money(9.99, 'USD'), { amount: 9.99, currency: 'USD' });
  assert.deepEqual(money(12.5, 'USD'), { amount: 12.5, currency: 'USD' });

  // Хөвөгч таслалын алдаа мөр бүр дээр таслагдана.
  assert.deepEqual(addMoney(money(0.1, 'USD'), money(0.2, 'USD')), { amount: 0.3, currency: 'USD' });
  assert.deepEqual(money(9.99 * 3, 'USD'), { amount: 29.97, currency: 'USD' });

  // Шимтгэл валютын нарийвчлалыг дагана ($1.20, бүхэл $1 биш).
  assert.deepEqual(percentOfMoney(money(9.99, 'USD'), 1200), { amount: 1.2, currency: 'USD' });
  assert.deepEqual(percentOfMoney(money(45000, 'MNT'), 1200), { amount: 5400, currency: 'MNT' });
});

test('checkout leaves the order unpaid until the provider confirms it', async () => {
  const buyer = await login('buyer@expocraft.mn', 'buyer12345');
  const admin = await login('admin@expocraft.mn', 'admin12345');
  const { checkout } = await startUsdCheckout(buyer);

  assert.equal(checkout.status, 200);
  const order = checkout.body.order;
  assert.equal(order.status, 'pending_payment');
  assert.equal(order.escrowStatus, 'pending');
  assert.equal(order.payment.status, 'pending');
  assert.equal(checkout.body.orderItems[0].status, 'pending_payment');

  // Мөнгө ороогүй тул escrow дэвтэрт нэг ч бичилт байж болохгүй.
  assert.equal(await escrowEntryCount(admin, order.id), 0);

  // Худалдан авагчийг Stripe-ийн hosted хуудас руу явуулах хаяг ирсэн байна.
  assert.equal(checkout.body.payment.provider, 'stripe');
  assert.match(checkout.body.payment.redirectUrl, /^https:\/\/checkout\.stripe\.com\//);
});

test('a confirmed stripe webhook captures the payment into escrow exactly once', async () => {
  const buyer = await login('buyer@expocraft.mn', 'buyer12345');
  const admin = await login('admin@expocraft.mn', 'admin12345');
  const { checkout } = await startUsdCheckout(buyer);
  const orderId = checkout.body.order.id;

  const payload = stripeEvent(orderId);
  const first = await call('POST', '/webhooks/payments/stripe', payload, null, {
    'content-type': 'application/json',
    'stripe-signature': stripeSignature(payload)
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.callback.status, 'captured');

  const settled = await call('GET', `/orders/${orderId}/payment`, null, buyer);
  assert.equal(settled.body.status, 'paid');
  assert.equal(settled.body.escrowStatus, 'held');
  assert.equal(settled.body.payment.status, 'captured');

  // capture + hold + commission = 3 бичилт
  assert.equal(await escrowEntryCount(admin, orderId), 3);

  // Provider нэг үйл явдлыг давтан илгээж болно — ledger давхарлаж болохгүй.
  const replay = await call('POST', '/webhooks/payments/stripe', payload, null, {
    'content-type': 'application/json',
    'stripe-signature': stripeSignature(payload)
  });
  assert.equal(replay.body.idempotent, true);
  assert.equal(await escrowEntryCount(admin, orderId), 3);
});

test('the payment webhook rejects every unverified signature', async () => {
  const buyer = await login('buyer@expocraft.mn', 'buyer12345');
  const { checkout } = await startUsdCheckout(buyer);
  const orderId = checkout.body.order.id;
  const payload = stripeEvent(orderId);
  const json = { 'content-type': 'application/json' };

  const missing = await call('POST', '/webhooks/payments/stripe', payload, null, json);
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, 'signature_missing');

  const garbage = await call('POST', '/webhooks/payments/stripe', payload, null,
    { ...json, 'stripe-signature': `t=${Math.floor(Date.now() / 1000)},v1=deadbeef` });
  assert.equal(garbage.status, 400);
  assert.equal(garbage.body.error.code, 'signature_invalid');

  const wrongKey = await call('POST', '/webhooks/payments/stripe', payload, null,
    { ...json, 'stripe-signature': stripeSignature(payload, { secret: 'whsec_attacker' }) });
  assert.equal(wrongKey.status, 400);
  assert.equal(wrongKey.body.error.code, 'signature_invalid');

  // Replay: гарын үсэг нь зөв ч цаг нь хэтэрсэн.
  const stale = await call('POST', '/webhooks/payments/stripe', payload, null,
    { ...json, 'stripe-signature': stripeSignature(payload, { timestamp: Math.floor(Date.now() / 1000) - 600 }) });
  assert.equal(stale.status, 400);
  assert.equal(stale.body.error.code, 'signature_expired');

  // Тохируулаагүй provider руу хандах.
  const unknown = await call('POST', '/webhooks/payments/hacker', payload, null, json);
  assert.equal(unknown.status, 404);

  // Аль нь ч захиалгыг хөндөөгүй байх ёстой.
  const untouched = await call('GET', `/orders/${orderId}/payment`, null, buyer);
  assert.equal(untouched.body.status, 'pending_payment');
});

test('a webhook for another order never settles this one', async () => {
  const buyer = await login('buyer@expocraft.mn', 'buyer12345');
  const { checkout } = await startUsdCheckout(buyer);
  const orderId = checkout.body.order.id;

  const payload = stripeEvent('ord_belongs_to_someone_else');
  const response = await call('POST', '/webhooks/payments/stripe', payload, null, {
    'content-type': 'application/json',
    'stripe-signature': stripeSignature(payload)
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.callback.status, 'ignored');

  const untouched = await call('GET', `/orders/${orderId}/payment`, null, buyer);
  assert.equal(untouched.body.status, 'pending_payment');
});

test('a failed payment cancels the order and returns the reserved stock', async () => {
  const buyer = await login('buyer@expocraft.mn', 'buyer12345');
  const { checkout, product } = await startUsdCheckout(buyer);
  const orderId = checkout.body.order.id;

  const reserved = await call('GET', `/products/${product.id}`);
  const stockWhileReserved = (reserved.body.product || reserved.body).stock;

  const payload = stripeEvent(orderId, 'checkout.session.expired');
  const response = await call('POST', '/webhooks/payments/stripe', payload, null, {
    'content-type': 'application/json',
    'stripe-signature': stripeSignature(payload)
  });
  assert.equal(response.body.callback.status, 'failed');

  const failed = await call('GET', `/orders/${orderId}/payment`, null, buyer);
  assert.equal(failed.body.status, 'payment_failed');
  assert.equal(failed.body.escrowStatus, 'not_required');

  const released = await call('GET', `/products/${product.id}`);
  const stockAfterFailure = (released.body.product || released.body).stock;
  assert.equal(stockAfterFailure, stockWhileReserved + 1, 'stock reserved at checkout must be released again');
});

test('sellers cannot work an order that has not been paid for', async () => {
  const buyer = await login('buyer@expocraft.mn', 'buyer12345');
  const { checkout } = await startUsdCheckout(buyer);
  const orderItem = checkout.body.orderItems[0];

  const sellerToken = await resolveSellerToken(orderItem.sellerId);

  const blocked = await call('PATCH', `/seller/order-items/${orderItem.id}/status`, { status: 'accepted' }, sellerToken);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, 'order_not_paid');
});

test('order item status only moves forward and locks once settled', async () => {
  const buyer = await login('buyer@expocraft.mn', 'buyer12345');
  const { checkout } = await startUsdCheckout(buyer);
  const orderId = checkout.body.order.id;
  const orderItem = checkout.body.orderItems[0];

  const payload = stripeEvent(orderId);
  await call('POST', '/webhooks/payments/stripe', payload, null, {
    'content-type': 'application/json',
    'stripe-signature': stripeSignature(payload)
  });

  const sellerToken = await resolveSellerToken(orderItem.sellerId);

  const setStatus = (status: string) =>
    call('PATCH', `/seller/order-items/${orderItem.id}/status`, { status }, sellerToken);

  assert.equal((await setStatus('accepted')).body.orderItem.status, 'accepted');

  // Бэлэн бүтээл `making`-г алгасаж болно.
  assert.equal((await setStatus('shipped')).body.orderItem.status, 'shipped');

  // Ухрахыг хориглоно — эс бөгөөс явцын мөр худал мэдээлэл харуулна.
  const backwards = await setStatus('making');
  assert.equal(backwards.status, 409);
  assert.equal(backwards.body.error.code, 'invalid_status_transition');

  assert.equal((await setStatus('delivered')).body.orderItem.status, 'delivered');

  // Хүргэгдсэн барааг цуцалж болохгүй — маргаанаар шийднэ.
  const cancelled = await setStatus('cancelled');
  assert.equal(cancelled.status, 409);
  assert.equal(cancelled.body.error.code, 'cancel_not_allowed');

  // Худалдан авагч баталгаажуулсны дараа мөр бүрмөсөн хаагдана.
  await call('POST', `/orders/${orderId}/confirm-received`, {}, buyer);
  const locked = await setStatus('shipped');
  assert.equal(locked.status, 409);
  assert.equal(locked.body.error.code, 'order_item_locked');
});

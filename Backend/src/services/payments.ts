'use strict';

const crypto = require('crypto');

/*
 * ── Төлбөрийн үйлчилгээ ───────────────────────────────────────────────────
 *
 * Гурван provider:
 *   stripe     — USD. Stripe Checkout Session (hosted хуудас), картын мэдээлэл
 *                бидэн дээр огт ирэхгүй тул PCI хамрах хүрээ хамгийн бага.
 *   qpay       — MNT. QPay v2 нэхэмжлэх + QR.
 *   simulated  — Тохиргоо байхгүй үеийн demo горим. Checkout дарахад шууд
 *                баталгаажихгүй; buyer demo баталгаажуулах үйлдэл хийсний
 *                дараа л escrow-д орно. `EXPOCRAFT_PAYMENT_MODE=live` үед энэ
 *                горимыг хориглоно — production дээр хуурамч төлбөрөөс сэргийлнэ.
 *
 * Захиалга `pending_payment` төлөвөөр үүсээд, provider-ийн баталгаажуулалт
 * (webhook/callback) ирж байж л `paid` болж escrow-д орно.
 */

/** `STRIPE_API_URL` нь зөвхөн туршилтад (stripe-mock) — production дээр тавихгүй. */
const STRIPE_API = String(process.env.STRIPE_API_URL || 'https://api.stripe.com/v1').replace(/\/$/, '');

/** Stripe-д бутархайгүй илэрхийлэгддэг валютууд — эдгээрийг 100-аар үржүүлэхгүй. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'MNT',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
]);

function minorUnits(amount: number, currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return Math.round(Number(amount || 0));
  return Math.round(Number(amount || 0) * 100);
}

function trimUrl(value: string, fallback: string): string {
  return String(value || fallback || '').trim().replace(/\/$/, '');
}

function createPaymentService({ db, id, now, money, httpError, audit, saveState, addEscrowEntry, logger }: any) {
  const log = logger || console;

  function mode(): string {
    return String(process.env.EXPOCRAFT_PAYMENT_MODE || 'manual').toLowerCase();
  }

  function stripeConfigured(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  function qpayConfigured(): boolean {
    return Boolean(
      process.env.QPAY_CLIENT_ID && process.env.QPAY_CLIENT_SECRET && process.env.QPAY_INVOICE_CODE
    );
  }

  /** Валют бүрд аль provider ажиллахыг тохиргооны дагуу шийднэ. */
  function providerFor(currency: string): string {
    if (currency === 'USD') return stripeConfigured() ? 'stripe' : 'simulated';
    return qpayConfigured() ? 'qpay' : 'simulated';
  }

  function assertProviderUsable(provider: string, currency: string) {
    if (provider === 'simulated' && mode() === 'live') {
      throw httpError(
        503,
        'payment_provider_unavailable',
        `No payment provider is configured for ${currency} while EXPOCRAFT_PAYMENT_MODE=live.`
      );
    }
  }

  function webOrigin(): string {
    return trimUrl(process.env.EXPOCRAFT_WEB_ORIGIN, 'http://localhost:3000');
  }

  function publicApiUrl(): string {
    return trimUrl(process.env.EXPOCRAFT_PUBLIC_API_URL, 'http://localhost:4000');
  }

  /**
   * QPay гарын үсэг явуулдаггүй тул callback URL-д HMAC токен суулгана.
   * Токен таарсан ч мөнгө орсныг QPay-аас дахин асууж (`/payment/check`)
   * баталгаажуулна — токен нь зөвхөн эхний шүүлтүүр.
   */
  function callbackToken(orderId: string): string {
    const secret = process.env.QPAY_WEBHOOK_SECRET || process.env.JWT_SECRET || 'dev-secret-change-me';
    return crypto.createHmac('sha256', secret).update(`qpay:${orderId}`).digest('hex').slice(0, 32);
  }

  function verifyCallbackToken(orderId: string, token: string): boolean {
    return timingSafeEqualHex(callbackToken(orderId), String(token || ''));
  }

  function timingSafeEqualHex(expected: string, received: string): boolean {
    const a = Buffer.from(String(expected), 'utf8');
    const b = Buffer.from(String(received), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  // ── Stripe ───────────────────────────────────────────────────────────────

  async function stripeRequest(path: string, params: URLSearchParams, idempotencyKey?: string) {
    const response = await fetch(`${STRIPE_API}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'content-type': 'application/x-www-form-urlencoded',
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {})
      },
      body: params
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      log.error?.('stripe_error', data?.error?.message || response.status);
      throw httpError(502, 'stripe_error', data?.error?.message || 'Stripe rejected the payment request.', data);
    }
    return data;
  }

  async function createStripeSession(order: any) {
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('client_reference_id', order.id);
    params.set('success_url', `${webOrigin()}/orders?paid=${encodeURIComponent(order.id)}`);
    params.set('cancel_url', `${webOrigin()}/cart?canceled=${encodeURIComponent(order.id)}`);
    params.set('metadata[orderId]', order.id);
    params.set('payment_intent_data[metadata][orderId]', order.id);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', String(order.currency).toLowerCase());
    params.set('line_items[0][price_data][unit_amount]', String(minorUnits(order.subtotal.amount, order.currency)));
    params.set('line_items[0][price_data][product_data][name]', `ExpoCraft · ${order.id}`);

    const session = await stripeRequest('/checkout/sessions', params, `checkout_${order.id}`);
    return {
      provider: 'stripe',
      providerRef: session.id,
      status: 'pending',
      redirectUrl: session.url,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
    };
  }

  // ── QPay ─────────────────────────────────────────────────────────────────

  function qpayApi(): string {
    return trimUrl(process.env.QPAY_API_URL, 'https://merchant.qpay.mn/v2');
  }

  async function qpayToken(): Promise<string> {
    const basic = Buffer.from(
      `${process.env.QPAY_CLIENT_ID}:${process.env.QPAY_CLIENT_SECRET}`
    ).toString('base64');
    const response = await fetch(`${qpayApi()}/auth/token`, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}`, 'content-type': 'application/json' }
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      throw httpError(502, 'qpay_auth_failed', data?.message || 'QPay authentication failed.', data);
    }
    return data.access_token;
  }

  async function createQpayInvoice(order: any) {
    const token = await qpayToken();
    const callbackUrl =
      `${publicApiUrl()}/webhooks/payments/qpay` +
      `?order=${encodeURIComponent(order.id)}&token=${callbackToken(order.id)}`;

    const response = await fetch(`${qpayApi()}/invoice`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        invoice_code: process.env.QPAY_INVOICE_CODE,
        sender_invoice_no: order.id,
        invoice_receiver_code: 'terminal',
        invoice_description: `ExpoCraft ${order.id}`,
        amount: minorUnits(order.subtotal.amount, order.currency),
        callback_url: callbackUrl
      })
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || !data.invoice_id) {
      throw httpError(502, 'qpay_invoice_failed', data?.message || 'QPay invoice creation failed.', data);
    }
    return {
      provider: 'qpay',
      providerRef: data.invoice_id,
      status: 'pending',
      qrText: data.qr_text || null,
      qrImage: data.qr_image ? `data:image/png;base64,${data.qr_image}` : null,
      deepLinks: Array.isArray(data.urls) ? data.urls : []
    };
  }

  /** QPay-аас нэхэмжлэхийн бодит төлөв асууна — callback-д итгэхгүй. */
  async function checkQpayInvoice(invoiceId: string) {
    const token = await qpayToken();
    const response = await fetch(`${qpayApi()}/payment/check`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 100 }
      })
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw httpError(502, 'qpay_check_failed', data?.message || 'QPay payment check failed.', data);
    const paidAmount = Number(data.paid_amount || 0);
    const rows = Array.isArray(data.rows) ? data.rows : [];
    return { paid: paidAmount > 0 && rows.length > 0, paidAmount, raw: data };
  }

  // ── Нэхэмжлэх үүсгэх (нийтлэг оролт) ────────────────────────────────────

  async function createPayment(order: any) {
    const provider = providerFor(order.currency);
    assertProviderUsable(provider, order.currency);

    if (provider === 'stripe') return createStripeSession(order);
    if (provider === 'qpay') return createQpayInvoice(order);
    return {
      provider: 'simulated',
      providerRef: id('sim'),
      status: 'pending',
      qrText: `EXPOCRAFT-DEMO-PAY:${order.id}:${order.subtotal.amount}:${order.currency}`,
      simulated: true
    };
  }

  // ── Stripe webhook гарын үсэг ────────────────────────────────────────────

  /**
   * `Stripe-Signature: t=<timestamp>,v1=<hex>[,v1=<hex>]` толгойг шалгана.
   * Тэмдэгт мөрийг timing-safe харьцуулж, 5 минутаас хуучин цагийг няцаана
   * (replay халдлагаас сэргийлнэ).
   */
  function verifyStripeSignature(rawBody: Buffer, signatureHeader: string, toleranceSeconds = 300) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw httpError(503, 'webhook_secret_missing', 'STRIPE_WEBHOOK_SECRET is not configured.');
    if (!signatureHeader) throw httpError(400, 'signature_missing', 'Stripe-Signature header is required.');

    const parts = String(signatureHeader)
      .split(',')
      .map((part) => part.trim().split('='))
      .filter((pair) => pair.length === 2);
    const timestamp = parts.find(([key]) => key === 't')?.[1];
    const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
    if (!timestamp || !signatures.length) {
      throw httpError(400, 'signature_malformed', 'Stripe-Signature header could not be parsed.');
    }

    const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
    if (!Number.isFinite(age) || age > toleranceSeconds) {
      throw httpError(400, 'signature_expired', 'Stripe-Signature timestamp is outside the tolerance window.');
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest('hex');
    if (!signatures.some((signature) => timingSafeEqualHex(expected, signature))) {
      throw httpError(400, 'signature_invalid', 'Stripe-Signature does not match the request body.');
    }

    try {
      return JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw httpError(400, 'invalid_json', 'Webhook body must be valid JSON.');
    }
  }

  // ── Төлбөр баталгаажуулах (escrow-д оруулах) ────────────────────────────

  /**
   * Төлбөр батлагдмагц захиалгыг `paid` болгож, escrow-д оруулна. Webhook
   * давхардаж ирж болзошгүй тул ИДЕМПОТЕНТ — аль хэдийн `captured` бол дахин
   * ledger бичилт хийхгүй.
   */
  function capturePayment(order: any, { providerRef, provider, raw }: any = {}) {
    if (!order) throw httpError(404, 'order_not_found', 'Order was not found.');
    if (order.payment?.status === 'captured') return { order, alreadyCaptured: true };

    const items = db.orderItems.filter((item: any) => item.orderId === order.id);
    const method = provider || order.payment?.method || providerFor(order.currency);

    order.status = 'paid';
    order.escrowStatus = 'held';
    order.payment = {
      ...(order.payment || {}),
      method,
      status: 'captured',
      providerRef: providerRef || order.payment?.providerRef || null,
      capturedAt: now(),
      raw: raw || order.payment?.raw || null
    };
    order.lifecycle = Array.from(new Set([...(order.lifecycle || []), 'paid']));

    for (const item of items) {
      item.status = 'paid';
      item.escrowStatus = 'held';
      item.escrowHeldAt = now();
      item.updatedAt = now();
      addEscrowEntry(order.id, item.id, item.sellerId, `capture_${method}_payment`, item.lineTotal, `${method} payment captured by platform.`);
      addEscrowEntry(order.id, item.id, item.sellerId, 'hold_buyer_payment', item.lineTotal, 'Buyer payment captured and held by platform escrow.');
      addEscrowEntry(order.id, item.id, item.sellerId, 'reserve_platform_commission', item.commission, 'Commission reserved from held funds.');
    }

    /*
     * Гэрээтэй захиалга: төлбөр батлагдмагц гэрээ хэрэгжиж эхэлнэ. Урьдчилгааны
     * үе шатыг төлөгдсөнд тооцно — мөнгө нь escrow-д аль хэдийн орсон.
     */
    for (const item of items.filter((candidate: any) => candidate.customRequestId)) {
      const contract = db.contracts.find((candidate: any) => candidate.customRequestId === item.customRequestId);
      if (!contract || contract.status === 'cancelled') continue;
      contract.status = 'in_progress';
      contract.orderId = order.id;
      contract.orderItemId = item.id;
      const deposit = (contract.depositSchedule || []).find((milestone: any) => milestone.due === 'on_acceptance');
      if (deposit) {
        deposit.status = 'paid';
        deposit.paidAt = now();
      }
      contract.updatedAt = now();
    }

    audit('system', 'capture_payment', 'order', order.id, { provider: method, providerRef });
    saveState(db);
    return { order, alreadyCaptured: false };
  }

  /**
   * Төлбөр амжилтгүй/цуцлагдсан үед захиалгыг хааж, нөөцөлсөн үлдэгдлийг
   * буцаана. Escrow бичилт хийгээгүй тул ledger-т юу ч буцаах шаардлагагүй.
   */
  function failPayment(order: any, reason = 'payment_failed') {
    if (!order || order.payment?.status === 'captured') return { order, changed: false };
    if (order.status === 'payment_failed') return { order, changed: false };

    const items = db.orderItems.filter((item: any) => item.orderId === order.id);
    for (const item of items) {
      item.status = 'cancelled';
      item.updatedAt = now();
      const product = db.products.find((candidate: any) => candidate.id === item.productId);
      if (product && typeof product.stock === 'number') {
        product.stock += item.quantity;
        if (product.stock > 0 && product.status === 'sold') product.status = 'active';
      }
    }
    order.status = 'payment_failed';
    order.escrowStatus = 'not_required';
    order.payment = { ...(order.payment || {}), status: 'failed', failedAt: now(), failureReason: reason };
    audit('system', 'payment_failed', 'order', order.id, { reason });
    saveState(db);
    return { order, changed: true };
  }

  return {
    mode,
    providerFor,
    assertProviderUsable,
    stripeConfigured,
    qpayConfigured,
    createPayment,
    capturePayment,
    failPayment,
    verifyStripeSignature,
    verifyCallbackToken,
    checkQpayInvoice,
    minorUnits
  };
}

module.exports = { createPaymentService };

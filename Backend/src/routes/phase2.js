'use strict';

module.exports = function registerPhase2(ctx) {
  const {
    route,
    ROLES,
    CONTRACT_STATUS,
    db,
    now,
    id,
    money,
    httpError,
    saveState,
    audit,
    readJson,
    requireAuth,
    requireRole,
    assertText,
    assertLocalized,
    assertPositiveInt,
    assertMoneyAmount,
    assertSupportedCurrency,
    productResponse,
    localize,
    addEscrowEntry
  } = ctx;

  function sellerOwnsProduct(sellerId, productId) {
    return db.products.find((product) => product.id === productId && product.sellerId === sellerId);
  }

  route('POST', '/seller/coupons', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const body = await readJson(ctx.req);
    const type = body.type === 'amount' ? 'amount' : 'percent';
    const value = assertMoneyAmount(body.value, 'value');
    if (type === 'percent' && value > 100) throw httpError(422, 'validation_error', 'value must be at most 100 for a percent coupon.');
    const coupon = {
      id: id('cpn'),
      sellerId: user.id,
      code: assertText(body.code, 'code').toUpperCase(),
      type,
      value,
      currency: body.currency || 'MNT',
      minSubtotal: body.minSubtotal ? money(assertMoneyAmount(body.minSubtotal.amount, 'minSubtotal.amount'), body.minSubtotal.currency || body.currency || 'MNT') : null,
      startsAt: body.startsAt || now(),
      expiresAt: body.expiresAt || null,
      usageLimit: Number(body.usageLimit || 100),
      usedCount: 0,
      status: 'active',
      createdAt: now()
    };
    db.coupons.push(coupon);
    audit(user.id, 'create_coupon', 'coupon', coupon.id);
    saveState(db);
    return { coupon };
  });

  route('GET', '/seller/coupons', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const coupons = db.coupons
      .filter((item) => item.sellerId === user.id)
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { coupons };
  });

  route('POST', '/coupons/validate', async (ctx) => {
    requireAuth(ctx);
    const body = await readJson(ctx.req);
    const coupon = db.coupons.find((item) => item.code === assertText(body.code, 'code').toUpperCase() && item.status === 'active');
    if (!coupon || coupon.usedCount >= coupon.usageLimit) throw httpError(404, 'coupon_not_available', 'Coupon is not available.');
    return { coupon, discountPreview: coupon.type === 'percent' ? `${coupon.value}%` : money(coupon.value, coupon.currency) };
  });

  route('POST', '/seller/custom-requests/:requestId/contract', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const body = await readJson(ctx.req);
    const request = db.customRequests.find((item) => item.id === ctx.params.requestId && item.sellerId === user.id);
    if (!request || !request.quote) throw httpError(404, 'custom_request_not_quoted', 'Quoted custom request was not found.');
    const contract = {
      id: id('ctr'),
      customRequestId: request.id,
      sellerId: user.id,
      buyerId: request.buyerId,
      status: body.status || 'sent',
      scope: assertText(body.scope || request.message, 'scope'),
      total: request.quote.price,
      leadDays: request.quote.productionDays,
      depositSchedule: Array.isArray(body.depositSchedule) ? body.depositSchedule : [
        { id: id('mil'), label: 'Deposit', due: 'on_acceptance', percent: 50, status: 'pending' },
        { id: id('mil'), label: 'Completion', due: 'before_delivery', percent: 50, status: 'pending' }
      ],
      createdAt: now(),
      updatedAt: now()
    };
    if (!CONTRACT_STATUS.includes(contract.status)) throw httpError(422, 'invalid_contract_status', 'Invalid contract status.');
    db.contracts.push(contract);
    audit(user.id, 'create_contract', 'contract', contract.id);
    saveState(db);
    return { contract };
  });

  route('GET', '/contracts', async (ctx) => {
    const user = requireAuth(ctx);
    const contracts = db.contracts
      .filter((item) => item.buyerId === user.id || item.sellerId === user.id)
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    return { contracts };
  });

  route('POST', '/contracts/:contractId/accept', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const contract = db.contracts.find((item) => item.id === ctx.params.contractId && item.buyerId === user.id);
    if (!contract) throw httpError(404, 'contract_not_found', 'Contract was not found.');
    contract.status = 'accepted';
    contract.acceptedAt = now();
    contract.updatedAt = now();

    /*
     * Гэрээг зөвшөөрөх нь үнийн саналыг зөвшөөрсөнтэй адил утгатай. Холбогдох
     * захиалгыг `accepted` болгосноор `POST /cart/custom-requests/:id`-аар
     * сагсанд орж, ердийн escrow-той төлбөрөөр өнгөрнө — гэрээ тусдаа хоёр
     * дахь төлбөрийн суваг үүсгэхгүй.
     */
    const request = db.customRequests.find((item) => item.id === contract.customRequestId);
    if (request && request.status === 'quoted') {
      request.status = 'accepted';
      request.updatedAt = now();
      audit(user.id, 'accept_custom_quote', 'custom_request', request.id, { contractId: contract.id });
    }

    audit(user.id, 'accept_contract', 'contract', contract.id);
    saveState(db);
    return { contract, customRequest: request || null };
  });

  route('PATCH', '/seller/order-items/:itemId/shipment', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const body = await readJson(ctx.req);
    const item = db.orderItems.find((candidate) => candidate.id === ctx.params.itemId && candidate.sellerId === user.id);
    if (!item) throw httpError(404, 'order_item_not_found', 'Seller order item was not found.');
    let shipment = db.shipments.find((candidate) => candidate.orderItemId === item.id);
    if (!shipment) {
      shipment = { id: id('shp'), orderId: item.orderId, orderItemId: item.id, sellerId: user.id, events: [], createdAt: now() };
      db.shipments.push(shipment);
    }
    shipment.method = body.method || item.shippingOption?.code || 'domestic_city';
    shipment.carrier = body.carrier || shipment.carrier || null;
    shipment.trackingCode = body.trackingCode || shipment.trackingCode || null;
    shipment.status = body.status || shipment.status || 'label_created';
    shipment.events.push({ status: shipment.status, location: body.location || null, note: body.note || '', createdAt: now() });
    shipment.updatedAt = now();
    item.tracking = { carrier: shipment.carrier, trackingCode: shipment.trackingCode };
    audit(user.id, 'update_shipment', 'shipment', shipment.id);
    saveState(db);
    return { shipment };
  });

  route('POST', '/webhooks/logistics/tracking', async (ctx) => {
    const body = await readJson(ctx.req);
    const shipment = db.shipments.find((item) => item.trackingCode === body.trackingCode);
    if (!shipment) throw httpError(404, 'shipment_not_found', 'Shipment was not found.');
    shipment.status = body.status || shipment.status;
    shipment.events.push({ status: shipment.status, location: body.location || null, note: body.note || '', raw: body, createdAt: now() });
    shipment.updatedAt = now();
    audit('system', 'logistics_tracking_callback', 'shipment', shipment.id);
    saveState(db);
    return { shipment };
  });

  route('POST', '/ai/products/suggest', async (ctx) => {
    requireRole(ctx, [ROLES.SELLER, ROLES.ADMIN]);
    const body = await readJson(ctx.req);
    const text = `${body.title || ''} ${body.description || ''} ${(body.imageHints || []).join(' ')}`.toLowerCase();
    const material = text.includes('felt') || text.includes('эсгий') ? 'felt' : text.includes('leather') || text.includes('арьс') ? 'leather' : 'wood';
    return {
      suggestions: {
        categorySlug: material === 'felt' ? 'felt-craft' : material === 'leather' ? 'leather-craft' : 'wood-craft',
        materials: [material],
        techniques: material === 'felt' ? ['hand_felting'] : material === 'leather' ? ['hand_stitching'] : ['hand_carving'],
        translation: body.mn ? { en: `[Draft translation] ${body.mn}` } : {},
        tags: ['handmade', 'mongolian-craft']
      }
    };
  });

  route('GET', '/recommendations', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const locale = ctx.url.searchParams.get('locale') || user.locale || 'mn';
    const currency = ctx.url.searchParams.get('currency') || 'MNT';
    const favoriteIds = new Set(db.favorites.filter((item) => item.userId === user.id).map((item) => item.productId));
    const favoriteMaterials = new Set(db.products.filter((product) => favoriteIds.has(product.id)).flatMap((product) => product.materials || []));
    const products = db.products
      .filter((product) => product.status === 'active' && (!favoriteIds.has(product.id)))
      .sort((a, b) => Number((b.materials || []).some((material) => favoriteMaterials.has(material))) - Number((a.materials || []).some((material) => favoriteMaterials.has(material))))
      .slice(0, 8)
      .map((product) => productResponse(product, locale, currency));
    return { products };
  });

  route('POST', '/webhooks/payments/:provider', async (ctx) => {
    const body = await readJson(ctx.req);
    const provider = ctx.params.provider;
    const eventId = assertText(body.eventId || body.id || body.invoiceId, 'eventId');
    const existing = db.paymentCallbacks.find((item) => item.provider === provider && item.eventId === eventId);
    if (existing) return { idempotent: true, callback: existing };
    const callback = { id: id('pcb'), provider, eventId, status: body.status || 'received', raw: body, createdAt: now() };
    db.paymentCallbacks.push(callback);
    if (body.orderId && body.amount && body.currency) {
      addEscrowEntry(body.orderId, null, body.sellerId || null, `webhook_${provider}_${callback.status}`, money(body.amount, body.currency), 'Idempotent payment callback recorded.');
    }
    audit('system', 'payment_callback', 'payment_callback', callback.id, { provider, eventId });
    saveState(db);
    return { idempotent: false, callback };
  });
};

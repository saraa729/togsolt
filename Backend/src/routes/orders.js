'use strict';

module.exports = function registerOrders(ctx) {
  const {
    route,
    ROLES,
    ORDER_ITEM_STATUS,
    CUSTOM_STATUS,
    PRODUCT_STATUS,
    REPORT_STATUS,
    db,
    now,
    id,
    money,
    addMoney,
    percentBps,
    httpError,
    verifyPassword,
    createUserRecord,
    saveState,
    audit,
    publicUser,
    localize,
    readJson,
    requireAuth,
    requireRole,
    hasRole,
    issueAuthSession,
    rotateRefreshToken,
    revokeRefreshToken,
    sellerShop,
    assertText,
    assertLocalized,
    translationSuggestions,
    localizedPayload,
    assertPositiveInt,
    assertSupportedLocale,
    assertSupportedCurrency,
    assertPaymentProvider,
    normalizeInventory,
    tracksPhysicalStock,
    assertPurchasableQuantity,
    addEscrowEntry,
    ledgerBalances,
    reconciliationForDate,
    freezeEscrowForOrderItem,
    releaseEscrowForOrderItem,
    refundEscrowForOrderItem,
    syncOrderEscrowStatus,
    productResponse,
    shippingInfoForProduct,
    featuredProducts,
    newArtisans,
    shippingOptionForProduct,
    orderTypeForCartItem,
    shopResponse,
    getOrCreateCart,
    cartResponse
  } = ctx;

  route('POST', '/cart/items', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const body = await readJson(ctx.req);
    const product = db.products.find((item) => item.id === body.productId && item.status === 'active');
    if (!product) throw httpError(404, 'product_not_found', 'Product was not found.');
    const quantity = assertPositiveInt(body.quantity || 1, 'quantity');
    assertPurchasableQuantity(product, quantity);
    const orderType = orderTypeForCartItem(body, product);
    const shippingOption = body.shippingOption || null;
    if (shippingOption) shippingOptionForProduct(product, shippingOption, body.destinationCountry || 'MN');
    const cart = getOrCreateCart(user.id);
    const existing = cart.items.find((item) => item.productId === product.id && JSON.stringify(item.customization || {}) === JSON.stringify(body.customization || {}));
    if (existing) existing.quantity += quantity;
    else cart.items.push({ id: id('ci'), productId: product.id, quantity, orderType, shippingOption, customization: body.customization || null, addedAt: now() });
    audit(user.id, 'add_cart_item', 'cart', cart.id, { productId: product.id, quantity });
    cart.updatedAt = now();
    saveState(db);
    return { cart: cartResponse(cart, body.locale || user.locale || 'mn', body.currency || 'MNT') };
  });
  
  route('POST', '/cart/custom-requests/:requestId', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const body = await readJson(ctx.req);
    const request = db.customRequests.find((item) => item.id === ctx.params.requestId && item.buyerId === user.id);
    if (!request || request.status !== 'accepted' || !request.quote) throw httpError(409, 'custom_quote_not_accepted', 'Accepted custom quote was not found.');
    const product = db.products.find((item) => item.id === request.productId && item.status === 'active');
    if (!product) throw httpError(404, 'product_not_found', 'Product was not found.');
    const shippingOption = body.shippingOption || null;
    if (shippingOption) shippingOptionForProduct(product, shippingOption, body.destinationCountry || 'MN');
    const cart = getOrCreateCart(user.id);
    if (!cart.items.some((item) => item.customRequestId === request.id)) {
      cart.items.push({
        id: id('ci'),
        productId: product.id,
        customRequestId: request.id,
        quantity: 1,
        orderType: 'custom',
        quotedPrice: request.quote.price,
        shippingOption,
        customization: { customRequestId: request.id, options: request.options },
        addedAt: now()
      });
    }
    cart.updatedAt = now();
    audit(user.id, 'add_custom_quote_to_cart', 'cart', cart.id, { customRequestId: request.id });
    saveState(db);
    return { cart: cartResponse(cart, body.locale || user.locale || 'mn', request.quote.price.currency) };
  });
  
  route('GET', '/cart', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    return {
      cart: cartResponse(
        getOrCreateCart(user.id),
        assertSupportedLocale(ctx.url.searchParams.get('locale') || user.locale || 'mn'),
        assertSupportedCurrency(ctx.url.searchParams.get('currency') || 'MNT')
      )
    };
  });

  route('PATCH', '/cart/items/:itemId', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const body = await readJson(ctx.req);
    const cart = getOrCreateCart(user.id);
    const item = cart.items.find((candidate) => candidate.id === ctx.params.itemId);
    if (!item) throw httpError(404, 'cart_item_not_found', 'Cart item was not found.');
    const product = db.products.find((candidate) => candidate.id === item.productId && candidate.status === 'active');
    if (!product) throw httpError(409, 'product_unavailable', 'Cart product is no longer available.');
    const quantity = assertPositiveInt(body.quantity, 'quantity');
    assertPurchasableQuantity(product, quantity);
    item.quantity = quantity;
    item.updatedAt = now();
    cart.updatedAt = now();
    saveState(db);
    return {
      cart: cartResponse(
        cart,
        assertSupportedLocale(body.locale || user.locale || 'mn'),
        assertSupportedCurrency(body.currency || 'MNT')
      )
    };
  });

  route('DELETE', '/cart/items/:itemId', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const cart = getOrCreateCart(user.id);
    const before = cart.items.length;
    cart.items = cart.items.filter((item) => item.id !== ctx.params.itemId);
    if (before === cart.items.length) throw httpError(404, 'cart_item_not_found', 'Cart item was not found.');
    cart.updatedAt = now();
    saveState(db);
    return {
      cart: cartResponse(
        cart,
        assertSupportedLocale(ctx.url.searchParams.get('locale') || user.locale || 'mn'),
        assertSupportedCurrency(ctx.url.searchParams.get('currency') || 'MNT')
      )
    };
  });
  
  /**
   * Купоны кодыг шалгаж буцаана. `POST /coupons/validate`-тай ижил дүрэм —
   * хэрэглэгч урьдчилан харсан хөнгөлөлт төлбөр дээр давхар шалгагдана.
   */
  function resolveCoupon(code) {
    const normalized = assertText(code, 'couponCode').toUpperCase();
    const coupon = db.coupons.find((item) => item.code === normalized && item.status === 'active');
    if (!coupon) throw httpError(404, 'coupon_not_available', 'Coupon is not available.');
    if (coupon.usedCount >= coupon.usageLimit) throw httpError(409, 'coupon_exhausted', 'Coupon usage limit has been reached.');
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= Date.now()) {
      throw httpError(409, 'coupon_expired', 'Coupon has expired.');
    }
    if (coupon.startsAt && new Date(coupon.startsAt).getTime() > Date.now()) {
      throw httpError(409, 'coupon_not_started', 'Coupon is not active yet.');
    }
    return coupon;
  }

  route('POST', '/checkout', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const body = await readJson(ctx.req);
    const cart = getOrCreateCart(user.id);
    if (cart.items.length === 0) throw httpError(422, 'empty_cart', 'Cart is empty.');
    const currency = assertSupportedCurrency(body.currency || 'MNT');
    const shippingAddress = body.shippingAddress || {};
    const destinationCountry = shippingAddress.country || 'MN';
    const paymentMethod = body.paymentMethod || (currency === 'MNT' ? 'qpay' : 'stripe');
    assertPaymentProvider(currency, paymentMethod);
    const shippingSelections = body.shippingSelections || {};
    const order = {
      id: id('ord'),
      buyerId: user.id,
      status: 'paid',
      currency,
      payment: {
        method: paymentMethod,
        status: 'captured',
        providerRef: id(paymentMethod === 'stripe' ? 'pi' : 'qpay'),
        capturedAt: now()
      },
      escrowStatus: 'held',
      lifecycle: ['paid'],
      shippingAddress,
      destinationCountry,
      sellerGroups: [],
      subtotal: money(0, currency),
      commissionTotal: money(0, currency),
      sellerTotal: money(0, currency),
      createdAt: now()
    };
    const orderItems = cart.items.map((cartItem) => {
      const product = db.products.find((item) => item.id === cartItem.productId);
      if (!product || product.status !== 'active') throw httpError(409, 'product_unavailable', 'One cart item is unavailable.');
      assertPurchasableQuantity(product, cartItem.quantity);
      if (destinationCountry !== 'MN' && !product.shipsInternationally) throw httpError(409, 'international_shipping_unavailable', 'Product cannot ship internationally.');
      const unitPrice = cartItem.quotedPrice || (currency === 'USD' && product.internationalPrice ? product.internationalPrice : product.price);
      if (unitPrice.currency !== currency) throw httpError(422, 'currency_unavailable', 'Product is not available in requested currency.');
      const shippingOptionCode = cartItem.shippingOption || shippingSelections[product.shopId] || shippingSelections[product.sellerId] || (destinationCountry === 'MN' ? 'domestic_city' : 'international_post');
      const shippingOption = shippingOptionForProduct(product, shippingOptionCode, destinationCountry);
      const lineTotal = money(unitPrice.amount * cartItem.quantity, currency);
      const commission = money(percentBps(lineTotal.amount, db.meta.defaultCommissionBps), currency);
      const sellerReceivable = money(lineTotal.amount - commission.amount, currency);
      return {
        id: id('oi'),
        orderId: order.id,
        sellerId: product.sellerId,
        shopId: product.shopId,
        productId: product.id,
        customRequestId: cartItem.customRequestId || null,
        quantity: cartItem.quantity,
        orderType: cartItem.orderType || orderTypeForCartItem(cartItem, product),
        productionDays: cartItem.customRequestId
          ? (db.customRequests.find((item) => item.id === cartItem.customRequestId)?.quote?.productionDays || product.productionDays)
          : (product.inventoryType === 'made_to_order' ? product.productionDays : product.productionDays),
        shippingOption,
        customization: cartItem.customization,
        unitPrice,
        lineTotal,
        commission,
        sellerReceivable,
        escrowStatus: 'held',
        escrowHeldAt: now(),
        escrowReleasedAt: null,
        status: 'paid',
        progressUpdates: [],
        payoutId: null,
        createdAt: now(),
        updatedAt: now()
      };
    });
    /*
     * ── Купон ────────────────────────────────────────────────────────────
     * Купон нь тухайн урлаачийнх тул зөвхөн түүний мөрүүдэд хамаарна.
     * Хөнгөлөлтийг мөр бүрд ЭХЛЭЭД хуваарилж, дараа нь шимтгэл/урлаачид
     * очих дүнг дахин бодно — ингэснээр доорх нийлбэр, бүлэг, escrow
     * бүртгэл бүгд өөрөө нийцнэ.
     */
    const coupon = body.couponCode ? resolveCoupon(body.couponCode) : null;
    if (coupon) {
      if (coupon.type === 'amount' && coupon.currency !== currency) {
        throw httpError(409, 'coupon_currency_mismatch', 'Coupon currency does not match the order currency.');
      }
      const eligible = orderItems.filter((item) => item.sellerId === coupon.sellerId);
      if (!eligible.length) throw httpError(409, 'coupon_not_applicable', 'Coupon does not apply to any item in this order.');

      const eligibleTotal = eligible.reduce((sum, item) => sum + item.lineTotal.amount, 0);
      if (coupon.minSubtotal && eligibleTotal < coupon.minSubtotal.amount) {
        throw httpError(409, 'coupon_min_subtotal', 'Order does not reach the coupon minimum subtotal.');
      }

      const total = coupon.type === 'percent'
        ? Math.round((eligibleTotal * coupon.value) / 100)
        : Math.min(coupon.value, eligibleTotal);

      // Мөрүүдэд хувь тэнцүүлэн хуваарилж, бөөрөнхийллийн үлдэгдлийг сүүлийн мөрөнд өгнө.
      let remaining = total;
      eligible.forEach((item, index) => {
        const share = index === eligible.length - 1
          ? remaining
          : Math.round((total * item.lineTotal.amount) / eligibleTotal);
        remaining -= share;
        item.discount = money(share, currency);
        item.lineTotal = money(item.lineTotal.amount - share, currency);
        item.commission = money(percentBps(item.lineTotal.amount, db.meta.defaultCommissionBps), currency);
        item.sellerReceivable = money(item.lineTotal.amount - item.commission.amount, currency);
      });

      coupon.usedCount += 1;
      order.coupon = { id: coupon.id, code: coupon.code, sellerId: coupon.sellerId, discount: money(total, currency) };
      audit(user.id, 'apply_coupon', 'coupon', coupon.id, { orderId: order.id, discount: total });
    }

    // Хөнгөлөлт тооцсоны дараа мөрүүдээс дүгнэнэ — гараар нэмсэн дүн зөрөхгүй.
    order.subtotal = orderItems.reduce((sum, item) => addMoney(sum, item.lineTotal), null) || money(0, currency);
    order.commissionTotal = orderItems.reduce((sum, item) => addMoney(sum, item.commission), null) || money(0, currency);
    order.sellerTotal = orderItems.reduce((sum, item) => addMoney(sum, item.sellerReceivable), null) || money(0, currency);
    order.sellerGroups = Object.values(orderItems.reduce((groups, item) => {
      groups[item.sellerId] = groups[item.sellerId] || {
        sellerId: item.sellerId,
        shopId: item.shopId,
        status: item.status,
        shippingOption: item.shippingOption,
        itemIds: [],
        subtotal: money(0, currency),
        commission: money(0, currency),
        sellerReceivable: money(0, currency)
      };
      groups[item.sellerId].itemIds.push(item.id);
      groups[item.sellerId].subtotal = addMoney(groups[item.sellerId].subtotal, item.lineTotal);
      groups[item.sellerId].commission = addMoney(groups[item.sellerId].commission, item.commission);
      groups[item.sellerId].sellerReceivable = addMoney(groups[item.sellerId].sellerReceivable, item.sellerReceivable);
      return groups;
    }, {}));
    /*
     * Үлдэгдлийг БҮХ шалгалт өнгөрсний дараа л хасна.
     * Өмнө нь мөр тус бүрийг боловсруулах үедээ хасдаг байсан тул сүүлийн мөр
     * (эсвэл купон) алдаа өгөхөд өмнөх мөрүүдийн бараа төлбөргүйгээр хасагдаж
     * үлддэг байв.
     */
    for (const item of orderItems) {
      const product = db.products.find((candidate) => candidate.id === item.productId);
      if (!product || !tracksPhysicalStock(product)) continue;
      product.stock -= item.quantity;
      if (product.stock === 0) product.status = 'sold';
    }

    db.orders.push(order);
    db.orderItems.push(...orderItems);
    for (const item of orderItems) {
      addEscrowEntry(order.id, item.id, item.sellerId, `capture_${paymentMethod}_payment`, item.lineTotal, `${paymentMethod} payment captured by platform.`);
      addEscrowEntry(order.id, item.id, item.sellerId, 'hold_buyer_payment', item.lineTotal, 'Buyer payment captured and held by platform escrow.');
      addEscrowEntry(order.id, item.id, item.sellerId, 'reserve_platform_commission', item.commission, 'Commission reserved from held funds.');
    }
    /*
     * Гэрээтэй захиалга: төлбөр хийгдмэгц гэрээ хэрэгжиж эхэлнэ. Урьдчилгааны
     * үе шатыг төлөгдсөнд тооцно — мөнгө нь escrow-д аль хэдийн орсон.
     */
    for (const item of orderItems.filter((candidate) => candidate.customRequestId)) {
      const contract = db.contracts.find((candidate) => candidate.customRequestId === item.customRequestId);
      if (!contract || contract.status === 'cancelled') continue;
      contract.status = 'in_progress';
      contract.orderId = order.id;
      contract.orderItemId = item.id;
      const deposit = (contract.depositSchedule || []).find((milestone) => milestone.due === 'on_acceptance');
      if (deposit) {
        deposit.status = 'paid';
        deposit.paidAt = now();
      }
      contract.updatedAt = now();
      audit(user.id, 'contract_in_progress', 'contract', contract.id, { orderId: order.id });
    }

    cart.items = [];
    cart.updatedAt = now();
    audit(user.id, 'checkout', 'order', order.id, { itemCount: orderItems.length });
    saveState(db);
    return { order, orderItems };
  });
  
  route('GET', '/orders', async (ctx) => {
    const user = requireAuth(ctx);
    let orders = db.orders;
    if (!hasRole(user, ROLES.ADMIN) && hasRole(user, ROLES.SELLER)) {
      const sellerOrderIds = new Set(db.orderItems.filter((item) => item.sellerId === user.id).map((item) => item.orderId));
      orders = orders.filter((order) => order.buyerId === user.id || sellerOrderIds.has(order.id));
    } else if (!hasRole(user, ROLES.ADMIN) && hasRole(user, ROLES.BUYER)) {
      orders = orders.filter((order) => order.buyerId === user.id);
    }
    return {
      orders: orders.map((order) => ({
        ...order,
        items: db.orderItems.filter((item) => item.orderId === order.id && (!hasRole(user, ROLES.SELLER) || hasRole(user, ROLES.ADMIN) || item.sellerId === user.id))
      }))
    };
  });

  route('GET', '/seller/balance', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    return { balances: ledgerBalances(user.id), payoutRequests: db.payoutRequests.filter((item) => item.sellerId === user.id).slice(-20).reverse() };
  });

  route('POST', '/seller/payout-requests', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const body = await readJson(ctx.req);
    const currency = assertSupportedCurrency(body.currency || 'MNT');
    const balances = ledgerBalances(user.id);
    const available = Number(balances.sellerBalance?.[currency] || 0);
    const amount = body.amount ? Number(body.amount) : available;
    if (!Number.isFinite(amount) || amount <= 0 || amount > available) throw httpError(422, 'invalid_payout_amount', 'Payout amount exceeds available balance.');
    const request = {
      id: id('por'),
      sellerId: user.id,
      status: 'requested',
      amount: money(amount, currency),
      method: body.method || 'domestic_bank',
      bankAccount: body.bankAccount || sellerShop(user.id)?.payout || null,
      note: body.note || '',
      createdAt: now(),
      updatedAt: now()
    };
    db.payoutRequests.push(request);
    audit(user.id, 'request_payout', 'payout_request', request.id);
    saveState(db);
    return { payoutRequest: request };
  });
  
  route('POST', '/orders/:orderId/confirm-received', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const order = db.orders.find((candidate) => candidate.id === ctx.params.orderId && candidate.buyerId === user.id);
    if (!order) throw httpError(404, 'order_not_found', 'Order was not found.');
    const released = [];
    for (const item of db.orderItems.filter((candidate) => candidate.orderId === order.id && candidate.status === 'delivered')) {
      const entry = releaseEscrowForOrderItem(item, user.id);
      if (entry) released.push(entry);
    }
    syncOrderEscrowStatus(order.id);
    audit(user.id, 'confirm_order_received', 'order', order.id, { released: released.length });
    saveState(db);
    return { order, released };
  });
  
  const SELLER_SETTABLE_ORDER_ITEM_STATUS = ORDER_ITEM_STATUS.filter((status) => !['completed', 'disputed'].includes(status));

  route('PATCH', '/seller/order-items/:itemId/status', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const body = await readJson(ctx.req);
    const item = db.orderItems.find((candidate) => candidate.id === ctx.params.itemId && candidate.sellerId === user.id);
    if (!item) throw httpError(404, 'order_item_not_found', 'Seller order item was not found.');
    if (!SELLER_SETTABLE_ORDER_ITEM_STATUS.includes(body.status)) {
      throw httpError(422, 'invalid_status', 'Sellers cannot set this status directly; completion requires buyer confirmation and disputes must go through /disputes.');
    }
    item.status = body.status;
    item.tracking = body.tracking || item.tracking || null;
    if (Array.isArray(body.progressMedia) || body.note) {
      item.progressUpdates = item.progressUpdates || [];
      item.progressUpdates.push({
        id: id('prog'),
        status: item.status,
        note: body.note || '',
        media: Array.isArray(body.progressMedia) ? body.progressMedia.map((media) => ({
          type: media.type === 'video' ? 'video' : 'image',
          url: assertText(media.url, 'progressMedia.url'),
          caption: media.caption ? assertLocalized(media.caption, 'progressMedia.caption') : {}
        })) : [],
        createdAt: now()
      });
    }
    item.updatedAt = now();
    let escrowEntry = null;
    if (body.status === 'delivered') item.deliveredAt = now();
    if (body.status === 'cancelled') escrowEntry = refundEscrowForOrderItem(item, user.id, body.reason);
    const order = syncOrderEscrowStatus(item.orderId);
    order.lifecycle = Array.from(new Set([...(order.lifecycle || []), item.status]));
    audit(user.id, 'update_order_item_status', 'order_item', item.id, { status: item.status });
    saveState(db);
    return { orderItem: item, order, escrowEntry };
  });
  
  route('POST', '/disputes', async (ctx) => {
    const user = requireRole(ctx, [ROLES.BUYER, ROLES.SELLER]);
    const body = await readJson(ctx.req);
    const item = db.orderItems.find((candidate) => candidate.id === body.orderItemId);
    if (!item) throw httpError(404, 'order_item_not_found', 'Order item was not found.');
    const order = db.orders.find((candidate) => candidate.id === item.orderId);
    const isParticipant = order?.buyerId === user.id || item.sellerId === user.id;
    if (!isParticipant) throw httpError(403, 'forbidden', 'Only order participants can dispute this item.');
    const dispute = {
      id: id('dis'),
      orderId: item.orderId,
      orderItemId: item.id,
      openedBy: user.id,
      sellerId: item.sellerId,
      buyerId: order.buyerId,
      reason: assertText(body.reason, 'reason'),
      status: 'frozen',
      evidence: Array.isArray(body.evidence) ? body.evidence.map((media) => ({
        type: media.type === 'video' ? 'video' : 'image',
        url: assertText(media.url, 'evidence.url'),
        caption: media.caption ? assertLocalized(media.caption, 'evidence.caption') : {}
      })) : [],
      resolution: null,
      createdAt: now(),
      updatedAt: now()
    };
    db.disputes.push(dispute);
    const escrowEntry = freezeEscrowForOrderItem(item, user.id, dispute.reason);
    audit(user.id, 'open_dispute', 'dispute', dispute.id, { orderItemId: item.id });
    saveState(db);
    return { dispute, escrowEntry };
  });
  
  route('POST', '/admin/disputes/:disputeId/resolve', async (ctx) => {
    const admin = requireRole(ctx, ROLES.ADMIN);
    const body = await readJson(ctx.req);
    const dispute = db.disputes.find((item) => item.id === ctx.params.disputeId);
    if (!dispute) throw httpError(404, 'dispute_not_found', 'Dispute was not found.');
    const item = db.orderItems.find((candidate) => candidate.id === dispute.orderItemId);
    if (!item) throw httpError(404, 'order_item_not_found', 'Order item was not found.');
    let escrowEntry = null;
    if (body.decision === 'refund_buyer') {
      dispute.status = 'resolved_refund';
      escrowEntry = refundEscrowForOrderItem(item, admin.id, body.note || 'Admin resolved dispute with buyer refund.');
    } else if (body.decision === 'release_seller') {
      dispute.status = 'resolved_release';
      item.status = 'delivered';
      escrowEntry = releaseEscrowForOrderItem(item, admin.id);
    } else {
      dispute.status = 'rejected';
    }
    dispute.resolution = { decision: body.decision, note: body.note || '', adminId: admin.id, resolvedAt: now() };
    dispute.updatedAt = now();
    syncOrderEscrowStatus(item.orderId);
    audit(admin.id, 'resolve_dispute', 'dispute', dispute.id, { decision: body.decision });
    saveState(db);
    return { dispute, orderItem: item, escrowEntry };
  });
  
  route('POST', '/seller/order-items/:itemId/progress', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const body = await readJson(ctx.req);
    const item = db.orderItems.find((candidate) => candidate.id === ctx.params.itemId && candidate.sellerId === user.id);
    if (!item) throw httpError(404, 'order_item_not_found', 'Seller order item was not found.');
    const update = {
      id: id('prog'),
      status: item.status,
      note: body.note || '',
      media: Array.isArray(body.media) ? body.media.map((media) => ({
        type: media.type === 'video' ? 'video' : 'image',
        url: assertText(media.url, 'media.url'),
        caption: media.caption ? assertLocalized(media.caption, 'media.caption') : {}
      })) : [],
      createdAt: now()
    };
    item.progressUpdates = item.progressUpdates || [];
    item.progressUpdates.push(update);
    item.updatedAt = now();
    audit(user.id, 'order_item_progress', 'order_item', item.id);
    saveState(db);
    return { progressUpdate: update, orderItem: item };
  });
};

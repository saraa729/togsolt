'use strict';

module.exports = function registerAdmin(ctx) {
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
    cartResponse,
    executeBankTransfer,
    jobScheduler
  } = ctx;

  route('POST', '/admin/payouts/run', async (ctx) => {
    const admin = requireRole(ctx, ROLES.ADMIN);
    const body = await readJson(ctx.req);
    const currency = body.currency || 'MNT';
    const payable = db.orderItems.filter((item) => ['delivered', 'completed'].includes(item.status) && item.escrowStatus === 'released' && !item.payoutId && item.sellerReceivable.currency === currency);
    const grouped = new Map();
    for (const item of payable) {
      if (!grouped.has(item.sellerId)) grouped.set(item.sellerId, []);
      grouped.get(item.sellerId).push(item);
    }
    const payouts = [];
    for (const [sellerId, items] of grouped.entries()) {
      const total = items.reduce((sum, item) => addMoney(sum, item.sellerReceivable), null) || money(0, currency);
      const payout = { id: id('pay'), sellerId, status: 'scheduled', currency, amount: total, orderItemIds: items.map((item) => item.id), createdAt: now() };
      for (const item of items) {
        item.payoutId = payout.id;
        addEscrowEntry(item.orderId, item.id, item.sellerId, 'payout_scheduled', item.sellerReceivable, `Domestic bank payout ${payout.id} scheduled.`);
      }
      db.payouts.push(payout);
      payouts.push(payout);
    }
    audit(admin.id, 'run_payouts', 'payout_batch', id('batch'), { count: payouts.length, currency });
    saveState(db);
    return { payouts };
  });

  route('PATCH', '/admin/payout-requests/:requestId', async (ctx) => {
    const admin = requireRole(ctx, ROLES.ADMIN);
    const body = await readJson(ctx.req);
    const request = db.payoutRequests.find((item) => item.id === ctx.params.requestId);
    if (!request) throw httpError(404, 'payout_request_not_found', 'Payout request was not found.');
    if (!['approved', 'rejected', 'paid'].includes(body.status)) throw httpError(422, 'invalid_payout_status', 'Invalid payout request status.');
    request.status = body.status;
    request.adminNote = body.note || request.adminNote || '';
    request.reviewedBy = admin.id;
    request.updatedAt = now();
    if (body.status === 'approved') {
      const receipt = await executeBankTransfer(request);
      const payout = {
        id: id('pay'),
        sellerId: request.sellerId,
        status: receipt.status === 'submitted' ? 'scheduled' : receipt.status,
        currency: request.amount.currency,
        amount: request.amount,
        payoutRequestId: request.id,
        receipt,
        createdAt: now()
      };
      db.payouts.push(payout);
      request.payoutId = payout.id;
      request.receipt = receipt;
    }
    audit(admin.id, 'review_payout_request', 'payout_request', request.id, { status: request.status });
    saveState(db);
    return { payoutRequest: request };
  });
  
  route('POST', '/admin/escrow/auto-release', async (ctx) => {
    const admin = requireRole(ctx, ROLES.ADMIN);
    const body = await readJson(ctx.req);
    const days = Number(body.days || db.meta.escrowAutoReleaseDays || 7);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const released = [];
    for (const item of db.orderItems.filter((candidate) => candidate.status === 'delivered' && candidate.escrowStatus === 'held')) {
      const deliveredAt = new Date(item.deliveredAt || item.updatedAt || item.createdAt).getTime();
      if (deliveredAt <= cutoff) {
        const entry = releaseEscrowForOrderItem(item, admin.id);
        if (entry) released.push(entry);
      }
    }
    for (const order of db.orders) syncOrderEscrowStatus(order.id);
    audit(admin.id, 'auto_release_escrow', 'escrow_batch', id('batch'), { days, released: released.length });
    saveState(db);
    return { released };
  });

  route('POST', '/admin/jobs/:jobName/run', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    if (ctx.params.jobName === 'escrow_auto_release') return jobScheduler.autoReleaseEscrow();
    if (ctx.params.jobName === 'daily_reconciliation') return jobScheduler.dailyReconciliation();
    throw httpError(404, 'job_not_found', 'Background job was not found.');
  });
  
  route('GET', '/admin/escrow-ledger', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    const orderId = ctx.url.searchParams.get('orderId');
    const sellerId = ctx.url.searchParams.get('sellerId');
    const entries = db.escrowLedger.filter((entry) => {
      if (orderId && entry.orderId !== orderId) return false;
      if (sellerId && entry.sellerId !== sellerId) return false;
      return true;
    });
    return { entries };
  });
  
  route('GET', '/admin/balances', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    return { balances: ledgerBalances(ctx.url.searchParams.get('sellerId')) };
  });
  
  route('GET', '/admin/reconciliation/daily', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    return { reconciliation: reconciliationForDate(ctx.url.searchParams.get('date')) };
  });
  
  route('GET', '/admin/queues', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    return {
      sellerVerification: db.shops.filter((shop) => shop.status === 'pending_verification'),
      contentModeration: db.reports.filter((report) => ['open', 'reviewing'].includes(report.status)),
      disputes: db.disputes.filter((dispute) => ['open', 'frozen'].includes(dispute.status)),
      payoutQueue: db.payouts.filter((payout) => payout.status === 'scheduled'),
      payoutRequests: db.payoutRequests.filter((request) => request.status === 'requested')
    };
  });

  route('GET', '/admin/seller-verifications', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    return {
      shops: db.shops
        .filter((shop) => ctx.url.searchParams.get('status') ? shop.status === ctx.url.searchParams.get('status') : true)
        .map((shop) => ({ ...shop, seller: publicUser(db.users.find((user) => user.id === shop.sellerId)) }))
    };
  });

  route('PATCH', '/admin/shops/:shopId/verification', async (ctx) => {
    const admin = requireRole(ctx, ROLES.ADMIN);
    const body = await readJson(ctx.req);
    const shop = db.shops.find((item) => item.id === ctx.params.shopId);
    if (!shop) throw httpError(404, 'shop_not_found', 'Shop was not found.');
    if (!['verified', 'rejected', 'pending_verification'].includes(body.status)) throw httpError(422, 'invalid_shop_status', 'Invalid shop status.');
    shop.status = body.status;
    shop.verificationNote = body.note || '';
    shop.verifiedAt = body.status === 'verified' ? now() : shop.verifiedAt;
    audit(admin.id, 'review_seller_verification', 'shop', shop.id, { status: shop.status });
    saveState(db);
    return { shop };
  });

  route('GET', '/admin/reports', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    const status = ctx.url.searchParams.get('status');
    return {
      reports: db.reports
        .filter((report) => !status || report.status === status)
        .map((report) => ({
          ...report,
          reporter: publicUser(db.users.find((user) => user.id === report.reporterId)),
          product: report.entityType === 'product' && db.products.find((product) => product.id === report.entityId) ? productResponse(db.products.find((product) => product.id === report.entityId), 'mn', 'MNT') : null,
          shop: report.entityType === 'shop' ? db.shops.find((shop) => shop.id === report.entityId) : null
        }))
    };
  });

  route('GET', '/admin/reports/:reportId', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    const report = db.reports.find((item) => item.id === ctx.params.reportId);
    if (!report) throw httpError(404, 'report_not_found', 'Report was not found.');
    return {
      report,
      reporter: publicUser(db.users.find((user) => user.id === report.reporterId)),
      product: report.entityType === 'product' && db.products.find((product) => product.id === report.entityId) ? productResponse(db.products.find((product) => product.id === report.entityId), 'mn', 'MNT') : null,
      shop: report.entityType === 'shop' ? db.shops.find((shop) => shop.id === report.entityId) : null
    };
  });

  route('GET', '/admin/disputes', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    return {
      disputes: db.disputes.map((dispute) => ({
        ...dispute,
        order: db.orders.find((order) => order.id === dispute.orderId),
        orderItem: db.orderItems.find((item) => item.id === dispute.orderItemId)
      }))
    };
  });
  
  route('PATCH', '/admin/settings', async (ctx) => {
    const admin = requireRole(ctx, ROLES.ADMIN);
    const body = await readJson(ctx.req);
    if (body.defaultCommissionBps !== undefined) {
      const bps = Number(body.defaultCommissionBps);
      if (!Number.isInteger(bps) || bps < 500 || bps > 1500) throw httpError(422, 'invalid_commission', 'Commission must be 5-15%.');
      db.meta.defaultCommissionBps = bps;
    }
    if (body.escrowAutoReleaseDays !== undefined) db.meta.escrowAutoReleaseDays = Number(body.escrowAutoReleaseDays);
    if (body.shippingSettings) db.meta.shippingSettings = { ...db.meta.shippingSettings, ...body.shippingSettings };
    if (body.supportedCurrencies) {
      if (!Array.isArray(body.supportedCurrencies) || !body.supportedCurrencies.every((currency) => ['MNT', 'USD'].includes(currency))) throw httpError(422, 'invalid_currencies', 'Supported currencies must be MNT and/or USD.');
      db.meta.supportedCurrencies = body.supportedCurrencies;
    }
    audit(admin.id, 'update_settings', 'platform_settings', 'meta', body);
    saveState(db);
    return { settings: db.meta };
  });
  
  route('GET', '/admin/audit-logs', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    const entityType = ctx.url.searchParams.get('entityType');
    const actorId = ctx.url.searchParams.get('actorId');
    const logs = db.auditLogs.filter((log) => {
      if (entityType && log.entityType !== entityType) return false;
      if (actorId && log.actorId !== actorId) return false;
      return true;
    }).slice(-200).reverse();
    return { auditLogs: logs };
  });

  route('GET', '/admin/users', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    return { users: db.users.map(publicUser) };
  });

  route('PATCH', '/admin/users/:userId', async (ctx) => {
    const admin = requireRole(ctx, ROLES.ADMIN);
    const body = await readJson(ctx.req);
    const user = db.users.find((item) => item.id === ctx.params.userId);
    if (!user) throw httpError(404, 'user_not_found', 'User was not found.');
    if (body.name !== undefined) user.name = assertText(body.name, 'name');
    if (body.role !== undefined) {
      if (!Object.values(ROLES).includes(body.role)) throw httpError(422, 'invalid_role', 'Invalid role.');
      user.role = body.role;
      user.roles = Array.from(new Set([body.role, ...((Array.isArray(user.roles) ? user.roles : [])).filter((role) => Object.values(ROLES).includes(role))]));
    }
    if (body.disabled !== undefined) user.disabled = Boolean(body.disabled);
    user.updatedAt = now();
    audit(admin.id, 'admin_update_user', 'user', user.id);
    saveState(db);
    return { user: publicUser(user) };
  });

  route('GET', '/admin/products', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    const locale = assertSupportedLocale(ctx.url.searchParams.get('locale') || 'mn');
    const currency = assertSupportedCurrency(ctx.url.searchParams.get('currency') || 'MNT');
    const status = ctx.url.searchParams.get('status');
    const products = db.products
      .filter((product) => !status || product.status === status)
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .map((product) => productResponse(product, locale, currency));
    return { products };
  });

  route('PATCH', '/admin/products/:productId/status', async (ctx) => {
    const admin = requireRole(ctx, ROLES.ADMIN);
    const body = await readJson(ctx.req);
    const product = db.products.find((item) => item.id === ctx.params.productId);
    if (!product) throw httpError(404, 'product_not_found', 'Product was not found.');
    if (!PRODUCT_STATUS.includes(body.status)) throw httpError(422, 'invalid_product_status', 'Invalid product status.');
    product.status = body.status;
    product.updatedAt = now();
    audit(admin.id, 'admin_update_product_status', 'product', product.id, { status: product.status });
    saveState(db);
    return {
      product: productResponse(
        product,
        assertSupportedLocale(ctx.url.searchParams.get('locale') || 'mn'),
        assertSupportedCurrency(ctx.url.searchParams.get('currency') || 'MNT')
      )
    };
  });

  route('GET', '/admin/orders', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    const status = ctx.url.searchParams.get('status');
    const orders = db.orders
      .filter((order) => !status || order.status === status)
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((order) => ({
        ...order,
        buyer: publicUser(db.users.find((user) => user.id === order.buyerId)),
        items: db.orderItems.filter((item) => item.orderId === order.id)
      }));
    return { orders };
  });
  
  route('GET', '/admin/reports/overview', async (ctx) => {
    requireRole(ctx, ROLES.ADMIN);
    const grossByCurrency = {};
    const commissionByCurrency = {};
    for (const order of db.orders) {
      grossByCurrency[order.currency] = (grossByCurrency[order.currency] || 0) + order.subtotal.amount;
      commissionByCurrency[order.currency] = (commissionByCurrency[order.currency] || 0) + order.commissionTotal.amount;
    }
    const completed = db.orders.filter((order) => order.status === 'completed').length;
    const cartAdds = db.auditLogs.filter((log) => log.action === 'checkout').length + db.carts.reduce((sum, cart) => sum + cart.items.length, 0);
    const domesticOrders = db.orders.filter((order) => order.destinationCountry === 'MN').length;
    const internationalOrders = db.orders.filter((order) => order.destinationCountry !== 'MN').length;
    return {
      users: db.users.length,
      sellers: db.users.filter((user) => hasRole(user, ROLES.SELLER)).length,
      verifiedShops: db.shops.filter((shop) => shop.status === 'verified').length,
      products: db.products.length,
      orders: db.orders.length,
      customRequests: db.customRequests.length,
      grossByCurrency,
      commissionByCurrency,
      balances: ledgerBalances(),
      funnel: {
        viewed: db.auditLogs.filter((log) => log.action === 'view_product').length,
        cart: cartAdds,
        paid: db.orders.length,
        completed
      },
      segmentBreakdown: {
        domesticOrders,
        internationalOrders
      },
      activeDisputes: db.disputes.filter((dispute) => ['open', 'frozen'].includes(dispute.status)).length,
      openReports: db.reports.filter((report) => ['open', 'reviewing'].includes(report.status)).length,
      escrowHeld: db.orderItems.filter((item) => item.escrowStatus === 'held').length,
      escrowReleased: db.orderItems.filter((item) => item.escrowStatus === 'released').length,
      pendingPayoutItems: db.orderItems.filter((item) => ['delivered', 'completed'].includes(item.status) && item.escrowStatus === 'released' && !item.payoutId).length
    };
  });
};

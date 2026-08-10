'use strict';

const sseClients = new Map();

function conversationParticipants(conversation) {
  return [conversation.buyerId, conversation.sellerId].filter(Boolean);
}

function pushEvent(userIds, event, payload) {
  for (const userId of userIds) {
    for (const res of sseClients.get(userId) || []) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  }
}

module.exports = function registerCustomTrust(ctx) {
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
    assertMoneyAmount,
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
    realtime
  } = ctx;

  route('POST', '/custom-requests', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const body = await readJson(ctx.req);
    const product = db.products.find((item) => item.id === body.productId && item.status === 'active');
    if (!product || !product.customEnabled) throw httpError(404, 'custom_not_available', 'Custom order is not available for this product.');
    const request = {
      id: id('cus'),
      buyerId: user.id,
      sellerId: product.sellerId,
      productId: product.id,
      status: 'requested',
      message: assertText(body.message, 'message'),
      messages: [
        {
          id: id('msg'),
          senderId: user.id,
          senderRole: ROLES.BUYER,
          message: assertText(body.message, 'message'),
          attachments: Array.isArray(body.attachments) ? body.attachments.map((file) => ({
            type: file.type === 'video' ? 'video' : 'image',
            url: assertText(file.url, 'attachments.url'),
            name: file.name || null
          })) : [],
          createdAt: now()
        }
      ],
      referenceImages: Array.isArray(body.referenceImages) ? body.referenceImages.map(String) : [],
      options: body.options || {},
      quote: null,
      createdAt: now(),
      updatedAt: now()
    };
    db.customRequests.push(request);
    audit(user.id, 'create_custom_request', 'custom_request', request.id);
    saveState(db);
    return { customRequest: request };
  });

  route('GET', '/custom-requests', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    return {
      customRequests: db.customRequests
        .filter((item) => item.buyerId === user.id)
        .slice()
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    };
  });

  route('GET', '/seller/custom-requests', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    return {
      customRequests: db.customRequests
        .filter((item) => item.sellerId === user.id)
        .slice()
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    };
  });
  
  route('PATCH', '/seller/custom-requests/:requestId', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const body = await readJson(ctx.req);
    const request = db.customRequests.find((item) => item.id === ctx.params.requestId && item.sellerId === user.id);
    if (!request) throw httpError(404, 'custom_request_not_found', 'Custom request was not found.');
    if (!CUSTOM_STATUS.includes(body.status)) throw httpError(422, 'invalid_status', 'Invalid custom request status.');
    request.status = body.status;
    if (body.message) {
      request.messages = request.messages || [];
      request.messages.push({
        id: id('msg'),
        senderId: user.id,
        senderRole: ROLES.SELLER,
        message: assertText(body.message, 'message'),
        attachments: Array.isArray(body.attachments) ? body.attachments.map((file) => ({
          type: file.type === 'video' ? 'video' : 'image',
          url: assertText(file.url, 'attachments.url'),
          name: file.name || null
        })) : [],
        createdAt: now()
      });
    }
    request.quote = body.quote ? {
      price: money(assertMoneyAmount(body.quote.price?.amount, 'quote.price.amount'), body.quote.price?.currency || 'MNT'),
      productionDays: Number(body.quote.productionDays || 7),
      note: body.quote.note || ''
    } : request.quote;
    request.updatedAt = now();
    audit(user.id, 'update_custom_request', 'custom_request', request.id, { status: request.status });
    saveState(db);
    return { customRequest: request };
  });
  
  route('POST', '/custom-requests/:requestId/accept-quote', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const request = db.customRequests.find((item) => item.id === ctx.params.requestId && item.buyerId === user.id);
    if (!request || request.status !== 'quoted' || !request.quote) throw httpError(409, 'quote_not_available', 'Quoted custom request was not found.');
    request.status = 'accepted';
    request.updatedAt = now();
    audit(user.id, 'accept_custom_quote', 'custom_request', request.id);
    saveState(db);
    return { customRequest: request };
  });
  
  route('POST', '/custom-requests/:requestId/messages', async (ctx) => {
    const user = requireAuth(ctx);
    const body = await readJson(ctx.req);
    const request = db.customRequests.find((item) => item.id === ctx.params.requestId);
    if (!request) throw httpError(404, 'custom_request_not_found', 'Custom request was not found.');
    const isParticipant = request.buyerId === user.id || request.sellerId === user.id || hasRole(user, ROLES.ADMIN);
    if (!isParticipant) throw httpError(403, 'forbidden', 'Only request participants can send messages.');
    const senderRole = request.sellerId === user.id ? ROLES.SELLER : request.buyerId === user.id ? ROLES.BUYER : ROLES.ADMIN;
    const message = {
      id: id('msg'),
      senderId: user.id,
      senderRole,
      message: assertText(body.message, 'message'),
      attachments: Array.isArray(body.attachments) ? body.attachments.map((file) => ({
        type: file.type === 'video' ? 'video' : 'image',
        url: assertText(file.url, 'attachments.url'),
        name: file.name || null
      })) : [],
      createdAt: now()
    };
    request.messages = request.messages || [];
    request.messages.push(message);
    request.updatedAt = now();
    audit(user.id, 'custom_request_message', 'custom_request', request.id);
    saveState(db);
    realtime?.publishCustomRequestMessage(request, message);
    return { message, customRequest: request };
  });
  
  route('POST', '/conversations', async (ctx) => {
    const user = requireAuth(ctx);
    const body = await readJson(ctx.req);
    const sellerId = assertText(body.sellerId, 'sellerId');
    const orderItemId = body.orderItemId || null;
    if (!db.users.find((candidate) => candidate.id === sellerId && hasRole(candidate, ROLES.SELLER))) throw httpError(404, 'seller_not_found', 'Seller was not found.');
    if (orderItemId) {
      const item = db.orderItems.find((candidate) => candidate.id === orderItemId);
      const order = item ? db.orders.find((candidate) => candidate.id === item.orderId) : null;
      if (!item || (item.sellerId !== sellerId) || (order.buyerId !== user.id && item.sellerId !== user.id && !hasRole(user, ROLES.ADMIN))) throw httpError(403, 'forbidden', 'Conversation is not available for this order item.');
    }
    let conversation = db.conversations.find((item) => item.orderItemId === orderItemId && item.buyerId === user.id && item.sellerId === sellerId);
    if (!conversation) {
      conversation = { id: id('conv'), buyerId: hasRole(user, ROLES.SELLER) ? body.buyerId : user.id, sellerId, orderItemId, messages: [], createdAt: now(), updatedAt: now() };
      db.conversations.push(conversation);
    }
    saveState(db);
    realtime?.publishConversationUpsert(conversation);
    return { conversation };
  });

  route('GET', '/conversations', async (ctx) => {
    const user = requireAuth(ctx);
    const conversations = db.conversations
      .filter((item) => item.buyerId === user.id || item.sellerId === user.id || hasRole(user, ROLES.ADMIN))
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .map((item) => ({
        ...item,
        buyer: publicUser(db.users.find((user) => user.id === item.buyerId)),
        seller: publicUser(db.users.find((user) => user.id === item.sellerId))
      }));
    return { conversations };
  });

  route('GET', '/conversations/stream', async (ctx) => {
    if (!ctx.req.headers.authorization && ctx.url.searchParams.get('token')) {
      ctx.req.headers.authorization = `Bearer ${ctx.url.searchParams.get('token')}`;
    }
    const user = requireAuth(ctx);
    if (!sseClients.has(user.id)) sseClients.set(user.id, new Set());
    sseClients.get(user.id).add(ctx.res);
    ctx.res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
      'x-accel-buffering': 'no'
    });
    ctx.res.write(`event: ready\n`);
    ctx.res.write(`data: ${JSON.stringify({ ok: true, userId: user.id, at: now() })}\n\n`);
    const heartbeat = setInterval(() => {
      if (!ctx.res.writableEnded) ctx.res.write(`event: heartbeat\ndata: ${JSON.stringify({ at: now() })}\n\n`);
    }, 25000);
    ctx.req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.get(user.id)?.delete(ctx.res);
    });
    return undefined;
  });
  
  route('POST', '/conversations/:conversationId/messages', async (ctx) => {
    const user = requireAuth(ctx);
    const body = await readJson(ctx.req);
    const conversation = db.conversations.find((item) => item.id === ctx.params.conversationId);
    if (!conversation) throw httpError(404, 'conversation_not_found', 'Conversation was not found.');
    if (![conversation.buyerId, conversation.sellerId].includes(user.id) && !hasRole(user, ROLES.ADMIN)) throw httpError(403, 'forbidden', 'Only conversation participants can send messages.');
    const senderRole = conversation.sellerId === user.id ? ROLES.SELLER : conversation.buyerId === user.id ? ROLES.BUYER : ROLES.ADMIN;
    const message = {
      id: id('msg'),
      senderId: user.id,
      senderRole,
      message: assertText(body.message, 'message'),
      attachments: Array.isArray(body.attachments) ? body.attachments.map((file) => ({
        type: file.type === 'video' ? 'video' : 'image',
        url: assertText(file.url, 'attachments.url'),
        name: file.name || null
      })) : [],
      createdAt: now()
    };
    conversation.messages.push(message);
    conversation.updatedAt = now();
    audit(user.id, 'conversation_message', 'conversation', conversation.id);
    saveState(db);
    pushEvent(conversationParticipants(conversation), 'message', { conversationId: conversation.id, message });
    realtime?.publishConversationMessage(conversation, message);
    return { message, conversation };
  });
  
  route('POST', '/reviews', async (ctx) => {
    const user = requireRole(ctx, [ROLES.BUYER, ROLES.SELLER]);
    const body = await readJson(ctx.req);
    const item = db.orderItems.find((candidate) => candidate.id === body.orderItemId);
    if (!item || !['delivered', 'completed'].includes(item.status)) throw httpError(409, 'review_not_available', 'Reviews are available only after delivery.');
    const order = db.orders.find((candidate) => candidate.id === item.orderId);
    const reviewerRole = order.buyerId === user.id ? ROLES.BUYER : item.sellerId === user.id ? ROLES.SELLER : null;
    if (!reviewerRole) throw httpError(403, 'forbidden', 'Only order participants can review.');
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(422, 'invalid_rating', 'Rating must be 1-5.');
    const review = {
      id: id('rev'),
      orderId: item.orderId,
      orderItemId: item.id,
      productId: item.productId,
      shopId: item.shopId,
      sellerId: item.sellerId,
      buyerId: order.buyerId,
      reviewerId: user.id,
      reviewerRole,
      rating,
      comment: body.comment || '',
      images: Array.isArray(body.images) ? body.images.map(String) : [],
      status: 'published',
      createdAt: now()
    };
    db.reviews.push(review);
    item.reviewIds = item.reviewIds || [];
    item.reviewIds.push(review.id);
    const shop = db.shops.find((candidate) => candidate.id === item.shopId);
    if (shop && reviewerRole === ROLES.BUYER) {
      const shopReviews = db.reviews.filter((candidate) => candidate.shopId === shop.id && candidate.reviewerRole === ROLES.BUYER && candidate.status === 'published');
      shop.stats.ratingCount = shopReviews.length;
      shop.stats.ratingAverage = Math.round((shopReviews.reduce((sum, candidate) => sum + candidate.rating, 0) / Math.max(shopReviews.length, 1)) * 10) / 10;
    }
    audit(user.id, 'create_review', 'review', review.id);
    saveState(db);
    return { review };
  });
  
  route('POST', '/reports', async (ctx) => {
    const user = requireAuth(ctx);
    const body = await readJson(ctx.req);
    const entityType = assertText(body.entityType, 'entityType');
    const entityId = assertText(body.entityId, 'entityId');
    if (entityType === 'product' && !db.products.some((product) => product.id === entityId)) throw httpError(404, 'product_not_found', 'Reported product was not found.');
    if (entityType === 'shop' && !db.shops.some((shop) => shop.id === entityId)) throw httpError(404, 'shop_not_found', 'Reported shop was not found.');
    const report = {
      id: id('rep'),
      reporterId: user.id,
      entityType,
      entityId,
      reason: assertText(body.reason, 'reason'),
      details: body.details || '',
      status: 'open',
      moderationNote: null,
      createdAt: now(),
      updatedAt: now()
    };
    db.reports.push(report);
    audit(user.id, 'create_report', 'report', report.id, { entityType, entityId });
    saveState(db);
    return { report };
  });
  
  route('PATCH', '/admin/reports/:reportId', async (ctx) => {
    const admin = requireRole(ctx, ROLES.ADMIN);
    const body = await readJson(ctx.req);
    const report = db.reports.find((item) => item.id === ctx.params.reportId);
    if (!report) throw httpError(404, 'report_not_found', 'Report was not found.');
    if (!REPORT_STATUS.includes(body.status)) throw httpError(422, 'invalid_report_status', 'Invalid report status.');
    report.status = body.status;
    report.moderationNote = body.note || report.moderationNote;
    report.updatedAt = now();
    if (body.action === 'hide_product' && report.entityType === 'product') {
      const product = db.products.find((item) => item.id === report.entityId);
      if (product) product.status = 'hidden';
    }
    audit(admin.id, 'moderate_report', 'report', report.id, { status: report.status, action: body.action });
    saveState(db);
    return { report };
  });
};

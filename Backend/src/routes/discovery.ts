'use strict';

module.exports = function registerDiscovery(ctx) {
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

  route('GET', '/categories', async (ctx) => {
    const locale = assertSupportedLocale(ctx.url.searchParams.get('locale') || 'mn');
    return { categories: db.categories.map((item) => ({ ...item, nameText: localize(item.name, locale) })) };
  });
  
  route('GET', '/home', async (ctx) => {
    const locale = assertSupportedLocale(ctx.url.searchParams.get('locale') || 'mn');
    const currency = assertSupportedCurrency(ctx.url.searchParams.get('currency') || 'MNT');
    const touristMode = ctx.url.searchParams.get('tourist') === 'true';
    return {
      locale,
      currency,
      touristMode,
      featuredProducts: featuredProducts(locale, currency, touristMode),
      newArtisans: newArtisans(locale),
      categories: db.categories.map((item) => ({ ...item, nameText: localize(item.name, locale) })),
      traditionSections: [
        {
          id: 'trad_felt',
          title: { mn: 'Эсгий урлал', en: 'Felt craft' },
          titleText: locale === 'en' ? 'Felt craft' : 'Эсгий урлал',
          descriptionText: locale === 'en'
            ? 'Mongolian wool felting carries nomadic home, warmth, and pattern traditions.'
            : 'Монгол эсгий урлал нь нүүдэлчдийн гэр ахуй, дулаан, хээ угалзын уламжлалыг хадгалдаг.'
        },
        {
          id: 'trad_wood',
          title: { mn: 'Модон урлал', en: 'Wood craft' },
          titleText: locale === 'en' ? 'Wood craft' : 'Модон урлал',
          descriptionText: locale === 'en'
            ? 'Hand-carved pieces show the maker’s touch, tool marks, and regional style.'
            : 'Гараар зорсон бүтээлд урлаачийн гарын мэдрэмж, багажны мөр, нутгийн хэв маяг шингэдэг.'
        }
      ]
    };
  });
  
  route('GET', '/tourist/home', async () => ({
    locale: 'en',
    currency: 'USD',
    headline: 'Unique gifts from Mongolia',
    featuredProducts: featuredProducts('en', 'USD', true),
    shippingGuide: {
      internationalPost: 'Look for products with international postal shipping. Customs notes are shown on product and cart items.',
      pickup: 'Meet-up pickup is available for travelers still in Mongolia when the artisan enables it.'
    }
  }));
  
  route('GET', '/shops', async (ctx) => {
    const search = String(ctx.url.searchParams.get('q') || '').toLowerCase();
    const status = ctx.url.searchParams.get('status');
    const locale = assertSupportedLocale(ctx.url.searchParams.get('locale') || 'mn');
    const shops = db.shops.filter((shop) => {
      if (status && shop.status !== status) return false;
      const activeProducts = db.products.filter((product) => product.shopId === shop.id && product.status === 'active');
      const searchable = [
        shop.displayName,
        shop.artisanProfile?.makerName,
        shop.city,
        shop.province,
        shop.district,
        localize(shop.story, 'mn'),
        localize(shop.story, 'en'),
        ...(shop.materials || []),
        ...activeProducts.flatMap((product) => [
          localize(product.title, 'mn'),
          localize(product.title, 'en'),
          ...(product.materials || []),
          ...(product.techniques || [])
        ])
      ].filter(Boolean).join(' ').toLowerCase();
      if (search && !searchable.includes(search)) return false;
      return true;
    });
    return { shops: shops.map((shop) => shopResponse(shop, locale)) };
  });
  
  route('POST', '/favorites/products/:productId', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const product = db.products.find((item) => item.id === ctx.params.productId && item.status === 'active');
    if (!product) throw httpError(404, 'product_not_found', 'Product was not found.');
    let favorite = db.favorites.find((item) => item.userId === user.id && item.productId === product.id);
    if (!favorite) {
      favorite = { id: id('fav'), userId: user.id, productId: product.id, createdAt: now() };
      db.favorites.push(favorite);
      audit(user.id, 'favorite_product', 'product', product.id);
      saveState(db);
    }
    return { favorite };
  });
  
  route('DELETE', '/favorites/products/:productId', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    db.favorites = db.favorites.filter((item) => !(item.userId === user.id && item.productId === ctx.params.productId));
    audit(user.id, 'unfavorite_product', 'product', ctx.params.productId);
    saveState(db);
    return { ok: true };
  });
  
  route('GET', '/favorites/products', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const locale = assertSupportedLocale(ctx.url.searchParams.get('locale') || user.locale || 'mn');
    const currency = assertSupportedCurrency(ctx.url.searchParams.get('currency') || 'MNT');
    const ids = new Set(db.favorites.filter((item) => item.userId === user.id).map((item) => item.productId));
    return { products: db.products.filter((product) => ids.has(product.id)).map((product) => productResponse(product, locale, currency)) };
  });
  
  route('POST', '/follows/shops/:shopId', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    const shop = db.shops.find((item) => item.id === ctx.params.shopId && item.status === 'verified');
    if (!shop) throw httpError(404, 'shop_not_found', 'Shop was not found.');
    let follow = db.follows.find((item) => item.userId === user.id && item.shopId === shop.id);
    if (!follow) {
      follow = { id: id('fol'), userId: user.id, shopId: shop.id, createdAt: now() };
      db.follows.push(follow);
      audit(user.id, 'follow_shop', 'shop', shop.id);
      saveState(db);
    }
    return { follow };
  });
  
  route('DELETE', '/follows/shops/:shopId', async (ctx) => {
    const user = requireRole(ctx, ROLES.BUYER);
    db.follows = db.follows.filter((item) => !(item.userId === user.id && item.shopId === ctx.params.shopId));
    audit(user.id, 'unfollow_shop', 'shop', ctx.params.shopId);
    saveState(db);
    return { ok: true };
  });
  
  route('GET', '/shop/:slug', async (ctx) => {
    const locale = assertSupportedLocale(ctx.url.searchParams.get('locale') || 'mn');
    const currency = assertSupportedCurrency(ctx.url.searchParams.get('currency') || 'MNT');
    const shop = db.shops.find((item) => item.slug === ctx.params.slug && item.status === 'verified');
    if (!shop) throw httpError(404, 'shop_not_found', 'Public shop was not found.');
    return { shop: shopResponse(shop, locale, true, currency) };
  });
};

'use strict';

const LOCATION_ALIASES = {
  ulaanbaatar: 'улаанбаатар',
  sukhbaatar: 'сүхбаатар',
  bayangol: 'баянгол',
  darkhan: 'дархан',
  'khan-uul': 'хан-уул',
  chingeltei: 'чингэлтэй',
  umnugovi: 'өмнөговь',
  dalanzadgad: 'даланзадгад',
  arkhangai: 'архангай',
  tsetserleg: 'цэцэрлэг',
  khuvsgul: 'хөвсгөл',
  murun: 'мөрөн',
  bayanzurkh: 'баянзүрх',
  songinokhairkhan: 'сонгинохайрхан'
};

function locationTerms(value) {
  if (!value) return [];
  const normalized = String(value).toLowerCase();
  return [...new Set([normalized, LOCATION_ALIASES[normalized]].filter(Boolean))];
}

module.exports = function registerCatalog(ctx) {
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
    publishedReviewsForProduct,
    getOrCreateCart,
    cartResponse,
    searchProducts
  } = ctx;

  route('POST', '/seller/shop', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    if (sellerShop(user.id)) throw httpError(409, 'shop_exists', 'Seller already has a shop.');
    const body = await readJson(ctx.req);
    const displayName = assertText(body.displayName, 'displayName');
    const shop = {
      id: id('shop'),
      sellerId: user.id,
      status: 'pending_verification',
      slug: displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id('shop'),
      displayName,
      logoUrl: body.logoUrl || null,
      bannerUrl: body.bannerUrl || null,
      story: assertLocalized(body.story, 'story'),
      city: assertText(body.city || 'Ulaanbaatar', 'city'),
      province: body.province || body.aimag || body.city || 'Ulaanbaatar',
      district: body.district || body.duureg || null,
      contact: {
        phone: body.contact?.phone || body.phone || user.phone || null,
        email: body.contact?.email || user.email,
        facebook: body.contact?.facebook || null,
        instagram: body.contact?.instagram || null
      },
      seo: {
        title: body.seo?.title || `${displayName} | ExpoCraft`,
        description: body.seo?.description || localize(body.story, 'mn') || localize(body.story, 'en')
      },
      stats: { ratingAverage: 0, ratingCount: 0, salesCount: 0, responseTimeHours: Number(body.responseTimeHours || 24) },
      materials: Array.isArray(body.materials) ? body.materials.map(String) : [],
      artisanProfile: {
        makerName: body.artisanProfile?.makerName || body.makerName || displayName,
        portraitUrl: body.artisanProfile?.portraitUrl || null,
        process: body.artisanProfile?.process ? assertLocalized(body.artisanProfile.process, 'artisanProfile.process') : {},
        yearsOfExperience: Number(body.artisanProfile?.yearsOfExperience || 0),
        socials: body.artisanProfile?.socials || {}
      },
      processMedia: Array.isArray(body.processMedia) ? body.processMedia.map((item) => ({
        type: item.type === 'video' ? 'video' : 'image',
        url: assertText(item.url, 'processMedia.url'),
        caption: item.caption ? assertLocalized(item.caption, 'processMedia.caption') : {}
      })) : [],
      translationSuggestions: {
        story: translationSuggestions(assertLocalized(body.story, 'story')),
        process: body.artisanProfile?.process ? translationSuggestions(assertLocalized(body.artisanProfile.process, 'artisanProfile.process')) : {}
      },
      payout: body.payout || null,
      createdAt: now(),
      verifiedAt: null
    };
    db.shops.push(shop);
    audit(user.id, 'create_shop', 'shop', shop.id);
    saveState(db);
    return { shop };
  });

  route('PATCH', '/seller/shop', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const shop = sellerShop(user.id);
    if (!shop) throw httpError(404, 'shop_not_found', 'Seller shop was not found.');
    const body = await readJson(ctx.req);
    if (body.displayName !== undefined) {
      shop.displayName = assertText(body.displayName, 'displayName');
      shop.seo = { ...shop.seo, title: shop.seo?.title || `${shop.displayName} | ExpoCraft` };
    }
    if (body.story !== undefined) {
      shop.story = localizedPayload(body.story, 'story').value;
      shop.translationSuggestions = {
        ...(shop.translationSuggestions || {}),
        story: translationSuggestions(shop.story)
      };
    }
    if (body.city !== undefined) shop.city = assertText(body.city, 'city');
    if (body.province !== undefined) shop.province = assertText(body.province, 'province');
    if (body.district !== undefined) shop.district = body.district ? assertText(body.district, 'district') : null;
    if (body.logoUrl !== undefined) shop.logoUrl = body.logoUrl || null;
    if (body.bannerUrl !== undefined) shop.bannerUrl = body.bannerUrl || null;
    if (body.contact !== undefined) {
      shop.contact = {
        ...shop.contact,
        phone: body.contact.phone !== undefined ? body.contact.phone : shop.contact?.phone,
        email: body.contact.email !== undefined ? body.contact.email : shop.contact?.email,
        facebook: body.contact.facebook !== undefined ? body.contact.facebook : shop.contact?.facebook,
        instagram: body.contact.instagram !== undefined ? body.contact.instagram : shop.contact?.instagram
      };
    }
    if (body.artisanProfile !== undefined) {
      shop.artisanProfile = {
        ...(shop.artisanProfile || {}),
        makerName: body.artisanProfile.makerName || shop.artisanProfile?.makerName || shop.displayName,
        portraitUrl: body.artisanProfile.portraitUrl !== undefined ? body.artisanProfile.portraitUrl : shop.artisanProfile?.portraitUrl,
        process: body.artisanProfile.process ? localizedPayload(body.artisanProfile.process, 'artisanProfile.process').value : shop.artisanProfile?.process,
        yearsOfExperience: body.artisanProfile.yearsOfExperience !== undefined ? Number(body.artisanProfile.yearsOfExperience || 0) : shop.artisanProfile?.yearsOfExperience,
        socials: body.artisanProfile.socials || shop.artisanProfile?.socials || {}
      };
    }
    shop.updatedAt = now();
    audit(user.id, 'update_shop', 'shop', shop.id);
    saveState(db);
    return { shop };
  });
  
  /**
   * Урлаачийг шууд баталгаажуулах товч зам (sellerId-аар).
   *
   * Админы UI үүнийг ашигладаггүй — тэнд `PATCH /admin/shops/:shopId/verification`
   * ашигладаг бөгөөд тэр нь татгалзах, тэмдэглэл үлдээх боломжтой. Энэ зам нь
   * скрипт болон тестээс урлаачийг хурдан баталгаажуулахад зориулагдсан хэвээр.
   */
  route('POST', '/admin/sellers/:sellerId/verify', async (ctx) => {
    const admin = requireRole(ctx, ROLES.ADMIN);
    const shop = db.shops.find((item) => item.sellerId === ctx.params.sellerId);
    if (!shop) throw httpError(404, 'shop_not_found', 'Seller shop was not found.');
    shop.status = 'verified';
    shop.verifiedAt = now();
    audit(admin.id, 'verify_seller', 'shop', shop.id, { sellerId: ctx.params.sellerId });
    saveState(db);
    return { shop };
  });
  
  route('POST', '/products', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const shop = sellerShop(user.id);
    if (!shop || shop.status !== 'verified') throw httpError(403, 'seller_not_verified', 'Seller must be verified before publishing products.');
    const body = await readJson(ctx.req);
    const category = db.categories.find((item) => item.id === body.categoryId);
    if (!category) throw httpError(422, 'invalid_category', 'Unknown categoryId.');
    const inventory = normalizeInventory(body);
    const title = localizedPayload(body.title, 'title');
    const description = localizedPayload(body.description, 'description');
    const story = body.story ? localizedPayload(body.story, 'story') : { value: {}, translationSuggestions: {} };
    const techniqueDescription = body.techniqueDescription ? localizedPayload(body.techniqueDescription, 'techniqueDescription') : { value: {}, translationSuggestions: {} };
    const status = body.status || 'active';
    if (!PRODUCT_STATUS.includes(status)) throw httpError(422, 'invalid_product_status', 'Invalid product status.');
    const product = {
      id: id('prd'),
      sellerId: user.id,
      shopId: shop.id,
      status,
      categoryId: category.id,
      title: title.value,
      description: description.value,
      story: story.value,
      translationSuggestions: {
        title: title.translationSuggestions,
        description: description.translationSuggestions,
        story: story.translationSuggestions,
        techniqueDescription: techniqueDescription.translationSuggestions
      },
      materials: Array.isArray(body.materials) ? body.materials.map(String) : [],
      techniques: Array.isArray(body.techniques) ? body.techniques.map(String) : [],
      techniqueDescription: techniqueDescription.value,
      styles: Array.isArray(body.styles) ? body.styles.map(String) : [],
      images: Array.isArray(body.images) ? body.images.map(String) : [],
      processMedia: Array.isArray(body.processMedia) ? body.processMedia.map((item) => ({
        type: item.type === 'video' ? 'video' : 'image',
        url: assertText(item.url, 'processMedia.url'),
        caption: item.caption ? assertLocalized(item.caption, 'processMedia.caption') : {}
      })) : [],
      price: money(assertMoneyAmount(body.price?.amount, 'price.amount'), body.price?.currency || 'MNT'),
      internationalPrice: body.internationalPrice ? money(assertMoneyAmount(body.internationalPrice.amount, 'internationalPrice.amount'), body.internationalPrice.currency || 'USD') : null,
      stock: inventory.stock,
      inventoryType: inventory.inventoryType,
      productionDays: inventory.productionDays,
      weightGram: Number(body.weightGram || 0),
      size: body.size || body.dimensionsCm || null,
      dimensionsCm: body.dimensionsCm || body.size || null,
      shipsInternationally: Boolean(body.shipsInternationally),
      touristGift: Boolean(body.touristGift),
      shippingProfile: body.shippingProfile || {
        domestic: { city: true, countryside: true, pickup: true },
        international: { postal: Boolean(body.shipsInternationally), customsNote: body.customsNote || {} }
      },
      customEnabled: Boolean(body.customEnabled),
      customOptions: Array.isArray(body.customOptions) ? body.customOptions.map(String) : [],
      createdAt: now(),
      updatedAt: now()
    };
    db.products.push(product);
    audit(user.id, 'create_product', 'product', product.id);
    saveState(db);
    return { product };
  });

  route('GET', '/seller/products', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const locale = assertSupportedLocale(ctx.url.searchParams.get('locale') || 'mn');
    const currency = assertSupportedCurrency(ctx.url.searchParams.get('currency') || 'MNT');
    const products = db.products
      .filter((product) => product.sellerId === user.id)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .map((product) => productResponse(product, locale, currency));
    return { products };
  });

  route('PATCH', '/seller/products/:productId', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const body = await readJson(ctx.req);
    const product = db.products.find((item) => item.id === ctx.params.productId && item.sellerId === user.id);
    if (!product) throw httpError(404, 'product_not_found', 'Seller product was not found.');

    if (body.categoryId !== undefined) {
      const category = db.categories.find((item) => item.id === body.categoryId);
      if (!category) throw httpError(422, 'invalid_category', 'Unknown categoryId.');
      product.categoryId = category.id;
    }
    if (body.title !== undefined) {
      const title = localizedPayload(body.title, 'title');
      product.title = title.value;
      product.translationSuggestions.title = title.translationSuggestions;
    }
    if (body.description !== undefined) {
      const description = localizedPayload(body.description, 'description');
      product.description = description.value;
      product.translationSuggestions.description = description.translationSuggestions;
    }
    if (body.story !== undefined) {
      const story = localizedPayload(body.story, 'story');
      product.story = story.value;
      product.translationSuggestions.story = story.translationSuggestions;
    }
    if (body.techniqueDescription !== undefined) {
      const techniqueDescription = localizedPayload(body.techniqueDescription, 'techniqueDescription');
      product.techniqueDescription = techniqueDescription.value;
      product.translationSuggestions.techniqueDescription = techniqueDescription.translationSuggestions;
    }
    if (body.price !== undefined) product.price = money(assertMoneyAmount(body.price.amount, 'price.amount'), body.price.currency || product.price.currency || 'MNT');
    if (body.internationalPrice !== undefined) product.internationalPrice = body.internationalPrice ? money(assertMoneyAmount(body.internationalPrice.amount, 'internationalPrice.amount'), body.internationalPrice.currency || 'USD') : null;
    if (body.inventoryType !== undefined || body.stock !== undefined || body.productionDays !== undefined) {
      const inventory = normalizeInventory({ ...product, ...body });
      product.inventoryType = inventory.inventoryType;
      product.stock = inventory.stock;
      product.productionDays = inventory.productionDays;
    }
    if (body.materials !== undefined) product.materials = Array.isArray(body.materials) ? body.materials.map(String) : [];
    if (body.techniques !== undefined) product.techniques = Array.isArray(body.techniques) ? body.techniques.map(String) : [];
    if (body.styles !== undefined) product.styles = Array.isArray(body.styles) ? body.styles.map(String) : [];
    if (body.images !== undefined) product.images = Array.isArray(body.images) ? body.images.map(String).filter(Boolean) : [];
    if (body.weightGram !== undefined) product.weightGram = Number(body.weightGram || 0);
    if (body.size !== undefined || body.dimensionsCm !== undefined) {
      product.size = body.size || body.dimensionsCm || null;
      product.dimensionsCm = body.dimensionsCm || body.size || null;
    }
    if (body.shipsInternationally !== undefined) product.shipsInternationally = Boolean(body.shipsInternationally);
    if (body.touristGift !== undefined) product.touristGift = Boolean(body.touristGift);
    if (body.customEnabled !== undefined) product.customEnabled = Boolean(body.customEnabled);
    if (body.customOptions !== undefined) product.customOptions = Array.isArray(body.customOptions) ? body.customOptions.map(String) : [];
    if (body.status !== undefined) {
      if (!['active', 'hidden'].includes(body.status)) throw httpError(422, 'invalid_product_status', 'Seller can only show or hide a product.');
      product.status = body.status;
    }

    product.updatedAt = now();
    audit(user.id, 'update_product', 'product', product.id);
    saveState(db);
    return {
      product: productResponse(
        product,
        assertSupportedLocale(ctx.url.searchParams.get('locale') || 'mn'),
        assertSupportedCurrency(ctx.url.searchParams.get('currency') || 'MNT')
      )
    };
  });

  route('PATCH', '/seller/products/:productId/status', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const body = await readJson(ctx.req);
    const product = db.products.find((item) => item.id === ctx.params.productId && item.sellerId === user.id);
    if (!product) throw httpError(404, 'product_not_found', 'Seller product was not found.');
    const status = body.status || 'hidden';
    if (!['active', 'hidden'].includes(status)) throw httpError(422, 'invalid_product_status', 'Seller can only show or hide a product.');
    product.status = status;
    product.updatedAt = now();
    audit(user.id, status === 'hidden' ? 'hide_product' : 'show_product', 'product', product.id);
    saveState(db);
    return {
      product: productResponse(
        product,
        assertSupportedLocale(ctx.url.searchParams.get('locale') || 'mn'),
        assertSupportedCurrency(ctx.url.searchParams.get('currency') || 'MNT')
      )
    };
  });

  route('DELETE', '/seller/products/:productId', async (ctx) => {
    const user = requireRole(ctx, ROLES.SELLER);
    const product = db.products.find((item) => item.id === ctx.params.productId && item.sellerId === user.id);
    if (!product) throw httpError(404, 'product_not_found', 'Seller product was not found.');
    product.status = 'hidden';
    product.updatedAt = now();
    audit(user.id, 'hide_product', 'product', product.id);
    saveState(db);
    return { ok: true, productId: product.id, status: product.status };
  });
  
  route('GET', '/products', async (ctx) => {
    const locale = assertSupportedLocale(ctx.url.searchParams.get('locale') || 'mn');
    const currency = assertSupportedCurrency(ctx.url.searchParams.get('currency') || 'MNT');
    const q = String(ctx.url.searchParams.get('q') || '').toLowerCase();
    const categoryId = ctx.url.searchParams.get('categoryId');
    const material = ctx.url.searchParams.get('material');
    const technique = ctx.url.searchParams.get('technique');
    const style = ctx.url.searchParams.get('style');
    const sellerId = ctx.url.searchParams.get('sellerId');
    const shopId = ctx.url.searchParams.get('shopId');
    const location = String(ctx.url.searchParams.get('location') || '').toLowerCase();
    const locationSearchTerms = locationTerms(location);
    const minPrice = ctx.url.searchParams.get('minPrice') ? Number(ctx.url.searchParams.get('minPrice')) : null;
    const maxPrice = ctx.url.searchParams.get('maxPrice') ? Number(ctx.url.searchParams.get('maxPrice')) : null;
    const international = ctx.url.searchParams.get('international');
    const inventoryType = ctx.url.searchParams.get('inventoryType');
    const tourist = ctx.url.searchParams.get('tourist') === 'true';
    const searchIds = q && searchProducts
      ? new Set((await searchProducts({ q, locale, currency, filters: {}, productResponse })).map((product) => product.id))
      : null;
    const products = db.products.filter((product) => {
      if (product.status !== 'active') return false;
      const shop = db.shops.find((item) => item.id === product.shopId);
      if (searchIds && !searchIds.has(product.id)) return false;
      if (inventoryType && product.inventoryType !== inventoryType) return false;
      if (categoryId && product.categoryId !== categoryId) return false;
      if (material && !product.materials.includes(material)) return false;
      if (technique && !(product.techniques || []).includes(technique)) return false;
      if (style && !product.styles.includes(style)) return false;
      if (sellerId && product.sellerId !== sellerId) return false;
      if (shopId && product.shopId !== shopId) return false;
      if (locationSearchTerms.length) {
        const shopLocation = `${shop?.province || ''} ${shop?.district || ''} ${shop?.city || ''}`.toLowerCase();
        if (!locationSearchTerms.some((term) => shopLocation.includes(term))) return false;
      }
      if (international === 'true' && !product.shipsInternationally) return false;
      if (tourist && !product.touristGift) return false;
      const selectedPrice = currency === 'USD' && product.internationalPrice ? product.internationalPrice : product.price;
      if (minPrice !== null && selectedPrice.amount < minPrice) return false;
      if (maxPrice !== null && selectedPrice.amount > maxPrice) return false;
      if (q && !searchIds) {
        const haystack = [
          localize(product.title, 'mn'),
          localize(product.title, 'en'),
          localize(product.description, 'mn'),
          localize(product.description, 'en'),
          localize(product.techniqueDescription, 'mn'),
          localize(product.techniqueDescription, 'en'),
          product.materials.join(' '),
          (product.techniques || []).join(' '),
          shop?.displayName || '',
          shop?.province || '',
          shop?.district || '',
          shop?.city || ''
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    return { products: products.map((product) => productResponse(product, locale, currency)) };
  });
  
  /**
   * Бүтээгдэхүүний сэтгэгдлүүд. Нийтийн зам — нэвтрээгүй ч уншиж болно.
   * Зөвхөн худалдан авагчийн нийтлэгдсэн сэтгэгдэл, шинэ нь эхэндээ.
   */
  route('GET', '/products/:productId/reviews', async (ctx) => {
    const product = db.products.find((item) => item.id === ctx.params.productId);
    if (!product) throw httpError(404, 'product_not_found', 'Product was not found.');
    const reviews = publishedReviewsForProduct(product.id)
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((review) => {
        const reviewer = db.users.find((item) => item.id === review.reviewerId);
        return {
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          images: review.images || [],
          // Бүтэн нэр биш — нийтэд харагдах хэсэгт хувийн мэдээлэл задлахгүй.
          reviewerName: reviewer?.name?.split(' ')[0] || 'ExpoCraft',
          createdAt: review.createdAt
        };
      });
    return { reviews, summary: { count: reviews.length, average: reviews.length ? Math.round((reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length) * 10) / 10 : 0 } };
  });

  route('GET', '/products/:productId', async (ctx) => {
    const product = db.products.find((item) => item.id === ctx.params.productId && item.status === 'active');
    if (!product) throw httpError(404, 'product_not_found', 'Product was not found.');
    const locale = assertSupportedLocale(ctx.url.searchParams.get('locale') || 'mn');
    const currency = assertSupportedCurrency(ctx.url.searchParams.get('currency') || 'MNT');
    audit(null, 'view_product', 'product', product.id, { locale, currency });
    saveState(db);
    const relatedProducts = db.products
      .filter((item) => item.status === 'active' && item.sellerId === product.sellerId && item.id !== product.id)
      .slice(0, 4)
      .map((item) => productResponse(item, locale, currency));
    return {
      product: {
        ...productResponse(product, locale, currency),
        relatedProducts
      }
    };
  });
};

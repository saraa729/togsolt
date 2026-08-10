'use strict';

import type { CoreServices, Currency, Locale, ServiceFactory } from '../types';

type CatalogServiceInput = Pick<CoreServices, 'db' | 'httpError' | 'localize'> & {
  INVENTORY_TYPES: string[];
};

type CatalogService = Record<string, (...args: any[]) => any>;

const createCatalogService: ServiceFactory<CatalogServiceInput, CatalogService> = function createCatalogService({ db, httpError, localize, INVENTORY_TYPES }) {
  function sellerShop(sellerId: string) {
    return db.shops.find((shop) => shop.sellerId === sellerId);
  }

  function tracksPhysicalStock(product: any) {
    return ['ready_made', 'limited_stock', 'one_of_one'].includes(product.inventoryType);
  }

  function assertPurchasableQuantity(product: any, quantity: number) {
    if (product.inventoryType === 'one_of_one' && quantity !== 1) {
      throw httpError(409, 'one_of_one_quantity', 'One-of-one craft items can only be purchased one at a time.');
    }
    if (tracksPhysicalStock(product) && quantity > product.stock) throw httpError(409, 'insufficient_stock', 'Requested quantity exceeds available inventory.');
  }

  function shippingInfoForProduct(product: any, locale: Locale = 'mn') {
    const profile = product.shippingProfile || {};
    const options = [];
    if (profile.domestic?.city) options.push({ code: 'domestic_city', label: locale === 'en' ? 'Ulaanbaatar delivery' : 'Хот дотор хүргэлт' });
    if (profile.domestic?.countryside) options.push({ code: 'domestic_countryside', label: locale === 'en' ? 'Domestic countryside delivery' : 'Орон нутаг хүргэлт' });
    if (profile.domestic?.pickup) options.push({ code: 'pickup', label: locale === 'en' ? 'Meet-up pickup' : 'Уулзаж авах' });
    if (profile.international?.postal && product.shipsInternationally) {
      options.push({
        code: 'international_post',
        label: locale === 'en' ? 'International postal shipping' : 'Олон улсын шуудан',
        customsNote: localize(profile.international.customsNote, locale)
      });
    }
    return options;
  }

  function productResponse(product: any, locale: Locale = 'mn', currency: Currency = 'MNT') {
    const shop = db.shops.find((item) => item.id === product.shopId);
    const category = db.categories.find((item) => item.id === product.categoryId);
    const price = currency === 'USD' && product.internationalPrice ? product.internationalPrice : product.price;
    return {
      ...product,
      titleText: localize(product.title, locale),
      descriptionText: localize(product.description, locale),
      storyText: localize(product.story, locale),
      techniqueText: localize(product.techniqueDescription, locale),
      touristGiftLabel: product.touristGift ? (locale === 'en' ? 'Unique gift from Mongolia' : 'Монголоос авах өвөрмөц бэлэг') : null,
      shippingInfo: shippingInfoForProduct(product, locale),
      price,
      shop: shop ? {
        id: shop.id,
        slug: shop.slug,
        displayName: shop.displayName,
        verified: shop.status === 'verified',
        verifiedAt: shop.verifiedAt || null,
        stats: shop.stats || {},
        storyText: localize(shop.story, locale),
        artisanProfile: shop.artisanProfile ? {
          ...shop.artisanProfile,
          processText: localize(shop.artisanProfile.process, locale)
        } : null
      } : null,
      category: category ? { id: category.id, slug: category.slug, name: localize(category.name, locale) } : null,
      reviewSummary: reviewSummaryForProduct(product.id)
    };
  }

  /** Бүтээгдэхүүний нийтлэгдсэн худалдан авагчийн сэтгэгдлүүд. */
  function publishedReviewsForProduct(productId) {
    return (db.reviews || []).filter(
      (review) => review.productId === productId && review.status === 'published' && review.reviewerRole === 'buyer'
    );
  }

  /**
   * Жагсаалтын хариуг хөнгөн байлгахын тулд зөвхөн тоо, дундаж оноог өгнө.
   * Сэтгэгдлийн бичвэрийг `GET /products/:productId/reviews`-аас авна.
   */
  function reviewSummaryForProduct(productId) {
    const reviews = publishedReviewsForProduct(productId);
    if (!reviews.length) return { count: 0, average: 0 };
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return { count: reviews.length, average: Math.round((total / reviews.length) * 10) / 10 };
  }

  function featuredProducts(locale, currency, touristMode = false) {
    return db.products
      .filter((product) => product.status === 'active' && (!touristMode || product.touristGift))
      .sort((a, b) => Number(b.touristGift) - Number(a.touristGift) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
      .map((product) => productResponse(product, locale, currency));
  }

  function shopResponse(shop, locale = 'mn', includeProducts = false, currency = 'MNT') {
    const activeProducts = db.products.filter((product) => product.shopId === shop.id && product.status === 'active');
    const products = includeProducts
      ? activeProducts.map((product) => productResponse(product, locale, currency))
      : undefined;
    const categoryNames = [...new Set(activeProducts.map((product) => {
      const category = db.categories.find((item) => item.id === product.categoryId);
      return category ? localize(category.name, locale) : null;
    }).filter(Boolean))];
    const materials = [...new Set(activeProducts.flatMap((product) => product.materials || []))];
    return {
      ...shop,
      verified: shop.status === 'verified',
      verifiedBadge: shop.status === 'verified' ? (locale === 'en' ? 'Verified artisan' : 'Баталгаажсан урлаач') : null,
      storyText: localize(shop.story, locale),
      productCount: activeProducts.length,
      categoryNames,
      materials,
      productSamples: activeProducts.slice(0, 3).map((product) => productResponse(product, locale, currency)),
      seo: {
        title: shop.seo?.title || `${shop.displayName} | ExpoCraft`,
        description: shop.seo?.description || localize(shop.story, locale)
      },
      artisanProfile: shop.artisanProfile ? {
        ...shop.artisanProfile,
        processText: localize(shop.artisanProfile.process, locale)
      } : null,
      processMedia: (shop.processMedia || []).map((item) => ({ ...item, captionText: localize(item.caption, locale) })),
      ...(includeProducts ? { products } : {})
    };
  }

  function newArtisans(locale) {
    return db.shops
      .filter((shop) => shop.status === 'verified')
      .sort((a, b) => new Date(b.verifiedAt || b.createdAt).getTime() - new Date(a.verifiedAt || a.createdAt).getTime())
      .slice(0, 10)
      .map((shop) => shopResponse(shop, locale));
  }

  function shippingOptionForProduct(product, optionCode, destinationCountry) {
    const options = shippingInfoForProduct(product, destinationCountry === 'MN' ? 'mn' : 'en');
    const selected = options.find((option) => option.code === optionCode);
    if (!selected) throw httpError(422, 'invalid_shipping_option', 'Shipping option is not available for this product.');
    if (destinationCountry !== 'MN' && selected.code !== 'international_post') throw httpError(422, 'international_shipping_required', 'International orders must use international_post.');
    return selected;
  }

  function orderTypeForCartItem(cartItem, product) {
    if (cartItem.customRequestId) return 'custom';
    if (product.inventoryType === 'made_to_order') return 'made_to_order';
    return 'ready_made';
  }

  return {
    sellerShop,
    tracksPhysicalStock,
    assertPurchasableQuantity,
    productResponse,
    shippingInfoForProduct,
    featuredProducts,
    newArtisans,
    shippingOptionForProduct,
    orderTypeForCartItem,
    shopResponse,
    publishedReviewsForProduct
  };
};

module.exports = { createCatalogService };

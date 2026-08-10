'use strict';

function daysAgo(value: string | null | undefined) {
  const time = value ? new Date(value).getTime() : 0;
  if (!time || Number.isNaN(time)) return 365;
  return Math.max(0, (Date.now() - time) / (24 * 60 * 60 * 1000));
}

function bump(map: Map<string, number>, key: string | null | undefined, weight: number) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + weight);
}

function topReasons(scored: { signals: Record<string, number> }) {
  return Object.entries(scored.signals)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);
}

function createRecommendationService({ db, productResponse }) {
  function buildProfile(user: any) {
    const materialWeights = new Map<string, number>();
    const categoryWeights = new Map<string, number>();
    const shopWeights = new Map<string, number>();
    const excludedProductIds = new Set<string>();

    const favoriteIds = new Set((db.favorites || []).filter((item: any) => item.userId === user.id).map((item: any) => item.productId));
    for (const product of db.products || []) {
      if (!favoriteIds.has(product.id)) continue;
      excludedProductIds.add(product.id);
      for (const material of product.materials || []) bump(materialWeights, material, 6);
      bump(categoryWeights, product.categoryId, 5);
      bump(shopWeights, product.shopId, 3);
    }

    for (const follow of (db.follows || []).filter((item: any) => item.userId === user.id)) {
      bump(shopWeights, follow.shopId, 5);
    }

    for (const order of (db.orders || []).filter((item: any) => item.buyerId === user.id)) {
      for (const item of (db.orderItems || []).filter((candidate: any) => candidate.orderId === order.id)) {
        const product = (db.products || []).find((candidate: any) => candidate.id === item.productId);
        if (!product) continue;
        excludedProductIds.add(product.id);
        for (const material of product.materials || []) bump(materialWeights, material, 8);
        bump(categoryWeights, product.categoryId, 7);
        bump(shopWeights, product.shopId, 4);
      }
    }

    for (const log of (db.auditLogs || []).filter((item: any) => item.actorId === user.id && item.action === 'view_product').slice(-40)) {
      const product = (db.products || []).find((candidate: any) => candidate.id === log.entityId);
      if (!product) continue;
      for (const material of product.materials || []) bump(materialWeights, material, 1);
      bump(categoryWeights, product.categoryId, 1);
      bump(shopWeights, product.shopId, 0.5);
    }

    return { materialWeights, categoryWeights, shopWeights, excludedProductIds };
  }

  function scoreProduct(product: any, profile: any, options: any) {
    const shop = (db.shops || []).find((item: any) => item.id === product.shopId);
    const signals: Record<string, number> = {};
    signals.material_match = (product.materials || []).reduce((sum: number, material: string) => sum + (profile.materialWeights.get(material) || 0), 0);
    signals.category_match = profile.categoryWeights.get(product.categoryId) || 0;
    signals.shop_affinity = profile.shopWeights.get(product.shopId) || 0;
    signals.shop_quality = Math.min(10, Number(shop?.stats?.ratingAverage || 0) * 1.2 + Math.log10(Number(shop?.stats?.salesCount || 0) + 1));
    signals.freshness = Math.max(0, 8 - daysAgo(product.updatedAt || product.createdAt) / 14);
    signals.availability = product.inventoryType === 'one_of_one' ? 2 : Number(product.stock || 0) > 0 || product.inventoryType === 'made_to_order' ? 4 : -20;
    signals.tourist_fit = options.destinationCountry && options.destinationCountry !== 'MN' && product.shipsInternationally ? 5 : 0;
    signals.exploration = profile.materialWeights.size === 0 && profile.categoryWeights.size === 0 ? 6 : 1;
    const score = Object.values(signals).reduce((sum, value) => sum + value, 0);
    return { product, score, signals };
  }

  function recommendForUser({ user, locale = 'mn', currency = 'MNT', limit = 8, destinationCountry = 'MN' }) {
    const profile = buildProfile(user);
    const scored = (db.products || [])
      .filter((product: any) => product.status === 'active' && !profile.excludedProductIds.has(product.id))
      .map((product: any) => scoreProduct(product, profile, { destinationCountry }))
      .filter((item: any) => item.score > -10)
      .sort((a: any, b: any) => b.score - a.score || daysAgo(a.product.updatedAt || a.product.createdAt) - daysAgo(b.product.updatedAt || b.product.createdAt));

    const selected: any[] = [];
    const shopCounts = new Map<string, number>();
    for (const item of scored) {
      const count = shopCounts.get(item.product.shopId) || 0;
      if (count >= 3 && selected.length < Math.min(6, Number(limit))) continue;
      selected.push(item);
      shopCounts.set(item.product.shopId, count + 1);
      if (selected.length >= Number(limit)) break;
    }

    return selected.map((item) => ({
      product: productResponse(item.product, locale, currency),
      score: Math.round(item.score * 100) / 100,
      reasons: topReasons(item)
    }));
  }

  return { recommendForUser };
}

module.exports = { createRecommendationService };

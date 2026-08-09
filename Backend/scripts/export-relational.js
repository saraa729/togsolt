'use strict';

/**
 * JSON хадгалалтыг §7-гийн харилцан хамаарлат схем рүү хөрвүүлнэ.
 *
 *   DATABASE_URL=postgres://... npm run db:relational
 *
 * Ажиллаж буй сервер JSON дээрээ хэвээр ажиллана — энэ нь тайлан, шинжилгээ,
 * цаашид бүрэн шилжихэд зориулсан хэвийн хэлбэрт оруулсан хуулбар.
 *
 * Дахин ажиллуулж болно: схемийг дахин үүсгэж (DROP … CASCADE) шинээр дүүргэнэ.
 */

const fs = require('fs');
const path = require('path');
const { DATA_FILE } = require('../src/config/constants');

const SCHEMA_FILE = path.join(__dirname, '..', 'db', 'postgres', 'relational.sql');

/** Мөнгө нь `{amount, currency}` эсвэл `undefined`. */
const amountOf = (money) => (money && Number.isFinite(Number(money.amount)) ? Math.round(Number(money.amount)) : null);
const currencyOf = (money) => (money && money.currency ? money.currency : null);
const iso = (value) => (value ? new Date(value).toISOString() : null);

async function insertRows(client, table, columns, rows) {
  if (!rows.length) return 0;
  // Нэг хүсэлтээр багцлан оруулна — мөр тус бүрд query явуулах нь удаан.
  const placeholders = [];
  const values = [];
  rows.forEach((row, rowIndex) => {
    const slots = columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
    placeholders.push(`(${slots.join(', ')})`);
    values.push(...columns.map((column) => row[column] ?? null));
  });
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`;
  const result = await client.query(sql, values);
  return result.rowCount;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL шаардлагатай. Жишээ:');
    console.error('  DATABASE_URL=postgres://user:pass@localhost:5432/expocraft npm run db:relational');
    process.exit(1);
  }
  if (!fs.existsSync(DATA_FILE)) throw new Error(`JSON өгөгдөл олдсонгүй: ${DATA_FILE}`);

  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  try {
    console.log('Схем үүсгэж байна…');
    await client.query(fs.readFileSync(SCHEMA_FILE, 'utf8'));

    const counts = {};
    const track = async (table, columns, rows) => {
      counts[table] = await insertRows(client, table, columns, rows);
    };

    // ── users
    await track('users', ['id', 'email', 'password_hash', 'roles', 'name', 'phone', 'country', 'locale', 'auth_providers', 'email_verified', 'disabled', 'created_at', 'last_login_at'],
      (db.users || []).map((u) => ({
        id: u.id, email: u.email, password_hash: u.passwordHash || null,
        roles: u.roles || [u.role || 'buyer'], name: u.name || u.email,
        phone: u.phone || null, country: u.country || 'MN', locale: u.locale || 'mn',
        auth_providers: u.authProviders || [], email_verified: Boolean(u.emailVerified),
        disabled: Boolean(u.disabled), created_at: iso(u.createdAt), last_login_at: iso(u.lastLoginAt)
      })));

    // ── shops
    await track('shops', ['id', 'seller_id', 'slug', 'display_name', 'status', 'logo_url', 'banner_url', 'story', 'city', 'province', 'district', 'contact', 'artisan_profile', 'process_media', 'rating_avg', 'rating_count', 'sales_count', 'response_hours', 'verified_at', 'created_at'],
      (db.shops || []).map((s) => ({
        id: s.id, seller_id: s.sellerId, slug: s.slug, display_name: s.displayName,
        status: s.status || 'pending_verification', logo_url: s.logoUrl || null, banner_url: s.bannerUrl || null,
        story: JSON.stringify(s.story || {}), city: s.city || null, province: s.province || null,
        district: s.district || null, contact: JSON.stringify(s.contact || {}),
        artisan_profile: s.artisanProfile ? JSON.stringify(s.artisanProfile) : null,
        process_media: JSON.stringify(s.processMedia || []),
        rating_avg: s.stats?.ratingAverage || 0, rating_count: s.stats?.ratingCount || 0,
        sales_count: s.stats?.salesCount || 0, response_hours: s.stats?.responseTimeHours ?? null,
        verified_at: iso(s.verifiedAt), created_at: iso(s.createdAt)
      })));

    // ── categories
    await track('categories', ['id', 'parent_id', 'slug', 'name'],
      (db.categories || []).map((c) => ({
        id: c.id, parent_id: c.parentId || null, slug: c.slug, name: JSON.stringify(c.name || {})
      })));

    // ── materials (бүтээлүүдийн материалуудаас гаргаж авна)
    const materialSet = new Set();
    for (const product of db.products || []) for (const m of product.materials || []) materialSet.add(m);
    const materials = [...materialSet].map((m) => ({ id: `mat_${m}`, name: JSON.stringify({ mn: m, en: m }) }));
    await track('materials', ['id', 'name'], materials);

    // ── products
    await track('products', ['id', 'shop_id', 'seller_id', 'category_id', 'name', 'description', 'story', 'technique', 'techniques', 'styles', 'images', 'process_media', 'stock_mode', 'stock', 'lead_time_days', 'price_amount', 'price_currency', 'intl_price_amount', 'intl_price_currency', 'weight_gram', 'dimensions', 'ships_internationally', 'tourist_gift', 'custom_enabled', 'status', 'created_at', 'updated_at'],
      (db.products || []).map((p) => ({
        id: p.id, shop_id: p.shopId, seller_id: p.sellerId, category_id: p.categoryId || null,
        name: JSON.stringify(p.title || {}), description: JSON.stringify(p.description || {}),
        story: p.story ? JSON.stringify(p.story) : null,
        technique: p.techniqueDescription ? JSON.stringify(p.techniqueDescription) : null,
        techniques: p.techniques || [], styles: p.styles || [],
        images: JSON.stringify(p.images || []), process_media: JSON.stringify(p.processMedia || []),
        stock_mode: p.inventoryType, stock: Number(p.stock || 0),
        lead_time_days: p.productionDays ?? null,
        price_amount: amountOf(p.price), price_currency: currencyOf(p.price) || 'MNT',
        intl_price_amount: amountOf(p.internationalPrice), intl_price_currency: currencyOf(p.internationalPrice),
        weight_gram: p.weightGram ?? null,
        dimensions: p.dimensionsCm ? JSON.stringify(p.dimensionsCm) : null,
        ships_internationally: Boolean(p.shipsInternationally), tourist_gift: Boolean(p.touristGift),
        custom_enabled: Boolean(p.customEnabled), status: p.status || 'active',
        created_at: iso(p.createdAt), updated_at: iso(p.updatedAt)
      })));

    const productMaterials = [];
    for (const product of db.products || []) {
      for (const m of new Set(product.materials || [])) {
        productMaterials.push({ product_id: product.id, material_id: `mat_${m}` });
      }
    }
    await track('product_materials', ['product_id', 'material_id'], productMaterials);

    // ── custom requests
    await track('custom_requests', ['id', 'shop_id', 'seller_id', 'buyer_id', 'product_id', 'description', 'reference_images', 'quoted_amount', 'quoted_currency', 'quoted_lead_days', 'status', 'created_at', 'updated_at'],
      (db.customRequests || []).map((r) => ({
        id: r.id, shop_id: r.shopId || null, seller_id: r.sellerId || null, buyer_id: r.buyerId,
        product_id: r.productId || null, description: r.message || '',
        reference_images: JSON.stringify(r.referenceImages || []),
        quoted_amount: amountOf(r.quote?.price), quoted_currency: currencyOf(r.quote?.price),
        quoted_lead_days: r.quote?.productionDays ?? null, status: r.status || 'requested',
        created_at: iso(r.createdAt), updated_at: iso(r.updatedAt)
      })));

    // ── carts
    await track('carts', ['id', 'buyer_id', 'updated_at'],
      (db.carts || []).map((c) => ({ id: c.id, buyer_id: c.buyerId, updated_at: iso(c.updatedAt) })));

    const cartItems = [];
    for (const cart of db.carts || []) {
      for (const item of cart.items || []) {
        cartItems.push({
          id: item.id, cart_id: cart.id, product_id: item.productId,
          custom_request_id: item.customRequestId || null, qty: Number(item.quantity || 1),
          quoted_amount: amountOf(item.quotedPrice), quoted_currency: currencyOf(item.quotedPrice),
          added_at: iso(item.addedAt)
        });
      }
    }
    await track('cart_items', ['id', 'cart_id', 'product_id', 'custom_request_id', 'qty', 'quoted_amount', 'quoted_currency', 'added_at'], cartItems);

    // ── orders → order_shops → order_items
    await track('orders', ['id', 'buyer_id', 'status', 'currency', 'subtotal_amount', 'commission_amount', 'seller_total_amount', 'discount_amount', 'coupon_code', 'payment_provider', 'payment_status', 'payment_ref', 'escrow_status', 'destination_country', 'shipping_address', 'created_at'],
      (db.orders || []).map((o) => ({
        id: o.id, buyer_id: o.buyerId, status: o.status || 'paid', currency: o.currency,
        subtotal_amount: amountOf(o.subtotal) || 0, commission_amount: amountOf(o.commissionTotal) || 0,
        seller_total_amount: amountOf(o.sellerTotal) || 0, discount_amount: amountOf(o.coupon?.discount) || 0,
        coupon_code: o.coupon?.code || null, payment_provider: o.payment?.method || null,
        payment_status: o.payment?.status || null, payment_ref: o.payment?.providerRef || null,
        escrow_status: o.escrowStatus || 'held', destination_country: o.destinationCountry || 'MN',
        shipping_address: JSON.stringify(o.shippingAddress || {}), created_at: iso(o.createdAt)
      })));

    // `sellerGroups` нь §7-гийн OrderShop — тогтвортой id үүсгэнэ.
    const orderShopId = (orderId, sellerId) => `osh_${orderId.slice(-10)}_${sellerId.slice(-8)}`;
    const orderShops = [];
    for (const order of db.orders || []) {
      for (const group of order.sellerGroups || []) {
        orderShops.push({
          id: orderShopId(order.id, group.sellerId), order_id: order.id, shop_id: group.shopId,
          seller_id: group.sellerId, status: group.status || 'paid',
          subtotal_amount: amountOf(group.subtotal) || 0,
          commission_amount: amountOf(group.commission) || 0,
          seller_receivable_amount: amountOf(group.sellerReceivable) || 0,
          currency: order.currency, shipping_method: group.shippingOption?.code || null,
          shipping_fee_amount: 0, tracking_code: null
        });
      }
    }
    await track('order_shops', ['id', 'order_id', 'shop_id', 'seller_id', 'status', 'subtotal_amount', 'commission_amount', 'seller_receivable_amount', 'currency', 'shipping_method', 'shipping_fee_amount', 'tracking_code'], orderShops);

    const productName = new Map((db.products || []).map((p) => [p.id, p.title?.mn || p.title?.en || p.id]));
    const orderById = new Map((db.orders || []).map((o) => [o.id, o]));
    await track('order_items', ['id', 'order_shop_id', 'order_id', 'product_id', 'custom_request_id', 'name', 'unit_price_amount', 'currency', 'qty', 'line_total_amount', 'commission_amount', 'seller_receivable_amount', 'discount_amount', 'order_type', 'production_days', 'status', 'escrow_status', 'progress_updates', 'delivered_at', 'created_at', 'updated_at'],
      (db.orderItems || [])
        .filter((i) => orderById.has(i.orderId))
        .map((i) => ({
          id: i.id, order_shop_id: orderShopId(i.orderId, i.sellerId), order_id: i.orderId,
          product_id: i.productId || null, custom_request_id: i.customRequestId || null,
          name: productName.get(i.productId) || i.productId,
          unit_price_amount: amountOf(i.unitPrice), currency: currencyOf(i.unitPrice) || 'MNT',
          qty: Number(i.quantity || 1), line_total_amount: amountOf(i.lineTotal),
          commission_amount: amountOf(i.commission) || 0,
          seller_receivable_amount: amountOf(i.sellerReceivable) || 0,
          discount_amount: amountOf(i.discount) || 0, order_type: i.orderType || null,
          production_days: i.productionDays ?? null, status: i.status || 'paid',
          escrow_status: i.escrowStatus || 'held',
          progress_updates: JSON.stringify(i.progressUpdates || []),
          delivered_at: iso(i.deliveredAt), created_at: iso(i.createdAt), updated_at: iso(i.updatedAt)
        })));

    // ── shipments
    await track('shipments', ['id', 'order_shop_id', 'order_item_id', 'method', 'carrier', 'tracking_code', 'status', 'events', 'created_at'],
      (db.shipments || []).map((s) => ({
        id: s.id, order_shop_id: s.orderId && s.sellerId ? orderShopId(s.orderId, s.sellerId) : null,
        order_item_id: s.orderItemId || null, method: s.method || null, carrier: s.carrier || null,
        tracking_code: s.trackingCode || null, status: s.status || null,
        events: JSON.stringify(s.events || []), created_at: iso(s.createdAt)
      })));

    // ── escrow payments (захиалгын төлбөрийн бичилт)
    await track('escrow_payments', ['id', 'order_id', 'provider', 'invoice_id', 'amount', 'currency', 'status', 'raw_callback', 'created_at'],
      (db.orders || []).map((o) => ({
        id: `esp_${o.id.slice(-12)}`, order_id: o.id, provider: o.payment?.method || 'unknown',
        invoice_id: o.payment?.providerRef || null, amount: amountOf(o.subtotal) || 0,
        currency: o.currency, status: o.payment?.status || 'captured',
        raw_callback: null, created_at: iso(o.createdAt)
      })));

    // ── ledger
    await track('ledger_entries', ['id', 'order_id', 'order_item_id', 'seller_id', 'kind', 'amount', 'currency', 'note', 'created_at'],
      (db.escrowLedger || [])
        .filter((e) => !e.orderId || orderById.has(e.orderId))
        .map((e) => ({
          id: e.id, order_id: e.orderId || null, order_item_id: e.orderItemId || null,
          seller_id: e.sellerId || null, kind: e.type, amount: amountOf(e.amount),
          currency: currencyOf(e.amount) || 'MNT', note: e.note || null, created_at: iso(e.createdAt)
        })));

    // ── payouts
    await track('payouts', ['id', 'seller_id', 'amount', 'currency', 'status', 'bank_account', 'requested_at', 'paid_at'],
      (db.payoutRequests || []).map((p) => ({
        id: p.id, seller_id: p.sellerId, amount: amountOf(p.amount), currency: currencyOf(p.amount) || 'MNT',
        status: p.status || 'requested', bank_account: JSON.stringify(p.bankAccount || {}),
        requested_at: iso(p.createdAt), paid_at: iso(p.paidAt)
      })));

    // ── disputes
    await track('disputes', ['id', 'order_id', 'order_item_id', 'opened_by', 'buyer_id', 'seller_id', 'reason', 'evidence', 'status', 'resolution', 'created_at'],
      (db.disputes || []).map((d) => ({
        id: d.id, order_id: d.orderId || null, order_item_id: d.orderItemId || null,
        opened_by: d.openedBy, buyer_id: d.buyerId || null, seller_id: d.sellerId || null,
        reason: d.reason, evidence: JSON.stringify(d.evidence || []), status: d.status || 'open',
        resolution: d.resolution ? JSON.stringify(d.resolution) : null, created_at: iso(d.createdAt)
      })));

    // ── chat
    await track('chat_threads', ['id', 'buyer_id', 'seller_id', 'shop_id', 'ref_type', 'ref_id', 'created_at', 'updated_at'],
      (db.conversations || []).map((c) => ({
        id: c.id, buyer_id: c.buyerId, seller_id: c.sellerId, shop_id: c.shopId || null,
        ref_type: c.orderItemId ? 'order_item' : null, ref_id: c.orderItemId || null,
        created_at: iso(c.createdAt), updated_at: iso(c.updatedAt)
      })));

    const chatMessages = [];
    for (const thread of db.conversations || []) {
      for (const m of thread.messages || []) {
        chatMessages.push({
          id: m.id, thread_id: thread.id, sender_id: m.senderId, content: m.message || null,
          image_url: m.attachments?.[0]?.url || null, created_at: iso(m.createdAt)
        });
      }
    }
    await track('chat_messages', ['id', 'thread_id', 'sender_id', 'content', 'image_url', 'created_at'], chatMessages);

    // ── reviews / reports / audit
    await track('reviews', ['id', 'order_item_id', 'order_id', 'product_id', 'shop_id', 'reviewer_id', 'reviewer_role', 'stars', 'comment', 'images', 'status', 'created_at'],
      (db.reviews || []).map((r) => ({
        id: r.id, order_item_id: r.orderItemId || null, order_id: r.orderId || null,
        product_id: r.productId || null, shop_id: r.shopId || null, reviewer_id: r.reviewerId,
        reviewer_role: r.reviewerRole, stars: r.rating, comment: r.comment || null,
        images: JSON.stringify(r.images || []), status: r.status || 'published', created_at: iso(r.createdAt)
      })));

    await track('reports', ['id', 'reporter_id', 'entity_type', 'entity_id', 'reason', 'details', 'status', 'moderation_note', 'created_at'],
      (db.reports || []).map((r) => ({
        id: r.id, reporter_id: r.reporterId, entity_type: r.entityType, entity_id: r.entityId,
        reason: r.reason, details: r.details || null, status: r.status || 'open',
        moderation_note: r.moderationNote || null, created_at: iso(r.createdAt)
      })));

    await track('audit_logs', ['id', 'actor_id', 'action', 'entity_type', 'entity_id', 'metadata', 'created_at'],
      (db.auditLogs || []).map((l) => ({
        id: l.id, actor_id: l.actorId || null, action: l.action, entity_type: l.entityType || null,
        entity_id: l.entityId || null, metadata: JSON.stringify(l.metadata || {}), created_at: iso(l.createdAt)
      })));

    console.log('\nХөрвүүлсэн мөрүүд:');
    for (const [table, n] of Object.entries(counts)) console.log(`  ${table.padEnd(20)} ${n}`);

    // Мөнгөний зөв байдлыг шалгана (§NFR-1): дэвтрийн нийлбэр = escrow үлдэгдэл
    const check = await client.query(`
      SELECT kind, currency, SUM(amount)::bigint AS total
      FROM ledger_entries GROUP BY kind, currency ORDER BY kind`);
    if (check.rows.length) {
      console.log('\nДэвтрийн хяналт:');
      for (const row of check.rows) console.log(`  ${row.kind.padEnd(32)} ${row.total} ${row.currency}`);
    }
    console.log('\nАмжилттай.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Алдаа:', error.message);
  process.exit(1);
});

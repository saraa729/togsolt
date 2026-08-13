'use strict';

require('dotenv').config();

const { app, route, handle, finalizeRoutes } = require('./http/router');
const registerRoutes = require('./routes');
const { now, id, money, addMoney, percentBps, httpError, localize, readJson, readRaw } = require('./utils/core');
const { verifyPassword, signToken, verifyToken } = require('./auth/security');
const { createAuthContext } = require('./auth/context');
const { loadState, saveState, initialState, createUserRecord } = require('./data/store');
const { createValidators } = require('./validators');
const { createLedgerService } = require('./services/ledger');
const { createCatalogService } = require('./services/catalog');
const { createCartService } = require('./services/cart');
const { createBankService } = require('./services/bank');
const { createPaymentService } = require('./services/payments');
const { createStorageService } = require('./services/storage');
const { createMailer } = require('./services/mailer');
const { createSearchService } = require('./services/search');
const { createRecommendationService } = require('./services/recommendations');
const { createRuntimeStore } = require('./services/runtime-store');
const { createQueueService } = require('./services/queue');
const { createRealtime } = require('./services/realtime');
const { createJobScheduler } = require('./jobs/scheduler');
const metrics = require('./observability/metrics');
const { openApiDocument } = require('./docs/openapi');
const {
  ROLES,
  ORDER_ITEM_STATUS,
  CUSTOM_STATUS,
  INVENTORY_TYPES,
  PRODUCT_STATUS,
  PAYMENT_PROVIDERS,
  REPORT_STATUS,
  CONTRACT_STATUS
} = require('./config/constants');
import type { AppContext } from './types';

const db = loadState();

function audit(actorId, action, entityType, entityId, metadata = {}) {
  db.auditLogs.push({ id: id('log'), actorId, action, entityType, entityId, metadata, createdAt: now() });
}

function ageHours(value) {
  const time = value ? new Date(value).getTime() : 0;
  if (!time || Number.isNaN(time)) return 0;
  return Math.max(0, (Date.now() - time) / (60 * 60 * 1000));
}

function criticalSlaCount() {
  const shops = db.shops.filter((shop) => shop.status === 'pending_verification' && ageHours(shop.createdAt) >= 48).length;
  const reports = db.reports.filter((report) => ['open', 'reviewing'].includes(report.status) && ageHours(report.updatedAt || report.createdAt) >= 24).length;
  const disputes = db.disputes.filter((dispute) => ['open', 'frozen'].includes(dispute.status) && ageHours(dispute.updatedAt || dispute.createdAt) >= 72).length;
  const payouts = db.payoutRequests.filter((request) => ['requested', 'approved', 'pending_manual'].includes(request.status) && ageHours(request.updatedAt || request.createdAt) >= 72).length;
  return shops + reports + disputes + payouts;
}

const auth = createAuthContext({
  db,
  audit,
  id,
  now,
  httpError,
  signToken,
  verifyToken
});

const validators = createValidators({
  db,
  httpError,
  INVENTORY_TYPES,
  PAYMENT_PROVIDERS
});

const ledger = createLedgerService({
  db,
  audit,
  id,
  now,
  money,
  addMoney
});

const catalog = createCatalogService({
  db,
  httpError,
  localize,
  INVENTORY_TYPES
});

const cart = createCartService({
  db,
  id,
  now,
  money,
  addMoney,
  productResponse: catalog.productResponse,
  orderTypeForCartItem: catalog.orderTypeForCartItem,
  shippingInfoForProduct: catalog.shippingInfoForProduct
});

const bank = createBankService({
  id,
  now,
  httpError
});

const payments = createPaymentService({
  db,
  id,
  now,
  money,
  httpError,
  audit,
  saveState,
  addEscrowEntry: ledger.addEscrowEntry
});

const storage = createStorageService({
  httpError
});

const mailer = createMailer();

const runtimeStore = createRuntimeStore();
const queue = createQueueService();
const realtime = createRealtime({
  db,
  verifyToken,
  publicUser: auth.publicUser,
  hasRole: auth.hasRole,
  ROLES,
  now
});
const search = createSearchService({
  db,
  localize
});
const recommendations = createRecommendationService({
  db,
  productResponse: catalog.productResponse
});
const jobs = createJobScheduler({
  db,
  now,
  id,
  audit,
  saveState,
  releaseEscrowForOrderItem: ledger.releaseEscrowForOrderItem,
  syncOrderEscrowStatus: ledger.syncOrderEscrowStatus,
  reconciliationForDate: ledger.reconciliationForDate,
  queue
});

const routeContext: AppContext = {
  route,
  ROLES,
  ORDER_ITEM_STATUS,
  CUSTOM_STATUS,
  PRODUCT_STATUS,
  CONTRACT_STATUS,
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
  publicUser: auth.publicUser,
  localize,
  readJson,
  readRaw,
  requireAuth: auth.requireAuth,
  requireRole: auth.requireRole,
  hasRole: auth.hasRole,
  issueAuthSession: auth.issueAuthSession,
  rotateRefreshToken: auth.rotateRefreshToken,
  revokeRefreshToken: auth.revokeRefreshToken,
  sellerShop: catalog.sellerShop,
  assertText: validators.assertText,
  assertLocalized: validators.assertLocalized,
  translationSuggestions: validators.translationSuggestions,
  localizedPayload: validators.localizedPayload,
  assertPositiveInt: validators.assertPositiveInt,
  assertMoneyAmount: validators.assertMoneyAmount,
  assertSupportedLocale: validators.assertSupportedLocale,
  assertSupportedCurrency: validators.assertSupportedCurrency,
  assertPaymentProvider: validators.assertPaymentProvider,
  normalizeInventory: validators.normalizeInventory,
  tracksPhysicalStock: catalog.tracksPhysicalStock,
  assertPurchasableQuantity: catalog.assertPurchasableQuantity,
  addEscrowEntry: ledger.addEscrowEntry,
  ledgerBalances: ledger.ledgerBalances,
  reconciliationForDate: ledger.reconciliationForDate,
  freezeEscrowForOrderItem: ledger.freezeEscrowForOrderItem,
  releaseEscrowForOrderItem: ledger.releaseEscrowForOrderItem,
  refundEscrowForOrderItem: ledger.refundEscrowForOrderItem,
  syncOrderEscrowStatus: ledger.syncOrderEscrowStatus,
  productResponse: catalog.productResponse,
  shippingInfoForProduct: catalog.shippingInfoForProduct,
  featuredProducts: catalog.featuredProducts,
  newArtisans: catalog.newArtisans,
  shippingOptionForProduct: catalog.shippingOptionForProduct,
  orderTypeForCartItem: catalog.orderTypeForCartItem,
  shopResponse: catalog.shopResponse,
  publishedReviewsForProduct: catalog.publishedReviewsForProduct,
  getOrCreateCart: cart.getOrCreateCart,
  cartResponse: cart.cartResponse,
  executeBankTransfer: bank.executeTransfer,
  normalizeBankAccount: bank.normalizeBankAccount,
  paymentMode: payments.mode,
  paymentProviderFor: payments.providerFor,
  assertPaymentProviderUsable: payments.assertProviderUsable,
  createPayment: payments.createPayment,
  capturePayment: payments.capturePayment,
  failPayment: payments.failPayment,
  verifyStripeSignature: payments.verifyStripeSignature,
  verifyPaymentCallbackToken: payments.verifyCallbackToken,
  checkQpayInvoice: payments.checkQpayInvoice,
  scanFile: storage.scanFile,
  saveImage: storage.saveImage,
  saveThumbnail: storage.saveThumbnail,
  mailer,
  runtimeStore,
  queue,
  realtime,
  searchProducts: search.searchProducts,
  recommendForUser: recommendations.recommendForUser,
  jobScheduler: jobs
};

registerRoutes(routeContext);

route('GET', '/metrics', async () => ({ metrics: metrics.snapshot(), runtimeStore: runtimeStore.provider, realtime: realtime.provider, queue: queue.provider }));
route('GET', '/metrics/prometheus', async (ctx) => {
  metrics.setGauge('expocraft_runtime_store_info', 1, { provider: runtimeStore.provider, environment: process.env.NODE_ENV || 'development' });
  metrics.setGauge('expocraft_realtime_info', 1, { provider: realtime.provider });
  metrics.setGauge('expocraft_queue_info', 1, { provider: queue.provider });
  metrics.setGauge('expocraft_admin_sla_critical_total', criticalSlaCount());
  if (process.env.EXPOCRAFT_LAST_BACKUP_TIMESTAMP_SECONDS) {
    metrics.setGauge('expocraft_last_backup_timestamp_seconds', Number(process.env.EXPOCRAFT_LAST_BACKUP_TIMESTAMP_SECONDS));
  }
  ctx.sendText(ctx.res, 200, metrics.prometheus(), 'text/plain; version=0.0.4; charset=utf-8');
  return undefined;
});
route('GET', '/docs/openapi.json', async () => openApiDocument());
route('GET', '/docs', async () => ({ openapi: '/docs/openapi.json', title: 'ExpoCraft API Docs' }));

finalizeRoutes();

module.exports = { app, handle, loadState, saveState, initialState, jobs, realtime, queue };

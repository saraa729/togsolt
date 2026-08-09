'use strict';

require('dotenv').config();

const { route, handle } = require('./http/router');
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
const { createStorageService } = require('./services/storage');
const { createMailer } = require('./services/mailer');
const { createSearchService } = require('./services/search');
const { createRuntimeStore } = require('./services/runtime-store');
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

const db = loadState();

function audit(actorId, action, entityType, entityId, metadata = {}) {
  db.auditLogs.push({ id: id('log'), actorId, action, entityType, entityId, metadata, createdAt: now() });
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

const storage = createStorageService({
  httpError
});

const mailer = createMailer();

const runtimeStore = createRuntimeStore();
const search = createSearchService({
  db,
  localize
});
const jobs = createJobScheduler({
  db,
  now,
  id,
  audit,
  saveState,
  releaseEscrowForOrderItem: ledger.releaseEscrowForOrderItem,
  syncOrderEscrowStatus: ledger.syncOrderEscrowStatus,
  reconciliationForDate: ledger.reconciliationForDate
});

registerRoutes({
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
  saveImage: storage.saveImage,
  saveThumbnail: storage.saveThumbnail,
  mailer,
  runtimeStore,
  searchProducts: search.searchProducts,
  jobScheduler: jobs
});

route('GET', '/metrics', async () => ({ metrics: metrics.snapshot(), runtimeStore: runtimeStore.provider }));
route('GET', '/metrics/prometheus', async (ctx) => {
  ctx.sendText(ctx.res, 200, metrics.prometheus(), 'text/plain; version=0.0.4; charset=utf-8');
  return undefined;
});
route('GET', '/docs/openapi.json', async () => openApiDocument());
route('GET', '/docs', async () => ({ openapi: '/docs/openapi.json', title: 'ExpoCraft API Docs' }));

module.exports = { handle, loadState, saveState, initialState, jobs };

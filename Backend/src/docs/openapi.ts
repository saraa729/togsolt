'use strict';

// [method, path, summary, tag, requiresAuth]
const ROUTE_TABLE = [
  // System
  ['get', '/health', 'Health check', 'System', false],
  ['get', '/metrics', 'Runtime metrics snapshot', 'System', false],
  ['get', '/metrics/prometheus', 'Runtime metrics in Prometheus text format', 'System', false],
  ['get', '/docs', 'API docs index', 'System', false],
  ['get', '/docs/openapi.json', 'This OpenAPI document', 'System', false],

  // Auth
  ['get', '/auth/login', 'Login endpoint info', 'Auth', false],
  ['get', '/auth/register', 'Register endpoint info', 'Auth', false],
  ['post', '/auth/register', 'Register a buyer and/or seller account', 'Auth', false],
  ['post', '/auth/login', 'Login with email/password, sets secure refresh cookie', 'Auth', false],
  ['post', '/auth/google', 'Login/register with Google; existing password accounts must link Google first', 'Auth', false],
  ['post', '/auth/refresh', 'Rotate refresh token from body or cookie', 'Auth', false],
  ['post', '/auth/logout', 'Revoke refresh token and clear cookie', 'Auth', false],
  ['post', '/auth/verify-email', 'Verify email address with a token', 'Auth', false],
  ['post', '/auth/forgot-password', 'Request a password reset token', 'Auth', false],
  ['post', '/auth/reset-password', 'Reset password with a reset token', 'Auth', false],
  ['post', '/me/roles/seller', 'Add the seller role to the current account', 'Auth', true],
  ['get', '/me', 'Current user profile and shop', 'Auth', true],
  ['patch', '/me', 'Update current user profile', 'Auth', true],

  // Discovery
  ['get', '/categories', 'List product categories', 'Discovery', false],
  ['get', '/home', 'Home feed: featured products, new artisans, categories', 'Discovery', false],
  ['get', '/tourist/home', 'English/USD home feed for tourists', 'Discovery', false],
  ['get', '/shops', 'Search shops', 'Discovery', false],
  ['get', '/shop/:slug', 'Public shop page with SEO, story, products', 'Discovery', false],
  ['post', '/favorites/products/:productId', 'Favorite a product', 'Discovery', true],
  ['delete', '/favorites/products/:productId', 'Unfavorite a product', 'Discovery', true],
  ['get', '/favorites/products', 'List favorited products', 'Discovery', true],
  ['get', '/follows/shops', 'List followed shops', 'Discovery', true],
  ['post', '/follows/shops/:shopId', 'Follow a shop', 'Discovery', true],
  ['delete', '/follows/shops/:shopId', 'Unfollow a shop', 'Discovery', true],

  // Catalog
  ['post', '/seller/shop', 'Create the seller shop profile', 'Catalog', true],
  ['patch', '/seller/shop', 'Update the seller shop profile', 'Catalog', true],
  ['post', '/admin/sellers/:sellerId/verify', 'Verify a seller shop', 'Catalog', true],
  ['post', '/products', 'Create a product (verified sellers only)', 'Catalog', true],
  ['get', '/seller/products', 'List the current seller’s products', 'Catalog', true],
  ['patch', '/seller/products/:productId', 'Update a product', 'Catalog', true],
  ['patch', '/seller/products/:productId/status', 'Show or hide a product', 'Catalog', true],
  ['delete', '/seller/products/:productId', 'Hide (soft-delete) a product', 'Catalog', true],
  ['get', '/products', 'Search and filter active products', 'Catalog', false],
  ['get', '/products/:productId', 'Product detail', 'Catalog', false],

  // Cart & Orders
  ['post', '/cart/items', 'Add a product to the cart', 'Orders', true],
  ['post', '/cart/custom-requests/:requestId', 'Add an accepted custom quote to the cart', 'Orders', true],
  ['get', '/cart', 'Get the current cart', 'Orders', true],
  ['patch', '/cart/items/:itemId', 'Update a cart item quantity', 'Orders', true],
  ['delete', '/cart/items/:itemId', 'Remove a cart item', 'Orders', true],
  ['post', '/checkout', 'Checkout the linked cart and capture escrow payment', 'Orders', true],
  ['get', '/orders', 'List orders visible to the current user', 'Orders', true],
  ['get', '/seller/balance', 'Seller escrow/payout balances', 'Orders', true],
  ['post', '/seller/payout-requests', 'Request a payout of released balance', 'Orders', true],
  ['post', '/orders/:orderId/confirm-received', 'Buyer confirms delivery, releasing escrow', 'Orders', true],
  ['patch', '/seller/order-items/:itemId/status', 'Seller updates order item status (accepted/making/shipped/delivered/cancelled)', 'Orders', true],
  ['post', '/seller/order-items/:itemId/progress', 'Seller posts a production progress update', 'Orders', true],
  ['post', '/disputes', 'Open a dispute on an order item, freezing escrow', 'Orders', true],
  ['post', '/admin/disputes/:disputeId/resolve', 'Admin resolves a dispute (refund buyer or release seller)', 'Orders', true],

  // Custom orders & trust
  ['post', '/custom-requests', 'Buyer creates a custom order request', 'Custom & Trust', true],
  ['get', '/custom-requests', 'List the buyer’s custom requests', 'Custom & Trust', true],
  ['get', '/seller/custom-requests', 'List the seller’s custom requests', 'Custom & Trust', true],
  ['patch', '/seller/custom-requests/:requestId', 'Seller updates status/quote on a custom request', 'Custom & Trust', true],
  ['post', '/custom-requests/:requestId/accept-quote', 'Buyer accepts a custom request quote', 'Custom & Trust', true],
  ['post', '/custom-requests/:requestId/messages', 'Send a message on a custom request', 'Custom & Trust', true],
  ['post', '/conversations', 'Start or fetch a buyer/seller conversation', 'Custom & Trust', true],
  ['get', '/conversations', 'List conversations for the current user', 'Custom & Trust', true],
  ['get', '/conversations/stream', 'Legacy SSE stream; primary realtime uses Socket.io rooms/presence/typing on /socket.io', 'Custom & Trust', true],
  ['post', '/conversations/:conversationId/messages', 'Send a message in a conversation', 'Custom & Trust', true],
  ['post', '/reviews', 'Post a review after delivery', 'Custom & Trust', true],
  ['post', '/reports', 'Report a product or shop for moderation', 'Custom & Trust', true],
  ['patch', '/admin/reports/:reportId', 'Admin moderates a report', 'Custom & Trust', true],

  // Admin
  ['post', '/admin/payouts/run', 'Batch-schedule payouts for released order items', 'Admin', true],
  ['patch', '/admin/payout-requests/:requestId', 'Approve/reject/mark-paid a seller payout request', 'Admin', true],
  ['post', '/admin/escrow/auto-release', 'Manually trigger escrow auto-release for delivered items', 'Admin', true],
  ['post', '/admin/jobs/:jobName/run', 'Manually run a background job', 'Admin', true],
  ['get', '/admin/ops/alerts', 'Admin SLA and operations alerts', 'Admin', true],
  ['get', '/admin/escrow-ledger', 'Query escrow ledger entries', 'Admin', true],
  ['get', '/admin/balances', 'Platform/seller escrow balances', 'Admin', true],
  ['get', '/admin/reconciliation/daily', 'Daily ledger reconciliation summary', 'Admin', true],
  ['get', '/admin/queues', 'Verification, moderation, dispute, and payout queues', 'Admin', true],
  ['get', '/admin/seller-verifications', 'List shops pending/verified for seller verification', 'Admin', true],
  ['patch', '/admin/shops/:shopId/verification', 'Approve/reject a shop verification', 'Admin', true],
  ['get', '/admin/reports', 'List moderation reports', 'Admin', true],
  ['get', '/admin/reports/:reportId', 'Moderation report detail', 'Admin', true],
  ['get', '/admin/disputes', 'List disputes with order context', 'Admin', true],
  ['patch', '/admin/settings', 'Update platform settings (commission, currencies, escrow window)', 'Admin', true],
  ['get', '/admin/audit-logs', 'Query audit log entries', 'Admin', true],
  ['get', '/admin/audit-logs/export', 'Export audit log entries as CSV', 'Admin', true],
  ['get', '/admin/users', 'List users', 'Admin', true],
  ['patch', '/admin/users/:userId', 'Update a user’s name/role/disabled status', 'Admin', true],
  ['get', '/admin/products', 'List all products for moderation', 'Admin', true],
  ['patch', '/admin/products/:productId/status', 'Admin sets a product’s status', 'Admin', true],
  ['get', '/admin/orders', 'List all orders', 'Admin', true],
  ['get', '/admin/reports/overview', 'Dashboard: GMV, commission, funnel, disputes, escrow', 'Admin', true],

  // Phase 2
  ['post', '/seller/coupons', 'Create a seller coupon', 'Phase 2', true],
  ['post', '/coupons/validate', 'Validate a coupon code', 'Phase 2', true],
  ['post', '/seller/custom-requests/:requestId/contract', 'Create a contract from a quoted custom request', 'Phase 2', true],
  ['post', '/contracts/:contractId/accept', 'Buyer accepts a contract', 'Phase 2', true],
  ['patch', '/seller/order-items/:itemId/shipment', 'Seller attaches carrier/tracking info', 'Phase 2', true],
  ['post', '/webhooks/logistics/tracking', 'Logistics provider tracking callback', 'Phase 2', false],
  ['post', '/ai/products/suggest', 'AI-assisted category/material/technique suggestions', 'Phase 2', true],
  ['get', '/recommendations', 'Personalized product recommendations', 'Phase 2', true],
  ['post', '/shipping/estimate', 'Estimate shipping, customs documents, and tax for a destination', 'Phase 2', true],
  ['post', '/webhooks/payments/:provider', 'Idempotent payment provider callback (QPay/Stripe)', 'Phase 2', false],

  // Uploads
  ['post', '/uploads/images', 'Upload a product/shop image', 'Uploads', true],

  // Legacy aliases (identical behavior to their /auth/* counterparts)
  ['get', '/login', 'Alias of GET /auth/login', 'Legacy aliases', false],
  ['get', '/register', 'Alias of GET /auth/register', 'Legacy aliases', false],
  ['get', '/api/auth/login', 'Alias of GET /auth/login', 'Legacy aliases', false],
  ['get', '/api/auth/register', 'Alias of GET /auth/register', 'Legacy aliases', false],
  ['post', '/login', 'Alias of POST /auth/login', 'Legacy aliases', false],
  ['post', '/register', 'Alias of POST /auth/register', 'Legacy aliases', false],
  ['post', '/api/auth/login', 'Alias of POST /auth/login', 'Legacy aliases', false],
  ['post', '/api/auth/register', 'Alias of POST /auth/register', 'Legacy aliases', false]
];

function toOpenApiPath(path) {
  return path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
}

function openApiDocument() {
  const paths = {};
  for (const [method, path, summary, tag, requiresAuth] of ROUTE_TABLE) {
    const openApiPath = toOpenApiPath(path);
    paths[openApiPath] = paths[openApiPath] || {};
    paths[openApiPath][method] = {
      summary,
      tags: [tag],
      ...(requiresAuth ? { security: [{ bearerAuth: [] }] } : {}),
      responses: {
        200: { description: summary },
        ...(requiresAuth ? { 401: { description: 'Missing or invalid access token' } } : {})
      }
    };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'ExpoCraft Marketplace API',
      version: '1.0.0',
      description: 'Mongolian handmade marketplace API for buyers, sellers, admins, escrow, chat, custom orders, payouts, uploads, and moderation. Path parameters use the standard `{param}` OpenAPI syntax; request/response bodies are JSON.'
    },
    servers: [{ url: 'http://127.0.0.1:4000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        refreshCookie: { type: 'apiKey', in: 'cookie', name: 'expocraft_refresh' }
      }
    },
    paths
  };
}

module.exports = { openApiDocument };

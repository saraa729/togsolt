# ExpoCraft Backend

Dependency-free Node.js backend prototype for a Mongolian handmade marketplace.

## Run

```bash
EXPOCRAFT_SEED=true node app.js
```

Server defaults to `http://localhost:4000`.

## Demo users

When `EXPOCRAFT_SEED=true`:

- Admin: `admin@expocraft.mn` / `admin12345`
- Seller: `seller@expocraft.mn` / `seller12345`
- Buyer: `buyer@expocraft.mn` / `buyer12345`

## Core API

The full, always-accurate contract is served at `GET /docs/openapi.json` (generated from the live route table, so it can never drift from this list). The groups below mirror its tags.

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google` (existing password accounts must link Google via an authenticated flow first — this endpoint cannot take over a password account)
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/verify-email`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /me`
- `PATCH /me`
- `POST /me/roles/seller`

### Discovery
- `GET /home`
- `GET /tourist/home`
- `GET /categories`
- `GET /shops`
- `GET /shop/:slug`
- `POST /favorites/products/:productId`
- `DELETE /favorites/products/:productId`
- `GET /favorites/products`
- `POST /follows/shops/:shopId`
- `DELETE /follows/shops/:shopId`

### Catalog
- `POST /seller/shop`
- `PATCH /seller/shop`
- `POST /admin/sellers/:sellerId/verify`
- `POST /products`
- `GET /products`
- `GET /products/:productId`
- `GET /seller/products`
- `PATCH /seller/products/:productId`
- `PATCH /seller/products/:productId/status`
- `DELETE /seller/products/:productId`

### Cart & Orders
- `POST /cart/items`
- `POST /cart/custom-requests/:requestId`
- `GET /cart`
- `PATCH /cart/items/:itemId`
- `DELETE /cart/items/:itemId`
- `POST /checkout`
- `GET /orders`
- `GET /seller/balance`
- `POST /seller/payout-requests`
- `POST /orders/:orderId/confirm-received`
- `PATCH /seller/order-items/:itemId/status` (sellers can drive the item through `accepted -> making -> shipped -> delivered`, or `cancelled`; only buyer confirmation, admin auto-release, or dispute resolution can move an item to `completed`)
- `POST /seller/order-items/:itemId/progress`
- `POST /disputes`
- `POST /admin/disputes/:disputeId/resolve`

### Custom Orders & Trust
- `POST /custom-requests`
- `GET /custom-requests`
- `GET /seller/custom-requests`
- `PATCH /seller/custom-requests/:requestId`
- `POST /custom-requests/:requestId/accept-quote`
- `POST /custom-requests/:requestId/messages`
- `POST /conversations`
- `GET /conversations`
- `GET /conversations/stream` (SSE)
- `POST /conversations/:conversationId/messages`
- `POST /reviews`
- `POST /reports`
- `PATCH /admin/reports/:reportId`

### Admin
- `POST /admin/payouts/run`
- `PATCH /admin/payout-requests/:requestId`
- `POST /admin/escrow/auto-release`
- `POST /admin/jobs/:jobName/run`
- `GET /admin/escrow-ledger`
- `GET /admin/balances`
- `GET /admin/reconciliation/daily`
- `GET /admin/queues`
- `GET /admin/seller-verifications`
- `PATCH /admin/shops/:shopId/verification`
- `GET /admin/reports`
- `GET /admin/reports/:reportId`
- `GET /admin/disputes`
- `PATCH /admin/settings`
- `GET /admin/audit-logs`
- `GET /admin/users`
- `PATCH /admin/users/:userId`
- `GET /admin/products`
- `PATCH /admin/products/:productId/status`
- `GET /admin/orders`
- `GET /admin/reports/overview`

### Phase 2
- `POST /seller/auctions`
- `GET /auctions`
- `POST /auctions/:auctionId/bids`
- `POST /seller/coupons`
- `POST /coupons/validate`
- `POST /seller/custom-requests/:requestId/contract`
- `POST /contracts/:contractId/accept`
- `PATCH /seller/order-items/:itemId/shipment`
- `POST /webhooks/logistics/tracking`
- `POST /ai/products/suggest`
- `GET /recommendations`
- `POST /webhooks/payments/:provider`

### Uploads
- `POST /uploads/images`

Use the token from `/auth/login` as:

```http
Authorization: Bearer YOUR_TOKEN_HERE
```

Create a local environment file first:

```bash
cp .env.example .env
```

## Notes

This is intentionally self-contained: it uses Node's `http`, `crypto`, and `fs` modules plus a JSON datastore at `data/expo-store.json`. It models the backend deeply enough for product validation and frontend integration, while staying easy to replace later with Express/Fastify + PostgreSQL.

## Docker

This backend can run in Docker with the local JSON state store.

To build and run from the repository root:

```bash
docker compose up --build
```

The backend will be available at `http://localhost:4000` and the frontend is served at `http://localhost:4173`.

To persist data between runs, the compose setup mounts `Backend/data` into the container.

## Project Structure

- `app.js`: tiny bootstrap/export entrypoint.
- `src/bootstrap/server.js`: HTTP server startup.
- `src/config/constants.js`: roles, statuses, payment providers, data paths, commission defaults.
- `src/http/router.js`: dependency-free route registry, CORS, JSON response/error handling.
- `src/utils/core.js`: common helpers for IDs, money, errors, localization, JSON parsing.
- `src/auth/security.js`: password hashing and JWT signing/verification.
- `src/auth/context.js`: auth guards, role checks, refresh-token session rotation.
- `src/data/store.js`: JSON datastore setup, seed data, migration/backfill, user record creation.
- `src/validators/index.js`: request validation, localized payload validation, inventory/payment constraints.
- `src/services/ledger.js`: escrow ledger, balances, reconciliation, release/refund/freeze logic.
- `src/services/catalog.js`: shop/product serializers, shipping options, inventory purchase rules.
- `src/services/cart.js`: cart lookup, cart totals, multi-seller cart grouping.
- `src/app.js`: composition root that wires services into route modules.
- `src/routes/auth.js`: auth, refresh rotation, profile/role APIs.
- `src/routes/discovery.js`: home, tourist mode, search discovery, favorites/follows, public shop.
- `src/routes/catalog.js`: seller shop verification and product catalog management.
- `src/routes/orders.js`: cart, checkout, order lifecycle, escrow confirmation, disputes, progress updates.
- `src/routes/custom-trust.js`: custom requests, chat, conversations, reviews, reports.
- `src/routes/admin.js`: payout, auto-release, ledger, balances, reconciliation, queues, settings, audit, dashboard.
- `src/routes/phase2.js`: auctions, coupons, custom contracts, logistics tracking, AI suggestions, recommendations, seller payout requests, idempotent payment webhooks.

## Marketplace Principles In The Backend

- Multi-seller payment: every checkout creates one order plus seller-owned `orderItems`; each item stores `lineTotal`, `commission`, and `sellerReceivable`.
- Escrow: captured buyer funds are marked `escrow_held`; ledger entries hold buyer payment and reserve platform commission. Seller payout is possible only after the item is delivered and escrow is released.
- Craft inventory: products support `ready_made`, `one_of_one`, and `made_to_order`; one-of-one items can only be bought one at a time.
- Artisan as brand: shops include `story` and `artisanProfile` with maker/process fields, surfaced in product responses.
- Two languages/payments from day one: localized fields use `{ mn, en }`; `MNT` routes to QPay and `USD` routes to Stripe.

## MVP FR-1 To FR-3 Coverage

- Registration/RBAC: users have `roles[]`, so one account can be both buyer and seller. Domestic buyer registration requires `phone`; Google login is modeled with `/auth/google`.
- JWT sessions: `/auth/login` and `/auth/register` return short-lived `accessToken` plus rotating `refreshToken`; `/auth/refresh` revokes the old token and issues a new pair.
- Seller activation: sellers create `/seller/shop`, then admin verifies via `/admin/sellers/:sellerId/verify` before product publishing is allowed.
- Public shop page: `/shop/:slug` returns SEO metadata, artisan story/profile, stats, process media, and active products.
- Craft products: products include materials, techniques, process media, size/dimensions, weight, bilingual content, and translation suggestions when one language is missing.
- Inventory modes: `one_of_one`, `limited_stock`, `ready_made`, and `made_to_order`; one-of-one items sell out after checkout and become `sold`.
- Custom orders: `/custom-requests` creates the request, `/custom-requests/:requestId/messages` stores the buyer/seller conversation, and seller quote updates include price plus production days.

## MVP FR-4 To FR-5 Coverage

- Discovery/search: `/products` filters by category, material, technique, price range, seller/shop, location, international availability, inventory type, and bilingual text.
- Home discovery: `/home` returns featured products, new artisans, category browsing, and tradition/story sections; `/tourist/home` forces English/USD with gift and shipping guidance.
- Buyer retention: buyers can favorite products and follow shops.
- Tourist mode: products can be marked `touristGift`; product responses expose English gift labels plus clear domestic/pickup/international shipping options and customs notes.
- Multi-seller cart: cart responses include `sellerGroups`, so one cart can be split by artisan/shop before checkout.
- Order types: cart/order items store `ready_made`, `made_to_order`, or `custom`; accepted custom quotes can be added to cart with `/cart/custom-requests/:requestId`.
- Shipping: checkout stores item-level shipping option: `domestic_city`, `domestic_countryside`, `international_post`, or `pickup`.
- Order flow: order items follow `paid -> accepted -> making -> shipped -> delivered -> completed`, plus `cancelled` and `disputed`; delivered items release escrow.
- Made-to-order progress: sellers add production notes/photos/videos with `/seller/order-items/:itemId/progress`.

## MVP FR-6 To FR-8 Coverage

- Payments: `MNT` routes to QPay and `USD` routes to Stripe; checkout records provider capture, escrow hold, commission reserve, release/refund, and payout ledger events.
- Escrow: delivered items stay held until buyer confirmation with `/orders/:orderId/confirm-received`, admin auto-release with `/admin/escrow/auto-release`, or dispute resolution.
- Commission: platform commission is configurable at 5-15% through `/admin/settings`; every commission reserve is ledgered.
- Seller balance and payout: `/admin/balances` computes seller/platform balances from ledger entries; `/admin/payouts/run` schedules domestic bank payouts and records payout ledger entries.
- Disputes/refunds: `/disputes` freezes escrow; `/admin/disputes/:disputeId/resolve` refunds buyer or releases seller funds with ledger evidence.
- Reconciliation: `/admin/reconciliation/daily` summarizes all ledger movement by type/currency for a day.
- Trust: `/conversations` supports buyer-seller chat with image/video attachments, `/reviews` supports two-sided post-delivery reviews, `/reports` flags fake/mass-produced content for moderation.
- Admin operations: `/admin/queues` exposes seller verification, moderation, disputes, and payout queues; `/admin/reports/overview` includes GMV, commission, balances, funnel, domestic/international split, reports, and disputes.
- Audit log: important auth, seller, product, payment, dispute, moderation, and settings actions are written to `auditLogs` and readable via `/admin/audit-logs`.

## Phase 2 And NFR Coverage

- Auctions: one-of-one products can be auctioned with `/seller/auctions`, listed via `/auctions`, and bid on via `/auctions/:auctionId/bids`.
- Promotions: sellers create coupons with `/seller/coupons`; buyers validate with `/coupons/validate`.
- Made-to-order contracts: quoted custom requests can produce contracts with deposit schedules via `/seller/custom-requests/:requestId/contract`; buyers accept via `/contracts/:contractId/accept`.
- Logistics: sellers attach carrier/tracking via `/seller/order-items/:itemId/shipment`; external tracking callbacks land at `/webhooks/logistics/tracking`.
- AI helpers: `/ai/products/suggest` returns category/material/technique/tag/translation suggestions; `/recommendations` gives buyer-personalized product suggestions.
- Payment NFR: `/webhooks/payments/:provider` records QPay/Stripe-style callbacks idempotently by event id.
- Seller payout request: released seller balance can be requested through `/seller/payout-requests`.
- IDOR coverage: seller order status changes are scoped to the owning seller and covered by integration tests.

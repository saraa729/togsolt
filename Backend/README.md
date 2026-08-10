# ExpoCraft Backend

TypeScript Node.js backend prototype for a Mongolian handmade marketplace.

## Run

```bash
npm install
npm run build
EXPOCRAFT_SEED=true npm start
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
- `GET /conversations/stream` (legacy SSE fallback)
- `POST /conversations/:conversationId/messages`

Realtime chat runs on Socket.io at `/socket.io` using the same JWT access token in
`auth.token`. Clients join `conversation:{id}` rooms through the
`conversation:join` event and receive `conversation:message`,
`conversation:presence`, and `typing:update`.
- `POST /reviews`
- `POST /reports`
- `PATCH /admin/reports/:reportId`

### Admin
- `POST /admin/payouts/run`
- `PATCH /admin/payout-requests/:requestId`
- `POST /admin/escrow/auto-release`
- `POST /admin/jobs/:jobName/run`
- `GET /admin/ops/alerts`
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
- `GET /admin/audit-logs/export`
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
- `POST /shipping/estimate`
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

Production env checklist is in `../DEPLOY_ENV.md`. Before deploying, run:

```bash
npm run env:check
```

## PostgreSQL Runtime

The backend now has a Prisma 7 schema for PostgreSQL in `prisma/schema.prisma`.
The current route/service layer still uses the JSON-compatible in-memory state
shape, but production should use `EXPOCRAFT_DB_PROVIDER=postgres`. In that mode
every saved state is written to PostgreSQL `app_state`, and the normalized
marketplace tables (`users`, `shops`, `products`, `orders`, `order_items`,
`ledger_entries`, `payouts`, etc.) are rebuilt in the background for live
reporting and the remaining table-by-table migration work.

```bash
npm run prisma:validate
npm run prisma:generate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/expocraft npm run db:push
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/expocraft npm run db:import
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/expocraft npm run db:status
```

Useful commands:

- `npm run db:migrate`: runs Prisma `db push`, then imports `data/expo-store.json` into `app_state`.
- `npm run db:export`: exports `app_state` back to the JSON store.
- `npm run db:relational`: rebuilds the reporting/normalized PostgreSQL tables from the JSON state.

## Notes

The route/service logic is intentionally kept compatible with the current state
shape while PostgreSQL is introduced. Escrow, ledger, cart, checkout, and seller
isolation remain covered by the existing integration tests before each deeper
native relational repository migration step.

## Docker

This backend can run in Docker with PostgreSQL-backed state, normalized
relational table sync, and Redis-backed runtime state for login lockout/rate
limit counters.

To build and run from the repository root:

```bash
docker compose up --build
```

The backend will be available at `http://localhost:4000` and the frontend is served at `http://localhost:3000`.

To persist data between runs, the compose setup mounts `Backend/data` into the container and keeps PostgreSQL data in the `postgres-data` volume.

## Runtime Store

Set `REDIS_URL` in production so short-lived runtime state is shared across all
backend instances. The runtime store is used for login failure lockout/rate-limit
state and is exposed on `GET /metrics` as `runtimeStore: "redis"`.

If `REDIS_URL` is empty, the backend uses an in-memory store for local
development only.

## Project Structure

- `app.ts`: bootstrap/export entrypoint compiled to `dist/app.js`.
- `app.js`: compatibility shim for tools that still call `node app.js`.
- `src/bootstrap/server.ts`: HTTP server startup.
- `src/config/constants.ts`: roles, statuses, payment providers, data paths, commission defaults.
- `src/http/router.ts`: dependency-free route registry, CORS, JSON response/error handling.
- `src/utils/core.ts`: common helpers for IDs, money, errors, localization, JSON parsing.
- `src/auth/security.ts`: password hashing and JWT signing/verification.
- `src/auth/context.ts`: auth guards, role checks, refresh-token session rotation.
- `src/data/store.ts`: JSON datastore setup, seed data, migration/backfill, user record creation.
- `src/data/prisma.ts`: Prisma 7 PostgreSQL client factory.
- `src/validators/index.ts`: request validation, localized payload validation, inventory/payment constraints.
- `src/services/ledger.ts`: escrow ledger, balances, reconciliation, release/refund/freeze logic.
- `src/services/catalog.ts`: shop/product serializers, shipping options, inventory purchase rules.
- `src/services/cart.ts`: cart lookup, cart totals, multi-seller cart grouping.
- `src/app.ts`: composition root that wires services into route modules.
- `src/routes/auth.ts`: auth, refresh rotation, profile/role APIs.
- `src/routes/discovery.ts`: home, tourist mode, search discovery, favorites/follows, public shop.
- `src/routes/catalog.ts`: seller shop verification and product catalog management.
- `src/routes/orders.ts`: cart, checkout, order lifecycle, escrow confirmation, disputes, progress updates.
- `src/routes/custom-trust.ts`: custom requests, chat, conversations, reviews, reports.
- `src/routes/admin.ts`: payout, auto-release, ledger, balances, reconciliation, queues, settings, audit, dashboard.
- `src/routes/phase2.ts`: auctions, coupons, custom contracts, logistics tracking, AI suggestions, recommendations, seller payout requests, idempotent payment webhooks.

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
- AI helpers: `/ai/products/suggest` returns category/material/technique/tag/translation suggestions; `/recommendations` uses a hybrid content/collaborative score from favorites, follows, purchases, views, shop quality, availability, freshness, and tourist fit.
- International customs UX: `/shipping/estimate` returns package weight, shipping estimate, customs document list, HS code/default customs metadata, origin country, and a tax estimate note.
- Admin operations: `/admin/queues` includes SLA alerts; `/admin/ops/alerts` summarizes critical/warning operations breaches; `/admin/audit-logs/export` exports CSV for reviews and investigations.
- Payment NFR: `/webhooks/payments/:provider` records QPay/Stripe-style callbacks idempotently by event id.
- Seller payout request: released seller balance can be requested through `/seller/payout-requests`.
- IDOR coverage: seller order status changes are scoped to the owning seller and covered by integration tests.

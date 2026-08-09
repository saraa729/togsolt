-- ExpoCraft — харилцан хамаарлат схем (шаардлагын баримт бичиг §7)
--
-- Ажиллаж буй сервер нь өгөгдлөө JSON баримт хэлбэрээр хадгалдаг (`schema.sql`
-- доторх `app_state`). Энэ файл нь тэр өгөгдлийг хэвийн хэлбэрт (normalized)
-- шилжүүлсэн загвар — тайлан, шинжилгээ, цаашид бүрэн шилжихэд зориулагдсан.
--
-- Дүүргэх:  npm run db:relational
--
-- Тэмдэглэл:
--   • Мөнгө нь ВСЕГДА (дүн, валют) хос багана — хөвөгч таслал ашиглахгүй,
--     бүхэл тоогоор (мөнгөн тэмдэгтийн хамгийн жижиг нэгжээр) хадгална.
--   • Хос хэлний талбарууд jsonb `{"mn": "...", "en": "..."}`.

BEGIN;

DROP TABLE IF EXISTS audit_logs, notifications, reports, reviews, chat_messages,
  chat_threads, disputes, payouts, ledger_entries, escrow_payments, shipments,
  order_items, order_shops, orders, cart_items, carts, custom_requests,
  product_materials, materials, products, categories, shops, users CASCADE;

-- ─────────────────────────────── Хэрэглэгч ───────────────────────────────
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  roles         TEXT[] NOT NULL DEFAULT '{buyer}',
  name          TEXT NOT NULL,
  phone         TEXT,
  country       TEXT NOT NULL DEFAULT 'MN',
  locale        TEXT NOT NULL DEFAULT 'mn',
  auth_providers TEXT[] NOT NULL DEFAULT '{}',
  email_verified BOOLEAN NOT NULL DEFAULT false,
  disabled      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- ──────────────────────────── Урлаачийн дэлгүүр ───────────────────────────
CREATE TABLE shops (
  id            TEXT PRIMARY KEY,
  seller_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending_verification'
                CHECK (status IN ('pending_verification', 'verified', 'rejected')),
  logo_url      TEXT,
  banner_url    TEXT,
  story         JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {mn, en}
  city          TEXT,
  province      TEXT,
  district      TEXT,
  contact       JSONB NOT NULL DEFAULT '{}'::jsonb,
  artisan_profile JSONB,                              -- урлаачийн царай, туршлага
  process_media JSONB NOT NULL DEFAULT '[]'::jsonb,   -- хийж буй зураг/видео
  rating_avg    NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count  INTEGER NOT NULL DEFAULT 0,
  sales_count   INTEGER NOT NULL DEFAULT 0,
  response_hours INTEGER,
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shops_seller_idx ON shops(seller_id);
CREATE INDEX shops_status_idx ON shops(status);

-- ──────────────────────────── Ангилал, материал ───────────────────────────
CREATE TABLE categories (
  id        TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  slug      TEXT NOT NULL UNIQUE,
  name      JSONB NOT NULL                            -- {mn, en}
);

CREATE TABLE materials (
  id   TEXT PRIMARY KEY,
  name JSONB NOT NULL
);

-- ───────────────────────────────── Бүтээл ─────────────────────────────────
CREATE TABLE products (
  id             TEXT PRIMARY KEY,
  shop_id        TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  seller_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id    TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name           JSONB NOT NULL,                      -- {mn, en}
  description    JSONB NOT NULL DEFAULT '{}'::jsonb,
  story          JSONB,
  technique      JSONB,
  techniques     TEXT[] NOT NULL DEFAULT '{}',
  styles         TEXT[] NOT NULL DEFAULT '{}',
  images         JSONB NOT NULL DEFAULT '[]'::jsonb,
  process_media  JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Нөөцийн гурван горим (§FR-3.2)
  stock_mode     TEXT NOT NULL
                 CHECK (stock_mode IN ('ready_made', 'limited_stock', 'one_of_one', 'made_to_order')),
  stock          INTEGER NOT NULL DEFAULT 0,
  lead_time_days INTEGER,
  price_amount   BIGINT NOT NULL,
  price_currency TEXT NOT NULL DEFAULT 'MNT',
  intl_price_amount   BIGINT,
  intl_price_currency TEXT,
  weight_gram    INTEGER,
  dimensions     JSONB,
  ships_internationally BOOLEAN NOT NULL DEFAULT false,
  tourist_gift   BOOLEAN NOT NULL DEFAULT false,
  custom_enabled BOOLEAN NOT NULL DEFAULT false,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'sold', 'hidden')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_shop_idx ON products(shop_id);
CREATE INDEX products_category_idx ON products(category_id);
CREATE INDEX products_status_idx ON products(status);
CREATE INDEX products_name_gin ON products USING GIN (name);

CREATE TABLE product_materials (
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, material_id)
);

-- ─────────────────────────── Өвөрмөц захиалга ────────────────────────────
CREATE TABLE custom_requests (
  id            TEXT PRIMARY KEY,
  shop_id       TEXT REFERENCES shops(id) ON DELETE SET NULL,
  seller_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  buyer_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id    TEXT REFERENCES products(id) ON DELETE SET NULL,
  description   TEXT NOT NULL,
  reference_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  quoted_amount BIGINT,
  quoted_currency TEXT,
  quoted_lead_days INTEGER,
  status        TEXT NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested', 'quoted', 'accepted', 'rejected', 'expired')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────── Сагс ──────────────────────────────────
CREATE TABLE carts (
  id         TEXT PRIMARY KEY,
  buyer_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
  id                TEXT PRIMARY KEY,
  cart_id           TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  custom_request_id TEXT REFERENCES custom_requests(id) ON DELETE SET NULL,
  qty               INTEGER NOT NULL CHECK (qty > 0),
  quoted_amount     BIGINT,
  quoted_currency   TEXT,
  added_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────────────────── Захиалга ───────────────────────────────
-- Нэг захиалга → олон урлаачийн дэд захиалга (§P1)
CREATE TABLE orders (
  id               TEXT PRIMARY KEY,
  buyer_id         TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status           TEXT NOT NULL DEFAULT 'paid',
  currency         TEXT NOT NULL,
  subtotal_amount  BIGINT NOT NULL DEFAULT 0,
  commission_amount BIGINT NOT NULL DEFAULT 0,
  seller_total_amount BIGINT NOT NULL DEFAULT 0,
  discount_amount  BIGINT NOT NULL DEFAULT 0,
  coupon_code      TEXT,
  payment_provider TEXT,
  payment_status   TEXT,
  payment_ref      TEXT,
  escrow_status    TEXT NOT NULL DEFAULT 'held'
                   CHECK (escrow_status IN ('not_required', 'held', 'released', 'refunded', 'disputed')),
  destination_country TEXT NOT NULL DEFAULT 'MN',
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_buyer_idx ON orders(buyer_id);
CREATE INDEX orders_created_idx ON orders(created_at);

CREATE TABLE order_shops (
  id            TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shop_id       TEXT NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  seller_id     TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status        TEXT NOT NULL DEFAULT 'paid',
  subtotal_amount   BIGINT NOT NULL DEFAULT 0,
  commission_amount BIGINT NOT NULL DEFAULT 0,
  seller_receivable_amount BIGINT NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL,
  shipping_method TEXT,
  shipping_fee_amount BIGINT NOT NULL DEFAULT 0,
  tracking_code TEXT,
  UNIQUE (order_id, shop_id)
);
CREATE INDEX order_shops_seller_idx ON order_shops(seller_id);

CREATE TABLE order_items (
  id                TEXT PRIMARY KEY,
  order_shop_id     TEXT NOT NULL REFERENCES order_shops(id) ON DELETE CASCADE,
  order_id          TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        TEXT REFERENCES products(id) ON DELETE SET NULL,
  custom_request_id TEXT REFERENCES custom_requests(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  unit_price_amount BIGINT NOT NULL,
  currency          TEXT NOT NULL,
  qty               INTEGER NOT NULL CHECK (qty > 0),
  line_total_amount BIGINT NOT NULL,
  commission_amount BIGINT NOT NULL DEFAULT 0,
  seller_receivable_amount BIGINT NOT NULL DEFAULT 0,
  discount_amount   BIGINT NOT NULL DEFAULT 0,
  order_type        TEXT,
  production_days   INTEGER,
  status            TEXT NOT NULL DEFAULT 'paid'
                    CHECK (status IN ('paid','accepted','making','shipped','delivered','completed','cancelled','disputed')),
  escrow_status     TEXT NOT NULL DEFAULT 'held',
  progress_updates  JSONB NOT NULL DEFAULT '[]'::jsonb,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON order_items(order_id);
CREATE INDEX order_items_status_idx ON order_items(status);

CREATE TABLE shipments (
  id            TEXT PRIMARY KEY,
  order_shop_id TEXT REFERENCES order_shops(id) ON DELETE CASCADE,
  order_item_id TEXT REFERENCES order_items(id) ON DELETE CASCADE,
  method        TEXT,
  carrier       TEXT,
  tracking_code TEXT,
  status        TEXT,
  events        JSONB NOT NULL DEFAULT '[]'::jsonb,
  shipped_at    TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────── Төлбөр, escrow, дэвтэр ─────────────────────────
CREATE TABLE escrow_payments (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,
  invoice_id   TEXT,
  amount       BIGINT NOT NULL,
  currency     TEXT NOT NULL,
  status       TEXT NOT NULL,
  raw_callback JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Мөнгөн хөдөлгөөн бүр нэг мөр. Баланс = нийлбэр (§FR-6.6).
CREATE TABLE ledger_entries (
  id            TEXT PRIMARY KEY,
  order_id      TEXT REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id TEXT REFERENCES order_items(id) ON DELETE SET NULL,
  seller_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL,        -- hold_buyer_payment, release_to_seller_balance, ...
  amount        BIGINT NOT NULL,
  currency      TEXT NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ledger_kind_idx ON ledger_entries(kind);
CREATE INDEX ledger_seller_idx ON ledger_entries(seller_id);
CREATE INDEX ledger_created_idx ON ledger_entries(created_at);

CREATE TABLE payouts (
  id           TEXT PRIMARY KEY,
  seller_id    TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount       BIGINT NOT NULL,
  currency     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'requested',
  bank_account JSONB,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  paid_at      TIMESTAMPTZ
);

CREATE TABLE disputes (
  id            TEXT PRIMARY KEY,
  order_id      TEXT REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id TEXT REFERENCES order_items(id) ON DELETE CASCADE,
  opened_by     TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  buyer_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  seller_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason        TEXT NOT NULL,
  evidence      JSONB NOT NULL DEFAULT '[]'::jsonb,
  status        TEXT NOT NULL DEFAULT 'open',
  resolution    JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────── Харилцаа, итгэл ────────────────────────────
CREATE TABLE chat_threads (
  id         TEXT PRIMARY KEY,
  buyer_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id    TEXT REFERENCES shops(id) ON DELETE SET NULL,
  ref_type   TEXT,
  ref_id     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT,
  image_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_thread_idx ON chat_messages(thread_id, created_at);

CREATE TABLE reviews (
  id            TEXT PRIMARY KEY,
  order_item_id TEXT REFERENCES order_items(id) ON DELETE SET NULL,
  order_id      TEXT REFERENCES orders(id) ON DELETE SET NULL,
  product_id    TEXT REFERENCES products(id) ON DELETE SET NULL,
  shop_id       TEXT REFERENCES shops(id) ON DELETE SET NULL,
  reviewer_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('buyer', 'seller')),
  stars         INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment       TEXT,
  images        JSONB NOT NULL DEFAULT '[]'::jsonb,
  status        TEXT NOT NULL DEFAULT 'published',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_product_idx ON reviews(product_id);
CREATE INDEX reviews_shop_idx ON reviews(shop_id);

CREATE TABLE reports (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  details     TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  moderation_note TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs(created_at);

COMMIT;

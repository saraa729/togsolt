BEGIN;

CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY DEFAULT 'expocraft',
  data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS state_migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_state_data_gin ON app_state USING GIN (data);
CREATE INDEX IF NOT EXISTS app_state_products_gin ON app_state USING GIN ((data -> 'products'));
CREATE INDEX IF NOT EXISTS app_state_shops_gin ON app_state USING GIN ((data -> 'shops'));
CREATE INDEX IF NOT EXISTS app_state_orders_gin ON app_state USING GIN ((data -> 'orders'));

COMMIT;

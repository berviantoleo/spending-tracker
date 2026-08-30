-- Migration 1: Core schema — tables, enums, indexes, triggers, realtime

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE receipt_status AS ENUM ('pending', 'processing', 'needs_review', 'done');
CREATE TYPE fx_rate_source AS ENUM ('api', 'cached', 'manual');

-- ---------------------------------------------------------------------------
-- categories
-- user_id NULL => system category (visible to everyone)
-- user_id SET  => user-created category (private)
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = system category
  name        TEXT NOT NULL,
  icon        TEXT,          -- emoji or icon name
  color       TEXT,          -- hex color string e.g. '#4CAF50'
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- receipts
-- ---------------------------------------------------------------------------

CREATE TABLE receipts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant            TEXT,
  receipt_date        DATE,
  original_amount     NUMERIC(12,2),
  original_currency   TEXT,          -- ISO 4217 e.g. 'USD'
  base_amount         NUMERIC(12,2),
  base_currency       TEXT,          -- ISO 4217 — user's base currency at time of upload
  fx_rate             NUMERIC(18,8),
  fx_rate_source      fx_rate_source,
  fx_rate_at          TIMESTAMPTZ,
  category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
  status              receipt_status NOT NULL DEFAULT 'pending',
  image_path          TEXT,          -- Supabase Storage path e.g. '{user_id}/{receipt_id}.jpg'
  raw_ai_response     JSONB,         -- full watsonx response stored for debugging
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- receipt_items
-- ---------------------------------------------------------------------------

CREATE TABLE receipt_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id   UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  quantity     NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12,2),
  total_price  NUMERIC(12,2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- currency_rates — FX rate cache
-- ---------------------------------------------------------------------------

CREATE TABLE currency_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency   TEXT NOT NULL,
  to_currency     TEXT NOT NULL,
  rate            NUMERIC(18,8) NOT NULL,
  source          TEXT NOT NULL DEFAULT 'api',
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, fetched_at)
);

-- ---------------------------------------------------------------------------
-- Trigger: auto-update receipts.updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX ON receipts(user_id, receipt_date DESC);
CREATE INDEX ON receipts(user_id, status);
CREATE INDEX ON receipt_items(receipt_id);
CREATE INDEX ON currency_rates(from_currency, to_currency, fetched_at DESC);

-- ---------------------------------------------------------------------------
-- Realtime — required for live status updates on receipt cards
-- ---------------------------------------------------------------------------

ALTER TABLE receipts REPLICA IDENTITY FULL;

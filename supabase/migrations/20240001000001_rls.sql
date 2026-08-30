-- Migration 2: Row Level Security policies for all tables

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read system categories and their own categories
CREATE POLICY "categories_select"
ON categories FOR SELECT TO authenticated
USING (user_id IS NULL OR user_id = auth.uid());

-- Authenticated users may insert their own non-system categories only
CREATE POLICY "categories_insert"
ON categories FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND is_system = false);

-- Authenticated users may update their own non-system categories only
CREATE POLICY "categories_update"
ON categories FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND is_system = false)
WITH CHECK (user_id = auth.uid() AND is_system = false);

-- Authenticated users may delete their own non-system categories only
CREATE POLICY "categories_delete"
ON categories FOR DELETE TO authenticated
USING (user_id = auth.uid() AND is_system = false);

-- ---------------------------------------------------------------------------
-- receipts
-- ---------------------------------------------------------------------------

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_select"
ON receipts FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "receipts_insert"
ON receipts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "receipts_update"
ON receipts FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "receipts_delete"
ON receipts FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- receipt_items
-- Scoped through the parent receipts row so no direct user_id column is needed
-- ---------------------------------------------------------------------------

ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipt_items_select"
ON receipt_items FOR SELECT TO authenticated
USING (
  receipt_id IN (SELECT id FROM receipts WHERE user_id = auth.uid())
);

CREATE POLICY "receipt_items_insert"
ON receipt_items FOR INSERT TO authenticated
WITH CHECK (
  receipt_id IN (SELECT id FROM receipts WHERE user_id = auth.uid())
);

CREATE POLICY "receipt_items_update"
ON receipt_items FOR UPDATE TO authenticated
USING (
  receipt_id IN (SELECT id FROM receipts WHERE user_id = auth.uid())
)
WITH CHECK (
  receipt_id IN (SELECT id FROM receipts WHERE user_id = auth.uid())
);

CREATE POLICY "receipt_items_delete"
ON receipt_items FOR DELETE TO authenticated
USING (
  receipt_id IN (SELECT id FROM receipts WHERE user_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- currency_rates — shared read cache; server writes via service role key
-- ---------------------------------------------------------------------------

ALTER TABLE currency_rates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the shared FX cache
CREATE POLICY "currency_rates_select"
ON currency_rates FOR SELECT TO authenticated
USING (true);

-- Authenticated users (server with service key) may insert/update cache rows
CREATE POLICY "currency_rates_insert"
ON currency_rates FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "currency_rates_update"
ON currency_rates FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

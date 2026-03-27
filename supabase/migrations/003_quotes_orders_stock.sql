-- =============================================================
-- BARTEZ B2B — Migration 003: Quotes table, server-side order numbers,
-- atomic stock reservation RPC, orders RLS
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- Fully idempotent — safe to run multiple times
-- =============================================================

-- ─── 1. QUOTES TABLE ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quotes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id   uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name text   NOT NULL DEFAULT '',
  items       jsonb  NOT NULL DEFAULT '[]'::jsonb,
  subtotal    numeric(12,2) NOT NULL DEFAULT 0,
  iva_total   numeric(12,2) NOT NULL DEFAULT 0,
  total       numeric(12,2) NOT NULL DEFAULT 0,
  currency    text   NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','ARS')),
  status      text   NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','sent','viewed','approved','rejected','expired')),
  version     integer NOT NULL DEFAULT 1,
  parent_id   bigint REFERENCES quotes(id) ON DELETE SET NULL,
  order_id    bigint,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_client ON quotes(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);

-- updated_at trigger (reuse existing function if present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'quotes_updated_at'
  ) THEN
    CREATE TRIGGER quotes_updated_at
      BEFORE UPDATE ON quotes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
EXCEPTION WHEN undefined_function THEN
  -- update_updated_at() does not exist yet, create it
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $body$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $body$;
  $fn$;
  CREATE TRIGGER quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

-- ─── 2. QUOTES RLS ────────────────────────────────────────────

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes_select_own"   ON quotes;
DROP POLICY IF EXISTS "quotes_select_admin" ON quotes;
DROP POLICY IF EXISTS "quotes_insert_own"   ON quotes;
DROP POLICY IF EXISTS "quotes_update_own"   ON quotes;
DROP POLICY IF EXISTS "quotes_delete_own"   ON quotes;
DROP POLICY IF EXISTS "quotes_all_admin"    ON quotes;

-- Clients see own quotes
CREATE POLICY "quotes_select_own" ON quotes FOR SELECT
  USING (client_id = auth.uid());

-- Admin/vendedor see all
CREATE POLICY "quotes_select_admin" ON quotes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor')
  ));

-- Clients can insert own
CREATE POLICY "quotes_insert_own" ON quotes FOR INSERT
  WITH CHECK (client_id = auth.uid());

-- Clients can update own
CREATE POLICY "quotes_update_own" ON quotes FOR UPDATE
  USING (client_id = auth.uid());

-- Admin can do anything
CREATE POLICY "quotes_all_admin" ON quotes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Clients can delete own drafts
CREATE POLICY "quotes_delete_own" ON quotes FOR DELETE
  USING (client_id = auth.uid() AND status = 'draft');

-- ─── 3. ORDERS RLS ────────────────────────────────────────────
-- orders.client_id is stored as text; cast to uuid for RLS comparison

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own"   ON orders;
DROP POLICY IF EXISTS "orders_select_admin" ON orders;
DROP POLICY IF EXISTS "orders_insert_own"   ON orders;
DROP POLICY IF EXISTS "orders_update_admin" ON orders;
DROP POLICY IF EXISTS "orders_update_own"   ON orders;

-- Clients see own orders
CREATE POLICY "orders_select_own" ON orders FOR SELECT
  USING (client_id::text = auth.uid()::text);

-- Admin/vendedor see all orders
CREATE POLICY "orders_select_admin" ON orders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor')
  ));

-- Clients can insert own orders
CREATE POLICY "orders_insert_own" ON orders FOR INSERT
  WITH CHECK (client_id::text = auth.uid()::text);

-- Admin/vendedor can update any order
CREATE POLICY "orders_update_admin" ON orders FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor')
  ));

-- Clients can update own pending/approved orders (e.g., upload payment proof)
CREATE POLICY "orders_update_own" ON orders FOR UPDATE
  USING (
    client_id::text = auth.uid()::text
    AND status IN ('pending','approved')
  );

-- ─── 4. FIX suppliers_admin / pricing_rules_admin WITH CHECK ──

DROP POLICY IF EXISTS "suppliers_admin"       ON suppliers;
DROP POLICY IF EXISTS "pricing_rules_admin"   ON pricing_rules;

CREATE POLICY "suppliers_admin" ON suppliers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor')
  ));

CREATE POLICY "pricing_rules_admin" ON pricing_rules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- ─── 5. SERVER-SIDE ORDER NUMBER SEQUENCE ─────────────────────

CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;

-- ─── 6. ATOMIC STOCK RESERVATION RPC ─────────────────────────
-- Creates order + reserves stock in a single transaction.
-- Returns { id, order_number, status } on success.
-- Raises EXCEPTION on insufficient stock (rolls back everything).

CREATE OR REPLACE FUNCTION reserve_stock_and_create_order(
  p_client_id              uuid,
  p_products               jsonb,
  p_total                  numeric,
  p_status                 text    DEFAULT 'pending',
  p_payment_method         text    DEFAULT NULL,
  p_payment_surcharge_pct  numeric DEFAULT NULL,
  p_shipping_type          text    DEFAULT NULL,
  p_shipping_address       text    DEFAULT NULL,
  p_shipping_transport     text    DEFAULT NULL,
  p_shipping_cost          numeric DEFAULT NULL,
  p_notes                  text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_number  text;
  v_order_id      bigint;
  v_item          jsonb;
  v_product_id    integer;
  v_quantity      integer;
  v_stock         integer;
  v_reserved      integer;
  v_available     integer;
  v_product_name  text;
BEGIN
  -- Generate server-side order number
  v_order_number := 'ORD-' || LPAD(nextval('order_number_seq')::text, 4, '0');

  -- Validate and reserve stock for each product atomically
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_products)
  LOOP
    v_product_id := (v_item->>'product_id')::integer;
    v_quantity   := (v_item->>'quantity')::integer;

    -- Lock the row to prevent concurrent modifications
    SELECT stock, COALESCE(stock_reserved, 0), name
      INTO v_stock, v_reserved, v_product_name
      FROM products
     WHERE id = v_product_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado: ID %', v_product_id;
    END IF;

    v_available := v_stock - v_reserved;

    IF v_quantity > v_available THEN
      RAISE EXCEPTION 'Stock insuficiente para "%": disponible %, solicitado %',
        v_product_name, v_available, v_quantity;
    END IF;

    -- Reserve stock
    UPDATE products
       SET stock_reserved = v_reserved + v_quantity
     WHERE id = v_product_id;
  END LOOP;

  -- Create the order
  INSERT INTO orders (
    client_id, products, total, status, order_number,
    payment_method, payment_surcharge_pct,
    shipping_type, shipping_address, shipping_transport, shipping_cost,
    notes, created_at
  ) VALUES (
    p_client_id::text, p_products, p_total, p_status, v_order_number,
    p_payment_method, p_payment_surcharge_pct,
    p_shipping_type, p_shipping_address, p_shipping_transport, p_shipping_cost,
    p_notes, now()
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'id',           v_order_id,
    'order_number', v_order_number,
    'status',       p_status
  );
END;
$$;

-- ─── 7. ENABLE REALTIME ON ORDERS ─────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE orders;

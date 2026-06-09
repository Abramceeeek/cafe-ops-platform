-- 0034_orders_index.sql
-- The Orders / Inbox / Live-Ops / Schedule / Manifest queries all filter orders
-- by shop, status, and delivery date. 0009 only has single-column indexes; add a
-- composite to keep those queries fast as history grows.
CREATE INDEX IF NOT EXISTS idx_orders_shop_status_date
  ON public.orders (shop_id, status, requested_delivery_date);

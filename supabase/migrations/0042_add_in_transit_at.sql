-- 0042_add_in_transit_at.sql
-- Audit 2026-06-13 (MEDIUM): orders carried a timestamp column for every status
-- EXCEPT in_transit, so neither the web STATUS_TIMESTAMP map nor the mobile
-- change_order_status RPC recorded when an order went out for delivery. Add the
-- column; 0043 (RPC) and the web action populate it.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS in_transit_at timestamptz;

-- 0045_orders_standing_columns.sql
-- Tag orders generated from a standing order (0044). is_standing marks the
-- auto-approved recurring orders; standing_order_id links back to the spec version
-- that produced the row (audit + the generator's idempotency guard in 0048).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_standing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS standing_order_id UUID REFERENCES public.standing_orders(id);

-- Drives the "already generated this spec for this date?" idempotency check.
CREATE INDEX IF NOT EXISTS idx_orders_standing_order
  ON public.orders (standing_order_id, requested_delivery_date)
  WHERE standing_order_id IS NOT NULL;

-- 0006_receipts.sql — PROJECT_SPEC §5.1, §12
-- Dispatch + monthly-summary receipts. Back-fills the FK on orders.receipt_id
-- now that the receipts table exists (column was created in 0004).

CREATE TABLE receipts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES orders(id),
  shop_id            UUID NOT NULL REFERENCES shops(id),
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_month       INT,      -- Populated by monthly aggregation cron (1-12)
  period_year        INT,      -- Populated by monthly aggregation cron
  pdf_storage_path   TEXT NOT NULL,    -- Path in Supabase Storage
  total_cost         NUMERIC(10,2),
  is_monthly_summary BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE orders ADD CONSTRAINT fk_orders_receipt
  FOREIGN KEY (receipt_id) REFERENCES receipts(id);

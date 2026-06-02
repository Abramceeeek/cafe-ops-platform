-- 0004_orders.sql — PROJECT_SPEC §5.1, §7
-- Orders + line items + per-item modifiers. Status enum drives the state machine
-- (§7). receipt_id is a plain column here; its FK to receipts is back-filled in
-- a later migration (0006), per spec.

CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES shops(id),
  submitted_by        UUID NOT NULL REFERENCES profiles(id),

  status              TEXT NOT NULL DEFAULT 'pending_request'
                        CHECK (status IN (
                          'pending_request',
                          'specialist_approved',
                          'shop_confirmed',
                          'in_progress',
                          'packaged',
                          'ready_for_courier',
                          'in_transit',
                          'delivered',
                          'rejected',
                          'cancelled'
                        )),

  -- Timing
  requested_delivery_date  DATE NOT NULL,
  submitted_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  specialist_approved_at   TIMESTAMPTZ,
  shop_confirmed_at        TIMESTAMPTZ,
  packaged_at              TIMESTAMPTZ,
  ready_at                 TIMESTAMPTZ,
  delivered_at             TIMESTAMPTZ,

  -- Personnel
  assigned_specialist      UUID REFERENCES profiles(id),
  assigned_courier         UUID REFERENCES profiles(id),

  -- Accounting (FK to receipts added in 0006)
  receipt_id               UUID,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id),
  quantity          NUMERIC(10,2) NOT NULL,
  unit              TEXT NOT NULL,         -- Denormalized from product at time of order
  custom_note       TEXT,
  unit_cost         NUMERIC(10,2),         -- Set at time of specialist approval
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_item_modifiers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id         UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_option_id    UUID NOT NULL REFERENCES modifier_options(id),
  modifier_group_name   TEXT NOT NULL,    -- Denormalized for receipt readability
  modifier_option_name  TEXT NOT NULL     -- Denormalized for receipt readability
);

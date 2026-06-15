-- 0044_standing_orders.sql
-- Recurring weekly "standing orders": a per-shop, per-weekday order spec that the
-- nightly job (0048) materialises into real, auto-approved orders. Mirrors the
-- order_templates* shape (0007). owner_role is the SHOP side that manages the spec
-- (foh_manager = pastry, kitchen_manager = bread); it also disambiguates the two
-- same-shop specs that both produce bread_baker items. Edits are versioned by
-- effective_from (a new row effective next Monday), so the current week stays
-- locked — the generator picks the latest version effective on/before each date.

CREATE TABLE standing_orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID NOT NULL REFERENCES shops(id),
  owner_role     TEXT NOT NULL,                                   -- 'foh_manager' | 'kitchen_manager'
  weekday        SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),  -- ISO: 1=Mon .. 7=Sun
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID NOT NULL REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE standing_order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standing_order_id UUID NOT NULL REFERENCES standing_orders(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id),
  quantity          NUMERIC(10,2) NOT NULL,
  custom_note       TEXT
);

CREATE TABLE standing_order_item_modifiers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standing_order_item_id UUID NOT NULL REFERENCES standing_order_items(id) ON DELETE CASCADE,
  modifier_option_id     UUID NOT NULL REFERENCES modifier_options(id)
);

-- Generator + management lookups: latest effective version for a (shop, role, weekday).
CREATE INDEX idx_standing_orders_lookup
  ON standing_orders (shop_id, owner_role, weekday, effective_from DESC);

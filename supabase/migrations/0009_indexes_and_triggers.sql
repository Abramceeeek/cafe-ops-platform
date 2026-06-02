-- 0009_indexes_and_triggers.sql — PROJECT_SPEC §5.1 (indexes), §5.2 (triggers)

-- ── Indexes (performance-critical paths) ─────────────────────────────
CREATE INDEX idx_orders_shop_id         ON orders(shop_id);
CREATE INDEX idx_orders_status          ON orders(status);
CREATE INDEX idx_orders_delivery_date   ON orders(requested_delivery_date);
CREATE INDEX idx_orders_assigned_spec   ON orders(assigned_specialist);
CREATE INDEX idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX idx_products_category_id   ON products(category_id);
CREATE INDEX idx_products_available     ON products(is_available);

-- ── Triggers: auto-update updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_touch_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER products_touch_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

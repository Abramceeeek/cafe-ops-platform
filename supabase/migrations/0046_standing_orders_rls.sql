-- 0046_standing_orders_rls.sql
-- Standing orders are shop + owner_role scoped, exactly like templates (0014):
-- a manager reads/writes only their own shop's specs for their own role; admin
-- reads all. The save RPC (0047) is SECURITY DEFINER and the generator (0048) runs
-- as service_role, so both bypass these — the policies cover the direct client
-- reads (the Standing Orders page) and direct deletes ("remove standing order").

ALTER TABLE standing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE standing_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE standing_order_item_modifiers ENABLE ROW LEVEL SECURITY;

-- ── standing_orders: own shop + own role (admin: read all) ───────────
CREATE POLICY "managers_read_own_standing" ON standing_orders
  FOR SELECT USING (
    (shop_id = current_shop_id() AND owner_role = current_role_name())
    OR current_role_name() = 'admin'
  );

CREATE POLICY "managers_insert_own_standing" ON standing_orders
  FOR INSERT WITH CHECK (
    shop_id = current_shop_id() AND owner_role = current_role_name() AND created_by = auth.uid()
  );

CREATE POLICY "managers_update_own_standing" ON standing_orders
  FOR UPDATE USING (
    shop_id = current_shop_id() AND owner_role = current_role_name()
  );

CREATE POLICY "managers_delete_own_standing" ON standing_orders
  FOR DELETE USING (
    shop_id = current_shop_id() AND owner_role = current_role_name()
  );

-- ── standing_order_items: scoped through the owning standing order ───
CREATE POLICY "managers_read_own_standing_items" ON standing_order_items
  FOR SELECT USING (
    standing_order_id IN (
      SELECT id FROM standing_orders
      WHERE shop_id = current_shop_id() AND owner_role = current_role_name()
    )
  );

CREATE POLICY "managers_insert_own_standing_items" ON standing_order_items
  FOR INSERT WITH CHECK (
    standing_order_id IN (
      SELECT id FROM standing_orders
      WHERE shop_id = current_shop_id() AND owner_role = current_role_name()
    )
  );

CREATE POLICY "managers_delete_own_standing_items" ON standing_order_items
  FOR DELETE USING (
    standing_order_id IN (
      SELECT id FROM standing_orders
      WHERE shop_id = current_shop_id() AND owner_role = current_role_name()
    )
  );

-- ── standing_order_item_modifiers: scoped through item → standing order ──
CREATE POLICY "managers_read_own_standing_mods" ON standing_order_item_modifiers
  FOR SELECT USING (
    standing_order_item_id IN (
      SELECT i.id FROM standing_order_items i
      JOIN standing_orders s ON s.id = i.standing_order_id
      WHERE s.shop_id = current_shop_id() AND s.owner_role = current_role_name()
    )
  );

CREATE POLICY "managers_insert_own_standing_mods" ON standing_order_item_modifiers
  FOR INSERT WITH CHECK (
    standing_order_item_id IN (
      SELECT i.id FROM standing_order_items i
      JOIN standing_orders s ON s.id = i.standing_order_id
      WHERE s.shop_id = current_shop_id() AND s.owner_role = current_role_name()
    )
  );

CREATE POLICY "managers_delete_own_standing_mods" ON standing_order_item_modifiers
  FOR DELETE USING (
    standing_order_item_id IN (
      SELECT i.id FROM standing_order_items i
      JOIN standing_orders s ON s.id = i.standing_order_id
      WHERE s.shop_id = current_shop_id() AND s.owner_role = current_role_name()
    )
  );

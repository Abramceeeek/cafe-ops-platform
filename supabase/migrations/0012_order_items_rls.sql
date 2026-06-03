-- 0012_order_items_rls.sql — PROJECT_SPEC §6.2
-- order_items had RLS enabled in 0010 but no SELECT policy, so it was fully
-- blocked. Make a line item readable exactly when its parent order is readable
-- (the inner orders query is itself RLS-filtered, so this scopes correctly).

CREATE POLICY "read_order_items_via_order" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id)
  );

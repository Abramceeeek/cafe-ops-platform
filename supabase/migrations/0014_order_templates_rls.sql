-- 0014_order_templates_rls.sql — ROADMAP 3.2, PROJECT_SPEC §6.2.
-- Templates (table from 0007) are role-scoped per shop: a manager sees only
-- templates for their own shop AND their own role. Mutations go through these
-- policies; reuses current_role_name()/current_shop_id() from 0010.

ALTER TABLE order_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_template_item_modifiers ENABLE ROW LEVEL SECURITY;

-- ── order_templates: own shop + own role ────────────────────────────
CREATE POLICY "managers_read_own_templates" ON order_templates
  FOR SELECT USING (
    shop_id = current_shop_id() AND role = current_role_name()
  );

CREATE POLICY "managers_insert_own_templates" ON order_templates
  FOR INSERT WITH CHECK (
    shop_id = current_shop_id()
    AND role = current_role_name()
    AND created_by = auth.uid()
  );

CREATE POLICY "managers_delete_own_templates" ON order_templates
  FOR DELETE USING (
    shop_id = current_shop_id() AND role = current_role_name()
  );

-- ── order_template_items: scoped through the owning template ─────────
CREATE POLICY "managers_read_own_template_items" ON order_template_items
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM order_templates
      WHERE shop_id = current_shop_id() AND role = current_role_name()
    )
  );

CREATE POLICY "managers_insert_own_template_items" ON order_template_items
  FOR INSERT WITH CHECK (
    template_id IN (
      SELECT id FROM order_templates
      WHERE shop_id = current_shop_id() AND role = current_role_name()
    )
  );

CREATE POLICY "managers_delete_own_template_items" ON order_template_items
  FOR DELETE USING (
    template_id IN (
      SELECT id FROM order_templates
      WHERE shop_id = current_shop_id() AND role = current_role_name()
    )
  );

-- ── order_template_item_modifiers: scoped through item → template ────
CREATE POLICY "managers_read_own_template_mods" ON order_template_item_modifiers
  FOR SELECT USING (
    template_item_id IN (
      SELECT i.id FROM order_template_items i
      JOIN order_templates t ON t.id = i.template_id
      WHERE t.shop_id = current_shop_id() AND t.role = current_role_name()
    )
  );

CREATE POLICY "managers_insert_own_template_mods" ON order_template_item_modifiers
  FOR INSERT WITH CHECK (
    template_item_id IN (
      SELECT i.id FROM order_template_items i
      JOIN order_templates t ON t.id = i.template_id
      WHERE t.shop_id = current_shop_id() AND t.role = current_role_name()
    )
  );

CREATE POLICY "managers_delete_own_template_mods" ON order_template_item_modifiers
  FOR DELETE USING (
    template_item_id IN (
      SELECT i.id FROM order_template_items i
      JOIN order_templates t ON t.id = i.template_id
      WHERE t.shop_id = current_shop_id() AND t.role = current_role_name()
    )
  );

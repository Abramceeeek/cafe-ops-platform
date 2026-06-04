-- 0020_fix_template_update_rls.sql
-- Drop the flawed update policy and recreate with `AND role = current_role_name()`
-- to prevent cross-role template modification within the same shop.

DROP POLICY IF EXISTS "shops_update_own_templates" ON public.order_templates;

CREATE POLICY "shops_update_own_templates" ON public.order_templates
  FOR UPDATE TO authenticated
  USING (
    current_role_name() IN ('foh_manager', 'kitchen_manager')
    AND shop_id = current_shop_id()
    AND role = current_role_name()
  )
  WITH CHECK (
    current_role_name() IN ('foh_manager', 'kitchen_manager')
    AND shop_id = current_shop_id()
    AND role = current_role_name()
  );

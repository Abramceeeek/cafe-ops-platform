-- 0030_specialist_manage_catalog.sql
-- Make the Pitmaster (meat_specialist) and Baker (bread_baker) responsible for
-- their own catalog: add/price/delete the products in the categories assigned to
-- them. Admin keeps full control of everything (admin_write_products FOR ALL).
-- Categories themselves stay admin-managed (admin_all_categories); specialists
-- only manage products inside their existing categories.
--
-- UPDATE was already possible via the (misnamed) specialist_toggle_86 policy;
-- this replaces it with a clearly-named UPDATE and adds the missing INSERT/DELETE.
DROP POLICY IF EXISTS "specialist_toggle_86" ON public.products;
DROP POLICY IF EXISTS "specialist_insert_products" ON public.products;
DROP POLICY IF EXISTS "specialist_update_products" ON public.products;
DROP POLICY IF EXISTS "specialist_delete_products" ON public.products;

CREATE POLICY "specialist_insert_products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (
    current_role_name() IN ('meat_specialist', 'bread_baker')
    AND category_id IN (SELECT id FROM public.product_categories WHERE assigned_role = current_role_name())
  );

CREATE POLICY "specialist_update_products" ON public.products
  FOR UPDATE TO authenticated USING (
    current_role_name() IN ('meat_specialist', 'bread_baker')
    AND category_id IN (SELECT id FROM public.product_categories WHERE assigned_role = current_role_name())
  );

CREATE POLICY "specialist_delete_products" ON public.products
  FOR DELETE TO authenticated USING (
    current_role_name() IN ('meat_specialist', 'bread_baker')
    AND category_id IN (SELECT id FROM public.product_categories WHERE assigned_role = current_role_name())
  );

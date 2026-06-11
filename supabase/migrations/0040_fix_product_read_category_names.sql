-- 0040_fix_product_read_category_names.sql
-- 0021's role_based_read_products filtered on category names that don't exist in
-- this database ('Pastry / Sweet', 'Retail Bakery', 'Bread', 'Meat'), so the
-- policy matched nothing and FOH/Kitchen managers saw ZERO products in the
-- catalog. Correct the lists to the real category names.
--   bread_baker     → 'Kitchen Bread', 'Pastry / Retail Bakery'
--   meat_specialist → 'Smoked / Meat / Prep'
-- FOH manager orders finished retail goods (Pastry / Retail Bakery);
-- Kitchen manager orders production inputs (Kitchen Bread, Smoked / Meat / Prep).

DROP POLICY IF EXISTS "role_based_read_products" ON public.products;

CREATE POLICY "role_based_read_products" ON public.products
  FOR SELECT USING (
    is_available = TRUE AND (
      current_role_name() = 'admin' OR
      (
        current_role_name() = 'foh_manager'
        AND category_id IN (
          SELECT id FROM public.product_categories
          WHERE name = 'Pastry / Retail Bakery'
        )
      ) OR
      (
        current_role_name() = 'kitchen_manager'
        AND category_id IN (
          SELECT id FROM public.product_categories
          WHERE name IN ('Kitchen Bread', 'Smoked / Meat / Prep')
        )
      ) OR
      current_role_name() IN ('meat_specialist', 'bread_baker', 'pastry_chef', 'courier')
    )
  );

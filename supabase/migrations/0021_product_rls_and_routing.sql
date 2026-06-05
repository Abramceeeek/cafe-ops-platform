-- 0021_product_rls_and_routing.sql
-- Enforces BOH vs FOH visibility on products and reroutes Pastry to Baker.

-- 1. Re-route Pastry and Retail Bakery categories to the Baker (bread_baker)
UPDATE public.product_categories 
SET assigned_role = 'bread_baker' 
WHERE name IN ('Pastry / Sweet', 'Retail Bakery');

-- 2. Drop the permissive products policy
DROP POLICY IF EXISTS "all_read_available_products" ON public.products;

-- 3. Create strict role-based visibility policy
CREATE POLICY "role_based_read_products" ON public.products
  FOR SELECT USING (
    is_available = TRUE AND (
      current_role_name() = 'admin' OR
      (
        current_role_name() = 'foh_manager' 
        AND category_id IN (SELECT id FROM public.product_categories WHERE name IN ('Pastry / Sweet', 'Retail Bakery'))
      ) OR
      (
        current_role_name() = 'kitchen_manager' 
        AND category_id IN (SELECT id FROM public.product_categories WHERE name IN ('Bread', 'Meat'))
      ) OR
      current_role_name() IN ('meat_specialist', 'bread_baker', 'pastry_chef', 'courier')
    )
  );

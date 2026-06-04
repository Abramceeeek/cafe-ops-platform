-- 0018_custom_visibility.sql
-- Assigns Pastry category to the Baker account, and restricts FOH/BOH catalog visibility.

-- 1. Reassign Pastry/Retail category to bread_baker so Arun gets all those orders
UPDATE public.product_categories
SET assigned_role = 'bread_baker'
WHERE name = 'Pastry / Retail Bakery';

-- 2. Modify Product Read Visibility
DROP POLICY IF EXISTS "all_read_available_products" ON public.products;

CREATE POLICY "auth_read_available_products" ON public.products
  FOR SELECT TO authenticated
  USING (
    is_available = TRUE
    AND (
      -- Admins, Specialists, Couriers see all available products
      current_role_name() NOT IN ('foh_manager', 'kitchen_manager')
      -- BOH only sees Meat & Bread
      OR (
        current_role_name() = 'kitchen_manager' 
        AND category_id IN (
          SELECT id FROM public.product_categories 
          WHERE name IN ('Kitchen Bread', 'Smoked / Meat / Prep')
        )
      )
      -- FOH only sees Pastry & Retail
      OR (
        current_role_name() = 'foh_manager' 
        AND category_id IN (
          SELECT id FROM public.product_categories 
          WHERE name = 'Pastry / Retail Bakery'
        )
      )
    )
  );

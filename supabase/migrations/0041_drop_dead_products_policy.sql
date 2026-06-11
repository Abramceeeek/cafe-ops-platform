-- 0041_drop_dead_products_policy.sql
-- Removes the dead, broken products SELECT policy created in 0021. That policy
-- references category names that do not exist in the live catalog
-- ('Pastry / Sweet', 'Retail Bakery', 'Bread', 'Meat') so its IN-subqueries are
-- always empty — it grants shop roles nothing. The effective, correct policy is
-- "auth_read_available_products" from 0018 (BOH -> Kitchen Bread + Smoked/Meat/Prep,
-- FOH -> Pastry / Retail Bakery). Dropping the dead one removes a latent footgun:
-- if 0018's policy were ever dropped, the 0021 policy would hide ALL products from
-- shop roles. (Policies are OR'd, so removing it does not change current behaviour.)
DROP POLICY IF EXISTS "role_based_read_products" ON public.products;

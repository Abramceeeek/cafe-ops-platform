-- 0032_foh_boh_order_isolation.sql
-- Same-shop isolation between FOH and BOH. Cross-shop is already enforced by
-- shop_id = current_shop_id(); this adds: a shop manager sees only orders
-- submitted by their OWN role (FOH sees FOH-submitted, BOH sees BOH-submitted).
-- Separating by submitter role (not item category) is unambiguous — bread_baker
-- categories are ordered by both FOH (pastry/retail) and BOH (kitchen bread).
-- Side effect: the blank-"Item" rows (cross-role orders whose product names the
-- viewer can't read) disappear, since those orders are no longer returned.
CREATE OR REPLACE FUNCTION public.order_submitter_role(p_order_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles
  WHERE id = (SELECT submitted_by FROM public.orders WHERE id = p_order_id)
$$;

DROP POLICY IF EXISTS "shops_read_own_orders" ON public.orders;

CREATE POLICY "shops_read_own_orders" ON public.orders
  FOR SELECT USING (
    current_role_name() IN ('foh_manager', 'kitchen_manager')
    AND shop_id = current_shop_id()
    AND current_role_name() = public.order_submitter_role(id)
  );

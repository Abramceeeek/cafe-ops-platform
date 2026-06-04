-- 0019_fix_specialist_read_pending_again.sql
-- Fix: 0016_rls_hardening.sql inadvertently re-introduced 'pending_request' to the
-- exclusion list for specialists, overriding the fix from 0013. Specialists MUST see
-- pending_request orders so they can approve them.

DROP POLICY IF EXISTS "specialists_read_relevant_orders" ON public.orders;

CREATE POLICY "specialists_read_relevant_orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    current_role_name() IN ('meat_specialist', 'bread_baker', 'pastry_chef')
    AND status NOT IN ('cancelled', 'rejected')
    AND public.order_has_specialist_items(id, current_role_name())
  );

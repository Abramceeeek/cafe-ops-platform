-- 0013_fix_specialist_read_pending.sql
-- Fix: the §6.2 policy in 0010 excluded 'pending_request' from a specialist's
-- readable set, which blocked the Inbox (§11.2A) — specialists could not see the
-- requests they must approve. Allow specialists to read any non-terminal order;
-- category filtering is done in the application query layer (per the §6.2 note).

DROP POLICY IF EXISTS "specialists_read_relevant_orders" ON orders;

CREATE POLICY "specialists_read_relevant_orders" ON orders
  FOR SELECT USING (
    current_role_name() IN ('meat_specialist', 'bread_baker', 'pastry_chef')
    AND status NOT IN ('cancelled', 'rejected')
  );

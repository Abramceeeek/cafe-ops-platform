-- 0050_emergency_auto_ready.sql
-- Emergency orders skip the manual "Mark ready for delivery" step. The moment a
-- specialist approves an is_emergency order (pending_request -> specialist_approved),
-- this BEFORE-UPDATE trigger rewrites the status to ready_for_courier so the courier
-- can collect it immediately — no second step. Covers BOTH the web
-- (updateOrderStatus) and mobile (approval RPC) paths, since both land on
-- public.orders.status.
--
-- Side effect (intended): for emergencies the shop's "Order approved" push is
-- replaced by the courier's "Order ready to collect" push — the point of an
-- emergency is to get it moving fast. Reversible: DROP TRIGGER + DROP FUNCTION.

CREATE OR REPLACE FUNCTION public.emergency_auto_ready()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_emergency
     AND NEW.status = 'specialist_approved'
     AND OLD.status = 'pending_request' THEN
    NEW.status   := 'ready_for_courier';
    NEW.ready_at := COALESCE(NEW.ready_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS emergency_auto_ready_trg ON public.orders;
CREATE TRIGGER emergency_auto_ready_trg
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.is_emergency AND NEW.status = 'specialist_approved' AND OLD.status = 'pending_request')
  EXECUTE FUNCTION public.emergency_auto_ready();

-- 0028_courier_sees_approved.sql
-- New flow: the courier sees an order the moment the specialist approves it (so
-- they can plan the day), not only once it's marked ready. Add 'specialist_approved'
-- to the courier read policy. The specialist's "mark ready for delivery"
-- (ready_for_courier) still gates when the courier may start the delivery — this
-- only widens read visibility.
DROP POLICY IF EXISTS "courier_read_route_orders" ON public.orders;

CREATE POLICY "courier_read_route_orders" ON public.orders
  FOR SELECT USING (
    current_role_name() = 'courier'
    AND status IN (
      'specialist_approved', 'shop_confirmed', 'in_progress', 'packaged',
      'ready_for_courier', 'in_transit', 'delivered'
    )
  );

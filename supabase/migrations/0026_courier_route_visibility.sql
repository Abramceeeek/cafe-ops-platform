-- 0026_courier_route_visibility.sql
-- Single-route courier model: one courier delivers the whole day's route, so a
-- courier should see EVERY order in courier-relevant statuses, not only orders
-- where assigned_courier = self. This matches the design's manifest (one courier,
-- all stops) and removes the fragile arbitrary auto-assignment as a visibility
-- gate. assigned_courier remains for record-keeping but no longer controls reads.
-- Couriers still cannot mutate orders directly (transitions go through the
-- service-role server action / edge function), so no write policy is added.

DROP POLICY IF EXISTS "courier_read_assigned_orders" ON public.orders;

CREATE POLICY "courier_read_route_orders" ON public.orders
  FOR SELECT USING (
    current_role_name() = 'courier'
    AND status IN (
      'shop_confirmed', 'in_progress', 'packaged',
      'ready_for_courier', 'in_transit', 'delivered'
    )
  );

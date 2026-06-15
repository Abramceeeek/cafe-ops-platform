-- 0048_generate_standing_orders_rpc.sql
-- Nightly materialiser. For every delivery date in the CURRENT ISO week (today
-- onward), find each shop's latest effective standing-order version for that weekday
-- and create real, AUTO-APPROVED orders from it (status 'specialist_approved',
-- is_standing = true), split one order per product category like submit_request.
-- Idempotent: skips a (spec, date) already generated, so it is safe to re-run.
-- Generating only the current week means edits (effective next Monday) never disturb
-- an already-generated day. service_role only — invoked by pg_cron (see docs/CRONS.md).
CREATE OR REPLACE FUNCTION public.generate_standing_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_end date := (date_trunc('week', CURRENT_DATE)::date + 6);  -- coming Sunday (ISO week)
  v_d        date := CURRENT_DATE;
  v_spec     record;
  v_cat      record;
  v_item     record;
  v_order_id uuid;
  v_item_id  uuid;
  v_created  int := 0;
  v_dates    int := 0;
BEGIN
  WHILE v_d <= v_week_end LOOP
    v_dates := v_dates + 1;

    -- Latest effective version per (shop, owner_role) for this weekday.
    FOR v_spec IN
      SELECT DISTINCT ON (s.shop_id, s.owner_role)
             s.id, s.shop_id, s.owner_role, s.created_by, s.is_active
      FROM public.standing_orders s
      WHERE s.weekday = EXTRACT(ISODOW FROM v_d)::int
        AND s.effective_from <= v_d
      ORDER BY s.shop_id, s.owner_role, s.effective_from DESC, s.created_at DESC
    LOOP
      CONTINUE WHEN NOT v_spec.is_active;

      -- Idempotency: already generated this spec for this date?
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.orders
        WHERE standing_order_id = v_spec.id AND requested_delivery_date = v_d
      );

      -- One order per category (mirrors submit_request's split by category).
      FOR v_cat IN
        SELECT DISTINCT p.category_id
        FROM public.standing_order_items si
        JOIN public.products p ON p.id = si.product_id
        WHERE si.standing_order_id = v_spec.id AND p.is_available = true
      LOOP
        INSERT INTO public.orders (
          shop_id, submitted_by, status, requested_delivery_date,
          specialist_approved_at, is_standing, standing_order_id
        )
        VALUES (
          v_spec.shop_id, v_spec.created_by, 'specialist_approved', v_d,
          NOW(), true, v_spec.id
        )
        RETURNING id INTO v_order_id;
        v_created := v_created + 1;

        FOR v_item IN
          SELECT si.id, si.product_id, si.quantity, si.custom_note, p.unit, p.price
          FROM public.standing_order_items si
          JOIN public.products p ON p.id = si.product_id
          WHERE si.standing_order_id = v_spec.id AND p.category_id = v_cat.category_id AND p.is_available = true
        LOOP
          INSERT INTO public.order_items (
            order_id, product_id, quantity, requested_quantity, unit, custom_note, unit_cost
          )
          VALUES (
            v_order_id, v_item.product_id, v_item.quantity, v_item.quantity,
            v_item.unit, v_item.custom_note, v_item.price
          )
          RETURNING id INTO v_item_id;

          -- Carry standing-order modifiers across, denormalised like submit_request.
          INSERT INTO public.order_item_modifiers (
            order_item_id, modifier_option_id, modifier_group_name, modifier_option_name
          )
          SELECT v_item_id, mo.id, mg.name, mo.name
          FROM public.standing_order_item_modifiers som
          JOIN public.modifier_options mo ON mo.id = som.modifier_option_id
          JOIN public.modifier_groups mg ON mg.id = mo.modifier_group_id
          WHERE som.standing_order_item_id = v_item.id;
        END LOOP;
      END LOOP;
    END LOOP;

    v_d := v_d + 1;
  END LOOP;

  RETURN jsonb_build_object('orders_created', v_created, 'dates_scanned', v_dates);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_standing_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_standing_orders() TO service_role;

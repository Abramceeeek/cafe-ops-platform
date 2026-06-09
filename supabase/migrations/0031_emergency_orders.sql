-- 0031_emergency_orders.sql
-- Allow ordering past the 16:00 cut-off / lead-time as a flagged EMERGENCY order.
-- The shop is warned it has a high chance of not being approved and is the last
-- resort; the specialist sees the flag in their Inbox. We only record the flag —
-- the lead-time waiver itself is enforced in the server action (orders.ts).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN NOT NULL DEFAULT false;

-- Recreate submit_request_atomic with a trailing p_is_emergency parameter.
-- Drop the old 4-arg signature so the 5-arg version is unambiguous (the default
-- keeps any 4-arg caller working).
DROP FUNCTION IF EXISTS public.submit_request_atomic(uuid, uuid, date, jsonb);

CREATE OR REPLACE FUNCTION public.submit_request_atomic(
  p_shop_id uuid,
  p_submitted_by uuid,
  p_requested_delivery_date date,
  p_groups jsonb,
  p_is_emergency boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group jsonb;
  v_item jsonb;
  v_mod jsonb;
  v_order_id uuid;
  v_item_id uuid;
  v_ids uuid[] := '{}';
BEGIN
  FOR v_group IN SELECT * FROM jsonb_array_elements(p_groups)
  LOOP
    INSERT INTO public.orders (shop_id, submitted_by, status, requested_delivery_date, is_emergency)
    VALUES (p_shop_id, p_submitted_by, 'pending_request', p_requested_delivery_date, p_is_emergency)
    RETURNING id INTO v_order_id;
    v_ids := array_append(v_ids, v_order_id);

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_group)
    LOOP
      INSERT INTO public.order_items (order_id, product_id, quantity, requested_quantity, unit, custom_note)
      VALUES (
        v_order_id,
        (v_item->>'product_id')::uuid,
        (v_item->>'quantity')::numeric,
        (v_item->>'quantity')::numeric,
        v_item->>'unit',
        v_item->>'custom_note'
      )
      RETURNING id INTO v_item_id;

      IF v_item->'modifiers' IS NOT NULL THEN
        FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'modifiers')
        LOOP
          INSERT INTO public.order_item_modifiers (
            order_item_id, modifier_option_id, modifier_group_name, modifier_option_name
          )
          VALUES (
            v_item_id,
            (v_mod->>'modifier_option_id')::uuid,
            v_mod->>'modifier_group_name',
            v_mod->>'modifier_option_name'
          );
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('order_ids', to_jsonb(v_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.submit_request_atomic(uuid, uuid, date, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_request_atomic(uuid, uuid, date, jsonb, boolean) TO service_role;

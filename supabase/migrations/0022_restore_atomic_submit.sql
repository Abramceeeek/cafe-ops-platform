-- 0022_restore_atomic_submit.sql
-- Restores all-or-nothing order submission (ROADMAP 2.3 / audit F-02). The atomic
-- RPC was dropped in 0020_manifest_schema_fix.sql and replaced by a JS loop in the
-- submitOrder server action, which can leave a PARTIAL order if a later insert fails.
-- This version takes the FULL multi-category split (p_groups = array of item-groups)
-- and creates every order + item + modifier in ONE transaction. Must run AFTER 0020
-- (which drops the old signature). Server action calls this and falls back to the loop
-- only if the function is not yet applied to a given environment.
DROP FUNCTION IF EXISTS public.submit_request_atomic(uuid, uuid, date, jsonb);

CREATE OR REPLACE FUNCTION public.submit_request_atomic(
  p_shop_id uuid,
  p_submitted_by uuid,
  p_requested_delivery_date date,
  p_groups jsonb                       -- array of groups; each group = array of item objects
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
    INSERT INTO public.orders (shop_id, submitted_by, status, requested_delivery_date)
    VALUES (p_shop_id, p_submitted_by, 'pending_request', p_requested_delivery_date)
    RETURNING id INTO v_order_id;
    v_ids := array_append(v_ids, v_order_id);

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_group)
    LOOP
      INSERT INTO public.order_items (order_id, product_id, quantity, unit, custom_note)
      VALUES (
        v_order_id,
        (v_item->>'product_id')::uuid,
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

-- This SECURITY DEFINER function is only ever called by the submitOrder server action
-- via the service-role client. Lock out direct PostgREST calls from end users so it
-- can't be used to bypass the server-side validation (shop/role/lead-time checks).
REVOKE ALL ON FUNCTION public.submit_request_atomic(uuid, uuid, date, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_request_atomic(uuid, uuid, date, jsonb) TO service_role;

-- 0027_specialist_order_edit.sql
-- Lets the Hub specialist edit a request (adjust quantities / remove lines) as
-- they approve & price it, while preserving what the shop originally asked for
-- so the shop can review a before/after diff before Final Confirm.
--   order_items.requested_quantity : the quantity the shop submitted (immutable)
--   orders.was_edited              : true when the specialist changed qty / removed a line
-- Also recreates submit_request_atomic to populate requested_quantity (the
-- committed 0022 cannot be edited — guard enforces immutability).

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS requested_quantity NUMERIC(10,2);
UPDATE public.order_items SET requested_quantity = quantity WHERE requested_quantity IS NULL;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS was_edited BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.submit_request_atomic(
  p_shop_id uuid,
  p_submitted_by uuid,
  p_requested_delivery_date date,
  p_groups jsonb
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
      INSERT INTO public.order_items (order_id, product_id, quantity, requested_quantity, unit, custom_note)
      VALUES (
        v_order_id,
        (v_item->>'product_id')::uuid,
        (v_item->>'quantity')::numeric,
        (v_item->>'quantity')::numeric,   -- requested_quantity mirrors the submitted quantity
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

REVOKE ALL ON FUNCTION public.submit_request_atomic(uuid, uuid, date, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_request_atomic(uuid, uuid, date, jsonb) TO service_role;

-- 0035_submit_idempotency.sql
-- Double-submit protection: a flaky network retry must not create duplicate
-- orders. The client sends one idempotency_key per submit attempt; if that key
-- was already used by this user, submit_request_atomic returns the existing
-- order ids instead of inserting again. (A single submit can create several
-- orders — one per category — all sharing the key, so the lookup index is NOT
-- unique; the function does the check.)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE INDEX IF NOT EXISTS idx_orders_idempotency
  ON public.orders (submitted_by, idempotency_key) WHERE idempotency_key IS NOT NULL;

DROP FUNCTION IF EXISTS public.submit_request_atomic(uuid, uuid, date, jsonb, boolean);

CREATE OR REPLACE FUNCTION public.submit_request_atomic(
  p_shop_id uuid,
  p_submitted_by uuid,
  p_requested_delivery_date date,
  p_groups jsonb,
  p_is_emergency boolean DEFAULT false,
  p_idempotency_key uuid DEFAULT null
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
  v_existing uuid[];
BEGIN
  -- Idempotency: this key already used by this user → return the existing ids.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT array_agg(id) INTO v_existing
    FROM public.orders
    WHERE submitted_by = p_submitted_by AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL AND array_length(v_existing, 1) > 0 THEN
      RETURN jsonb_build_object('order_ids', to_jsonb(v_existing));
    END IF;
  END IF;

  FOR v_group IN SELECT * FROM jsonb_array_elements(p_groups)
  LOOP
    INSERT INTO public.orders (shop_id, submitted_by, status, requested_delivery_date, is_emergency, idempotency_key)
    VALUES (p_shop_id, p_submitted_by, 'pending_request', p_requested_delivery_date, p_is_emergency, p_idempotency_key)
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

REVOKE ALL ON FUNCTION public.submit_request_atomic(uuid, uuid, date, jsonb, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_request_atomic(uuid, uuid, date, jsonb, boolean, uuid) TO service_role;

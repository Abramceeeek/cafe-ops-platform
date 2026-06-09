-- 0036_submit_request_rpc.sql
-- Mobile order submission without an edge-function deploy. submit_request_atomic
-- is service_role-only (trusts its args), so the Flutter app can't call it. This
-- adds submit_request: a SECURITY DEFINER function granted to `authenticated`
-- that DERIVES the submitter (auth.uid()) and shop (from the caller's profile) —
-- so they can't be spoofed — enforces the same role/category guard as the web
-- submitOrder, splits the cart by category, and inserts the orders. Lead-time /
-- cut-off is a soft UX rule handled app-side (+ the is_emergency flag); the hard
-- security checks live here.
CREATE OR REPLACE FUNCTION public.submit_request(
  p_requested_delivery_date date,
  p_items jsonb,
  p_is_emergency boolean DEFAULT false,
  p_idempotency_key uuid DEFAULT null
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_shop uuid;
  v_active boolean;
  v_item jsonb;
  v_mod jsonb;
  v_pid uuid;
  v_cat uuid;
  v_assigned text;
  v_unit text;
  v_order_id uuid;
  v_item_id uuid;
  v_ids uuid[] := '{}';
  v_existing uuid[];
  v_cat_order jsonb := '{}'::jsonb;  -- category_id -> order_id (one order per category)
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT role, shop_id, is_active INTO v_role, v_shop, v_active FROM public.profiles WHERE id = v_uid;
  IF v_role IS NULL OR v_active IS NOT TRUE THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_role NOT IN ('foh_manager', 'kitchen_manager') THEN RAISE EXCEPTION 'role_not_permitted'; END IF;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'no_shop_assigned'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'cart_empty'; END IF;

  -- Idempotency: this key already used by this user → return the existing ids.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT array_agg(id) INTO v_existing
    FROM public.orders WHERE submitted_by = v_uid AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL AND array_length(v_existing, 1) > 0 THEN
      RETURN jsonb_build_object('order_ids', to_jsonb(v_existing));
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := (v_item->>'product_id')::uuid;
    SELECT p.category_id, pc.assigned_role, p.unit
      INTO v_cat, v_assigned, v_unit
      FROM public.products p JOIN public.product_categories pc ON pc.id = p.category_id
      WHERE p.id = v_pid;
    IF v_cat IS NULL THEN RAISE EXCEPTION 'product_not_found: %', v_pid; END IF;

    -- Role/category guard (mirrors the web submitOrder).
    IF v_role = 'foh_manager' AND v_assigned <> 'bread_baker' THEN
      RAISE EXCEPTION 'security_bypass: FOH can only order Pastry/Retail items';
    END IF;
    IF v_role = 'kitchen_manager' AND v_assigned NOT IN ('bread_baker', 'meat_specialist') THEN
      RAISE EXCEPTION 'security_bypass: BOH can only order Bread/Meat items';
    END IF;

    IF v_cat_order ? v_cat::text THEN
      v_order_id := (v_cat_order->>v_cat::text)::uuid;
    ELSE
      INSERT INTO public.orders (shop_id, submitted_by, status, requested_delivery_date, is_emergency, idempotency_key)
      VALUES (v_shop, v_uid, 'pending_request', p_requested_delivery_date, p_is_emergency, p_idempotency_key)
      RETURNING id INTO v_order_id;
      v_ids := array_append(v_ids, v_order_id);
      v_cat_order := v_cat_order || jsonb_build_object(v_cat::text, v_order_id::text);
    END IF;

    INSERT INTO public.order_items (order_id, product_id, quantity, requested_quantity, unit, custom_note)
    VALUES (v_order_id, v_pid, (v_item->>'quantity')::numeric, (v_item->>'quantity')::numeric, v_unit, v_item->>'custom_note')
    RETURNING id INTO v_item_id;

    IF v_item->'modifiers' IS NOT NULL THEN
      FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'modifiers')
      LOOP
        INSERT INTO public.order_item_modifiers (order_item_id, modifier_option_id, modifier_group_name, modifier_option_name)
        VALUES (v_item_id, (v_mod->>'modifier_option_id')::uuid, v_mod->>'modifier_group_name', v_mod->>'modifier_option_name');
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('order_ids', to_jsonb(v_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.submit_request(date, jsonb, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_request(date, jsonb, boolean, uuid) TO authenticated;

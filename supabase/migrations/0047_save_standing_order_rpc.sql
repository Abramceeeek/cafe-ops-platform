-- 0047_save_standing_order_rpc.sql
-- Authenticated save of a standing-order version. SECURITY DEFINER: derives the
-- shop + role from the caller's profile (cannot be spoofed) and enforces the same
-- role/category guard as submit_request (0036) — vital because these specs feed the
-- AUTO-APPROVED generator (0048). Each call inserts a NEW version; the caller passes
-- p_effective_from = next Monday for an edit (so the current week stays locked) or
-- CURRENT_DATE for a brand-new spec. Returns the new standing_orders id.
CREATE OR REPLACE FUNCTION public.save_standing_order(
  p_weekday int,
  p_effective_from date,
  p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_shop uuid;
  v_active boolean;
  v_so_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_mod jsonb;
  v_pid uuid;
  v_assigned text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT role, shop_id, is_active INTO v_role, v_shop, v_active FROM public.profiles WHERE id = v_uid;
  IF v_role IS NULL OR v_active IS NOT TRUE THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_role NOT IN ('foh_manager', 'kitchen_manager') THEN RAISE EXCEPTION 'role_not_permitted'; END IF;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'no_shop_assigned'; END IF;
  IF p_weekday IS NULL OR p_weekday < 1 OR p_weekday > 7 THEN RAISE EXCEPTION 'bad_weekday'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'cart_empty'; END IF;

  INSERT INTO public.standing_orders (shop_id, owner_role, weekday, effective_from, created_by)
  VALUES (v_shop, v_role, p_weekday, COALESCE(p_effective_from, CURRENT_DATE), v_uid)
  RETURNING id INTO v_so_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := (v_item->>'product_id')::uuid;
    SELECT pc.assigned_role INTO v_assigned
      FROM public.products p JOIN public.product_categories pc ON pc.id = p.category_id
      WHERE p.id = v_pid;
    IF v_assigned IS NULL THEN RAISE EXCEPTION 'product_not_found: %', v_pid; END IF;

    -- Same guard as submit_request: FOH = Pastry/Retail (bread_baker), BOH = Bread/Meat.
    IF v_role = 'foh_manager' AND v_assigned <> 'bread_baker' THEN
      RAISE EXCEPTION 'security_bypass: FOH standing orders are Pastry/Retail only';
    END IF;
    IF v_role = 'kitchen_manager' AND v_assigned NOT IN ('bread_baker', 'meat_specialist') THEN
      RAISE EXCEPTION 'security_bypass: BOH standing orders are Bread/Meat only';
    END IF;

    INSERT INTO public.standing_order_items (standing_order_id, product_id, quantity, custom_note)
    VALUES (v_so_id, v_pid, (v_item->>'quantity')::numeric, v_item->>'custom_note')
    RETURNING id INTO v_item_id;

    IF v_item->'modifiers' IS NOT NULL THEN
      FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'modifiers')
      LOOP
        INSERT INTO public.standing_order_item_modifiers (standing_order_item_id, modifier_option_id)
        VALUES (v_item_id, (v_mod->>'modifier_option_id')::uuid);
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_so_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_standing_order(int, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_standing_order(int, date, jsonb) TO authenticated;

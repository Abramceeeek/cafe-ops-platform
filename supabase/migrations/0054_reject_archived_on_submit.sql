-- 0054_reject_archived_on_submit.sql
-- With 0051 the database no longer refuses to READ an unavailable product, so the
-- guarantee that an archived or 86'd item can never enter a NEW order has to be
-- stated in the order-writing paths. This recreates the four of them unchanged
-- except for that check (and the generator's archived filter), so a phone running
-- an older build gets a clean 'product_archived' error instead of a silent order.
--   submit_request           (0036) — mobile
--   submit_request_atomic    (0035) — web, service-role
--   save_standing_order      (0047) — weekly spec
--   generate_standing_orders (0048) — nightly materialiser

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
  v_avail boolean;
  v_archived timestamptz;
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
    SELECT p.category_id, pc.assigned_role, p.unit, p.is_available, p.archived_at
      INTO v_cat, v_assigned, v_unit, v_avail, v_archived
      FROM public.products p JOIN public.product_categories pc ON pc.id = p.category_id
      WHERE p.id = v_pid;
    IF v_cat IS NULL THEN RAISE EXCEPTION 'product_not_found: %', v_pid; END IF;
    IF v_archived IS NOT NULL THEN RAISE EXCEPTION 'product_archived: %', v_pid; END IF;
    IF v_avail IS NOT TRUE THEN RAISE EXCEPTION 'product_unavailable: %', v_pid; END IF;

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
  v_pid uuid;
  v_avail boolean;
  v_archived timestamptz;
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
      v_pid := (v_item->>'product_id')::uuid;
      SELECT is_available, archived_at INTO v_avail, v_archived
        FROM public.products WHERE id = v_pid;
      IF v_avail IS NULL THEN RAISE EXCEPTION 'product_not_found: %', v_pid; END IF;
      IF v_archived IS NOT NULL THEN RAISE EXCEPTION 'product_archived: %', v_pid; END IF;
      IF v_avail IS NOT TRUE THEN RAISE EXCEPTION 'product_unavailable: %', v_pid; END IF;

      INSERT INTO public.order_items (order_id, product_id, quantity, requested_quantity, unit, custom_note)
      VALUES (
        v_order_id,
        v_pid,
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
  v_avail boolean;
  v_archived timestamptz;
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
    SELECT pc.assigned_role, p.is_available, p.archived_at
      INTO v_assigned, v_avail, v_archived
      FROM public.products p JOIN public.product_categories pc ON pc.id = p.category_id
      WHERE p.id = v_pid;
    IF v_assigned IS NULL THEN RAISE EXCEPTION 'product_not_found: %', v_pid; END IF;
    IF v_archived IS NOT NULL THEN RAISE EXCEPTION 'product_archived: %', v_pid; END IF;

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


-- A standing order is a weekly spec, not history: an archived product's lines are
-- removed by archive_product (0053), so this filter only matters for a spec saved
-- before that RPC existed. An 86'd item is skipped exactly as before.
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
        WHERE si.standing_order_id = v_spec.id AND p.is_available = true AND p.archived_at IS NULL
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
          WHERE si.standing_order_id = v_spec.id AND p.category_id = v_cat.category_id
            AND p.is_available = true AND p.archived_at IS NULL
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

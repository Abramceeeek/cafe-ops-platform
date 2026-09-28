-- 0058_category_shop_roles.sql
-- Which shop roles can see and order a category's products is now data on the
-- category, not a list of category NAMES in the products policy. Renaming a
-- category, or adding one from the web catalog, used to hide its products from
-- every shop with no error (0018 → 0021 → 0040 all chased this). The order
-- paths also disagreed with what the shop could see: they allowed by
-- assigned_role, so FOH could order Kitchen Bread it never saw, and in a seeded
-- env (Pastry = pastry_chef) couldn't order the Pastry it did see.
--
-- One rule everywhere: a shop role can see and order a category's products iff
-- the role is in product_categories.shop_roles.
--   read_products_by_role     — the products SELECT policy (was 0051)
--   submit_request            — mobile            (was 0054)
--   submit_request_atomic     — web, service-role (was 0054; had no role check)
--   save_standing_order       — weekly spec       (was 0054)
--   generate_standing_orders  — nightly; skips lines the spec's role can no
--                               longer order, like 86'd/archived ones (was 0054)
-- apps/admin_web/app/actions/orders.ts (submitOrder) mirrors the same rule.

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS shop_roles TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.product_categories
  DROP CONSTRAINT IF EXISTS product_categories_shop_roles_check;
ALTER TABLE public.product_categories
  ADD CONSTRAINT product_categories_shop_roles_check
  CHECK (shop_roles <@ ARRAY['foh_manager', 'kitchen_manager']::TEXT[]);

-- Backfill from the names in 0051's policy, so visibility is exactly what it was.
UPDATE public.product_categories
   SET shop_roles = array_append(shop_roles, 'foh_manager')
 WHERE name = 'Pastry / Retail Bakery'
   AND NOT 'foh_manager' = ANY(shop_roles);
UPDATE public.product_categories
   SET shop_roles = array_append(shop_roles, 'kitchen_manager')
 WHERE name IN ('Kitchen Bread', 'Smoked / Meat / Prep')
   AND NOT 'kitchen_manager' = ANY(shop_roles);

DO $$
DECLARE hidden text;
BEGIN
  SELECT string_agg(name, ', ' ORDER BY display_order, name) INTO hidden
    FROM public.product_categories WHERE shop_roles = '{}';
  IF hidden IS NOT NULL THEN
    RAISE NOTICE 'Not orderable by any shop (as before this migration): %', hidden;
  END IF;
END $$;

DROP POLICY IF EXISTS "read_products_by_role" ON public.products;

CREATE POLICY "read_products_by_role" ON public.products
  FOR SELECT TO authenticated USING (
    current_role_name() NOT IN ('foh_manager', 'kitchen_manager')
    OR category_id IN (
      SELECT id FROM public.product_categories
      WHERE current_role_name() = ANY(shop_roles)
    )
  );


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
  v_cat_name text;
  v_shop_roles text[];
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
    SELECT p.category_id, pc.name, pc.shop_roles, p.unit, p.is_available, p.archived_at
      INTO v_cat, v_cat_name, v_shop_roles, v_unit, v_avail, v_archived
      FROM public.products p JOIN public.product_categories pc ON pc.id = p.category_id
      WHERE p.id = v_pid;
    IF v_cat IS NULL THEN RAISE EXCEPTION 'product_not_found: %', v_pid; END IF;
    IF v_archived IS NOT NULL THEN RAISE EXCEPTION 'product_archived: %', v_pid; END IF;
    IF v_avail IS NOT TRUE THEN RAISE EXCEPTION 'product_unavailable: %', v_pid; END IF;

    -- Same rule as read_products_by_role (and the web submitOrder).
    IF NOT (v_role = ANY(v_shop_roles)) THEN
      RAISE EXCEPTION 'security_bypass: % is not orderable by %', v_cat_name, v_role;
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


-- Service-role only and called after submitOrder's own checks, but it now
-- repeats the category rule against the submitter's role so the two can't drift.
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
  v_role text;
  v_pid uuid;
  v_avail boolean;
  v_archived timestamptz;
  v_cat_name text;
  v_shop_roles text[];
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

  SELECT role INTO v_role FROM public.profiles WHERE id = p_submitted_by;

  FOR v_group IN SELECT * FROM jsonb_array_elements(p_groups)
  LOOP
    INSERT INTO public.orders (shop_id, submitted_by, status, requested_delivery_date, is_emergency, idempotency_key)
    VALUES (p_shop_id, p_submitted_by, 'pending_request', p_requested_delivery_date, p_is_emergency, p_idempotency_key)
    RETURNING id INTO v_order_id;
    v_ids := array_append(v_ids, v_order_id);

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_group)
    LOOP
      v_pid := (v_item->>'product_id')::uuid;
      SELECT p.is_available, p.archived_at, pc.name, pc.shop_roles
        INTO v_avail, v_archived, v_cat_name, v_shop_roles
        FROM public.products p JOIN public.product_categories pc ON pc.id = p.category_id
        WHERE p.id = v_pid;
      IF v_avail IS NULL THEN RAISE EXCEPTION 'product_not_found: %', v_pid; END IF;
      IF v_archived IS NOT NULL THEN RAISE EXCEPTION 'product_archived: %', v_pid; END IF;
      IF v_avail IS NOT TRUE THEN RAISE EXCEPTION 'product_unavailable: %', v_pid; END IF;
      IF v_role IS NULL OR NOT (v_role = ANY(v_shop_roles)) THEN
        RAISE EXCEPTION 'security_bypass: % is not orderable by %', v_cat_name, COALESCE(v_role, 'unknown role');
      END IF;

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
  v_cat_name text;
  v_shop_roles text[];
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
    SELECT pc.name, pc.shop_roles, p.is_available, p.archived_at
      INTO v_cat_name, v_shop_roles, v_avail, v_archived
      FROM public.products p JOIN public.product_categories pc ON pc.id = p.category_id
      WHERE p.id = v_pid;
    IF v_cat_name IS NULL THEN RAISE EXCEPTION 'product_not_found: %', v_pid; END IF;
    IF v_archived IS NOT NULL THEN RAISE EXCEPTION 'product_archived: %', v_pid; END IF;

    -- Same rule as submit_request: the category must list this role in shop_roles.
    IF NOT (v_role = ANY(v_shop_roles)) THEN
      RAISE EXCEPTION 'security_bypass: % is not orderable by %', v_cat_name, v_role;
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


-- A spec line whose category no longer lists the spec's owner_role is skipped
-- like an 86'd one: the line stays on the spec, so re-ticking the role in the
-- catalog brings it back the next night.
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
        JOIN public.product_categories pc ON pc.id = p.category_id
        WHERE si.standing_order_id = v_spec.id AND p.is_available = true AND p.archived_at IS NULL
          AND v_spec.owner_role = ANY(pc.shop_roles)
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

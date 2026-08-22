-- 0053_archive_product_rpc.sql
-- The catalog's Delete button calls this instead of DELETE FROM products.
--   * standing_order_items and order_template_items are forward-looking specs, not
--     history, so the product's lines there are removed outright.
--   * order_items is history and is NEVER touched.
--   * No order_items reference => the row really is deleted (a mistyped product
--     added five minutes ago disappears completely, modifier_groups cascade).
--   * Otherwise the row is archived: archived_at set, and is_available forced false
--     so clients that only know the old 86 filter (a phone on an older build) stop
--     offering it without needing an app update.
-- SECURITY DEFINER, so the role/category permission check is explicit here — it
-- mirrors the products write policies from 0030.
CREATE OR REPLACE FUNCTION public.archive_product(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      text := current_role_name();
  v_assigned  text;
  v_name      text;
  v_orders    int;
  v_standing  int;
  v_templates int;
BEGIN
  IF v_role IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT p.name, pc.assigned_role INTO v_name, v_assigned
    FROM public.products p
    JOIN public.product_categories pc ON pc.id = p.category_id
   WHERE p.id = p_product_id;
  IF v_name IS NULL THEN RAISE EXCEPTION 'product_not_found: %', p_product_id; END IF;

  IF v_role <> 'admin' AND NOT (v_role IN ('meat_specialist', 'bread_baker') AND v_assigned = v_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO v_orders FROM public.order_items WHERE product_id = p_product_id;

  DELETE FROM public.standing_order_items WHERE product_id = p_product_id;
  GET DIAGNOSTICS v_standing = ROW_COUNT;

  DELETE FROM public.order_template_items WHERE product_id = p_product_id;
  GET DIAGNOSTICS v_templates = ROW_COUNT;

  IF v_orders = 0 THEN
    DELETE FROM public.products WHERE id = p_product_id;
  ELSE
    UPDATE public.products
       SET archived_at = NOW(), is_available = false, updated_at = NOW()
     WHERE id = p_product_id;
  END IF;

  RETURN jsonb_build_object(
    'action', CASE WHEN v_orders = 0 THEN 'deleted' ELSE 'archived' END,
    'name', v_name,
    'order_items', v_orders,
    'standing_orders_cleared', v_standing,
    'templates_cleared', v_templates
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_product(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text := current_role_name();
  v_assigned text;
  v_name     text;
BEGIN
  IF v_role IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT p.name, pc.assigned_role INTO v_name, v_assigned
    FROM public.products p
    JOIN public.product_categories pc ON pc.id = p.category_id
   WHERE p.id = p_product_id;
  IF v_name IS NULL THEN RAISE EXCEPTION 'product_not_found: %', p_product_id; END IF;

  IF v_role <> 'admin' AND NOT (v_role IN ('meat_specialist', 'bread_baker') AND v_assigned = v_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.products
     SET archived_at = NULL, is_available = true, updated_at = NOW()
   WHERE id = p_product_id;

  RETURN jsonb_build_object('action', 'restored', 'name', v_name);
END;
$$;

REVOKE ALL ON FUNCTION public.archive_product(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_product(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.restore_product(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_product(uuid) TO authenticated;

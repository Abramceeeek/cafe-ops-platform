-- 0043_change_order_status_empty_guard.sql
-- SECURITY/CORRECTNESS FIX (audit 2026-06-13 NC-1): change_order_status (0038) let a
-- courier transitioning ready_for_courier -> in_transit pass p_removed_item_ids and
-- DELETE every line item, then still flip the status — the C2 empty-order hole on a
-- second code path that the 0041 specialist_review guard never covered. An emptied
-- order breaks receipt totals (GBP) and fulfilment and enables silent courier removal.
-- Fix: refuse the in_transit handoff unless at least one line with quantity > 0 remains.
-- Also records in_transit_at (column added in 0042). Body otherwise identical to 0038.
CREATE OR REPLACE FUNCTION public.change_order_status(
  p_order_id uuid,
  p_to text,
  p_item_edits jsonb DEFAULT '[]'::jsonb,       -- [{id, quantity}] (courier qty adjust)
  p_removed_item_ids uuid[] DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_active boolean;
  v_from text;
  v_assigned text;
  v_edit jsonb;
  v_patch_ts text;
  v_updated uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role, is_active INTO v_role, v_active FROM public.profiles WHERE id = v_uid;
  IF v_role IS NULL OR v_active IS NOT TRUE THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT status INTO v_from FROM public.orders WHERE id = p_order_id;
  IF v_from IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;

  -- Allowed (from -> to, role) combinations.
  IF NOT (
    (v_from = 'specialist_approved' AND p_to = 'ready_for_courier'
      AND v_role IN ('meat_specialist', 'bread_baker', 'pastry_chef'))
    OR (v_from = 'ready_for_courier' AND p_to = 'in_transit' AND v_role = 'courier')
    OR (v_from = 'in_transit' AND p_to = 'delivered' AND v_role = 'courier')
  ) THEN
    RAISE EXCEPTION 'invalid_transition_or_role: % -> % as %', v_from, p_to, v_role;
  END IF;

  -- Specialists may only advance their own category's orders.
  IF v_role IN ('meat_specialist', 'bread_baker', 'pastry_chef') THEN
    SELECT pc.assigned_role INTO v_assigned
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.product_categories pc ON pc.id = p.category_id
    WHERE oi.order_id = p_order_id
    LIMIT 1;
    IF v_assigned IS DISTINCT FROM v_role THEN RAISE EXCEPTION 'not_your_category'; END IF;
  END IF;

  -- Courier qty adjustments at handoff (start delivery).
  IF p_to = 'in_transit' THEN
    IF p_removed_item_ids IS NOT NULL AND array_length(p_removed_item_ids, 1) > 0 THEN
      DELETE FROM public.order_items WHERE id = ANY(p_removed_item_ids) AND order_id = p_order_id;
    END IF;
    FOR v_edit IN SELECT * FROM jsonb_array_elements(COALESCE(p_item_edits, '[]'::jsonb))
    LOOP
      UPDATE public.order_items SET quantity = (v_edit->>'quantity')::numeric
      WHERE id = (v_edit->>'id')::uuid AND order_id = p_order_id;
    END LOOP;
    -- Audit NC-1: never strand an order with zero line items at handoff.
    IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND quantity > 0) THEN
      RAISE EXCEPTION 'cannot_transition_empty_order';
    END IF;
  END IF;

  v_patch_ts := CASE p_to
                  WHEN 'ready_for_courier' THEN 'ready_at'
                  WHEN 'in_transit' THEN 'in_transit_at'
                  WHEN 'delivered' THEN 'delivered_at'
                  ELSE NULL END;

  UPDATE public.orders
  SET status = p_to,
      ready_at = CASE WHEN v_patch_ts = 'ready_at' THEN now() ELSE ready_at END,
      in_transit_at = CASE WHEN v_patch_ts = 'in_transit_at' THEN now() ELSE in_transit_at END,
      delivered_at = CASE WHEN v_patch_ts = 'delivered_at' THEN now() ELSE delivered_at END
  WHERE id = p_order_id AND status = v_from
  RETURNING id INTO v_updated;

  IF v_updated IS NULL THEN RAISE EXCEPTION 'concurrent_modification'; END IF;
  RETURN jsonb_build_object('ok', true, 'from', v_from, 'to', p_to);
END;
$$;

REVOKE ALL ON FUNCTION public.change_order_status(uuid, text, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_order_status(uuid, text, jsonb, uuid[]) TO authenticated;

-- 0041_specialist_review_empty_guard.sql
-- CORRECTNESS FIX (audit C2): specialist_review (0037) let a specialist DELETE all
-- line items (p_removed_item_ids) or zero out their quantities and STILL transition the
-- order to 'specialist_approved'. The result is an approved order with nothing in it —
-- receipts (GBP total) and fulfilment break downstream.
-- Fix: after edits/pricing, refuse to approve unless at least one line has quantity > 0.
-- Body is otherwise identical to 0037 (verified equal to the live function).
CREATE OR REPLACE FUNCTION public.specialist_review(
  p_order_id uuid,
  p_approve boolean,
  p_item_edits jsonb DEFAULT '[]'::jsonb,   -- [{id, quantity}]
  p_removed_item_ids uuid[] DEFAULT '{}',
  p_reason text DEFAULT null
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_active boolean;
  v_status text;
  v_assigned text;
  v_edit jsonb;
  v_qty_changed boolean := false;
  v_was_edited boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role, is_active INTO v_role, v_active FROM public.profiles WHERE id = v_uid;
  IF v_role IS NULL OR v_active IS NOT TRUE THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_role NOT IN ('meat_specialist', 'bread_baker', 'pastry_chef') THEN
    RAISE EXCEPTION 'role_not_permitted';
  END IF;

  SELECT status INTO v_status FROM public.orders WHERE id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF v_status <> 'pending_request' THEN RAISE EXCEPTION 'invalid_transition'; END IF;

  -- Ownership: the order's (single) category must be assigned to this specialist.
  SELECT pc.assigned_role INTO v_assigned
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  JOIN public.product_categories pc ON pc.id = p.category_id
  WHERE oi.order_id = p_order_id
  LIMIT 1;
  IF v_assigned IS DISTINCT FROM v_role THEN RAISE EXCEPTION 'not_your_category'; END IF;

  IF p_approve THEN
    IF p_removed_item_ids IS NOT NULL AND array_length(p_removed_item_ids, 1) > 0 THEN
      DELETE FROM public.order_items WHERE id = ANY(p_removed_item_ids) AND order_id = p_order_id;
    END IF;
    FOR v_edit IN SELECT * FROM jsonb_array_elements(COALESCE(p_item_edits, '[]'::jsonb))
    LOOP
      UPDATE public.order_items SET quantity = (v_edit->>'quantity')::numeric
      WHERE id = (v_edit->>'id')::uuid AND order_id = p_order_id;
    END LOOP;
    -- Admin-owned pricing: each surviving line priced from the product.
    UPDATE public.order_items oi SET unit_cost = p.price
    FROM public.products p WHERE p.id = oi.product_id AND oi.order_id = p_order_id;

    -- Audit C2: never approve an order with nothing in it (all lines removed or zeroed).
    IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND quantity > 0) THEN
      RAISE EXCEPTION 'cannot_approve_empty_order';
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.order_items
      WHERE order_id = p_order_id AND requested_quantity IS NOT NULL AND quantity <> requested_quantity
    ) INTO v_qty_changed;
    v_was_edited := v_qty_changed OR COALESCE(array_length(p_removed_item_ids, 1), 0) > 0;

    UPDATE public.orders
    SET status = 'specialist_approved', specialist_approved_at = now(), was_edited = v_was_edited
    WHERE id = p_order_id AND status = 'pending_request';
  ELSE
    UPDATE public.orders
    SET status = 'rejected', rejection_reason = NULLIF(trim(COALESCE(p_reason, '')), '')
    WHERE id = p_order_id AND status = 'pending_request';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.specialist_review(uuid, boolean, jsonb, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.specialist_review(uuid, boolean, jsonb, uuid[], text) TO authenticated;

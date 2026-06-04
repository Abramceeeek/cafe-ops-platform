-- 0017_data_integrity.sql - Phase 3 Data Integrity

-- F-02: Atomicity in submit-request
CREATE OR REPLACE FUNCTION public.submit_request_atomic(
  p_shop_id uuid,
  p_submitted_by uuid,
  p_requested_delivery_date date,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid;
  v_item record;
  v_item_id uuid;
  v_mod record;
BEGIN
  INSERT INTO public.orders (shop_id, submitted_by, status, requested_delivery_date)
  VALUES (p_shop_id, p_submitted_by, 'pending_request', p_requested_delivery_date)
  RETURNING id INTO v_order_id;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, unit, custom_note)
    VALUES (
      v_order_id,
      (v_item.value->>'product_id')::uuid,
      (v_item.value->>'quantity')::int,
      v_item.value->>'unit',
      v_item.value->>'custom_note'
    )
    RETURNING id INTO v_item_id;
    
    IF v_item.value->'modifiers' IS NOT NULL THEN
      FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item.value->'modifiers')
      LOOP
        INSERT INTO public.order_item_modifiers (
          order_item_id, 
          modifier_option_id, 
          modifier_group_name, 
          modifier_option_name
        )
        VALUES (
          v_item_id,
          (v_mod.value->>'modifier_option_id')::uuid,
          v_mod.value->>'modifier_group_name',
          v_mod.value->>'modifier_option_name'
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id);
END;
$$;

-- F-25: Monthly Statement Persistence
ALTER TABLE public.receipts ALTER COLUMN order_id DROP NOT NULL;

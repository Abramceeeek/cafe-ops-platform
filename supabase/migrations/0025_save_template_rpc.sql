CREATE OR REPLACE FUNCTION save_order_template(
  p_shop_id uuid,
  p_created_by uuid,
  p_name text,
  p_role text,
  p_items jsonb
) RETURNS uuid AS $$
DECLARE
  v_template_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_mod jsonb;
BEGIN
  INSERT INTO order_templates (shop_id, created_by, name, role)
  VALUES (p_shop_id, p_created_by, p_name, p_role)
  RETURNING id INTO v_template_id;

  IF p_items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO order_template_items (template_id, product_id, quantity, custom_note)
      VALUES (v_template_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::numeric, v_item->>'custom_note')
      RETURNING id INTO v_item_id;

      IF v_item->'modifiers' IS NOT NULL THEN
        FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'modifiers')
        LOOP
          INSERT INTO order_template_item_modifiers (template_item_id, modifier_option_id)
          VALUES (v_item_id, (v_mod->>'modifier_option_id')::uuid);
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN v_template_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

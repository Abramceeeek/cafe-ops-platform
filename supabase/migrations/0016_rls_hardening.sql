-- 0016_rls_hardening.sql - Phase 2 RLS Hardening

-- F-05: Enforce is_active = TRUE in helpers
CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid() AND is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION public.current_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT shop_id
  FROM public.profiles
  WHERE id = auth.uid() AND is_active = TRUE;
$$;

-- Recreate hook to enforce is_active
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  v_role text;
  v_shop uuid;
  v_active boolean;
BEGIN
  SELECT role, shop_id, is_active INTO v_role, v_shop, v_active
  FROM public.profiles
  WHERE id = (event ->> 'user_id')::uuid;

  claims := COALESCE(event -> 'claims', '{}'::jsonb);
  IF v_active = TRUE AND v_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{role}', to_jsonb(v_role));
    claims := jsonb_set(claims, '{shop_id}', COALESCE(to_jsonb(v_shop), 'null'::jsonb));
  ELSE
    claims := jsonb_set(claims, '{role}', 'null'::jsonb);
    claims := jsonb_set(claims, '{shop_id}', 'null'::jsonb);
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- F-08: delivery_manifests and manifest_stops
ALTER TABLE public.manifest_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couriers_read_manifests" ON public.delivery_manifests
  FOR SELECT TO authenticated
  USING (courier_id = auth.uid() OR current_role_name() = 'admin');

CREATE POLICY "couriers_read_stops" ON public.manifest_stops
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_manifests m
      WHERE m.id = manifest_stops.manifest_id
      AND (m.courier_id = auth.uid() OR current_role_name() = 'admin')
    )
  );

-- F-06: order_item_modifiers missing RLS
ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_order_item_modifiers" ON public.order_item_modifiers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_items i
      JOIN public.orders o ON i.order_id = o.id
      WHERE i.id = order_item_modifiers.order_item_id
      AND (
        o.shop_id = current_shop_id()
        OR current_role_name() = 'admin'
        OR o.assigned_courier = auth.uid()
        OR current_role_name() IN ('meat_specialist', 'bread_baker', 'pastry_chef')
      )
    )
  );

-- F-11: Order Visibility Refinements
CREATE OR REPLACE FUNCTION public.order_has_specialist_items(p_order_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items i
    JOIN public.products p ON i.product_id = p.id
    JOIN public.product_categories c ON p.category_id = c.id
    WHERE i.order_id = p_order_id
    AND c.assigned_role = p_role
  );
$$;

DROP POLICY IF EXISTS "specialists_read_relevant_orders" ON public.orders;
CREATE POLICY "specialists_read_relevant_orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    current_role_name() IN ('meat_specialist', 'bread_baker', 'pastry_chef')
    AND status NOT IN ('pending_request', 'cancelled', 'rejected')
    AND public.order_has_specialist_items(id, current_role_name())
  );

DROP POLICY IF EXISTS "courier_read_assigned_orders" ON public.orders;
CREATE POLICY "courier_read_assigned_orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    current_role_name() = 'courier'
    AND status IN ('ready_for_courier', 'in_transit', 'delivered')
    AND assigned_courier = auth.uid()
    AND (
      status != 'delivered'
      OR (delivered_at IS NOT NULL AND delivered_at >= CURRENT_DATE)
    )
  );

-- F-15: Catalog & Config Protection
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutoff_config ENABLE ROW LEVEL SECURITY;

-- Global authenticated read, admin-only write
-- shops
CREATE POLICY "auth_read_shops" ON public.shops FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "admin_all_shops" ON public.shops FOR ALL TO authenticated USING (current_role_name() = 'admin');

-- product_categories
CREATE POLICY "auth_read_categories" ON public.product_categories FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "admin_all_categories" ON public.product_categories FOR ALL TO authenticated USING (current_role_name() = 'admin');

-- modifier_groups
CREATE POLICY "auth_read_modifier_groups" ON public.modifier_groups FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "admin_all_modifier_groups" ON public.modifier_groups FOR ALL TO authenticated USING (current_role_name() = 'admin');

-- modifier_options
CREATE POLICY "auth_read_modifier_options" ON public.modifier_options FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "admin_all_modifier_options" ON public.modifier_options FOR ALL TO authenticated USING (current_role_name() = 'admin');

-- cutoff_config
CREATE POLICY "auth_read_cutoff_config" ON public.cutoff_config FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "admin_all_cutoff_config" ON public.cutoff_config FOR ALL TO authenticated USING (current_role_name() = 'admin');

-- F-17: profiles UPDATE for fcm_token
CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- F-20 / F-22: order_templates missing RLS coverage and updates
CREATE POLICY "shops_update_own_templates" ON public.order_templates
  FOR UPDATE TO authenticated
  USING (
    current_role_name() IN ('foh_manager', 'kitchen_manager')
    AND shop_id = current_shop_id()
  );

CREATE POLICY "admin_read_templates" ON public.order_templates FOR SELECT TO authenticated USING (current_role_name() = 'admin');
CREATE POLICY "admin_read_template_items" ON public.order_template_items FOR SELECT TO authenticated USING (current_role_name() = 'admin');
CREATE POLICY "admin_read_template_modifiers" ON public.order_template_item_modifiers FOR SELECT TO authenticated USING (current_role_name() = 'admin');

-- Storage Policies
-- Create policies on storage.objects for the receipts bucket
CREATE POLICY "shops_read_own_receipts_storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND current_role_name() IN ('foh_manager', 'kitchen_manager')
    AND position('/' || current_shop_id()::text || '/' in name) > 0
  );

CREATE POLICY "admin_read_all_receipts_storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND current_role_name() = 'admin'
  );

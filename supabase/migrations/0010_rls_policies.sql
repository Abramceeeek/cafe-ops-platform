-- 0010_rls_policies.sql — PROJECT_SPEC §6.2
-- Authoritative access control. App-level filtering is a secondary UX layer only.

-- Enable RLS on all protected tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_manifests ENABLE ROW LEVEL SECURITY;

-- Helper: current user's role
CREATE OR REPLACE FUNCTION current_role_name()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper: current user's shop_id
CREATE OR REPLACE FUNCTION current_shop_id()
RETURNS UUID AS $$
  SELECT shop_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ── ORDERS: Shops only see their own orders ─────────────────────────
CREATE POLICY "shops_read_own_orders" ON orders
  FOR SELECT USING (
    current_role_name() IN ('foh_manager', 'kitchen_manager')
    AND shop_id = current_shop_id()
  );

-- ── ORDERS: Specialists see only relevant (non-pending) orders ───────
-- (Category filtering done via order_items JOIN in application queries.)
CREATE POLICY "specialists_read_relevant_orders" ON orders
  FOR SELECT USING (
    current_role_name() IN ('meat_specialist', 'bread_baker', 'pastry_chef')
    AND status NOT IN ('pending_request', 'cancelled', 'rejected')
  );

-- ── ORDERS: Courier sees only packaged/ready/in-transit orders ───────
CREATE POLICY "courier_read_assigned_orders" ON orders
  FOR SELECT USING (
    current_role_name() = 'courier'
    AND status IN ('ready_for_courier', 'in_transit', 'delivered')
  );

-- ── ORDERS: Admin sees everything ────────────────────────────────────
CREATE POLICY "admin_read_all_orders" ON orders
  FOR SELECT USING (current_role_name() = 'admin');

-- ── PRODUCTS: Everyone can read available products ───────────────────
CREATE POLICY "all_read_available_products" ON products
  FOR SELECT USING (is_available = TRUE);

-- ── PRODUCTS: Only Admin can write products ──────────────────────────
CREATE POLICY "admin_write_products" ON products
  FOR ALL USING (current_role_name() = 'admin');

-- ── PRODUCTS: Specialists can toggle their own category's 86 ─────────
CREATE POLICY "specialist_toggle_86" ON products
  FOR UPDATE USING (
    (current_role_name() = 'meat_specialist'
      AND category_id IN (SELECT id FROM product_categories WHERE assigned_role = 'meat_specialist'))
    OR
    (current_role_name() = 'bread_baker'
      AND category_id IN (SELECT id FROM product_categories WHERE assigned_role = 'bread_baker'))
    OR
    (current_role_name() = 'pastry_chef'
      AND category_id IN (SELECT id FROM product_categories WHERE assigned_role = 'pastry_chef'))
  );

-- ── PROFILES: Users see only their own profile; Admin sees all ───────
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "admin_read_all_profiles" ON profiles
  FOR SELECT USING (current_role_name() = 'admin');

-- ── RECEIPTS: Shops see their own; Admin sees all ────────────────────
CREATE POLICY "shops_read_own_receipts" ON receipts
  FOR SELECT USING (
    current_role_name() IN ('foh_manager', 'kitchen_manager')
    AND shop_id = current_shop_id()
  );

CREATE POLICY "admin_read_all_receipts" ON receipts
  FOR SELECT USING (current_role_name() = 'admin');

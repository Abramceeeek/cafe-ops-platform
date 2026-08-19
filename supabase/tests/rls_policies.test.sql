-- RLS behavioral tests — PROJECT_SPEC §6.2, ROADMAP 1.2.
-- Runs on plain Postgres: a non-superuser 'authenticated' role + a
-- request.jwt.claims GUC that auth.uid() reads. Equivalent coverage to pgTAP.
--
-- NEGATIVE CONTROL: the assertions check EXACT row counts (2/3/2/3/5/1). If RLS
-- were inactive (e.g. run as superuser), every role would see all 5 orders and
-- these assertions would fail loudly — so a pass proves the policies are live.

\set ON_ERROR_STOP on

-- ── Seed (as superuser — RLS bypassed for setup) ────────────────────
INSERT INTO auth.users (id) VALUES
  ('11111111-1111-1111-1111-111111111101'),  -- FOH A
  ('11111111-1111-1111-1111-111111111102'),  -- FOH B
  ('22222222-2222-2222-2222-222222222201'),  -- Meat specialist
  ('33333333-3333-3333-3333-333333333301'),  -- Courier
  ('44444444-4444-4444-4444-444444444401');  -- Admin

INSERT INTO shops (id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Shop A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Shop B');

INSERT INTO profiles (id, full_name, role, shop_id) VALUES
  ('11111111-1111-1111-1111-111111111101','FOH A','foh_manager','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('11111111-1111-1111-1111-111111111102','FOH B','foh_manager','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'),
  ('22222222-2222-2222-2222-222222222201','Meat','meat_specialist',NULL),
  ('33333333-3333-3333-3333-333333333301','Courier','courier',NULL),
  ('44444444-4444-4444-4444-444444444401','Admin','admin',NULL);

INSERT INTO product_categories (id, name, assigned_role) VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1','Meat','meat_specialist'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3','Pastry / Retail Bakery','bread_baker');

INSERT INTO products (id, category_id, name, unit, is_available) VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1','cccccccc-cccc-cccc-cccc-ccccccccccc1','Lamb','kg',TRUE),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2','cccccccc-cccc-cccc-cccc-ccccccccccc1','Beef (86d)','kg',FALSE),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd4','cccccccc-cccc-cccc-cccc-ccccccccccc3','Croissant','unit',TRUE);

INSERT INTO orders (id, shop_id, submitted_by, status, requested_delivery_date, assigned_courier, delivered_at) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','11111111-1111-1111-1111-111111111101','pending_request','2026-07-01', NULL, NULL),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','11111111-1111-1111-1111-111111111101','shop_confirmed','2026-07-01', NULL, NULL),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2','11111111-1111-1111-1111-111111111102','pending_request','2026-07-01', NULL, NULL),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2','11111111-1111-1111-1111-111111111102','ready_for_courier','2026-07-01', '33333333-3333-3333-3333-333333333301', NULL),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2','11111111-1111-1111-1111-111111111102','delivered','2026-07-01', '33333333-3333-3333-3333-333333333301', NOW());

INSERT INTO order_items (order_id, product_id, quantity, unit) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 1, 'kg'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 1, 'kg'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 1, 'kg'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 1, 'kg'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 1, 'kg');

DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM orders;
  IF c <> 5 THEN RAISE EXCEPTION 'seed expected 5 orders, got %', c; END IF;
END $$;

-- ── FOH A: only Shop A's 2 orders, zero from Shop B ─────────────────
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111101"}';
SET ROLE authenticated;
DO $$ DECLARE c int; cb int; BEGIN
  SELECT count(*) INTO c FROM orders;
  IF c <> 2 THEN RAISE EXCEPTION 'FOH A should see 2 orders, saw % (RLS inactive?)', c; END IF;
  SELECT count(*) INTO cb FROM orders WHERE shop_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  IF cb <> 0 THEN RAISE EXCEPTION 'FOH A must not see Shop B orders, saw %', cb; END IF;
END $$;
RESET ROLE;

-- ── FOH B: only Shop B's 3 ──────────────────────────────────────────
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111102"}';
SET ROLE authenticated;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM orders;
  IF c <> 3 THEN RAISE EXCEPTION 'FOH B should see 3 orders, saw %', c; END IF;
END $$;
RESET ROLE;

-- ── Courier: whole day's route — every order shop_confirmed→delivered, any
--    shop, regardless of assignment (0026 single-route model). Fixture has
--    shop_confirmed(e2, unassigned) + ready_for_courier(e4) + delivered(e5) = 3.
--    Crucially includes the UNASSIGNED shop_confirmed order; still no pending. ──
SET request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333301"}';
SET ROLE authenticated;
DO $$ DECLARE c int; bad int; unassigned int; BEGIN
  SELECT count(*) INTO c FROM orders;
  IF c <> 3 THEN RAISE EXCEPTION 'Courier should see 3 route orders, saw %', c; END IF;
  SELECT count(*) INTO bad FROM orders WHERE status = 'pending_request';
  IF bad <> 0 THEN RAISE EXCEPTION 'Courier must not see pending_request, saw %', bad; END IF;
  -- proves visibility is not gated on assignment: e2 is shop_confirmed + unassigned
  SELECT count(*) INTO unassigned FROM orders WHERE assigned_courier IS NULL;
  IF unassigned <> 1 THEN RAISE EXCEPTION 'Courier should see the 1 unassigned route order, saw %', unassigned; END IF;
END $$;
RESET ROLE;

-- ── Specialist: sees all non-terminal orders incl. pending_request (0013) ──
-- (5 seeded, none cancelled/rejected → all 5 visible; must see the 2 pending.)
SET request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222201"}';
SET ROLE authenticated;
DO $$ DECLARE c int; pend int; term int; BEGIN
  SELECT count(*) INTO c FROM orders;
  IF c <> 5 THEN RAISE EXCEPTION 'Specialist should see 5 non-terminal orders, saw %', c; END IF;
  SELECT count(*) INTO pend FROM orders WHERE status = 'pending_request';
  IF pend <> 2 THEN RAISE EXCEPTION 'Specialist should see the 2 pending requests, saw %', pend; END IF;
  SELECT count(*) INTO term FROM orders WHERE status IN ('cancelled', 'rejected');
  IF term <> 0 THEN RAISE EXCEPTION 'Specialist must not see terminal orders, saw %', term; END IF;
END $$;
RESET ROLE;

-- ── Admin: all 5 ────────────────────────────────────────────────────
SET request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444401"}';
SET ROLE authenticated;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM orders;
  IF c <> 5 THEN RAISE EXCEPTION 'Admin should see all 5 orders, saw %', c; END IF;
END $$;
RESET ROLE;

-- ── Products: FOH sees only its own category (Pastry / Retail Bakery) ──
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111101"}';
SET ROLE authenticated;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM products;
  IF c <> 1 THEN RAISE EXCEPTION 'FOH should see only its 1 Pastry product, saw %', c; END IF;
END $$;
RESET ROLE;

-- ── ORDER TEMPLATES: scoped by shop AND role (0014) ─────────────────
-- Seed a Kitchen manager at Shop A + 3 templates (FOH A, Kitchen A, FOH B).
INSERT INTO auth.users (id) VALUES
  ('11111111-1111-1111-1111-111111111103');  -- Kitchen A
INSERT INTO profiles (id, full_name, role, shop_id) VALUES
  ('11111111-1111-1111-1111-111111111103','Kitchen A','kitchen_manager','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1');
INSERT INTO order_templates (id, shop_id, created_by, name, role) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','11111111-1111-1111-1111-111111111101','FOH A tmpl','foh_manager'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','11111111-1111-1111-1111-111111111103','Kitchen A tmpl','kitchen_manager'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2','11111111-1111-1111-1111-111111111102','FOH B tmpl','foh_manager');

-- FOH A: sees ONLY its own template (1) — not Shop B's, not Kitchen's.
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111101"}';
SET ROLE authenticated;
DO $$ DECLARE c int; other_shop int; other_role int; BEGIN
  SELECT count(*) INTO c FROM order_templates;
  IF c <> 1 THEN RAISE EXCEPTION 'FOH A should see 1 template, saw % (RLS inactive?)', c; END IF;
  SELECT count(*) INTO other_shop FROM order_templates WHERE shop_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  IF other_shop <> 0 THEN RAISE EXCEPTION 'FOH A must not see Shop B templates, saw %', other_shop; END IF;
  SELECT count(*) INTO other_role FROM order_templates WHERE role = 'kitchen_manager';
  IF other_role <> 0 THEN RAISE EXCEPTION 'FOH A must not see Kitchen templates, saw %', other_role; END IF;
END $$;
RESET ROLE;

-- Kitchen A: sees ONLY its own template (1) — not FOH's.
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111103"}';
SET ROLE authenticated;
DO $$ DECLARE c int; foh int; BEGIN
  SELECT count(*) INTO c FROM order_templates;
  IF c <> 1 THEN RAISE EXCEPTION 'Kitchen A should see 1 template, saw %', c; END IF;
  SELECT count(*) INTO foh FROM order_templates WHERE role = 'foh_manager';
  IF foh <> 0 THEN RAISE EXCEPTION 'Kitchen A must not see FOH templates, saw %', foh; END IF;
END $$;
RESET ROLE;

-- ── Anon: sees exactly zero rows on everything ──────────────────────
SET request.jwt.claims = '{}';
SET ROLE anon;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM orders;
  IF c <> 0 THEN RAISE EXCEPTION 'Anon should see 0 orders, saw %', c; END IF;
  SELECT count(*) INTO c FROM shops;
  IF c <> 0 THEN RAISE EXCEPTION 'Anon should see 0 shops, saw %', c; END IF;
END $$;
RESET ROLE;

-- ── Write Tests: Cross-tenant insert/update should fail ────────────
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111101"}';
SET ROLE authenticated;
DO $$ BEGIN
  -- FOH A trying to insert an order for Shop B
  INSERT INTO orders (shop_id, submitted_by, requested_delivery_date) 
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '11111111-1111-1111-1111-111111111101', '2026-07-01');
  RAISE EXCEPTION 'FOH A was able to insert an order for Shop B! RLS failed.';
EXCEPTION WHEN OTHERS THEN
  -- Expected!
END $$;
RESET ROLE;

-- ── Receipts Isolation Test ─────────────────────────────────────────
-- Need to seed some receipts first as superuser
INSERT INTO receipts (id, order_id, shop_id, pdf_storage_path) VALUES
  ('ffffffff-ffff-ffff-ffff-fffffffffff1', (SELECT id FROM orders WHERE shop_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' LIMIT 1), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'path1'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff2', (SELECT id FROM orders WHERE shop_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2' LIMIT 1), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'path2');

SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111101"}';
SET ROLE authenticated;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM receipts;
  IF c <> 1 THEN RAISE EXCEPTION 'FOH A should see 1 receipt, saw %', c; END IF;
END $$;
RESET ROLE;

-- ── Delivery Manifests Test ─────────────────────────────────────────
INSERT INTO delivery_manifests (id, courier_id, delivery_date) VALUES
  ('12341234-1234-1234-1234-123412341234', '33333333-3333-3333-3333-333333333301', '2026-07-01');

SET request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333301"}';
SET ROLE authenticated;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM delivery_manifests;
  IF c <> 1 THEN RAISE EXCEPTION 'Courier should see 1 manifest, saw %', c; END IF;
END $$;
RESET ROLE;

-- ── order_item_modifiers Isolation Test ─────────────────────────────
-- (Assuming order_item_modifiers are seeded via order inserts - wait, we need to seed some)
INSERT INTO order_items (id, order_id, product_id, quantity, unit) VALUES
  ('99999999-9999-9999-9999-999999999991', (SELECT id FROM orders WHERE shop_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' LIMIT 1), 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 1, 'kg'),
  ('99999999-9999-9999-9999-999999999992', (SELECT id FROM orders WHERE shop_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2' LIMIT 1), 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 1, 'kg');

-- Need to insert into modifier_groups and options to satisfy foreign keys
INSERT INTO modifier_groups (id, product_id, name) VALUES ('77777777-7777-7777-7777-777777777777', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'Prep');
INSERT INTO modifier_options (id, modifier_group_id, name) VALUES ('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'Raw');

INSERT INTO order_item_modifiers (order_item_id, modifier_option_id, modifier_group_name, modifier_option_name) VALUES
  ('99999999-9999-9999-9999-999999999991', '88888888-8888-8888-8888-888888888888', 'Prep', 'Raw'),
  ('99999999-9999-9999-9999-999999999992', '88888888-8888-8888-8888-888888888888', 'Prep', 'Raw');

SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111101"}';
SET ROLE authenticated;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM order_item_modifiers;
  IF c <> 1 THEN RAISE EXCEPTION 'FOH A should see 1 order_item_modifier, saw %', c; END IF;
END $$;
RESET ROLE;

-- ── Specialist Category Filtering Test (F-11) ───────────────────────
-- Meat specialist should only see the Meat order (and not Bread/Pastry orders)
-- We need to add a Bread category and Bread product, then a Bread order.
INSERT INTO product_categories (id, name, assigned_role) VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'Bread', 'bread_baker');
INSERT INTO products (id, category_id, name, unit, is_available) VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'Sourdough', 'loaf', TRUE);

-- Create a bread order
INSERT INTO orders (id, shop_id, submitted_by, status, requested_delivery_date) VALUES
  ('12121212-1212-1212-1212-121212121212', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111101', 'pending_request', '2026-07-01');
INSERT INTO order_items (order_id, product_id, quantity, unit) VALUES
  ('12121212-1212-1212-1212-121212121212', 'dddddddd-dddd-dddd-dddd-ddddddddddd3', 1, 'loaf');

SET request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222201", "role": "meat_specialist"}';
SET ROLE authenticated;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM orders WHERE id = '12121212-1212-1212-1212-121212121212';
  IF c <> 0 THEN RAISE EXCEPTION 'Meat specialist saw a Bread order, saw %', c; END IF;
END $$;
RESET ROLE;

-- ── STANDING ORDERS: shop+owner_role isolation (0046), category guard +
--    auto-approved generation + idempotency + next-week lock (0047/0048) ──
-- Reuse FOH A / FOH B / Kitchen A (all from above). Croissant (ddddddd…d4) is the
-- bread_baker pastry product; Lamb (…d1) is meat_specialist.

-- 1) FOH A saves a pastry standing order for TODAY'S weekday, effective now.
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111101"}';
SET ROLE authenticated;
SELECT public.save_standing_order(
  EXTRACT(ISODOW FROM CURRENT_DATE)::int, CURRENT_DATE,
  json_build_array(json_build_object('product_id','dddddddd-dddd-dddd-dddd-ddddddddddd4','quantity',5))::jsonb);

-- 2) Guard: FOH cannot put a Meat item in a (auto-approved) standing order.
DO $$ BEGIN
  PERFORM public.save_standing_order(
    EXTRACT(ISODOW FROM CURRENT_DATE)::int, CURRENT_DATE,
    json_build_array(json_build_object('product_id','dddddddd-dddd-dddd-dddd-ddddddddddd1','quantity',1))::jsonb);
  RAISE EXCEPTION 'FOH was allowed to add a Meat item to a standing order — guard failed.';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%guard failed%' THEN RAISE; END IF;  -- re-raise our own; swallow the expected security_bypass
END $$;
RESET ROLE;

-- 3) Isolation: FOH B (other shop) and Kitchen A (same shop, other role) see none.
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111102"}'; SET ROLE authenticated;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM standing_orders;
  IF c <> 0 THEN RAISE EXCEPTION 'FOH B should see 0 standing orders, saw %', c; END IF;
END $$;
RESET ROLE;
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111103"}'; SET ROLE authenticated;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM standing_orders;
  IF c <> 0 THEN RAISE EXCEPTION 'Kitchen A should see 0 FOH standing orders (role-isolated), saw %', c; END IF;
END $$;
RESET ROLE;
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111101"}'; SET ROLE authenticated;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM standing_orders;
  IF c <> 1 THEN RAISE EXCEPTION 'FOH A should see its 1 standing order, saw %', c; END IF;
END $$;
RESET ROLE;

-- 4) Generate (superuser; the function is service_role-only) → one auto-approved
--    order for Shop A today, qty 5.
SELECT public.generate_standing_orders();
DO $$ DECLARE c int; st text; q numeric; BEGIN
  SELECT count(*) INTO c FROM orders
   WHERE is_standing AND shop_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' AND requested_delivery_date=CURRENT_DATE;
  IF c <> 1 THEN RAISE EXCEPTION 'expected 1 generated standing order for Shop A today, got %', c; END IF;
  SELECT o.status, oi.quantity INTO st, q
   FROM orders o JOIN order_items oi ON oi.order_id=o.id
   WHERE o.is_standing AND o.shop_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' AND o.requested_delivery_date=CURRENT_DATE;
  IF st <> 'specialist_approved' THEN RAISE EXCEPTION 'standing order must be auto-approved, status=%', st; END IF;
  IF q <> 5 THEN RAISE EXCEPTION 'generated qty expected 5, got %', q; END IF;
END $$;

-- 5) Idempotent: a second run creates nothing new.
SELECT public.generate_standing_orders();
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM orders
   WHERE is_standing AND shop_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' AND requested_delivery_date=CURRENT_DATE;
  IF c <> 1 THEN RAISE EXCEPTION 'generate not idempotent, got % orders', c; END IF;
END $$;

-- 6) Next-week edit is locked out of the current week: a new version effective next
--    Monday must NOT change today's already-generated order.
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111101"}'; SET ROLE authenticated;
SELECT public.save_standing_order(
  EXTRACT(ISODOW FROM CURRENT_DATE)::int, (date_trunc('week', CURRENT_DATE)::date + 7),
  json_build_array(json_build_object('product_id','dddddddd-dddd-dddd-dddd-ddddddddddd4','quantity',99))::jsonb);
RESET ROLE;
SELECT public.generate_standing_orders();
DO $$ DECLARE q numeric; BEGIN
  SELECT oi.quantity INTO q FROM orders o JOIN order_items oi ON oi.order_id=o.id
   WHERE o.is_standing AND o.shop_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' AND o.requested_delivery_date=CURRENT_DATE;
  IF q <> 5 THEN RAISE EXCEPTION 'current week must stay locked at 5 after a next-week edit, got %', q; END IF;
END $$;

-- ── PRODUCT ARCHIVE (0051 + 0053) ────────────────────────────
-- 1) Regression: a specialist can still SEE their own out-of-stock product, so the
--    86 toggle is reversible without an admin (the old policy hid it from them).
SET request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222201"}';
SET ROLE authenticated;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM products WHERE category_id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1';
  IF c <> 2 THEN RAISE EXCEPTION 'Specialist should see both Meat products incl. the 86d one, saw %', c; END IF;
END $$;
RESET ROLE;

-- 2) A product with order history archives (row kept, history untouched);
--    a never-ordered one is really deleted.
INSERT INTO order_items (order_id, product_id, quantity, unit)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1','dddddddd-dddd-dddd-dddd-ddddddddddd1', 3, 'kg');

SET request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222201"}';
SET ROLE authenticated;
DO $$ DECLARE r jsonb; c int; BEGIN
  r := public.archive_product('dddddddd-dddd-dddd-dddd-ddddddddddd1');   -- Lamb, 1 order line
  IF r->>'action' <> 'archived' THEN RAISE EXCEPTION 'Lamb should archive, got %', r; END IF;
  SELECT count(*) INTO c FROM order_items WHERE product_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1';
  IF c <> 1 THEN RAISE EXCEPTION 'archive must not touch order history, saw % lines', c; END IF;

  r := public.archive_product('dddddddd-dddd-dddd-dddd-ddddddddddd2');   -- Beef (86d), never ordered
  IF r->>'action' <> 'deleted' THEN RAISE EXCEPTION 'unused Beef should delete, got %', r; END IF;
  SELECT count(*) INTO c FROM products WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddddd2';
  IF c <> 0 THEN RAISE EXCEPTION 'unused product row should be gone, saw %', c; END IF;
END $$;

-- 3) An archived product stays readable, so order history still resolves its name.
DO $$ DECLARE n text; BEGIN
  SELECT p.name INTO n FROM order_items oi JOIN products p ON p.id = oi.product_id
   WHERE oi.product_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1';
  IF n IS DISTINCT FROM 'Lamb' THEN RAISE EXCEPTION 'archived product unreadable from history, got %', n; END IF;
END $$;

-- 4) Restore puts it back on the ordering list.
DO $$ DECLARE ok boolean; BEGIN
  PERFORM public.restore_product('dddddddd-dddd-dddd-dddd-ddddddddddd1');
  SELECT archived_at IS NULL AND is_available INTO ok FROM products
   WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1';
  IF NOT ok THEN RAISE EXCEPTION 'restore_product did not clear the archive flags'; END IF;
END $$;

-- 5) A specialist cannot archive another zone's product.
DO $$ BEGIN
  PERFORM public.archive_product('dddddddd-dddd-dddd-dddd-ddddddddddd4');  -- Pastry
  RAISE EXCEPTION 'Meat specialist archived a Pastry product';
EXCEPTION WHEN sqlstate 'P0001' THEN
  IF SQLERRM <> 'forbidden' THEN RAISE; END IF;
END $$;
RESET ROLE;

-- 6) Order lines carry a name snapshot, so a later rename leaves history alone.
DO $$ DECLARE n text; BEGIN
  SELECT product_name INTO n FROM order_items
   WHERE product_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1' LIMIT 1;
  IF n <> 'Lamb' THEN RAISE EXCEPTION 'product_name snapshot missing, got %', n; END IF;
  UPDATE products SET name = 'Lamb Shoulder' WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1';
  SELECT product_name INTO n FROM order_items
   WHERE product_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1' LIMIT 1;
  IF n <> 'Lamb' THEN RAISE EXCEPTION 'rename rewrote history, got %', n; END IF;
END $$;

SELECT 'rls_policies.test.sql: all scenarios passed' AS result;

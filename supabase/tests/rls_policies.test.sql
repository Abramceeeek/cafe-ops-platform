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
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1','Meat','meat_specialist');

INSERT INTO products (id, category_id, name, unit, is_available) VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1','cccccccc-cccc-cccc-cccc-ccccccccccc1','Lamb','kg',TRUE),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2','cccccccc-cccc-cccc-cccc-ccccccccccc1','Beef (86d)','kg',FALSE);

INSERT INTO orders (shop_id, submitted_by, status, requested_delivery_date) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','11111111-1111-1111-1111-111111111101','pending_request','2026-07-01'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','11111111-1111-1111-1111-111111111101','shop_confirmed','2026-07-01'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2','11111111-1111-1111-1111-111111111102','pending_request','2026-07-01'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2','11111111-1111-1111-1111-111111111102','ready_for_courier','2026-07-01'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2','11111111-1111-1111-1111-111111111102','delivered','2026-07-01');

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

-- ── Courier: only ready_for_courier/in_transit/delivered (2) ────────
SET request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333301"}';
SET ROLE authenticated;
DO $$ DECLARE c int; bad int; BEGIN
  SELECT count(*) INTO c FROM orders;
  IF c <> 2 THEN RAISE EXCEPTION 'Courier should see 2 orders, saw %', c; END IF;
  SELECT count(*) INTO bad FROM orders WHERE status = 'pending_request';
  IF bad <> 0 THEN RAISE EXCEPTION 'Courier must not see pending_request, saw %', bad; END IF;
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

-- ── Products: FOH sees only the 1 available product (86d one hidden) ─
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111101"}';
SET ROLE authenticated;
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM products;
  IF c <> 1 THEN RAISE EXCEPTION 'FOH should see only 1 available product, saw %', c; END IF;
END $$;
RESET ROLE;

SELECT 'rls_policies.test.sql: all scenarios passed' AS result;

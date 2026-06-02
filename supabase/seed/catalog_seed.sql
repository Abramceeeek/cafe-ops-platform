-- catalog_seed.sql — ROADMAP 1.4 (dev/staging catalog) + cutoff default (§10).
-- No auth dependency, so it applies on bare Postgres and is verified in CI.
-- Idempotent-ish: safe to run on a fresh `supabase db reset`. Ends with
-- assertions so a broken/short seed fails loudly.

-- ── Shops (7) — PROJECT_SPEC C2 ─────────────────────────────────────
INSERT INTO shops (name, address) VALUES
  ('Shop A - Soho',      '1 Soho Sq, London'),
  ('Shop B - Camden',    '2 Camden High St, London'),
  ('Shop C - Shoreditch','3 Old St, London'),
  ('Shop D - Islington', '4 Upper St, London'),
  ('Shop E - Brixton',   '5 Coldharbour Ln, London'),
  ('Shop F - Hackney',   '6 Mare St, London'),
  ('Shop G - Peckham',   '7 Rye Ln, London');

-- ── Categories (4) ──────────────────────────────────────────────────
INSERT INTO product_categories (name, assigned_role, display_order) VALUES
  ('Meat',           'meat_specialist', 1),
  ('Bread',          'bread_baker',     2),
  ('Pastry',         'pastry_chef',     3),
  ('General Pantry', 'admin',           4);

-- ── Products (13: 4 meat, 3 bread, 4 pastry, 2 pantry) ──────────────
INSERT INTO products (category_id, name, unit, lead_time_hours)
SELECT id, p.name, p.unit, p.lead FROM product_categories c
JOIN (VALUES
  ('Meat','Lamb','kg',24),
  ('Meat','Beef','kg',24),
  ('Meat','Chicken','kg',24),
  ('Meat','Pork','kg',24),
  ('Bread','Sourdough Loaf','loaf',48),
  ('Bread','Baguette','loaf',24),
  ('Bread','Ciabatta','loaf',24),
  ('Pastry','Croissant','unit',24),
  ('Pastry','Pain au Chocolat','unit',24),
  ('Pastry','Danish','unit',24),
  ('Pastry','Muffin','unit',24),
  ('General Pantry','Olive Oil','litre',24),
  ('General Pantry','Flour','kg',24)
) AS p(cat, name, unit, lead) ON c.name = p.cat;

-- ── Modifiers (representative: Lamb, Sourdough, Croissant) ──────────
INSERT INTO modifier_groups (product_id, name, is_required, display_order)
SELECT p.id, g.name, g.req, g.ord FROM products p
JOIN (VALUES
  ('Lamb','Cut',TRUE,1),
  ('Lamb','Prep State',TRUE,2),
  ('Sourdough Loaf','Size',TRUE,1),
  ('Sourdough Loaf','Crust',FALSE,2),
  ('Croissant','Size',TRUE,1)
) AS g(prod, name, req, ord) ON p.name = g.prod;

INSERT INTO modifier_options (modifier_group_id, name, display_order)
SELECT mg.id, o.name, o.ord FROM modifier_groups mg
JOIN products p ON p.id = mg.product_id
JOIN (VALUES
  ('Lamb','Cut','Leg',1),       ('Lamb','Cut','Shoulder',2),
  ('Lamb','Cut','Chops',3),     ('Lamb','Cut','Minced',4),
  ('Lamb','Prep State','Raw',1),('Lamb','Prep State','Marinated',2),
  ('Lamb','Prep State','Fully Cooked',3),('Lamb','Prep State','Sous-Vide',4),
  ('Sourdough Loaf','Size','Standard',1),('Sourdough Loaf','Size','Large',2),
  ('Sourdough Loaf','Crust','Soft',1),   ('Sourdough Loaf','Crust','Standard',2),
  ('Sourdough Loaf','Crust','Extra Crispy',3),
  ('Croissant','Size','Mini',1),('Croissant','Size','Standard',2),('Croissant','Size','Large',3)
) AS o(prod, grp, name, ord) ON p.name = o.prod AND mg.name = o.grp;

-- ── Cut-off default (§10.1) ─────────────────────────────────────────
INSERT INTO cutoff_config (cutoff_time, timezone) VALUES ('16:00:00', 'Europe/London');

-- ── Assertions ──────────────────────────────────────────────────────
DO $$
DECLARE n_shops int; n_cats int; n_prod int; n_opt int;
BEGIN
  SELECT count(*) INTO n_shops FROM shops;
  SELECT count(*) INTO n_cats  FROM product_categories;
  SELECT count(*) INTO n_prod  FROM products;
  SELECT count(*) INTO n_opt   FROM modifier_options;
  IF n_shops <> 7  THEN RAISE EXCEPTION 'expected 7 shops, got %', n_shops; END IF;
  IF n_cats  <> 4  THEN RAISE EXCEPTION 'expected 4 categories, got %', n_cats; END IF;
  IF n_prod  < 13  THEN RAISE EXCEPTION 'expected >=13 products, got %', n_prod; END IF;
  IF n_opt   < 16  THEN RAISE EXCEPTION 'expected >=16 modifier options, got %', n_opt; END IF;
END $$;

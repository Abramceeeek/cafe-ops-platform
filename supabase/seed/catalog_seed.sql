-- catalog_seed.sql — real bobo & wild catalog: 7 locations, 3 categories.
-- Live DB is loaded via apps/admin_web/scripts/load-real-catalog.mjs; this file
-- seeds fresh envs and is verified by CI (db-migration-apply). No modifiers —
-- Pickled Goods' optional note uses order_items.custom_note at order time.

-- ── Shops (7 real locations) ────────────────────────────────────────
INSERT INTO shops (name) VALUES
  ('Shoreditch'), ('Clapham'), ('St. Albans'), ('Chigwell'),
  ('Stratford'), ('South Woodford'), ('Wanstead');

-- ── Categories (→ Hub specialist role) ──────────────────────────────
INSERT INTO product_categories (name, assigned_role, display_order) VALUES
  ('Kitchen Bread',          'bread_baker',     1),
  ('Smoked / Meat / Prep',   'meat_specialist', 2),
  ('Pastry / Retail Bakery', 'pastry_chef',     3);

-- ── Products ────────────────────────────────────────────────────────
INSERT INTO products (category_id, name, unit, lead_time_hours)
SELECT c.id, p.name, p.unit, 24
FROM product_categories c
JOIN (VALUES
  ('Kitchen Bread','Sourdough Bread','item'),
  ('Kitchen Bread','Focaccia','item'),
  ('Kitchen Bread','Burger Bun','item'),
  ('Smoked / Meat / Prep','Smoked Lamb','kg'),
  ('Smoked / Meat / Prep','Smoked Brisket','kg'),
  ('Smoked / Meat / Prep','Smoked Chicken','kg'),
  ('Smoked / Meat / Prep','Halal Bacon','kg'),
  ('Smoked / Meat / Prep','Halal Sausage','kg'),
  ('Smoked / Meat / Prep','Pickled Goods','kg'),
  ('Pastry / Retail Bakery','Plain C.Buns','item'),
  ('Pastry / Retail Bakery','Raspberry White Choco','item'),
  ('Pastry / Retail Bakery','Pist. C.Buns','item'),
  ('Pastry / Retail Bakery','Apple C. Buns','item'),
  ('Pastry / Retail Bakery','Alm. Croissant','item'),
  ('Pastry / Retail Bakery','Pistachio Pain au Chocolate','item'),
  ('Pastry / Retail Bakery','Dark Croissants','item'),
  ('Pastry / Retail Bakery','Croissants','item'),
  ('Pastry / Retail Bakery','Pain au Chocolate','item'),
  ('Pastry / Retail Bakery','Pista / Choco Pain au Sussie','item'),
  ('Pastry / Retail Bakery','The Bow (Dulche)','item'),
  ('Pastry / Retail Bakery','Browine','item'),
  ('Pastry / Retail Bakery','Pain au Raisin','item'),
  ('Pastry / Retail Bakery','Apricot & Almond Danish','item'),
  ('Pastry / Retail Bakery','Walnut / Chocolate Cookie','item'),
  ('Pastry / Retail Bakery','Choco Cookies','item'),
  ('Pastry / Retail Bakery','Honey Cake','item'),
  ('Pastry / Retail Bakery','Toffee Cake','item'),
  ('Pastry / Retail Bakery','Snicker Round','item'),
  ('Pastry / Retail Bakery','Apple Tart','item'),
  ('Pastry / Retail Bakery','Ret. Focaccia','item'),
  ('Pastry / Retail Bakery','Ret. Sourd. Bread','item')
) AS p(cat, name, unit) ON c.name = p.cat;

-- ── Cut-off default (§10.1) ─────────────────────────────────────────
INSERT INTO cutoff_config (cutoff_time, timezone) VALUES ('16:00:00', 'Europe/London');

-- ── Assertions ──────────────────────────────────────────────────────
DO $$
DECLARE n_shops int; n_cats int; n_prod int;
BEGIN
  SELECT count(*) INTO n_shops FROM shops;
  SELECT count(*) INTO n_cats  FROM product_categories;
  SELECT count(*) INTO n_prod  FROM products;
  IF n_shops < 7  THEN RAISE EXCEPTION 'expected >=7 shops, got %', n_shops; END IF;
  IF n_cats  <> 3 THEN RAISE EXCEPTION 'expected 3 categories, got %', n_cats; END IF;
  IF n_prod  < 31 THEN RAISE EXCEPTION 'expected >=31 products, got %', n_prod; END IF;
END $$;

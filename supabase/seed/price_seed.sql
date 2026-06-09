-- price_seed.sql — owner-supplied prices, matched to live product names.
-- Editable afterwards by admin and the owning specialist in Catalog. Idempotent
-- (UPDATE by name). 4 list items have no product and are intentionally skipped:
-- Filled Croissants, Banana Bread, Mushroom Danish, Cruffin.
UPDATE public.products SET price = 2.25 WHERE name = 'Plain C.Buns';
UPDATE public.products SET price = 1.40 WHERE name = 'Croissants';
UPDATE public.products SET price = 1.70 WHERE name = 'Pain au Chocolate';
UPDATE public.products SET price = 1.60 WHERE name = 'Walnut / Chocolate Cookie';
UPDATE public.products SET price = 1.60 WHERE name = 'Choco Cookies';
UPDATE public.products SET price = 1.70 WHERE name = 'Pain au Raisin';
UPDATE public.products SET price = 2.70 WHERE name = 'Honey Cake';
UPDATE public.products SET price = 3.00 WHERE name = 'Toffee Cake';
UPDATE public.products SET price = 3.00 WHERE name = 'Snicker Round';
UPDATE public.products SET price = 2.00 WHERE name = 'Ret. Focaccia';
UPDATE public.products SET price = 2.50 WHERE name = 'Ret. Sourd. Bread';
UPDATE public.products SET price = 2.00 WHERE name = 'Alm. Croissant';
UPDATE public.products SET price = 1.40 WHERE name = 'Browine';
UPDATE public.products SET price = 2.00 WHERE name = 'The Bow (Dulche)';
UPDATE public.products SET price = 2.00 WHERE name = 'Pista / Choco Pain au Sussie';
UPDATE public.products SET price = 5.00 WHERE name = 'Sourdough Bread';
UPDATE public.products SET price = 10.00 WHERE name = 'Focaccia';
UPDATE public.products SET price = 2.00 WHERE name = 'Pistachio Pain au Chocolate';

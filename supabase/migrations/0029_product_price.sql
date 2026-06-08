-- 0029_product_price.sql
-- Admin-owned pricing: each product carries a unit price set by admin in the
-- Catalog. On specialist approval the order line's unit_cost is populated from
-- this price (the specialist no longer prices — they only adjust quantities).
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);

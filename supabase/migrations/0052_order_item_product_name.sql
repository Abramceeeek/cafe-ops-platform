-- 0052_order_item_product_name.sql
-- order_items denormalises `unit` at order time but not the product name — every
-- order view joins products(name) live, so renaming a product relabels all of its
-- history (Croissants alone sits on 290 past lines). Snapshot the name on insert.
--
-- A BEFORE INSERT trigger fills it instead of editing each writer, so every path is
-- covered at once: submit_request (0036), submit_request_atomic (0035, the web
-- service-role path), the non-atomic JS fallback in app/actions/orders.ts,
-- generate_standing_orders (0048) and the seed scripts.
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name TEXT;

UPDATE public.order_items oi
   SET product_name = p.name
  FROM public.products p
 WHERE p.id = oi.product_id AND oi.product_name IS NULL;

CREATE OR REPLACE FUNCTION public.fill_order_item_product_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_name IS NULL THEN
    SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_product_name ON public.order_items;
CREATE TRIGGER order_items_product_name
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.fill_order_item_product_name();

-- Left nullable on purpose: SET NOT NULL comes in a later migration once live has
-- run with the trigger and reports zero nulls.

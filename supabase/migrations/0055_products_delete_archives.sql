-- 0055_products_delete_archives.sql
-- Hub builds from before archive_product (0053) still send a plain DELETE FROM
-- products, which fails with 23503 for every product that has ever been ordered —
-- the catalog's Delete works on a just-added item but errors on long-standing ones.
-- Installed apps only learn the RPC with an app update, so the fix lives here.
--
-- A BEFORE DELETE trigger gives every DELETE archive_product's semantics:
--   * standing_order_items / order_template_items lines are removed (they are
--     forward-looking specs, not history);
--   * no order_items reference => the delete proceeds as asked;
--   * otherwise the row is archived and the delete is skipped (RETURN NULL), so the
--     caller gets a clean success instead of a foreign-key error.
-- Row triggers fire only for rows the caller's RLS DELETE policy already allowed, so
-- SECURITY DEFINER here widens nothing about who can remove a product.
CREATE OR REPLACE FUNCTION public.products_delete_archives()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.standing_order_items WHERE product_id = OLD.id;
  DELETE FROM public.order_template_items WHERE product_id = OLD.id;

  IF EXISTS (SELECT 1 FROM public.order_items WHERE product_id = OLD.id) THEN
    UPDATE public.products
       SET archived_at = COALESCE(archived_at, NOW()), is_available = false, updated_at = NOW()
     WHERE id = OLD.id;
    RETURN NULL;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS products_delete_archives ON public.products;
CREATE TRIGGER products_delete_archives
  BEFORE DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_delete_archives();

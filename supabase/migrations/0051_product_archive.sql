-- 0051_product_archive.sql
-- Products that have ever been ordered cannot be deleted: order_items,
-- order_template_items and standing_order_items all reference products(id) with
-- NO ACTION, so the catalog's Delete button fails with 23503 for every long-standing
-- item (only brand-new, never-ordered products delete cleanly). This adds the
-- archive flag those deletes will fall back to (RPC in 0053).
--
-- It also removes the `is_available = TRUE` predicate from the products SELECT
-- policy. That predicate is the cause of two live bugs:
--   1. Once a specialist marks an item out of stock, RLS hides the row from them,
--      so it vanishes from their catalog and the "Restore" button is unreachable —
--      86 is a one-way trip for everyone except admin.
--   2. Order embeds (order_items -> products) return NULL for an 86'd product, so
--      the Hub inbox — which reads the routing role from the first line's
--      products.product_categories.assigned_role — silently drops the whole
--      pending request from the specialist's queue.
-- Archiving would hit (2) at scale, so availability filtering moves to the queries
-- that actually list products for ordering. Role/category scoping is unchanged.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS products_active_idx
  ON public.products (category_id) WHERE archived_at IS NULL;

DROP POLICY IF EXISTS "auth_read_available_products" ON public.products;
-- Stale duplicate from 0021; 0041_drop_dead_products_policy.sql never reached live.
DROP POLICY IF EXISTS "role_based_read_products" ON public.products;

CREATE POLICY "read_products_by_role" ON public.products
  FOR SELECT TO authenticated USING (
    current_role_name() NOT IN ('foh_manager', 'kitchen_manager')
    OR (
      current_role_name() = 'kitchen_manager'
      AND category_id IN (
        SELECT id FROM public.product_categories
        WHERE name IN ('Kitchen Bread', 'Smoked / Meat / Prep')
      )
    )
    OR (
      current_role_name() = 'foh_manager'
      AND category_id IN (
        SELECT id FROM public.product_categories
        WHERE name = 'Pastry / Retail Bakery'
      )
    )
  );

-- Write policies (admin_write_products, specialist_{insert,update,delete}_products
-- from 0030) are unchanged. The specialist UPDATE policy has USING only, which
-- Postgres reuses as WITH CHECK, so moving a product's category_id is only allowed
-- into a category assigned to that same role.

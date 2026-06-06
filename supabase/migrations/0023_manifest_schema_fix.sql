-- 0020_manifest_schema_fix.sql
-- Phase 3: Consolidate backend architecture and fix Courier manifest duplicate stops.

-- 1. Drop the legacy SQL RPC since atomic insertion is now safely handled by Next.js Server Actions.
DROP FUNCTION IF EXISTS public.submit_request_atomic(uuid, uuid, date, jsonb);

-- 2. Fix the manifest_stops schema to group purely by shop_id (1 stop per shop per day).
-- We must remove the `order_id` dependency.
ALTER TABLE public.manifest_stops DROP CONSTRAINT IF EXISTS manifest_stops_order_id_fkey;
ALTER TABLE public.manifest_stops DROP COLUMN IF EXISTS order_id;

-- 3. Add a unique constraint to ensure a manifest never has duplicate stops for the same shop.
ALTER TABLE public.manifest_stops ADD CONSTRAINT manifest_stops_unique_shop UNIQUE (manifest_id, shop_id);

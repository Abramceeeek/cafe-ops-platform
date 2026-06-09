-- orders_notify_webhook.sql  —  MANUAL, deploy-specific. NOT in migrations/ on
-- purpose: it carries a per-deployment URL + secret and depends on the Supabase
-- webhooks engine (supabase_functions.http_request), which bare-Postgres CI and
-- `supabase db push` would choke on. Apply by hand once, after substitution.
--
-- Fires a push whenever an order's status changes — from the web (server
-- actions) OR the mobile apps (RPCs), since both update public.orders. The
-- Supabase Database Webhook POSTs the row (record + old_record) to the Vercel
-- /api/notify-order route, which resolves recipients and sends FCM.
--
-- BEFORE APPLYING, replace:
--   __NOTIFY_URL__     e.g. https://<your-app>.vercel.app/api/notify-order
--   __NOTIFY_SECRET__  the same value set as NOTIFY_SECRET in Vercel env
-- Then run:  node scripts/apply-sql.mjs supabase/manual/orders_notify_webhook.sql
-- (or paste into the Supabase SQL editor). Do NOT commit the substituted file.
--
-- The guard makes this a safe no-op anywhere the webhooks engine is absent.

DO $$
BEGIN
  IF to_regproc('supabase_functions.http_request') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS orders_notify_status_change ON public.orders;
    EXECUTE $ddl$
      CREATE TRIGGER orders_notify_status_change
        AFTER UPDATE OF status ON public.orders
        FOR EACH ROW
        WHEN (old.status IS DISTINCT FROM new.status)
        EXECUTE FUNCTION supabase_functions.http_request(
          '__NOTIFY_URL__',
          'POST',
          '{"Content-Type":"application/json","x-notify-secret":"__NOTIFY_SECRET__"}',
          '{}',
          '5000'
        );
    $ddl$;
    RAISE NOTICE 'orders notify webhook installed.';
  ELSE
    RAISE NOTICE 'supabase_functions.http_request absent — skipped (expected off-Supabase).';
  END IF;
END $$;

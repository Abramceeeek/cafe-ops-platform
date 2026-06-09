-- orders_overdue_cron.sql  —  MANUAL, deploy-specific. NOT in migrations/.
-- Schedules a nightly call to the Vercel /api/notify-overdue route, which pushes
-- a reminder to any specialist whose approved orders (delivery tonight-or-sooner)
-- aren't marked ready yet. Needs pg_cron + pg_net (enable both in the Supabase
-- dashboard → Database → Extensions) plus a per-deploy URL + secret.
--
-- BEFORE APPLYING, replace:
--   __NOTIFY_OVERDUE_URL__   e.g. https://<your-app>.vercel.app/api/notify-overdue
--   __NOTIFY_SECRET__        the same value set as NOTIFY_SECRET in Vercel env
-- Then apply once (Supabase SQL editor or scripts/apply-sql.mjs). Do NOT commit
-- the substituted file. Runs 19:00 UTC daily (≈evening London); adjust as needed.

DO $$
BEGIN
  IF to_regproc('cron.schedule') IS NOT NULL AND to_regproc('net.http_post') IS NOT NULL THEN
    PERFORM cron.unschedule('orders-overdue-reminder')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'orders-overdue-reminder');
    PERFORM cron.schedule(
      'orders-overdue-reminder',
      '0 19 * * *',
      $cron$
        SELECT net.http_post(
          url     := '__NOTIFY_OVERDUE_URL__',
          headers := '{"Content-Type":"application/json","x-notify-secret":"__NOTIFY_SECRET__"}'::jsonb,
          body    := '{}'::jsonb
        );
      $cron$
    );
    RAISE NOTICE 'orders overdue reminder scheduled (19:00 UTC daily).';
  ELSE
    RAISE NOTICE 'pg_cron / pg_net absent — skipped (enable the extensions first).';
  END IF;
END $$;

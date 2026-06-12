-- notify-crons.sql — MANUAL, deploy-specific. NOT in migrations/.
-- Schedules the cut-off reminder (#1) and the pickup reminder (#5) via pg_cron,
-- calling the Vercel routes through pg_net directly (this project has no
-- supabase_functions schema, so net.http_post is used — same as the orders
-- webhook). Needs pg_cron + pg_net enabled (Supabase → Database → Extensions).
--
-- BEFORE APPLYING, replace:
--   __BASE_URL__       e.g. https://<your-app>.vercel.app
--   __NOTIFY_SECRET__  the same value set as NOTIFY_SECRET in Vercel env
-- Times are UTC. The 16:00 London cut-off is ~15:00 UTC (BST) / 16:00 UTC (GMT),
-- so 14:00 UTC fires ~1–2h before. Adjust to taste. Do NOT commit the
-- substituted file.

DO $$
BEGIN
  IF to_regproc('cron.schedule') IS NOT NULL AND to_regproc('net.http_post') IS NOT NULL THEN
    -- #1 Cut-off reminder to shops — 14:00 UTC daily (before the 16:00 London cut-off)
    PERFORM cron.unschedule('cutoff-reminder') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cutoff-reminder');
    PERFORM cron.schedule('cutoff-reminder', '0 14 * * *', $cron$
      SELECT net.http_post(
        url := '__BASE_URL__/api/notify-cutoff',
        headers := '{"Content-Type":"application/json","x-notify-secret":"__NOTIFY_SECRET__"}'::jsonb,
        body := '{}'::jsonb);
    $cron$);

    -- #5 Ready-but-not-picked-up nudge to couriers — 13:00 UTC daily
    PERFORM cron.unschedule('pickup-reminder') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pickup-reminder');
    PERFORM cron.schedule('pickup-reminder', '0 13 * * *', $cron$
      SELECT net.http_post(
        url := '__BASE_URL__/api/notify-pickup',
        headers := '{"Content-Type":"application/json","x-notify-secret":"__NOTIFY_SECRET__"}'::jsonb,
        body := '{}'::jsonb);
    $cron$);

    RAISE NOTICE 'cutoff + pickup reminders scheduled.';
  ELSE
    RAISE NOTICE 'pg_cron / pg_net absent — enable the pg_cron extension first.';
  END IF;
END $$;

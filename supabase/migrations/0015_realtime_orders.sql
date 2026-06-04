-- 0015_realtime_orders.sql — ROADMAP Stage C (in-app notifications).
-- Add orders to the Supabase Realtime publication so the web app receives
-- postgres_changes events (RLS-filtered per role). Guarded: on plain Postgres
-- (CI db-migration-apply) the supabase_realtime publication does not exist, so
-- this is a no-op there; on Supabase it enables the live feed.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;

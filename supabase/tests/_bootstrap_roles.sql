-- Creates the non-superuser 'authenticated' role used to exercise RLS.
-- Run AFTER migrations so the table grants cover every table.
-- (Superusers bypass RLS — tests MUST run as this role or they pass vacuously.)

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

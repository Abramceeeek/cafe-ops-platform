-- 0057_app_versions.sql
-- Server-side "update required" switch for the two Flutter apps. Each build is
-- stamped by CI with APP_CODE_VERSION = the commit count of the commit it was built
-- from, so a store build and a code-push patch of the same commit report the same
-- number. An app whose version is below min_version shows a blocking "Update
-- required" screen linking to ios_url / android_url instead of running stale code
-- against a newer database. min_version 0 = nobody is blocked.
--
-- Readable by anon on purpose: the check runs before sign-in too.
CREATE TABLE IF NOT EXISTS public.app_versions (
  app          TEXT PRIMARY KEY CHECK (app IN ('shop', 'hub')),
  min_version  INT NOT NULL DEFAULT 0,
  ios_url      TEXT,
  android_url  TEXT,
  message      TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_app_versions" ON public.app_versions;
CREATE POLICY "read_app_versions" ON public.app_versions
  FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "admin_write_app_versions" ON public.app_versions;
CREATE POLICY "admin_write_app_versions" ON public.app_versions
  FOR ALL TO authenticated
  USING (current_role_name() = 'admin') WITH CHECK (current_role_name() = 'admin');

INSERT INTO public.app_versions (app, ios_url, android_url) VALUES
  ('shop', 'https://testflight.apple.com/join/Qp356Cpa',
           'https://github.com/Abramceeeek/cafe-ops-platform/releases/latest/download/hubsync-shop.apk'),
  ('hub',  'https://testflight.apple.com/join/6GwBMuKP',
           'https://github.com/Abramceeeek/cafe-ops-platform/releases/latest/download/hubsync-hub.apk')
ON CONFLICT (app) DO NOTHING;

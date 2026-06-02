-- Auth shim for CI Postgres (real Supabase provides these).
-- auth.uid() reads the JWT 'sub' claim from the request.jwt.claims GUC, mirroring
-- Supabase. With no claim set it returns NULL (so migrations still apply cleanly).

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid
$$;

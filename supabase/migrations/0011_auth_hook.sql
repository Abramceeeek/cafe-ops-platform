-- 0011_auth_hook.sql — ROADMAP 1.3
-- Supabase custom_access_token hook: injects role + shop_id into the JWT on every
-- token issuance, so claims are available without a DB round-trip.
-- Enable it in the dashboard: Authentication → Hooks → Custom Access Token →
-- public.custom_access_token_hook (see docs/SUPABASE_SETUP.md).

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  v_role text;
  v_shop uuid;
BEGIN
  SELECT role, shop_id INTO v_role, v_shop
  FROM public.profiles
  WHERE id = (event ->> 'user_id')::uuid;

  claims := COALESCE(event -> 'claims', '{}'::jsonb);
  IF v_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{role}', to_jsonb(v_role));
    claims := jsonb_set(claims, '{shop_id}', COALESCE(to_jsonb(v_shop), 'null'::jsonb));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Only the auth admin runs the hook; keep it off-limits to clients.
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

-- The hook reads profiles (which has RLS enabled) — let the auth admin read it.
GRANT SELECT ON TABLE public.profiles TO supabase_auth_admin;
CREATE POLICY "auth_admin_read_profiles" ON public.profiles
  FOR SELECT TO supabase_auth_admin USING (TRUE);

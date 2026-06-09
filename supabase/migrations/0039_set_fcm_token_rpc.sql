-- 0039_set_fcm_token_rpc.sql
-- Let a signed-in user store their own FCM (push) device token. profiles.fcm_token
-- already exists (0002) but there's no self-update RLS, so the mobile apps call
-- this SECURITY DEFINER RPC after login. Scoped to the caller via auth.uid().
CREATE OR REPLACE FUNCTION public.set_fcm_token(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET fcm_token = p_token WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.set_fcm_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_fcm_token(text) TO authenticated;

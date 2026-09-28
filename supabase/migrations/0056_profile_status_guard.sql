-- 0056_profile_status_guard.sql
-- Between 2026-09-17 and 2026-09-24 every live profile but one — both admins
-- included — was set is_active = false, and nothing recorded who did it.
-- current_role_name() returns NULL for an inactive profile, so RLS silently hid
-- every product and order from the shops ("No products available") while the apps
-- still let people in. Two guards so this can't happen silently again:
--   1. profile_status_log records every is_active / role change: who, when, and
--      through which path (authenticated = a signed-in user, service_role = the
--      admin Users page / server code, anything else = SQL editor or a script).
--   2. The last active admin can't be deactivated or demoted, so there is always
--      someone left who can switch accounts back on from the Users page.
CREATE TABLE IF NOT EXISTS public.profile_status_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id  UUID NOT NULL,
  old_active  BOOLEAN,
  new_active  BOOLEAN,
  old_role    TEXT,
  new_role    TEXT,
  changed_by  UUID,
  via         TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profile_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_profile_status_log" ON public.profile_status_log;
CREATE POLICY "admin_read_profile_status_log" ON public.profile_status_log
  FOR SELECT TO authenticated USING (current_role_name() = 'admin');

CREATE OR REPLACE FUNCTION public.guard_profile_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS NOT DISTINCT FROM OLD.is_active AND NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  IF OLD.role = 'admin' AND OLD.is_active
     AND (NEW.is_active IS NOT TRUE OR NEW.role IS DISTINCT FROM 'admin')
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles WHERE role = 'admin' AND is_active AND id <> OLD.id
     ) THEN
    RAISE EXCEPTION 'last_active_admin'
      USING HINT = 'Activate another admin before deactivating or demoting this one.';
  END IF;

  INSERT INTO public.profile_status_log
    (profile_id, old_active, new_active, old_role, new_role, changed_by, via)
  VALUES (
    OLD.id, OLD.is_active, NEW.is_active, OLD.role, NEW.role, auth.uid(),
    COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', session_user)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_status ON public.profiles;
CREATE TRIGGER profiles_guard_status
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_status();

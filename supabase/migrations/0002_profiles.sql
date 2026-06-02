-- 0002_profiles.sql — PROJECT_SPEC §5.1, §6.1
-- One row per login (19 at v1 launch) across 7 roles. Linked to Supabase Auth.
-- Role is a CHECK-constrained enum here — there is NO separate roles table.

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN (
                'foh_manager',
                'kitchen_manager',
                'meat_specialist',
                'bread_baker',
                'pastry_chef',
                'courier',
                'admin'
              )),
  shop_id     UUID REFERENCES shops(id),  -- NULL for hub roles
  fcm_token   TEXT,                       -- Firebase push token, updated on login
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- shop_id must be populated for shop roles, NULL for hub/admin roles.
ALTER TABLE profiles ADD CONSTRAINT check_shop_role
  CHECK (
    (role IN ('foh_manager', 'kitchen_manager') AND shop_id IS NOT NULL) OR
    (role NOT IN ('foh_manager', 'kitchen_manager') AND shop_id IS NULL)
  );

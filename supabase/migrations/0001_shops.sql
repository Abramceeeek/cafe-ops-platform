-- 0001_shops.sql — PROJECT_SPEC §5.1
-- The 7 satellite café locations. v1 seeds 7 rows; UI hardcodes them, DB scales.

CREATE TABLE shops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                        -- e.g. "Shop C - Camden"
  address     TEXT,
  timezone    TEXT NOT NULL DEFAULT 'Europe/London',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

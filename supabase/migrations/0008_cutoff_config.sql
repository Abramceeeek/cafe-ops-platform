-- 0008_cutoff_config.sql — PROJECT_SPEC §5.1, §10
-- Admin-managed cut-off. Only one row active; app reads the latest record.

CREATE TABLE cutoff_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_time     TIME NOT NULL DEFAULT '16:00:00',   -- 4:00 PM server time
  timezone        TEXT NOT NULL DEFAULT 'Europe/London',
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_by      UUID REFERENCES profiles(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

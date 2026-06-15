-- 0049_cutoff_10am.sql
-- Move the daily cut-off to 10:00 Europe/London. Orders placed BEFORE 10:00 are
-- eligible for next-day delivery; at/after 10:00 the earliest delivery is the day
-- after tomorrow. The app reads the latest cutoff_config row (effective_from <=
-- today), so insert a new effective-today row rather than rewriting history.
INSERT INTO public.cutoff_config (cutoff_time, timezone, effective_from)
VALUES ('10:00:00', 'Europe/London', CURRENT_DATE);

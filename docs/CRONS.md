# Scheduled jobs — owner setup (Roadmap 4.2 + 4.4)

Both crons invoke an Edge Function on a schedule via `pg_cron` + `pg_net`. The
service-role key is **read from Supabase Vault at call time** — it is never written
into a migration or any committed file (the repo is public).

## One-time enable (Supabase SQL editor, as owner)
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store secrets in Vault (run once; values come from Settings → API).
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<service_role_key>', 'service_role_key');
```

## Helper to invoke a function with the Vault secret
```sql
create or replace function call_edge_function(fn text) returns void as $$
declare
  base text; key text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into key  from vault.decrypted_secrets where name = 'service_role_key';
  perform net.http_post(
    url     := base || '/functions/v1/' || fn,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || key),
    body    := '{}'::jsonb
  );
end;
$$ language plpgsql security definer;
```

## Schedules
```sql
-- 4.2 Monthly statement — 00:01 UTC on the 1st of each month.
select cron.schedule('monthly-statement', '1 0 1 * *',
  $$ select call_edge_function('generate-monthly-statement'); $$);

-- 4.4 Cut-off warning — 30 min before the 16:00 Europe/London cut-off.
-- pg_cron is UTC-only: 15:30 London = 14:30 UTC (BST) / 15:30 UTC (GMT).
-- DST caveat: adjust the hour at the clock change, or schedule both and let the
-- function no-op when it isn't the right local time.
select cron.schedule('cutoff-warning', '30 14 * * *',
  $$ select call_edge_function('cutoff-warning-cron'); $$);

-- Standing orders — materialise the current ISO week's recurring orders daily.
-- Pure DB (migration 0048): no Edge Function / Vault needed, call the RPC directly.
-- Idempotent, so the exact time only needs to be early enough that today's order
-- exists before production. 00:05 UTC is safe (well clear of the 16:00 cut-off).
-- The RPC computes "today" + the ISO-week window from CURRENT_DATE (UTC). Keep the
-- schedule early in the UTC day: Europe/London is never behind UTC, so at 00:05 UTC
-- the UTC date already matches the London date. If you ever move this LATER in the
-- UTC day, make the RPC's date timezone-aware first (else a day could be skipped).
select cron.schedule('standing-orders-gen', '5 0 * * *',
  $$ select public.generate_standing_orders(); $$);
```

## Verify (manual trigger, no schedule wait)
```bash
# backdate / force as needed; both functions are side-effect-free to call.
curl -s -X POST "$SUPABASE_URL/functions/v1/cutoff-warning-cron"      -H "Authorization: Bearer $SERVICE_ROLE"   # → { warn_count, warn:[...] }
curl -s -X POST "$SUPABASE_URL/functions/v1/generate-monthly-statement" -H "Authorization: Bearer $SERVICE_ROLE"
```

## Inspect / remove
```sql
select * from cron.job;
select cron.unschedule('cutoff-warning');
```

> **Channel note:** `cutoff-warning-cron` currently returns the target manager list
> and logs it; the actual push is wired in Stage E (FCM, native apps). Until then it
> is a safe no-op nudge generator.

# HubSync — Internal Café Operations Platform

Closed-ecosystem B2B ERP for a 7-Shop café brand and its central Hub.
See [PROJECT_SPEC.md](PROJECT_SPEC.md) (source of truth) and [ROADMAP.md](ROADMAP.md).

## Monorepo layout (PROJECT_SPEC §3.3)

```
apps/
  shop_app/    Flutter — FOH + Kitchen roles
  hub_app/     Flutter — Specialists + Courier roles
  admin_web/   Next.js 14 — Admin only
packages/
  shared_models/      Dart/TS data models (Phase 1)
  shared_constants/   Role/status enums, routes (Phase 1)
supabase/
  migrations/  Numbered SQL migrations (Phase 1)
  functions/   Edge Functions (Deno)
  seed/        Dev/staging seed data (Phase 1)
.github/
  workflows/   CI pipeline
  scripts/     Custom CI guards (bash)
```

> **Status:** Phase 0 scaffold. Apps are minimal placeholders sized to make CI
> runnable. Riverpod/Drift, schema, and real screens land in Phase 1+.

## Run locally

```bash
# Admin web
cd apps/admin_web && npm install && npm run dev

# Flutter apps (requires Flutter SDK on PATH)
cd apps/shop_app && flutter pub get && flutter run
cd apps/hub_app  && flutter pub get && flutter run

# Edge function tests (requires Deno)
deno test supabase/functions/
```

Copy [.env.example](.env.example) to `.env.local` and fill in values — never
commit secrets (PROJECT_SPEC §15.3).

## CI

`.github/workflows/ci.yml` runs on push / PR to `main`, `staging`, `dev`:

| Check | What it does |
|---|---|
| `CI / mobile-apps` | `flutter analyze` + `flutter test` for both Flutter apps |
| `CI / admin-web` | `npm ci` + `npm run lint` + `npm run build` |
| `CI / edge-functions` | `deno test` for Edge Functions |
| `CI / rls-tenant-isolation` | Heuristic scan: Edge Function DB access must reference shop_id/role scoping (PROJECT_SPEC §6.2) |
| `CI / nomenclature-check` | Bans "customer"/"driver" in UI source — enforces Shop/Hub/Courier (§1.1) |
| `CI / db-migration-guard` | Committed migrations are immutable; migrations must be `*.sql` (§5) |
| `CI / banned-deps` | Blocks unapproved state-management / UI-kit packages (§4) |

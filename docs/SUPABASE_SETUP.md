# Supabase Setup — `hubsync-dev` (ROADMAP 0.2)

Do this once to unblock real auth/UI verification and deploys. Repeat per env
(`dev`, `staging`, `prod`) when ready.

## 1. Create the project
1. <https://supabase.com> → **New project** → name `hubsync-dev`, region near London, set a DB password.
2. Note from **Project Settings → API**: the **Project URL**, **anon key**, **service_role key**.
3. Note from **Project Settings → General**: the **Reference ID** (`project-ref`).

## 2. Apply the schema
With the Supabase CLI (`npm i -g supabase` or scoop/brew):
```bash
supabase login                       # opens browser, creates an access token
supabase link --project-ref <dev-ref>
supabase db push                     # applies supabase/migrations/0001..0011
psql "<connection-string>" -f supabase/seed/catalog_seed.sql   # optional dev catalog
```

## 3. Enable the JWT claims hook
Dashboard → **Authentication → Hooks → Custom Access Token** → select
`public.custom_access_token_hook` (created by migration `0011`). This injects
`role` + `shop_id` into every JWT.

## 4. Create the 19 accounts
No public sign-up (C1). Create users via **Authentication → Users → Add user**
(or the admin API), then insert matching `profiles` rows (role + shop_id).
`dev_seed.sql` will automate this once written (needs the auth admin API, not raw SQL).

## 5. Wire CI/CD secrets (GitHub → Settings → Secrets and variables → Actions)
| Secret | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | personal access token from `supabase login` |
| `SUPABASE_PROJECT_REF_STAGING` / `_PROD` | the project Reference ID |

Then merges to `staging` / `main` run `deploy-staging.yml` / `deploy-prod.yml`
(they no-op until these secrets exist). For prod, configure the **production**
GitHub Environment with a required reviewer.

## 6. Web (Vercel) env vars
In the Vercel project (`apps/admin_web`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. See [DEPLOY.md](DEPLOY.md).

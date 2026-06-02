# Deployment Guide

> **Status reality:** the apps are Phase-0 skeletons. Web/staging hosting now is
> fine (de-risks the pipeline). **Do not submit blank apps to public app-store
> review** — it gets rejected. Internal test tracks (Play Internal, TestFlight
> internal) accept skeletons once there are minimal screens.

---

## 1. Web — `apps/admin_web` (Next.js 14) — actionable now

Use **Vercel's native Git integration** (not a GitHub Actions workflow — it's the
standard, zero-config path and gives per-PR preview URLs):

1. Create a free account at <https://vercel.com> and **Add New → Project**, import
   `Abramceeeek/cafe-ops-platform`.
2. **Root Directory:** `apps/admin_web`. Framework preset auto-detects Next.js.
3. **Environment Variables** (add when Supabase exists):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Thereafter: push to a branch → preview deploy; merge to the production
   branch → production deploy.

Alternatives: Cloudflare Pages, Netlify, or self-host (`next build && next start`
behind Node/Docker).

---

## 2. Staging / Prod backend (Supabase) — BLOCKED until projects exist

ROADMAP 0.2 + 0.3. Cannot be built/verified until the three Supabase projects and
their secrets exist (`SUPABASE_*_DEV/STAGING/PROD`).

Once they do, add:

- `deploy-staging.yml` (on merge to `staging`): `supabase db push --linked` +
  `supabase functions deploy`, against `hubsync-staging`.
- `deploy-prod.yml` (on merge to `main`): same against `hubsync-prod`, behind a
  **GitHub Environment with a required-reviewer approval gate**.

Migrations are already validated on every PR by `CI / db-migration-apply`.

---

## 3. Android — `shop_app` / `hub_app` — BLOCKED on platform folders

**Hard blocker (not account-related):** the Flutter apps have no `android/`
folder yet (they were scaffolded as bare packages). `flutter build appbundle`
needs the Gradle project. Generate it first:

```bash
cd apps/shop_app && flutter create --platforms=android,ios .   # then repeat for hub_app
```

Then, to ship to **Play Console → Internal testing**:
1. Play Console account ($25 one-time); decide package ids (`com.hubsync.shop`, `com.hubsync.hub`).
2. Create an upload keystore (`keytool`), store it + passwords as GitHub secrets
   (base64) — never commit the keystore.
3. CI job (ubuntu runner): `flutter build appbundle --release`, sign, upload via
   `r0adkll/upload-google-play`. Or use **Firebase App Distribution** for faster
   internal builds.

---

## 4. iOS — BLOCKED on macOS + Apple account

**iOS cannot be built on this Windows machine at all.** Options:
- a Mac, or GitHub `macos-latest` runners, or
- **Codemagic** — Flutter-focused cloud CI that builds *both* Android and iOS and
  handles signing/TestFlight; likely the simplest cross-platform path.

Requires the Apple Developer Program ($99/yr), certificates + provisioning
profiles, a bundle id, and TestFlight for internal testing. Also run
`flutter create --platforms=ios .` to generate the `ios/` project first.

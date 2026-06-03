# Getting Started — Owner Setup Checklist (free path, ~20 users)

Total cost on this plan: **$0**, except **$99/yr Apple Developer** — needed only to
ship the **iOS** build. Supabase, Vercel, Firebase push, Android delivery, and maps
are all free. No Play Store.

What unblocks the most: **Step 1**. The moment the dev gets the Supabase URL + anon
key, the web app can be wired and verified end-to-end.

---

## ✅ Step 1 — Supabase (do first) · ~15 min · free
1. <https://supabase.com> → sign up → **New project** `hubsync`, region near London, save a strong DB password.
2. **Project Settings → API** → copy **Project URL**, **anon public key**, **service_role key**.
   **Project Settings → General** → copy **Reference ID** (`project-ref`).
3. Apply the database (run from the repo root — no Docker needed):
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push        # applies migrations 0001..0011, records history
   ```
4. (Optional dev catalog) **SQL Editor** → paste `supabase/seed/catalog_seed.sql` → **Run**.
5. **Authentication → Providers** → enable **Email**; turn **off** "Allow new users to sign up" (internal only).
6. **Authentication → Hooks → Custom Access Token** → select `custom_access_token_hook`.

→ **Hand the dev:** Project URL + anon key. Keep service_role secret (goes only into Vercel/GitHub/Edge secrets).

## ✅ Step 2 — Vercel (web dashboard live) · ~10 min · free
1. <https://vercel.com> → sign up with GitHub → **Add New Project** → import `cafe-ops-platform`.
2. **Root Directory:** `apps/admin_web`.
3. **Environment Variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Deploy** → you get a live admin URL.

→ **Hand the dev:** the Vercel URL.

## ✅ Step 3 — Staff logins · ~10 min · free
**Authentication → Users → Add user** (email + password) for each of the ~20 staff.
Send the dev the list of *who → which role → which shop*; you'll get a small SQL
snippet to set their `profiles` rows.

## ⏳ Step 4 — Firebase push (when we reach notifications) · free
Create a Firebase project → add Android + iOS apps → enable **Cloud Messaging** →
download `google-services.json` / `GoogleService-Info.plist` → create a
service-account JSON. Also powers free Android distribution (Step 5).

## ⏳ Step 5 — Android delivery (no Play Store) · free
**Firebase App Distribution**: add testers' emails; CI uploads builds; staff install
via a link. Zero cost.

## ⏳ Step 6 — iOS delivery · $99/yr (the only cost)
Enrol in the **Apple Developer Program**. Build via **Codemagic** (free tier, no Mac)
→ distribute via **TestFlight** (up to 100 internal testers, free). Do only when iOS
is ready to ship.

## Maps — nothing to do
Courier "Start Route" opens Google Maps with all stops pre-loaded — no key, no billing.

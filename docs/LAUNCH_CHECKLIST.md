# Go-Live Checklist — HubSync (web, internal, ~20 users)

Roadmap stage: **Phase 4.5 — UAT + Launch Readiness.** Work top to bottom; nothing
here costs money except the optional backup line. `[you]` = needs the owner;
`[me]` = I can do it; `[verify]` = confirm it's already true.

## 1. Security — do BEFORE real data goes in
- [ ] **Rotate the `service_role` key** — it was shared via `keys.txt`/chat. Supabase → Settings → API → roll it. `[you]`
- [ ] **Rotate the DB password** — also shared. Supabase → Settings → Database. `[you]`
- [ ] Auth → Providers: **"Allow new sign-ups" is OFF** (internal only). `[verify]`
- [ ] Repo has no committed secrets (verified clean; repo is public for free CI — keep `keys.txt` local-only). `[verify]`
- [ ] RLS isolation spot-check on prod: Shop A login cannot see Shop B's orders. `[me+you]`
- [ ] Vercel prod env vars present: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `[verify]`

## 2. Real data — replace the test/seed data
- [x] **Real staff logins created** on `@bobo.wild` (replaced `*.hubsync.test`) via
  `node scripts/rename-accounts.mjs` (idempotent; password from `STAFF_PASSWORD` env).
  18 accounts: `foh.<site>@` + `boh.<site>@` ×7, `pitmaster@`, `baker@`, `courier@`,
  `admin@bobo.wild`. Shared launch password set via `STAFF_PASSWORD` — **rotate after UAT**.
  Test accounts `pastry@hubsync.test` / `jane@example.com` deactivated. `[done]`
- [ ] Shops: keep Shop A–G or load the **real 7 locations** (Shoreditch, Clapham, St. Albans, Chigwell, Stratford, South Woodford, Wanstead). `[decision]`
- [ ] Catalog: keep sample or load the **real bobo & wild catalog** (kitchen bread / smoked-meat / pastry) with lead times + category→specialist. `[decision, me seeds]`
- [ ] Set **unit costs** on products if you want receipt/finance £ totals (blank now → shows "—"). `[decision]`
- [ ] Confirm **cut-off** = 16:00 Europe/London in `cutoff_config`. `[verify]`
- [ ] Delete the stray **"Jane Doe"** test profile. `[me]`

## 3. Functional UAT — run a full working day on prod (each role login)
- [ ] Shop submits a request; a **multi-category cart splits** into one order per specialist.
- [ ] Too-early delivery date is **rejected** (cut-off / lead-time).
- [ ] Specialist **Inbox** shows only their category; **Approve / Reject** work.
- [ ] Shop **Final Confirm** → `shop_confirmed`.
- [ ] Specialist **board**: in-progress → packaged → ready (urgency colors right).
- [ ] Courier **manifest**: Confirm pickup → in-transit; **Start route** opens Google Maps.
- [ ] Shop **Confirm Receipt** → delivered → **receipt PDF** downloads.
- [ ] Admin **Live Ops** shows all shops; **Finance** lists delivered + **monthly statement** generates.
- [ ] **Mobile**: hamburger nav works for every role on a phone.

## 4. Deploy / ops
- [ ] Decide Vercel **production branch**: keep `main` (I promote `dev`→`main`) or switch to `dev` (everything live immediately). `[decision]`
- [ ] Order mutations now run through **Next.js server actions** (`app/actions/orders.ts`:
  `submitOrder`, `updateOrderStatus`) — the `submit-request` / `order-state-change` Edge
  Functions were retired. Edge Functions still deployed: get-server-time, generate-receipt,
  get-receipt, generate-monthly-statement, cutoff-warning-cron. `[verify]`
- [ ] **Apply pending migrations to LIVE** (SQL Editor): `0022_restore_atomic_submit.sql`
  (atomic split-order RPC, locked to service_role) + `0023_drop_dead_products_policy.sql`. `[you]`
- [ ] (Optional, only paid item) **Daily DB backups** — Supabase Pro ~$25/mo; free tier keeps limited backups. `[decision]`
- [ ] Tell staff to **"Add to Home Screen"** for an app-like icon. `[optional]`

## 5. Known limitations to accept before relying on it
- **No push notifications yet** — in-app realtime alerts work while the app is open (bell + toasts); device push (FCM) comes with the native apps.
- **No offline mode** (web needs connectivity).
- **Monthly statement** + **cut-off warning** crons are built but need scheduling — see `docs/CRONS.md` (owner enables `pg_cron`/`pg_net` + Vault). Until then the monthly statement runs from the admin button and the cut-off warning is a no-op.
- **Order templates** are built (Save as Template → Templates → Order Now).
- **Native iOS/Android apps** not built (Stage E; iOS needs Apple Developer $99/yr).

## 6. After UAT
Fix anything found → **go live** for the 20 staff on the web. Then **Stage E**
(native apps) whenever you want them.

# HubSync — Full UAT Script (deployed system, per role)

Walk this top-to-bottom on the **live** web app. Every step is **action → expected**.
Tick each box. If a step fails, note the screen + message and stop that flow.

- **All logins:** password `Bobo&wild2026` (shared launch password — rotate after UAT).
- **Accounts** (18): `foh.<site>@bobo.wild` + `boh.<site>@bobo.wild` for
  `clapham, shoreditch, chigwell, swoodford, stratford, stalbans, wanstead`;
  `pitmaster@bobo.wild` (Meat), `baker@bobo.wild` (Bread + Pastry/Retail),
  `courier@bobo.wild`, `admin@bobo.wild`. (`admin@bobo.wild` is in addition to the owner's
  Gmail admin login.)
- **Roles map:** FOH = front-of-house manager; BOH = kitchen manager; Pitmaster =
  meat_specialist; Baker = bread_baker (handles both Bread and Pastry/Retail).
- **Routing:** BOH Meat → Pitmaster · BOH Bread → Baker · FOH Pastry/Retail → Baker.

> ⚠️ **Pre-req for the atomic-submit check (step 3c):** the owner must apply migrations
> `0022_restore_atomic_submit.sql` + `0023_drop_dead_products_policy.sql` in the Supabase
> SQL Editor. Until then submission still works (safe non-atomic fallback) but is not
> all-or-nothing. See **docs/CRONS.md**-style apply note at the end.

---

## 0. Sign-in & access control
- [ ] Sign in as `foh.clapham@bobo.wild` → lands on the FOH home; nav shows New Request,
      Templates, Orders (no Inbox/Board/Manifest/Admin).
- [ ] Sign out → sign in as `pitmaster@bobo.wild` → nav shows Inbox + To-Do Board (no
      New Request/Admin).
- [ ] Sign in as `admin@bobo.wild` → nav shows Live Ops, Catalog, Finance, Users.
- [ ] Wrong password is rejected; the deactivated `pastry@hubsync.test` / `jane@example.com`
      cannot be used (no longer valid accounts).

## 1. Catalog visibility (role scoping) — automatable via `scripts/uat.mjs`
- [ ] `boh.clapham` New Request → catalog shows **only** *Kitchen Bread* + *Smoked / Meat /
      Prep* (9 products). No pastry.
- [ ] `foh.clapham` New Request → catalog shows **only** *Pastry / Retail Bakery* (22
      products). No bread/meat.
- [ ] Repeat for a second site (e.g. `boh.stratford`, `foh.stratford`) → same scoping.

## 2. Submit a request (single category)
- [ ] As `boh.clapham`, add 2× *Sourdough Bread* → cart shows the line + unit.
- [ ] Pick a delivery date ≥ lead time (≥ tomorrow, after today's 16:00 cut-off it's +1 more
      day) → **Submit** succeeds; toast confirms; order appears under Orders as
      `pending_request`.

## 3. Submit a multi-category cart → split order
- [ ] As `boh.clapham`, add *Sourdough Bread* (Bread) **and** *Smoked Lamb* (Meat) → submit.
- [ ] (3a) Orders list shows **two** orders from one cart — one Bread, one Meat.
- [ ] (3b) The Bread order is visible to **Baker**; the Meat order to **Pitmaster** (verify
      in their Inboxes, step 5).
- [ ] (3c) *After 0022 applied:* if a submit fails mid-way (simulate by an invalid item) it
      creates **zero** orders (all-or-nothing). Before 0022: may create a partial order.

## 4. Cut-off / lead-time gating
- [ ] As `foh.clapham`, try a delivery date of **today** (or too soon) → **rejected** with a
      lead-time / cut-off message; no order created.
- [ ] Submit with an empty cart → blocked ("Cart is empty").

## 5. Two-Way Handshake — specialist approve/reject
- [ ] As `pitmaster@bobo.wild`, open **Inbox** → sees only **Meat** orders (not Bread/Pastry).
- [ ] Approve the Meat order → status → `specialist_approved`; it leaves the pending inbox.
- [ ] As `baker@bobo.wild`, **Inbox** shows **Bread + Pastry/Retail** orders; approve the
      Bread order.
- [ ] Negative: as `pitmaster`, attempt to act on a Bread order or to set `shop_confirmed`
      → **rejected** (not your category / role not permitted).
- [ ] Reject a test order as the specialist → status → `rejected`; submitting shop sees it.

## 6. Shop final confirm
- [ ] As the submitting shop (`boh.clapham`), the approved order shows "needs your action".
- [ ] **Final Confirm** → status → `shop_confirmed`. (This is what releases it to
      production + builds the courier manifest.)

## 7. Production board (specialist)
- [ ] As the owning specialist, advance the order `in_progress` → `packaged` →
      `ready_for_courier`; urgency colours reflect delivery date.
- [ ] Negative: attempt an illegal jump (e.g. `ready_for_courier` → `delivered`) → rejected.

## 8. Courier — Today / Tomorrow per-branch list  *(new)*
- [ ] As `courier@bobo.wild`, open **Manifest** → a **Today / Tomorrow** toggle (with counts).
- [ ] Each tab lists **one card per branch** = "what to bring": product × summed quantity +
      unit, with order count and total units. Quantities match the orders for that day.
- [ ] **Confirm pickup (N)** on a branch → its `ready_for_courier` orders become
      `in_transit`; the count updates.
- [ ] **Start route** opens Google Maps with the day's branch addresses as multi-stop.

## 9. Delivery sign-off & receipt
- [ ] As the receiving shop, **Confirm Receipt** on an in-transit order → status →
      `delivered`. (Only the shop role can trigger this.)
- [ ] A **receipt PDF** is generated and downloadable; receipt lists items/quantities (and
      £ totals only if unit costs are set).

## 10. Admin
- [ ] `admin@bobo.wild` **Live Ops** → sees orders across **all** shops/states.
- [ ] **Catalog** → toggle a product's "86" (unavailable) → shops no longer see it in New
      Request; toggle back.
- [ ] **Finance** → delivered orders listed; **Generate monthly statement** runs and lists
      per-shop totals.
- [ ] **Users** → the 18 accounts listed with correct role + shop; deactivated test accounts
      show inactive.

## 11. Notifications (in-app, while app open)
- [ ] With a specialist logged in, submit a matching order from a shop in another tab → a
      bell badge / toast appears for the specialist.
- [ ] Shop sees a toast when its order is `specialist_approved`; courier on
      `ready_for_courier`.

## 12. Security / RLS negatives (also covered by `scripts/uat.mjs`)
- [ ] `foh.clapham` cannot see another shop's orders (Orders list is Clapham-only).
- [ ] Direct table writes are impossible from the client (enforced by RLS — mutations only
      via the server actions). *Automated: `node scripts/uat.mjs` → 7/7 pass.*
- [ ] `submit_request_atomic` is not callable by a signed-in user.

## 13. Mobile
- [ ] On a phone width, the hamburger drawer opens the role-correct nav for FOH, BOH,
      specialist, courier, and admin; core flows are usable.

---

### Run the automated security harness
```powershell
$env:SUPABASE_URL=...; $env:SUPABASE_ANON_KEY=...; $env:SUPABASE_SERVICE_ROLE_KEY=...
$env:STAFF_PASSWORD='Bobo&wild2026'
node apps/admin_web/scripts/uat.mjs   # expect: 7 passed, 0 failed
```

### Owner: apply pending migrations to LIVE (Supabase → SQL Editor)
Paste and run, in order, the contents of:
1. `supabase/migrations/0022_restore_atomic_submit.sql`
2. `supabase/migrations/0023_drop_dead_products_policy.sql`

Then re-run `scripts/uat.mjs` — the RPC check should now report *permission denied*
(locked to `service_role`) rather than *function not found*.

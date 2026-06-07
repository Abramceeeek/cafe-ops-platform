# Responsive (iPad/tablet) + Deep Next-Steps

## Context
App was built mobile-only: the shell (`apps/admin_web/components/mobile-shell.tsx`) forces `max-w-md` (448px). On an iPad / Android tablet the whole app is a narrow column with ~60% of the screen wasted. Target: responsive **web now**, native **Android later**. Also fixed this round: the New Request page was visually broken.

## Fixed now
**New Request page** was a 3-way bad merge: the other session's filter-chips + `sm:grid-cols-2` "Add" catalog were trapped inside the header's `flex justify-between` (→ squished to a thin column), my row-based catalog rendered a second time, and a stale `lg:sticky` Card wrapped the cart. Rewrote the `return` to one clean flow: header → filter chips → single row catalog (filter-aware) → cart (split-by-category) → dialog (chips + stepper). Verified clean on mobile; lint/build green.

## A. Responsive strategy (the real work)
Single biggest lever = the shell width. Plan:

**R1 — widen the shell (quick win).** `mobile-shell.tsx`: `max-w-md` → `max-w-md md:max-w-3xl lg:max-w-5xl`, keep `mx-auto`; keep the bottom tab bar (correct for touch tablets). Hub **Board** is a wall display → let it go full-width on ≥md.
**R2 — per-screen tablet layouts** (md: breakpoints, only effective once R1 widens the container):
- Request: `md:grid md:grid-cols-[1fr_360px]` — catalog left, **sticky cart right** (the cart was originally designed for this).
- Home / Orders / Templates / Inbox: `md:grid-cols-2` card grids.
- Board: show all 4 columns full-width (drop horizontal scroll ≥lg).
- Manifest: `md:grid-cols-2` stops.
- Admin (live-ops/catalog/finance/users): already browser/sidebar + wide — just verify at tablet.
**R3 — polish:** tap targets ≥44px, type/spacing scale, verify every screen at 375 / 768 / 1024 / 1180.

Decision (recommended, no need to ask): tablet shop/hub nav stays the **bottom tab bar** (touch-first), content widens + goes multi-column. Admin stays sidebar.

## B. Button audit
Primary actions are wired in code: submit, add-to-cart, approve-&-edit, reject, advance, pickup, final confirm, confirm receipt, filter chips, refresh, tab nav, sign out, theme toggle, save/order/delete template. Notification bell = working dropdown. No confirmed dead buttons; no decorative-only fakes found. **Recommend a live click-through per role (mobile + tablet) as R3** — dark Hub screens make `preview_screenshot` glitch, so verify those via DOM.

## C. Missed / risk items from this session
1. **Live DB drift is structural** — CI applies migrations to a throwaway Postgres only; live needs manual `scripts/apply-sql.mjs` + `NOTIFY pgrst,'reload schema'`. Green CI ≠ applied to prod. → adopt Supabase CLI `db push` in deploy, or a hard release checklist.
2. **Two state machines** (`app/actions/orders.ts` + `functions/order-state-change`) kept in sync by hand → drift risk. Long-term: web calls the edge fn (one source).
3. **Flutter submit gap**: `submit_request_atomic` is `service_role`-only → Flutter needs a `submit-order` edge fn (Phase S1 in `FLUTTER_BUILD_PLAN.md`).
4. **FCM push** deferred (Firebase creds + courier-device decision, Spec D1).
5. Courier auto-assign still arbitrary (`limit 1`) — harmless now that route visibility is global (0026), but `assigned_courier` semantics are vague.
6. Demo accounts `foh.demo@` / `baker.demo@` remain (test pollution) — optional cleanup.
7. **No automated web UI/e2e tests** — only RLS + edge deno + migration-apply in CI; UI is manually verified.
8. Design screens not yet built: **order detail / tracking timeline**, specialist **86-toggle**, richer **Account**.

## D. Deepest next steps (priority order)
- **P1 Responsive R1 + R2** (tablet) — the active ask.
- **P2 Live click-through audit**, all roles, mobile + tablet; fix anything broken.
- **P3 Release hygiene** — kill manual-migration drift (CLI in pipeline or checklist) + remove demo accounts.
- **P4 Flutter** per `FLUTTER_BUILD_PLAN.md` (submit edge fn first).
- **P5 Remaining design screens** (tracking, 86 toggle, account).
- **P6 Unify state machine** (web → edge fn).
- **P7 FCM push**.

## Verification per responsive phase
Screenshot request / home / orders / board at 375 / 768 / 1024 / 1180. No wasted space, no overflow, tap targets ≥44px. `lint` + `build` + CI green per PR; each migration applied to live + cache reloaded.

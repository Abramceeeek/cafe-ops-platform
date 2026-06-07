# Flutter Build Plan — Shop App & Hub App

Phased plan to bring the two Flutter apps to feature parity with the web admin app.
Each phase = one PR, CI-checked (`flutter analyze` + `flutter test`), device-tested by you before the next.

## Source of truth & wiring
- **State transitions:** call the `order-state-change` Edge Function (now aligned to the canonical web logic in `apps/admin_web/app/actions/orders.ts`). Flutter cannot call Next.js server actions, so the edge function is the mobile entry point.
- **Order submission:** call the `submit_request_atomic(uuid, uuid, date, jsonb)` RPC (restored in `0022`) — atomic split-by-category insert.
- **Template save:** `save_order_template` RPC (`0025`).
- **Reads:** Supabase client directly; RLS already scopes products/orders per role.
- **Models/constants:** reuse `packages/shared_models` + `packages/shared_constants`.
- **Theme:** Shop App = **light**; Hub App = **dark** (mirror the web's role-based theming).
- **Real-time:** subscribe to `orders` changes for live updates/toasts (mirror `components/mobile-shell.tsx`).

## ⚠️ Backend gaps to close during the build (each flagged in its phase)
1. **`order-state-change` does not accept `item_costs`** → the Specialist *Approve & Quote* can't set per-line `unit_cost` from Flutter. Must extend the edge fn to accept `item_costs` (mirror the web action). **[Phase H1]**
2. **Edge fn side-effects diverge from web** (courier auto-assign + manifest creation timing). Reconcile so mobile + web produce identical manifests. **[Phase H1/H3]**
3. **`submit_request_atomic` must enforce the same rules as the web `submitOrder`** (lead-time, 4 PM cut-off, role/category guard, split). Verify/align before relying on it. **[Phase S1]**
4. **FCM push** — deferred (needs Firebase service creds + courier device-ownership decision, Spec D1). Placeholder stays.

---

## Phase 0 — Foundation ✅ (done)
`core/auth_provider.dart`, `core/router.dart` (role guards), `core/supabase_provider.dart`, `features/auth/login_screen.dart`, `features/dashboard/dashboard_screen.dart`, Riverpod + supabase_flutter + go_router wired.

---

## Shop App (FOH / Kitchen) — light theme

### Phase S1 — Catalog → Cart → Submit  (core, highest value)
Mirrors `app/(app)/request/page.tsx`.
- Catalog list (role-scoped categories/products), product sheet with modifier chips + qty stepper + note.
- Cart with lead-time-aware delivery-date picker + 4 PM cut-off countdown; multi-category split preview.
- Submit → `submit_request_atomic` RPC.
- **Verify:** place an order on device → appears in web Live Ops; gap #3 checked.

### Phase S2 — Orders & Tracking
Mirrors `orders/page.tsx`.
- Order History (filter chips, date groups, status pills).
- Order detail / tracking timeline.
- **Final Confirm** (specialist_approved → shop_confirmed) via edge fn.

### Phase S3 — Templates & Account
- Templates list, Order-Now (`submit_request_atomic`), Save (`save_order_template`).
- Account (identity, role/shop, sign out).

### Phase S4 — Delivery sign-off & polish
- Sign-off with **mandatory per-line checklist** (button disabled until every line ticked) → delivered via edge fn.
- Draft carts (local storage), fat-finger anomaly warning (soft confirm on >Nx usual qty).

---

## Hub App (Specialists + Courier) — dark theme

### Phase H1 — Specialist Inbox + Approve & Quote
Mirrors `inbox/page.tsx`.
- Category-scoped pending inbox, per-line unit-cost entry, quote total.
- Approve (writes `unit_cost` + specialist_approved) / Reject (reason).
- **Closes gap #1 + #2:** extend edge fn for `item_costs` and reconcile courier-assign/manifest side-effects.

### Phase H2 — To-Do Board + 86
Mirrors `board/page.tsx`.
- Production kanban (Confirmed → In production → Packaged → Ready), Advance via edge fn.
- 86 toggle (update `products.is_available`, RLS `specialist_toggle_86`).

### Phase H3 — Courier Manifest
Mirrors `manifest/page.tsx`.
- Route by delivery date with production status per stop, Google-Maps multi-stop link.
- Per-stop hand-off checklist → pickup (in_transit), two-party sign-off (shop confirms `delivered`).
- Courier Account.

---

## Per-phase definition of done
1. `flutter analyze` + `flutter test` green in CI.
2. Builds and runs on a device/emulator (your check).
3. State change verified cross-app (mobile action shows in web Live Ops, and vice-versa).
4. Any backend change (edge fn / RPC) lands as its own migration/function PR and stays in sync with `orders.ts`.

# ROADMAP.md — HubSync Internal Café Operations Platform
**Version:** 2.0  
**Spec Reference:** All tasks reference sections in `PROJECT_SPEC.md`. If a task conflicts with the spec, the spec wins — update the spec first, then the task.  
**Rule:** A task is not "done" until every item in its **Definition of Done** is verifiable. "It works on my machine" is not done.

---

## How to Read This Document

Each task follows this structure:

> **What:** What to build  
> **Notes:** Specific implementation guidance (read the spec section first)  
> **Deliverables:** Exact files, functions, or migrations produced  
> **Definition of Done (DoD):** Verifiable checklist. A PR cannot merge until all items are checked.

**Labels used:**
- `⚠️ BLOCKED` — Cannot start until an external decision is confirmed (see Section 16 of spec)
- `🔗 DEPENDS ON` — Cannot start until another task is done
- `⚡ PARALLEL` — Can be worked in parallel with another task by a second developer
- `🚨 RISK` — Known complexity or ambiguity that needs attention

---

## Phase 0: Repo, Environments & Tooling
**Duration:** Days 1–3 (before any feature work begins)  
**Goal:** Every developer has a working local environment and a functioning CI pipeline before a single feature is written. Skipping this phase causes chaos in every subsequent phase.

---

### 0.1 Monorepo Initialisation

**What:** Create the project repository with the monorepo structure defined in `PROJECT_SPEC.md §3.3`.

**Notes:**
- Use the exact folder structure from the spec: `apps/shop_app`, `apps/hub_app`, `apps/admin_web`, `packages/shared_models`, `packages/shared_constants`, `supabase/`, `docs/`
- Initialise Flutter projects for `shop_app` and `hub_app` with Riverpod 2.x and Drift pre-installed
- Initialise Next.js 14 (App Router) for `admin_web`
- Add `.gitignore` that covers Flutter build artefacts, `.env.local`, `node_modules`, and Supabase local volumes
- Copy `PROJECT_SPEC.md` and `ROADMAP.md` into `docs/`

**Deliverables:**
- `hubsync/` monorepo root with all folders scaffolded
- `README.md` at root with: project overview, how to run each app locally, link to `docs/PROJECT_SPEC.md`
- `.env.example` matching the template in `PROJECT_SPEC.md §17.2`
- `.gitignore` at root

**Definition of Done:**
- [ ] `git clone` + `flutter pub get` in `shop_app` and `hub_app` produces zero errors
- [ ] `npm install` in `admin_web` produces zero errors
- [ ] `.env.local` is listed in `.gitignore` and confirmed absent from the commit history
- [ ] A second developer can follow the README and run the project from scratch in under 15 minutes

---

### 0.2 Three-Environment Supabase Setup

**What:** Provision three isolated Supabase projects: `hubsync-dev`, `hubsync-staging`, `hubsync-prod`.

**Notes:**
- Each environment is a completely separate Supabase project — not the same project with a different schema
- `hubsync-prod` should have daily backups enabled immediately
- Store all three sets of credentials as GitHub Actions secrets now (before you need them), following the naming convention: `SUPABASE_URL_DEV`, `SUPABASE_URL_STAGING`, `SUPABASE_URL_PROD`, etc.
- No developer should have direct write access to `hubsync-prod` — all production changes go through CI/CD only

**Deliverables:**
- Three Supabase projects created
- GitHub Actions secrets populated for all three environments
- `supabase/config.toml` configured for local development

**Definition of Done:**
- [ ] `supabase start` runs locally with zero errors
- [ ] `supabase db reset` applies a blank migration successfully
- [ ] All three project URLs resolve and return a valid health response
- [ ] No raw credentials exist in any committed file

---

### 0.3 CI/CD Pipeline

**What:** Set up GitHub Actions workflows for automated testing and deployment.

**Notes:**
- Three workflows needed:
  1. `pr-checks.yml` — runs on every PR to `dev`: lint, unit tests, Supabase migration dry-run
  2. `deploy-staging.yml` — runs on merge to `staging`: applies migrations to `hubsync-staging`, deploys Edge Functions
  3. `deploy-prod.yml` — runs on merge to `main`: applies migrations to `hubsync-prod`, deploys Edge Functions (requires manual approval gate in GitHub)
- Flutter: use `flutter analyze` and `flutter test` in the PR check
- Next.js: use `npm run build` and `npm test`

**Deliverables:**
- `.github/workflows/pr-checks.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-prod.yml`

**Definition of Done:**
- [ ] Opening a PR against `dev` automatically triggers `pr-checks.yml`
- [ ] A deliberate failing test causes the PR check to fail and block merge
- [ ] Merging to `staging` triggers the staging deploy without manual intervention
- [ ] Merging to `main` triggers the prod deploy but requires a manual approval click

---

### 0.4 External Service Accounts

**What:** Create and configure all third-party service accounts required by the stack.

**Notes:**
- Firebase project: create one project (`hubsync`), enable Cloud Messaging, download the `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) — store in CI secrets, not in the repo
- Google Maps: enable Directions API and Maps SDK for Android/iOS in Google Cloud Console. Create separate API keys for dev and prod with HTTP referrer restrictions
- Confirm the Courier device decision (see `PROJECT_SPEC.md §16, D1`) before configuring FCM — the token architecture differs between personal and company-issued device

**Deliverables:**
- Firebase project created, FCM enabled, service account JSON stored as a GitHub Secret
- Google Maps API keys created (dev + prod), stored as GitHub Secrets
- Confirmation of Courier device decision documented in `PROJECT_SPEC.md §16`

**Definition of Done:**
- [ ] `⚠️ BLOCKED:` Courier device decision confirmed with client
- [ ] A test FCM push notification can be sent to a dev device from the Firebase console
- [ ] Google Maps Directions API returns a valid response for a test request using the dev key
- [ ] Neither service's credentials exist in any committed file

---

### Phase 0 Completion Gate

Do not begin Phase 1 until all of the following are true:
- [ ] Every developer has cloned the repo and run all three apps locally
- [ ] CI/CD pipeline is green on a test PR
- [ ] All external service accounts are configured
- [ ] Courier device decision confirmed (unblocks FCM architecture)

---

## Phase 1: Foundation & Data Layer
**Duration:** Weeks 1–4  
**Goal:** The database, security model, and authentication are complete and locked. All subsequent phases build on top of this layer. Getting this wrong means rebuilding everything.

---

### 1.1 Database Schema & Migrations
🔗 **DEPENDS ON:** 0.2 (Supabase environments)

**What:** Implement the full database schema from `PROJECT_SPEC.md §5.1` as numbered SQL migration files.

**Notes:**
- Migration files go in `supabase/migrations/` with the naming convention `000N_description.sql`
- Write migrations in this order to respect foreign key dependencies:
  1. `0001_shops.sql`
  2. `0002_profiles.sql` (references `auth.users` and `shops`)
  3. `0003_product_catalog.sql` (categories, products, modifier_groups, modifier_options)
  4. `0004_orders.sql` (orders, order_items, order_item_modifiers)
  5. `0005_delivery_manifests.sql`
  6. `0006_receipts.sql` (plus the FK back-fill on `orders.receipt_id`)
  7. `0007_order_templates.sql`
  8. `0008_cutoff_config.sql`
  9. `0009_indexes_and_triggers.sql`
- The `profiles.role` CHECK constraint must enforce the full enum from the spec — do not use a separate `roles` table
- The `check_shop_role` constraint (shop_id required for shop roles, NULL for hub roles) must be included in `0002`

**Deliverables:**
- `supabase/migrations/0001` through `0009` SQL files
- `supabase/seed/dev_seed.sql` — seeds all 7 shops, 19 profiles (with dummy passwords), and a representative product catalog

**Definition of Done:**
- [ ] `supabase db reset` applies all 9 migrations + seed with zero errors
- [ ] `supabase db reset` is idempotent (can be run multiple times without failure)
- [ ] All foreign key constraints are verified via `pg_constraint` query
- [ ] `check_shop_role` constraint rejects an `foh_manager` record with a NULL `shop_id`
- [ ] `check_shop_role` constraint rejects a `meat_specialist` record with a populated `shop_id`
- [ ] Dev seed file populates all 19 user profiles and can be verified by querying `SELECT role, count(*) FROM profiles GROUP BY role`

---

### 1.2 Row-Level Security (RLS) Policies
🔗 **DEPENDS ON:** 1.1  
🚨 **RISK:** This is the most security-critical task in the project. Every policy must be integration-tested. Do not rely on app-layer filtering as a substitute.

**What:** Implement all RLS policies from `PROJECT_SPEC.md §6.2` as a dedicated migration.

**Notes:**
- All policies go in `supabase/migrations/0010_rls_policies.sql`
- Helper functions `current_role_name()` and `current_shop_id()` must be created before the policies that depend on them
- After writing policies, write a companion test file that attempts every prohibited cross-role access scenario and verifies it returns zero rows (not an error)
- Policies for `orders` must be tested with simulated JWTs for all 7 role types

**Deliverables:**
- `supabase/migrations/0010_rls_policies.sql`
- `supabase/tests/rls_policies.test.sql` — pgTAP test file covering all cross-role access scenarios

**Definition of Done:**
- [ ] `foh_manager` for Shop A queries `orders`: receives only Shop A's orders, zero rows from any other shop
- [ ] `meat_specialist` queries `orders`: receives only orders assigned to their category, zero orders for bread or pastry
- [ ] `courier` queries `orders`: receives only orders with status `ready_for_courier`, `in_transit`, or `delivered`
- [ ] `bread_baker` attempts to `UPDATE` a `meat_specialist`'s product: blocked at DB level
- [ ] `admin` queries `orders`: receives all rows across all shops and statuses
- [ ] All 7 cross-role prohibition scenarios have a passing pgTAP test

---

### 1.3 Authentication & Role-Based Routing
🔗 **DEPENDS ON:** 1.1, 1.2  
⚡ **PARALLEL:** Can be developed in parallel with 1.4 once 1.1 and 1.2 are merged

**What:** Configure Supabase Auth, implement custom JWT claims, and build role-based app routing in Flutter and Next.js.

**Notes:**
- Use a Supabase Auth Hook (`custom_access_token` hook) to inject `role` and `shop_id` into the JWT on every login. This makes them available to RLS policies without a DB round-trip
- JWT shape required:
  ```json
  { "role": "foh_manager", "shop_id": "uuid-of-shop", "sub": "user-uuid" }
  ```
- In Flutter: after login, read the JWT claims and route to the correct app shell. `foh_manager` and `kitchen_manager` → Shop App shell. `meat_specialist`, `bread_baker`, `pastry_chef`, `courier` → Hub App shell
- In Next.js Admin: redirect to login if no valid session, redirect to dashboard if `role = admin`, block all other roles
- There is no public sign-up flow. All 19 accounts are created by running `supabase/seed/dev_seed.sql` in dev, and by an Admin-triggered function in prod

**Deliverables:**
- `supabase/migrations/0011_auth_hook.sql` — custom JWT claims hook
- `apps/shop_app/lib/auth/` — login screen + role-based routing logic
- `apps/hub_app/lib/auth/` — login screen + role-based routing logic
- `apps/admin_web/app/auth/` — login page + session guard middleware

**Definition of Done:**
- [ ] Logging in as `foh_manager` (Shop A) on the Shop App routes to the Shop dashboard showing only Shop A data
- [ ] Logging in as `meat_specialist` on the Hub App routes to the Hub Specialist dashboard
- [ ] Logging in as `admin` on Admin Web routes to the admin dashboard
- [ ] A `bread_baker` attempting to load the Shop App is rejected with a clear error screen (wrong app)
- [ ] JWT contains `role` and `shop_id` claims — verified in the Supabase Auth logs
- [ ] An expired JWT triggers automatic token refresh (not a logout)
- [ ] Logging in with an `is_active = FALSE` account returns a user-facing "Account inactive" error

---

### 1.4 Product Catalog — Backend & Admin Seed UI
🔗 **DEPENDS ON:** 1.1, 1.2  
⚡ **PARALLEL:** Can run in parallel with 1.3

**What:** Build the Admin-facing catalog management UI (v0 — functional, not polished) and the 86 toggle at the database level.

**Notes:**
- This is the v0 admin interface for catalog management only — the full Admin Dashboard is Phase 4. Build the minimum needed to populate and manage the catalog
- The UI must support: Create/Edit/Delete for Categories, Products, Modifier Groups, and Modifier Options
- Lead time is set per-product as an integer (hours)
- The "86" toggle updates `products.is_available` — this triggers a Supabase Realtime broadcast automatically (no extra code needed for the broadcast, only for the listener in Phase 2)
- Seed the catalog with at least: 4 Meat products with modifiers, 3 Bread products with modifiers, 4 Pastry products with modifiers, 2 General Pantry items
- Populate `cutoff_config` with the default: 16:00:00, timezone `Europe/London`

**Deliverables:**
- `apps/admin_web/app/catalog/` — catalog CRUD pages
- `supabase/seed/catalog_seed.sql` — representative catalog for dev/staging

**Definition of Done:**
- [ ] Admin can create a new Category and it appears immediately in the list
- [ ] Admin can add a Product under a Category with a lead time, and it appears in the catalog
- [ ] Admin can add Modifier Groups and Options to a Product
- [ ] Admin can toggle `is_available` on a product and the change persists in the DB
- [ ] `catalog_seed.sql` runs without errors and produces at least 13 products with modifiers
- [ ] Attempting to delete a Product that has existing `order_items` is blocked (FK constraint)

---

### 1.5 Hub Specialist UI — The Inbox
🔗 **DEPENDS ON:** 1.3 (auth), 1.4 (catalog must exist)

**What:** Build the Specialist's Inbox screen in the Hub App — the view that shows `pending_request` orders awaiting Approval 1.

**Notes:**
- This screen is built before the Shop App can submit orders (Phase 2), so it will initially be tested with manually-seeded order data
- Realtime: use Supabase's `stream()` builder in Flutter to listen for new `pending_request` orders filtered to the specialist's assigned category. New orders must appear without a pull-to-refresh
- Category filtering: the query must JOIN `order_items` → `products` → `product_categories` and filter by `product_categories.assigned_role = [current user's role]`
- Each order card must show: Shop name, list of items + modifiers + quantities, requested delivery date, time since submitted
- Cards sorted by `requested_delivery_date ASC` (most urgent first)
- "Approve & Quote" and "Reject" actions live on the expanded order detail view — not Phase 1 (those require the state machine Edge Function from 2.3)

**Deliverables:**
- `apps/hub_app/lib/screens/inbox/` — Inbox screen and order card widget
- Unit tests for the category-filter query logic

**Definition of Done:**
- [ ] Seeding a `pending_request` order for a Meat product causes it to appear on the `meat_specialist`'s Inbox within 3 seconds (Realtime)
- [ ] The same order does NOT appear on the `bread_baker`'s Inbox
- [ ] Orders are sorted by delivery date ascending
- [ ] Each card correctly displays shop name, all items with their full modifier chain, and delivery date
- [ ] If there are no pending requests, the screen shows an empty state ("No pending requests — all clear.")
- [ ] Inbox correctly handles a cart containing items from the specialist's category mixed with items from another category — only the relevant items are shown on that specialist's card

---

### Phase 1 Completion Gate

Do not begin Phase 2 until:
- [ ] All 9 schema migrations apply cleanly via CI on a fresh DB
- [ ] All RLS pgTAP tests pass in CI
- [ ] All 19 seed accounts can log in and are routed to the correct app
- [ ] Product catalog contains at least 13 seeded products across all categories
- [ ] Specialist Inbox displays real-time updates in the Hub App

---

## Phase 2: The Shops & The Two-Way Handshake
**Duration:** Weeks 5–8  
**Goal:** Shops can browse the catalog, build a cart with all constraints enforced, submit a Request, and complete the full dual-approval flow. By the end of this phase, a full handshake can be executed end-to-end.

---

### 2.1 Shop App — Catalog Browsing & Cart
🔗 **DEPENDS ON:** 1.3 (auth), 1.4 (catalog data)

**What:** Build the Shop App catalog browsing flow and the shopping cart with offline support.

**Notes:**
- Hierarchy: Category list → Product list → Product detail (modifier selection) → Cart
- All mandatory Modifier Groups must be completed before a product can be added to the cart — the "Add to Cart" button is disabled until all required modifiers are selected
- Offline caching: on app launch and foreground resume, fetch the full catalog and write it to the local Drift DB. When offline, serve from Drift and show a persistent "Offline — read-only mode" banner
- The Realtime listener for the 86 toggle must be active: if a product is 86'd while the user is browsing, it disappears from the catalog and any instance of it in the cart is flagged with a warning
- Custom note field per item: max 200 characters, plain text

**Deliverables:**
- `apps/shop_app/lib/screens/catalog/` — category/product/modifier screens
- `apps/shop_app/lib/screens/cart/` — cart screen
- `apps/shop_app/lib/db/drift_catalog.dart` — Drift schema for offline catalog cache
- Riverpod providers for catalog state and cart state

**Definition of Done:**
- [ ] Shop can browse Category → Product → select all required modifiers → add to cart
- [ ] "Add to Cart" is blocked until all required modifier groups have a selection
- [ ] Adding the same product with different modifiers creates two distinct cart line items
- [ ] Killing the app and relaunching while offline shows the last-fetched catalog from Drift
- [ ] 86ing a product in the Admin UI causes it to disappear from the Shop's catalog within 5 seconds (Realtime)
- [ ] A product in the cart that gets 86'd shows a warning banner on the cart screen
- [ ] Custom note field enforces the 200-character limit client-side

---

### 2.2 Order Constraints & Timing
🔗 **DEPENDS ON:** 2.1 (cart must exist)  
🚨 **RISK:** All time logic must use server time. Any use of `DateTime.now()` in Dart for cut-off/lead-time validation is a bug.

**What:** Implement the 4:00 PM daily cut-off, product lead time enforcement, and the countdown timer UI.

**Notes:**
- Server time sync: on app launch, call an Edge Function that returns the current server timestamp. Calculate the offset vs device clock. All subsequent time calculations use `deviceNow + offset`
- Re-sync server time every 15 minutes in the background
- Countdown timer: persistent banner on the Shop App home screen and cart screen. Format: *"⏳ 2h 15m left for tomorrow's delivery"* or *"🔒 Cut-off passed — next delivery: Wednesday"*
- Date picker in the cart: greyed-out dates must include a tooltip explaining why they're unavailable (e.g., *"Sourdough requires 48h lead time"*)
- The cut-off and lead-time validation is also enforced server-side in the `submit-request` Edge Function (task 2.3) — the client validation is UX only
- See `PROJECT_SPEC.md §10` for the exact lead time algorithm

**Deliverables:**
- `supabase/functions/get-server-time/` — Edge Function returning server UTC + London offset
- `apps/shop_app/lib/services/time_sync_service.dart` — manages server time sync and offset
- `apps/shop_app/lib/widgets/countdown_banner.dart` — persistent countdown widget
- Unit tests for the lead time algorithm covering all boundary conditions

**Definition of Done:**
- [ ] With server time at 3:45 PM, countdown banner shows ~15 minutes remaining
- [ ] With server time at 4:01 PM, "Add to Cart" for items targeting tomorrow is blocked; banner shows next window
- [ ] A sourdough product (48h lead time) with server time at 3:00 PM on Monday cannot be ordered for Tuesday or Wednesday — Thursday is the earliest selectable date
- [ ] Advancing device clock by 2 hours does not bypass the cut-off (server time governs)
- [ ] Date picker greys out lead-time-violated dates and shows an explanatory tooltip on tap
- [ ] Unit tests cover: before cut-off same day, after cut-off same day, exact 48h lead time boundary

---

### 2.3 The Two-Way Handshake — Approval 1 (Specialist Approves)
🔗 **DEPENDS ON:** 2.1, 2.2, 1.5  
🚨 **RISK:** Multi-category carts create multiple orders. The `submit-request` function must handle this atomically — all order records are inserted, or none are (use a Postgres transaction).

**What:** Build the cart submission Edge Function, wire the Specialist's "Approve & Quote" action, and integrate FCM push notifications for Approval 1.

**Notes:**
- Edge Function `submit-request`: receives the cart payload, validates cut-off + lead times server-side, creates `orders` + `order_items` + `order_item_modifiers` records in a single transaction. If the cart spans multiple categories, creates one `orders` record per specialist — see `PROJECT_SPEC.md §8.2` for split-order behaviour
- State machine: `submit-request` sets `status = 'pending_request'`. Status mutations always go through the `order-state-change` Edge Function — never a direct client UPDATE
- Edge Function `order-state-change`: implements the valid transition table from `PROJECT_SPEC.md §7.3`. Validates the caller's role is permitted for this transition. Sets the relevant `*_at` timestamp. Sends FCM notifications (see Section 13 of spec)
- Specialist "Approve & Quote": calls `order-state-change` with `new_status = 'specialist_approved'`. Optionally sets `unit_cost` on each `order_item` before approving
- FCM: on `specialist_approved`, send a push to the originating shop manager's FCM token

**Deliverables:**
- `supabase/functions/submit-request/index.ts`
- `supabase/functions/order-state-change/index.ts`
- `apps/hub_app/lib/screens/inbox/approve_quote_screen.dart` — specialist approval UI
- `apps/shop_app/lib/screens/orders/pending_requests_screen.dart` — shows submitted requests awaiting specialist approval
- FCM integration in both Flutter apps (foreground + background message handling)

**Definition of Done:**
- [ ] Submitting a cart creates the correct number of `orders` records (one per category in cart)
- [ ] A cart submitted after 4:00 PM for tomorrow's delivery is rejected by the Edge Function with a clear error message
- [ ] A cart with a 48h product targeting an invalid date is rejected by the Edge Function
- [ ] Multi-category cart (Meat + Pastry) creates 2 separate orders, each assigned to the correct specialist
- [ ] Meat Specialist's Inbox shows the meat order; Pastry Chef's Inbox shows the pastry order
- [ ] Specialist taps "Approve & Quote" → `status` transitions to `specialist_approved` → Shop Manager receives FCM push
- [ ] Invalid state transition attempt (e.g., `pending_request` → `in_progress`) is rejected by `order-state-change` with a 400 error
- [ ] Push notification arrives on a locked device and on a foreground app

---

### 2.4 The Two-Way Handshake — Approval 2 (Shop Final Confirms)
🔗 **DEPENDS ON:** 2.3

**What:** Build the Shop's Final Confirm UI and the simultaneous routing logic triggered at confirmation.

**Notes:**
- The "Awaiting Confirmation" screen is accessible from a push notification tap and from the order history screen
- Final Confirm calls `order-state-change` with `new_status = 'shop_confirmed'`
- The `order-state-change` function must detect the `shop_confirmed` transition specifically and trigger two simultaneous actions:
  1. The order now appears in the Specialist's To-Do Board (the Specialist's dashboard query filter includes `shop_confirmed` status)
  2. The order is appended to the Courier's active manifest for the `requested_delivery_date`. If no manifest exists for that date, create one
- FCM: on `shop_confirmed`, send push to the assigned Specialist and to the Courier

**Deliverables:**
- `apps/shop_app/lib/screens/orders/awaiting_confirmation_screen.dart` — review + Final Confirm UI
- Updates to `order-state-change` Edge Function for the dual-routing trigger on `shop_confirmed`
- `supabase/migrations/0012_manifest_auto_create.sql` — DB function that upserts a manifest for the delivery date

**Definition of Done:**
- [ ] Shop receives FCM push when Specialist approves → tapping push opens the "Awaiting Confirmation" screen showing the correct order details
- [ ] Shop taps "Final Confirm" → `status` transitions to `shop_confirmed`
- [ ] The order appears immediately in the Specialist's To-Do Board (no refresh required — Realtime)
- [ ] A `delivery_manifests` record exists for the target delivery date, and a `manifest_stops` record links this order to the correct shop
- [ ] If two orders from different shops target the same delivery date, both appear as stops on the same manifest
- [ ] Specialist and Courier both receive FCM push notifications on Final Confirm
- [ ] Attempting to Final Confirm an already-confirmed order returns a clear error

---

### Phase 2 Completion Gate

Do not begin Phase 3 until:
- [ ] A full handshake (submit → Approval 1 → Final Confirm) can be executed end-to-end on staging
- [ ] Multi-category cart split-order behaviour is verified end-to-end
- [ ] All FCM notifications fire correctly for all 4 handshake events
- [ ] Server-side cut-off and lead-time validation is confirmed with a test that manipulates the device clock

---

## Phase 3: Production Tracking & Logistics
**Duration:** Weeks 9–11  
**Goal:** Specialists can track production through to ready-for-delivery. Couriers have an optimized route and can execute digital sign-offs at each Shop.

---

### 3.1 Hub Specialist UI — The To-Do Board
🔗 **DEPENDS ON:** 2.4 (confirmed orders must exist)

**What:** Build the Specialist's production ticket rail and state-update controls.

**Notes:**
- The To-Do Board is a Kanban-style horizontal scroll with 4 columns: `shop_confirmed` | `in_progress` | `packaged` | `ready_for_courier`
- Cards only appear here after `shop_confirmed` — never before (Pending Requests live only in the Inbox)
- Urgency colour coding (required — not optional aesthetic): Red = delivery today, Amber = delivery tomorrow, Green = 2+ days
- State chips on each card: tapping a chip calls `order-state-change` — it does not directly update the DB
- On transition to `ready_for_courier`: FCM sent to Courier
- 86 button: accessible from the To-Do Board via a long-press on any card. Tapping 86 updates `products.is_available = FALSE` and triggers the propagation chain from `PROJECT_SPEC.md §9.3`

**Deliverables:**
- `apps/hub_app/lib/screens/todo_board/` — kanban board screen + card widget
- Unit tests for urgency colour logic (edge case: delivery date is today but order came in at 11:59 PM)

**Definition of Done:**
- [ ] Confirmed orders appear in the `shop_confirmed` column immediately (Realtime — no refresh)
- [ ] Tapping a state chip correctly transitions the order through each stage
- [ ] Cards are colour-coded correctly: today = red, tomorrow = amber, 2+ days = green
- [ ] An order in the `ready_for_courier` column triggers an FCM push to the Courier
- [ ] Long-pressing a card and tapping "86" marks the product unavailable and sends push to all shops
- [ ] The `meat_specialist`'s board never shows Bread or Pastry orders

---

### 3.2 Standard Order Templates
🔗 **DEPENDS ON:** 2.1 (catalog + cart)  
⚡ **PARALLEL:** Can run in parallel with 3.1

**What:** Allow Shop Managers to save, load, and order from pre-built order templates.

**Notes:**
- "Save as Template" button appears on the Cart screen after at least one item is added
- Templates are role-scoped: an `foh_manager`'s templates only contain FOH-relevant products. Attempting to load a template that contains a product now marked `is_available = FALSE` should warn the user and exclude those items
- "Order Now" from a template must still run full cut-off + lead-time validation (same as a manual cart submission). Templates are not a bypass
- Template names are free text, max 50 characters

**Deliverables:**
- `apps/shop_app/lib/screens/templates/` — template list + save/edit screens
- `supabase/functions/submit-from-template/index.ts` — or re-use `submit-request` with a `template_id` flag

**Definition of Done:**
- [ ] Shop Manager saves a cart as a template; it appears in the template list on next app launch
- [ ] "Order Now" on a template submits the request with full server-side validation
- [ ] If a template contains an 86'd product, the user is warned and the 86'd item is excluded from submission
- [ ] Template is role-scoped — Kitchen Manager cannot see FOH Manager's templates and vice versa
- [ ] Deleting a template does not affect any existing orders created from it

---

### 3.3 Courier Manifest & Route Optimisation
🔗 **DEPENDS ON:** 2.4 (manifest is created at shop_confirmed)  
⚠️ **BLOCKED:** Courier device decision must be confirmed (Phase 0, task 0.4) before FCM token architecture is finalised

**What:** Build the Courier's daily manifest view and Google Maps multi-stop route optimisation.

**Notes:**
- The Courier sees only orders with status `ready_for_courier` grouped into the day's manifest
- Route optimisation: call the Google Maps Directions API with all shop addresses as waypoints. Cache the optimized route in `delivery_manifests.route_data` (JSONB) — don't call Maps API on every screen load
- The "Start Route" button opens Google Maps (or Waze) as an external app with the pre-built waypoints URL
- A manifest stop is not considered "deliverable" until its linked order is in `ready_for_courier` status. If some stops are still `packaged`, show them as "Not ready yet" with the Specialist's last status update

**Deliverables:**
- `apps/hub_app/lib/screens/courier/manifest_screen.dart` — today's stops list
- `apps/hub_app/lib/screens/courier/stop_detail_screen.dart` — per-stop item list
- `supabase/functions/build-manifest-route/index.ts` — calls Maps API, saves route to `delivery_manifests.route_data`

**Definition of Done:**
- [ ] Courier app shows today's manifest with all confirmed + ready stops
- [ ] Stops are ordered by the optimized route sequence from Maps API
- [ ] Stops where the linked order is not yet `ready_for_courier` are clearly marked "Not ready"
- [ ] "Start Route" opens the native maps app with all waypoints pre-loaded
- [ ] Maps API is not called if a cached route already exists for today's manifest (check `route_data` is not null)
- [ ] Courier only sees manifests for the current date (not future or past)

---

### 3.4 Digital Delivery Sign-Off
🔗 **DEPENDS ON:** 3.3

**What:** Build the Courier-initiated, Shop-completed delivery sign-off flow.

**Notes:**
- Flow: Courier taps "Confirm Arrival" at a stop → the Shop Manager's app receives a push notification → Shop opens the sign-off screen → Shop verifies items → Shop taps "Confirm Receipt" → status transitions to `delivered`
- The sign-off screen on the Shop App must list every item in the delivery with quantities and modifiers for physical verification
- "Confirm Receipt" calls `order-state-change` with `new_status = 'delivered'`. This is the only role permitted to trigger this transition
- On `delivered`: the receipt generation Edge Function is called asynchronously (fire-and-forget from the transition function)
- If there is a discrepancy (item missing or wrong quantity), Shop Manager taps "Report Issue" — this flags the order for Admin review but still completes the delivery to unblock the Courier

**Deliverables:**
- `apps/hub_app/lib/screens/courier/confirm_arrival_screen.dart` — Courier-side arrival confirmation
- `apps/shop_app/lib/screens/delivery/sign_off_screen.dart` — Shop-side receipt confirmation
- Updates to `order-state-change` to call receipt generation async on `delivered` transition

**Definition of Done:**
- [ ] Courier taps "Confirm Arrival" → Shop Manager receives FCM push within 10 seconds
- [ ] Sign-off screen lists all items, quantities, and modifiers for the delivery
- [ ] Shop taps "Confirm Receipt" → `status` transitions to `delivered`
- [ ] `manifest_stops` record updated with `signed_off_by` and `signed_off_at`
- [ ] The sign-off screen cannot be bypassed — Courier's stop cannot be marked complete without Shop confirmation
- [ ] "Report Issue" path flags the order and notifies Admin but still advances the status to `delivered`

---

### Phase 3 Completion Gate

Do not begin Phase 4 until:
- [ ] A full end-to-end flow (submit → handshake → production → delivery sign-off) runs on staging without intervention
- [ ] Courier manifest correctly aggregates stops from multiple shops
- [ ] Sign-off creates a `delivered` status and fires the receipt trigger

---

## Phase 4: Administration, Accounting & Polish
**Duration:** Weeks 12–14  
**Goal:** Automate all paperwork. Give the business owner a complete top-down view of operations. Deliver the app in a state ready for UAT.

---

### 4.1 Automated PDF Receipt Generation
🔗 **DEPENDS ON:** 3.4 (triggered by `delivered` status)

**What:** Build the `generate-receipt` Edge Function that creates a PDF receipt on every delivery sign-off.

**Notes:**
- Use Puppeteer (running in the Edge Function) to render an HTML template to PDF
- Receipt template fields are specified exactly in `PROJECT_SPEC.md §12.1` — implement all fields. Do not invent new ones without updating the spec
- The function is called asynchronously from `order-state-change` — it must not block the sign-off confirmation
- Storage path: `receipts/{year}/{month}/{shop_id}/{receipt_id}.pdf`
- After generating: insert a `receipts` record, update `orders.receipt_id`, send FCM + email to Admin
- Test with a known input to verify the PDF structure matches the spec template

**Deliverables:**
- `supabase/functions/generate-receipt/index.ts`
- `supabase/functions/generate-receipt/receipt_template.html` — HTML receipt template
- `supabase/migrations/0013_storage_bucket.sql` — creates the `receipts` storage bucket with appropriate access policies (Admin read, Shop read own folder)

**Definition of Done:**
- [ ] Completing a sign-off generates a PDF within 30 seconds (async — not instant)
- [ ] PDF contains all fields from `PROJECT_SPEC.md §12.1` correctly populated
- [ ] PDF is stored at the correct path in Supabase Storage
- [ ] `receipts` record inserted and `orders.receipt_id` updated
- [ ] Shop Manager can open their receipt from the order history screen
- [ ] Admin receives FCM notification with a direct link to the PDF
- [ ] A failed PDF generation (e.g. Puppeteer crash) logs the error and retries once — it does not silently fail

---

### 4.2 Monthly Statement Cron Job
🔗 **DEPENDS ON:** 4.1 (daily receipts must exist)

**What:** Build the Edge Function cron that compiles daily receipts into a per-Shop monthly statement on the 1st of each month.

**Notes:**
- Cron schedule: `0 1 1 * *` (00:01 UTC on the 1st of each month)
- For each active shop: query all `receipts` from the previous calendar month, aggregate totals, render a summary PDF using the same Puppeteer approach as 4.1
- Monthly summary PDF: itemized by week, then by product category, with a grand total
- Store at: `receipts/{year}/{month}/{shop_id}/MONTHLY_SUMMARY.pdf`
- Insert a `receipts` record with `is_monthly_summary = TRUE`
- Test by triggering the function manually with a backdated month — verify correct aggregation

**Deliverables:**
- `supabase/functions/generate-monthly-statement/index.ts`
- `supabase/functions/generate-monthly-statement/monthly_template.html`
- Cron job configured in `supabase/config.toml`

**Definition of Done:**
- [ ] Manually triggering the function for the previous month generates one PDF per active Shop (7 total)
- [ ] Each PDF shows a correct total matching the sum of all `receipts.total_cost` for that shop and month
- [ ] Admin receives FCM notification listing all 7 generated statements
- [ ] Function handles a shop with zero deliveries in a month (generates a zero-total statement, no crash)
- [ ] Cron schedule is verified in the Supabase dashboard

---

### 4.3 Admin Dashboard (Full Build)
🔗 **DEPENDS ON:** All previous phases  
⚡ **PARALLEL:** Admin Web skeleton and routing can begin in Phase 1 alongside 1.4

**What:** Build the complete Admin Web dashboard in Next.js 14 covering all 4 views from `PROJECT_SPEC.md §11.3`.

**Notes:**
- **Live Operations:** Real-time Kanban via Supabase Realtime subscription. Filterable by Shop, Specialist, Status, and Delivery Date. Use React Server Components for the initial load, client components for the live-update layer
- **Catalog Management:** Extend the v0 catalog UI from task 1.4 into a polished, full CRUD experience
- **Financial Reports:** Monthly statement table per shop; individual PDF download links; batch download (ZIP) button for all statements in a month; cost trend chart using Recharts
- **User Management:** List all 19 profiles with role, shop, last login, `is_active` status. Admin can deactivate accounts and trigger a FCM token reset (force logout on all devices)
- All Admin Web pages are server-rendered with session validation in Next.js middleware — no client-side route guards only

**Deliverables:**
- `apps/admin_web/app/operations/` — live operations Kanban
- `apps/admin_web/app/catalog/` — full catalog management (extending v0)
- `apps/admin_web/app/finance/` — financial reporting
- `apps/admin_web/app/users/` — user management

**Definition of Done:**
- [ ] Live Ops page shows all active orders in real-time; filter by Shop narrows to correct orders
- [ ] Catalog CRUD: Admin can add/edit/delete products and their modifier trees
- [ ] Financial page shows monthly statement download links for all shops for the current and last 3 months
- [ ] Batch download produces a ZIP of 7 PDFs without error
- [ ] User Management: deactivating a profile causes that user's next API call to be rejected (JWT invalidated via RLS `is_active` check)
- [ ] All pages return a 302 redirect to login if no valid admin session

---

### 4.4 Cut-off Time Warning Notification (Cron)
🔗 **DEPENDS ON:** Phase 1 (FCM setup from 2.3)  
⚡ **PARALLEL:** Can be built alongside 4.3

**What:** Build a cron Edge Function that fires a 30-minute warning push to Shop Managers who haven't yet placed tomorrow's order.

**Notes:**
- Schedule: fires 30 minutes before the configured `cutoff_config.cutoff_time` (e.g., 15:30 if cut-off is 16:00)
- Targets: all `foh_manager` and `kitchen_manager` profiles where `is_active = TRUE`
- Exclude shops that already have a confirmed order for tomorrow's delivery date (don't spam shops who are already sorted)
- Message: *"⏰ 30 minutes left to place tomorrow's orders. Tap to order now."*

**Deliverables:**
- `supabase/functions/cutoff-warning-cron/index.ts`
- Cron schedule configured in `supabase/config.toml`

**Definition of Done:**
- [ ] Function fires at the correct time relative to `cutoff_config.cutoff_time`
- [ ] Only sends to shops without a confirmed order for tomorrow
- [ ] A shop that has already confirmed an order for tomorrow does not receive the notification
- [ ] Manual trigger for testing works without side effects on production data

---

### 4.5 End-to-End Testing & UAT Preparation
🔗 **DEPENDS ON:** All Phase 4 tasks

**What:** Run a full system test on staging with simulated staff, fix regressions, and prepare TestFlight / Play Console for internal beta distribution.

**Notes:**
- Assign team members specific roles (one person = `foh_manager` Shop C, another = `meat_specialist`, another = `courier`, another = `admin`) and execute a complete working day simulation:
  1. Morning: Shops place orders before 4:00 PM cut-off
  2. Hub: Specialists approve and move to production
  3. Next morning: Courier executes deliveries and sign-offs
  4. End of month: Manually trigger the monthly statement cron and verify all 7 PDFs
- Fix all bugs found. Update `PROJECT_SPEC.md` if any behaviour was implemented differently
- App Store / Play Console: configure TestFlight for iOS internal testing and Google Play internal track for Android. Use staging Supabase credentials for the beta builds

**Deliverables:**
- Bug fixes with regression tests
- TestFlight build (iOS) and Play Console Internal Track build (Android)
- UAT sign-off document signed by the client/business owner

**Definition of Done:**
- [ ] Full simulated working day completes on staging with zero critical errors
- [ ] All 19 roles can log in and complete their respective workflows
- [ ] Monthly statement cron generates correct PDFs for all 7 shops
- [ ] TestFlight build is live and at least 3 internal testers have installed it
- [ ] Play Console Internal Track build is live
- [ ] Client has completed UAT and signed off
- [ ] Zero RLS violations detected in Supabase logs during the simulation

---

### Phase 4 Completion Gate — Launch Readiness Checklist

- [ ] All schema migrations apply cleanly on a fresh `hubsync-prod` DB
- [ ] All 19 prod accounts created (do not use seed file in prod — create via Admin UI)
- [ ] FCM tokens verified for all active mobile devices
- [ ] Google Maps API key rotated to prod key with correct referrer restrictions
- [ ] Supabase Storage bucket policies verified for prod
- [ ] Daily backup confirmed active on `hubsync-prod`
- [ ] CI/CD deploy-prod pipeline tested with a non-breaking migration
- [ ] Client sign-off on UAT

---

## Summary Timeline

| Phase | Duration | Key Milestone |
|---|---|---|
| Phase 0 | Days 1–3 | Repo, CI, environments, external services live |
| Phase 1 | Weeks 1–4 | DB, RLS, auth, catalog, Specialist Inbox functional |
| Phase 2 | Weeks 5–8 | Full Two-Way Handshake executable end-to-end on staging |
| Phase 3 | Weeks 9–11 | Production tracking + delivery sign-off functional |
| Phase 4 | Weeks 12–14 | PDF receipts, Admin dashboard, UAT complete |
| **Launch** | **Week 15** | **Prod deploy, all staff onboarded** |

---

## Decisions Blocking Dev Work

Before any code is written, the following require client confirmation:

| Decision | Blocks | Where |
|---|---|---|
| Courier device type (personal vs company-issued) | FCM token architecture, background GPS | Phase 0 task 0.4 |
| Café brand name for UI | Any screen with brand name | Phase 1 task 1.3 |
| Initial product catalog content | Catalog seed file | Phase 1 task 1.4 |
| Unit pricing per product (for receipts) | Receipt generation | Phase 4 task 4.1 |

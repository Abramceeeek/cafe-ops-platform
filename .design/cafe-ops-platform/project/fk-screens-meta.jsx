/* ════════════════════════════════════════════════════════════════
   Screen registry — the page-by-page map + per-screen handoff notes.
   Drives the left directory rail and the right spec panel.
   Each entry: { id, title, group, roles, sub, purpose, behaviors[],
                 data[], spec } — written for a developer / Claude Code.
   group ∈ Order flow | Manage | Fulfilment | Account
   ════════════════════════════════════════════════════════════════ */

const SCREENS = [
  {
    id: 'home', title: 'Home / Dashboard', group: 'Order flow', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Persistent cut-off countdown, action queue, live orders.',
    purpose: 'Landing screen after login. Surfaces what needs the manager\u2019s attention right now and the time pressure of the daily cut-off.',
    behaviors: [
      'Countdown banner is always visible & persistent; re-syncs to server time, never device clock (§10.2).',
      'When countdown hits 0, "New Request" is disabled for the next valid day and the banner rolls to the following window.',
      'A badge appears on any order needing Shop action — here, the specialist_approved order awaiting Final Confirm.',
      'Multi-category submissions render as one grouped card ("Tuesday Request — 2 Orders", §8.2).',
      'Kitchen persona additionally shows an 86 alert banner when one of its products is out (§9.3).',
    ],
    data: ['orders (status, requested_delivery_date)', 'cutoff_config', 'realtime order-status subscription'],
    spec: '§11.1-A · §10.2 · §8.2',
  },
  {
    id: 'catalog', title: 'Catalog / New Request', group: 'Order flow', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Browse role-scoped categories → products.',
    purpose: 'Entry to building a Request. Categories shown are scoped to the manager\u2019s role.',
    behaviors: [
      'Categories are role-scoped: FOH sees Pastry / Retail Bakery / Cookies & Cakes; Kitchen sees Meat / Bread / General Pantry.',
      '86\u2019d products are visually disabled and cannot be added (§9.3 — normally RLS-hidden; shown struck-through here for the handoff).',
      'Tapping a product opens the modifier sheet. Products are never flat items (§C3).',
      'Running cart count (item count, never cost) is shown; cost is the Specialist\u2019s to set (§11.1-B).',
    ],
    data: ['product_categories', 'products (is_available, lead_time_hours, unit)'],
    spec: '§11.1-B · §9.1 · §C3',
  },
  {
    id: 'product', title: 'Product + Modifier chain', group: 'Order flow', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Required modifier groups gate "Add".',
    purpose: 'Configure a single line: pick every required modifier, set quantity in the product\u2019s unit, add an optional note.',
    behaviors: [
      'Required modifier groups must each have a selection or "Add to request" stays disabled (§11.1-B, §C3).',
      'Quantity stepper shows the product\u2019s unit (kg / tray / loaf / unit).',
      'Custom note capped at 200 chars (§11.1-B).',
      'Modifier chain mirrors modifier_groups → modifier_options (§9.1).',
    ],
    data: ['modifier_groups (is_required)', 'modifier_options', 'order_item draft (quantity, custom_note)'],
    spec: '§9.1 · §11.1-B · §C3',
  },
  {
    id: 'cart', title: 'Cart + Delivery date', group: 'Order flow', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Lead-time-gated date picker; split-order preview.',
    purpose: 'Review the draft, pick a system-valid delivery date, and submit the Request to the Hub.',
    behaviors: [
      'Date picker enforces rules client-side AND server-side: today never selectable, past blocked, non-operational days closed (§10.3).',
      'Any date that fails the lead time of ANY cart item is greyed with a reason (e.g. Sourdough 48h) (§C4, §9.2).',
      'If the cart spans 2 categories it will split into 2 orders, one per specialist — previewed inline (§8.2).',
      'Submit is blocked offline with a tooltip; all validation re-runs server-side on submit (§14, §10).',
    ],
    data: ['order draft → orders + order_items', 'cutoff_config', 'lead-time validation (Edge Function)'],
    spec: '§10.3 · §9.2 · §8.1 · §8.2',
  },
  {
    id: 'submitted', title: 'Request submitted', group: 'Order flow', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Confirmation — status pending_request.',
    purpose: 'Acknowledge submission and set expectations for the first handshake gate.',
    behaviors: [
      'Order(s) created at status pending_request; FCM fires to the assigned specialist(s) (§8.1 step 1, §13).',
      'A 2-category cart shows both child orders here, grouped.',
      'No cost yet — pricing happens at specialist approval.',
    ],
    data: ['orders.status = pending_request', 'assigned_specialist (derived from categories)'],
    spec: '§8.1 · §13',
  },
  {
    id: 'confirm', title: 'Final Confirm (Handshake)', group: 'Order flow', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Approval 2 of the Two-Way Handshake.',
    purpose: 'The Shop\u2019s second approval. Review the Specialist\u2019s confirmation & quoted prices, then lock the order.',
    behaviors: [
      'Reached from the Home action badge after the Specialist taps "Approve & Quote" (status specialist_approved).',
      'Shows priced line items; this is the first time cost appears (Specialist set unit_cost at approval).',
      '"Final Confirm" → status shop_confirmed; simultaneously pushes to the Specialist board AND the Courier manifest (§8.1 step 3).',
      'Orders are immutable after Final Confirm — changes mean a new Request (§C6).',
      '"Cancel" is allowed only at this stage → status cancelled (terminal).',
    ],
    data: ['orders.status: specialist_approved → shop_confirmed', 'order_items.unit_cost', 'manifest append'],
    spec: '§8.1 · §7.2 · §C6',
  },
  {
    id: 'confirmed', title: 'Order confirmed', group: 'Order flow', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Success — order is live.',
    purpose: 'Confirm the handshake is complete and point the manager to tracking.',
    behaviors: [
      'status now shop_confirmed; Specialist & Courier both notified (§13).',
      'Links straight to the order timeline.',
    ],
    data: ['orders.status = shop_confirmed', 'shop_confirmed_at timestamp'],
    spec: '§8.1 · §7.1',
  },
  {
    id: 'templates', title: 'My Templates', group: 'Manage', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Saved carts; one-tap re-order.',
    purpose: 'Re-run a regular shop. Templates are role-scoped to the manager\u2019s catalog.',
    behaviors: [
      '"Order Now" re-runs lead-time + cut-off validation, then submits instantly (§11.1-C).',
      'A template with an invalid item (86\u2019d, or lead-time miss) is flagged before ordering.',
      'Templates only contain items from the role\u2019s catalog (§11.1-C).',
      '"Edit" adds/removes items; "New template from a cart" saves the current draft.',
    ],
    data: ['order_templates (role-scoped)', 'order_template_items + modifiers'],
    spec: '§11.1-C · §5.1',
  },
  {
    id: 'history', title: 'Order History', group: 'Manage', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Colour-coded status list, grouped by date.',
    purpose: 'Browse every Request/Order this manager has placed, with status at a glance.',
    behaviors: [
      'Status badges follow the §11.1-D colour code: yellow / blue / orange / green / red.',
      'Filter chips: All / Active / Delivered / Rejected.',
      'A Shop only ever sees its own orders — RLS enforced at the DB, not just the app (§C8, §C9).',
      'Tap a row → order detail & tracking timeline.',
    ],
    data: ['orders WHERE shop_id = current_shop_id() (RLS)'],
    spec: '§11.1-D · §C8 · §C9',
  },
  {
    id: 'order', title: 'Order detail / Tracking', group: 'Fulfilment', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Timeline of status transitions with timestamps.',
    purpose: 'Follow one order through the lifecycle; see the courier ETA when in transit.',
    behaviors: [
      'Timeline renders each status transition with its server timestamp (§11.1-D, §7).',
      'Live position updates via Realtime while the order is active.',
      'When in_transit, shows courier name, stop position and ETA.',
      'Rejected orders show the Specialist\u2019s rejection reason instead of a timeline (§7.1).',
    ],
    data: ['orders + *_at timestamps', 'manifest_stops (ETA)', 'realtime subscription'],
    spec: '§7.2 · §11.1-D · §13',
  },
  {
    id: 'signoff', title: 'Delivery Sign-off', group: 'Fulfilment', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Verify items, confirm receipt — blocking modal.',
    purpose: 'Two-party delivery close-out. Triggered when the order goes in_transit / courier arrives.',
    behaviors: [
      'Pushed via Realtime when status = in_transit; cannot be dismissed without confirming or flagging (§11.1-E).',
      'Lists every line for the manager to tick off against what arrived.',
      '"Received & Confirmed" → status delivered; receipt PDF auto-generated async (§8.1 step 5, §12.1).',
      '"Flag a discrepancy" opens a sub-form instead of confirming.',
    ],
    data: ['orders.status: in_transit → delivered', 'manifest_stops.signed_off_by / _at', 'receipts (async)'],
    spec: '§11.1-E · §8.1 · §12.1',
  },
  {
    id: 'discrepancy', title: 'Flag a discrepancy', group: 'Fulfilment', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Report short / damaged / wrong items.',
    purpose: 'Capture a delivery problem at sign-off instead of silently confirming.',
    behaviors: [
      'Per-line issue type (Short / Damaged / Wrong item) + free-text note.',
      'Does not block the courier indefinitely — records the exception against the manifest stop.',
      'Admin is notified; the order can still be marked delivered-with-exception.',
    ],
    data: ['manifest_stops (exception note)', 'admin notification (FCM)'],
    spec: '§11.1-E · §13',
  },
  {
    id: 'account', title: 'Account', group: 'Account', roles: ['foh_manager', 'kitchen_manager'],
    sub: 'Profile, shop, role, offline state.',
    purpose: 'Identity & app status. Internal staff only — accounts are issued by Admin (§C1).',
    behaviors: [
      'Shows the bound shop & role; both are fixed by the profile (§5.1 constraint).',
      'Offline indicator: when offline the app is read-only — Submit & Confirm disable (§14).',
      'No public sign-up; sign-out returns to the issued-account login (§C1).',
    ],
    data: ['profiles (full_name, role, shop_id)', 'connectivity state'],
    spec: '§C1 · §14 · §5.1',
  },
];

window.SCREENS = SCREENS;

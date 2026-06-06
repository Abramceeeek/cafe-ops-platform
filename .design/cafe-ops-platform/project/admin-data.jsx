/* ════════════════════════════════════════════════════════════════
   Admin Web (Next.js, light browser) — screen registry.
   Single persona: Rana A., Brand Owner. Sees everything (§6, §11.3).
   ════════════════════════════════════════════════════════════════ */

const ADMIN_FRAME = (path) => ({ w: 1180, h: 752, url: 'hubsync.app/' + path });

const ADMIN_META = [
  { id: 'ops', title: 'Live Operations', group: 'Operations', kind: 'browser', frame: ADMIN_FRAME('ops'), root: true,
    sub: 'Real-time kanban across all shops.',
    purpose: 'The brand owner\u2019s command center. A live board of every active order across all 7 shops and all specialists, with at-a-glance counts.',
    behaviors: [
      'Real-time kanban of all active orders, all shops, all specialists (§11.3-A).',
      'Filterable by Shop, Specialist, Status, Delivery Date.',
      'Admin sees everything — RLS grants the admin role full read (§6).',
      'Click any card to open the full order detail.',
      'Updates stream in via Supabase Realtime.',
    ],
    data: ['orders (all shops) + order_items', 'realtime subscription', 'aggregate status counts'],
    spec: '§11.3-A · §6' },
  { id: 'order', title: 'Order detail', group: 'Operations', kind: 'browser', frame: ADMIN_FRAME('ops/order'),
    sub: 'Full drill-through on one order.',
    purpose: 'Everything about a single order: lifecycle timeline, priced lines, the two-party handshake trail, and the courier/specialist assigned.',
    behaviors: [
      'Opened from any kanban card (§11.3-A).',
      'Shows the full status history with server timestamps (§7).',
      'Surfaces the handshake actors: who submitted, who approved/priced, who is delivering.',
      'Read-only for Admin in v1 — Admin observes, the apps act.',
    ],
    data: ['orders + *_at timestamps', 'order_items.unit_cost', 'profiles (submitted_by, assigned_specialist, assigned_courier)'],
    spec: '§7 · §8 · §11.3-A' },
  { id: 'catalog', title: 'Catalog Management', group: 'Manage', kind: 'browser', frame: ADMIN_FRAME('catalog'), root: true,
    sub: 'CRUD products, lead times, 86 status.',
    purpose: 'Authoritative control of the product catalog — categories, products, modifier groups & options, lead times, and availability.',
    behaviors: [
      'Full CRUD on Categories, Products, Modifier Groups, Modifier Options (§11.3-B).',
      'Set lead_time_hours and activate/deactivate products — only Admin can write products (§6).',
      'View all current "86" items with the time they went out (§11.3-B, §9.3).',
      'Products are never flat — every product carries a modifier chain (§C3).',
    ],
    data: ['product_categories · products · modifier_groups · modifier_options', 'products.is_available + lead_time_hours'],
    spec: '§11.3-B · §9 · §6' },
  { id: 'finance', title: 'Financial Reports', group: 'Manage', kind: 'browser', frame: ADMIN_FRAME('finance'), root: true,
    sub: 'Per-shop monthly transfers + receipts.',
    purpose: 'Money view. Per-shop monthly summaries built from delivery receipts, with trends and downloadable PDFs.',
    behaviors: [
      'Per-shop monthly summary table; download individual or batch receipt PDFs (§11.3-C).',
      'Cost trend charts; export to CSV.',
      'Figures are internal transfer records, not VAT invoices (§12.1).',
      'Receipts are generated automatically on delivery and aggregated monthly by cron (§12).',
    ],
    data: ['receipts (period_month/year, total_cost)', 'monthly aggregation (Edge Function cron)', 'orders.unit_cost rollups'],
    spec: '§11.3-C · §12' },
  { id: 'users', title: 'User Management', group: 'Manage', kind: 'browser', frame: ADMIN_FRAME('users'), root: true,
    sub: '19 profiles · roles · last login.',
    purpose: 'Operate the closed roster. View all profiles, their roles & locations, activate/deactivate accounts, reset push tokens.',
    behaviors: [
      'View all 19 profiles, roles, and last-login timestamps (§11.3-D).',
      'Activate / deactivate accounts; reset FCM tokens.',
      'Internal staff only — no public sign-up; Admin issues every account (§C1).',
      'Roles are fixed: 6 role types across 7 shops + the Hub (§5.1, §C2).',
    ],
    data: ['profiles (role, shop_id, fcm_token, is_active, last login)'],
    spec: '§11.3-D · §C1 · §5.1' },
];

window.ADMIN_META = ADMIN_META;

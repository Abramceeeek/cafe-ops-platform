/* ════════════════════════════════════════════════════════════════
   HubSync · Shop App data model — FOH + Kitchen Managers ONLY
   This mirrors the PROJECT_SPEC schema (§5) closely enough that a
   developer (or Claude Code) can read real shapes off the screens.
   All exported on window.DATA.
   ════════════════════════════════════════════════════════════════ */

/* ── Simulated server clock (spec §10: server time is authoritative) ──
   Frozen at Tue 3 Jun 2026, 14:13 London. Cut-off is 16:00 →
   ~1h 47m left to place TOMORROW's (Wed 4 Jun) orders. */
const SERVER_NOW = new Date('2026-06-03T14:13:00');
const CUTOFF_HOUR = 16; // 4:00 PM, from cutoff_config

/* ── Shops (spec §5.1 — seed 7, UI hardcodes). FOH+Kitchen live at one. ── */
const SHOPS = [
  { id: 'shop_c', name: 'Shop C — Camden', tz: 'Europe/London' },
];

/* ── The two Shop-App personas (spec §6 roles) ── */
const PERSONAS = {
  foh_manager: {
    role: 'foh_manager',
    title: 'FOH Manager',
    person: 'Amara Okafor',
    initials: 'AO',
    shop: 'Shop C — Camden',
    blurb: 'Front-of-house. Orders finished retail goods for the counter & display.',
    // role-scoped catalog (spec §11.1-C: templates/catalog are role-scoped)
    categories: ['Pastry', 'Retail Bakery', 'Cookies & Cakes'],
  },
  kitchen_manager: {
    role: 'kitchen_manager',
    title: 'Kitchen Manager',
    person: 'Tom Reyes',
    initials: 'TR',
    shop: 'Shop C — Camden',
    blurb: 'Back-of-house. Orders production inputs — proteins, bread, pantry.',
    categories: ['Meat', 'Bread', 'General Pantry'],
  },
};

/* ── Catalog (spec §9: Category → Product → Modifier Group → Option) ──
   lead = lead_time_hours (system-enforced, §C4/§9.2). a86 = is_available=false. */
const CATALOG = {
  /* ===== FOH categories ===== */
  'Pastry': { role: 'pastry_chef', icon: 'croiss', products: [
    { id: 'p_almond', name: 'Almond Croissant', unit: 'tray', lead: 24, mods: [
      { name: 'Bake', req: true, opts: ['Golden', 'Well-baked', 'Light'] },
      { name: 'Pack size', req: true, opts: ['Single', 'Tray of 6', 'Tray of 12'] },
    ]},
    { id: 'p_pain', name: 'Pain au Chocolat', unit: 'tray', lead: 24, mods: [
      { name: 'Pack size', req: true, opts: ['Single', 'Tray of 6', 'Tray of 12'] },
    ]},
    { id: 'p_pist', name: 'Pistachio Cardamom Bun', unit: 'unit', lead: 24, mods: [
      { name: 'Pack size', req: true, opts: ['Single', 'Box of 12'] },
    ]},
    { id: 'p_honey', name: 'Honey Cake', unit: 'cake', lead: 24, mods: [
      { name: 'Size', req: true, opts: ['Whole', 'Half'] },
    ]},
  ]},
  'Retail Bakery': { role: 'bread_baker', icon: 'bread', products: [
    { id: 'r_sour', name: 'Sourdough Loaf', unit: 'loaf', lead: 48, mods: [
      { name: 'Size', req: true, opts: ['Standard', 'Large'] },
      { name: 'Crust', req: false, opts: ['Soft', 'Standard', 'Extra Crispy'] },
    ]},
    { id: 'r_foc', name: 'Focaccia', unit: 'tray', lead: 24, mods: [
      { name: 'Topping', req: true, opts: ['Rosemary', 'Olive', 'Plain'] },
    ]},
    { id: 'r_bag', name: 'Baguette', unit: 'unit', lead: 24, mods: [] },
  ]},
  'Cookies & Cakes': { role: 'pastry_chef', icon: 'croiss', products: [
    { id: 'c_choc', name: 'Chocolate Chip Cookie', unit: 'unit', lead: 24, mods: [
      { name: 'Pack size', req: true, opts: ['Box of 6', 'Box of 12'] },
    ]},
    { id: 'c_carrot', name: 'Carrot Cake Slice', unit: 'unit', lead: 24, mods: [] },
  ]},
  /* ===== Kitchen categories ===== */
  'Meat': { role: 'meat_specialist', icon: 'meat', products: [
    { id: 'm_lamb', name: 'Lamb', unit: 'kg', lead: 24, mods: [
      { name: 'Cut', req: true, opts: ['Leg', 'Shoulder', 'Chops', 'Minced'] },
      { name: 'Prep State', req: true, opts: ['Raw', 'Marinated', 'Fully Cooked', 'Sous-Vide'] },
    ]},
    { id: 'm_beef', name: 'Beef', unit: 'kg', lead: 24, mods: [
      { name: 'Cut', req: true, opts: ['Sirloin', 'Brisket', 'Minced', 'Diced'] },
      { name: 'Prep State', req: true, opts: ['Raw', 'Marinated', 'Fully Cooked'] },
    ]},
    { id: 'm_brisket', name: 'Smoked Brisket', unit: 'kg', lead: 24, a86: true,
      note: 'Smoker at capacity today — back tomorrow.', mods: [
      { name: 'Prep State', req: true, opts: ['Whole', 'Sliced'] },
    ]},
    { id: 'm_saus', name: 'Halal Sausage', unit: 'kg', lead: 24, mods: [
      { name: 'Thickness', req: true, opts: ['Thin', 'Thick cut'] },
    ]},
  ]},
  'Bread': { role: 'bread_baker', icon: 'bread', products: [
    { id: 'b_sour', name: 'Sourdough Loaf', unit: 'loaf', lead: 48, mods: [
      { name: 'Size', req: true, opts: ['Standard', 'Large'] },
      { name: 'Crust', req: false, opts: ['Soft', 'Standard', 'Extra Crispy'] },
    ]},
    { id: 'b_bun', name: 'Burger Bun', unit: 'unit', lead: 24, mods: [
      { name: 'Style', req: true, opts: ['Brioche', 'Sesame', 'Plain'] },
    ]},
    { id: 'b_foc', name: 'Focaccia', unit: 'tray', lead: 24, mods: [] },
  ]},
  'General Pantry': { role: 'meat_specialist', icon: 'box', products: [
    { id: 'g_passata', name: 'Tomato Passata', unit: 'litre', lead: 24, mods: [] },
    { id: 'g_oil', name: 'Olive Oil', unit: 'litre', lead: 24, mods: [] },
  ]},
};

/* ── Delivery date options for the cart picker (spec §10.3) ──
   relative to SERVER_NOW (Tue 3 Jun). today not selectable; past blocked;
   48h-lead items push the earliest valid date out by a day. */
const DATES = [
  { dow: 'Tue', d: 3, label: 'Today',    state: 'today' },   // never selectable
  { dow: 'Wed', d: 4, label: 'Tomorrow', state: 'ok' },      // 24h ok
  { dow: 'Thu', d: 5, label: 'Thu 5 Jun',state: 'ok' },      // 48h ok from Thu
  { dow: 'Fri', d: 6, label: 'Fri 6 Jun',state: 'ok' },
  { dow: 'Sat', d: 7, label: 'Sat 7 Jun',state: 'closed' },  // non-operational
  { dow: 'Sun', d: 8, label: 'Sun 8 Jun',state: 'closed' },
  { dow: 'Mon', d: 9, label: 'Mon 9 Jun',state: 'ok' },
];

/* ── Saved templates (spec §5.1 order_templates; §11.1-C) ── */
const TEMPLATES = {
  foh_manager: [
    { id: 't1', name: 'Standard Tuesday FOH Restock', items: 8, cats: 'Pastry · Retail Bakery', used: 'Used 2 days ago', warn: null },
    { id: 't2', name: 'Weekend Pastry Push', items: 14, cats: 'Pastry · Cookies & Cakes', used: 'Used last Fri', warn: null },
    { id: 't3', name: 'Mid-week Bread Top-up', items: 5, cats: 'Retail Bakery', used: 'Used last week', warn: '1 item needs a later date — Sourdough 48h lead' },
  ],
  kitchen_manager: [
    { id: 't4', name: 'Daily Protein Prep', items: 6, cats: 'Meat', used: 'Used yesterday', warn: '1 item 86\u2019d — Smoked Brisket out today' },
    { id: 't5', name: 'Bread Bake List', items: 4, cats: 'Bread', used: 'Used 3 days ago', warn: '1 item needs a later date — Sourdough 48h lead' },
  ],
};

/* ── Order history (spec §7 statuses, §11.1-D colour code) ──
   Shared demo set; some belong to FOH, some Kitchen (by category). */
const ORDERS = {
  foh_manager: [
    { id: 'A4F2', cat: 'Pastry', items: 12, qty: '12 items', status: 'specialist_approved',
      date: 'Wed 4 Jun', spec: 'Marcus (Pastry)', total: 166.50, group: null,
      lines: [
        ['Almond Croissant', 'Golden · Tray of 6 ×3', 28.50],
        ['Pain au Chocolat', 'Tray of 12 ×6', 54.00],
        ['Pistachio Cardamom Bun', 'Box of 12 ×24', 60.00],
        ['Honey Cake', 'Whole ×2', 24.00],
      ]},
    { id: 'B1C8', cat: 'Retail Bakery', items: 8, qty: '8 items', status: 'in_transit',
      date: 'Today 9 Jun', spec: 'Priya (Bread)', total: 92.00, group: null,
      lines: [
        ['Sourdough Loaf', 'Large · Extra Crispy ×6', 30.00],
        ['Focaccia', 'Rosemary ×4 trays', 38.00],
        ['Baguette', '×24', 24.00],
      ]},
    { id: '9E3D', cat: 'Pastry', items: 15, qty: '15 items', status: 'in_progress',
      date: 'Wed 4 Jun', spec: 'Marcus (Pastry)', total: 188.00, group: 'Tuesday Request' },
    { id: '7K2D', cat: 'Retail Bakery', items: 6, qty: '6 items', status: 'delivered',
      date: 'Yesterday 8 Jun', spec: 'Priya (Bread)', total: 71.00, group: null },
    { id: '3T1X', cat: 'Pastry', items: 9, qty: '9 items', status: 'delivered',
      date: '7 Jun', spec: 'Marcus (Pastry)', total: 104.50, group: null },
  ],
  kitchen_manager: [
    { id: 'C7A1', cat: 'Meat', items: 4, qty: '13 kg', status: 'packaged',
      date: 'Wed 4 Jun', spec: 'Yusuf (Meat)', total: 142.00, group: 'Tuesday Request' },
    { id: 'M5B2', cat: 'Bread', items: 5, qty: '40 loaves', status: 'shop_confirmed',
      date: 'Thu 5 Jun', spec: 'Priya (Bread)', total: 88.00, group: null },
    { id: '5R9P', cat: 'Meat', items: 2, qty: '4 kg', status: 'rejected',
      date: '7 Jun', spec: 'Yusuf (Meat)', total: 0, group: null,
      reject: 'Brisket smoker fully booked — please re-request for Thursday.' },
    { id: 'K2D9', cat: 'Bread', items: 6, qty: '48 loaves', status: 'delivered',
      date: 'Yesterday 8 Jun', spec: 'Priya (Bread)', total: 96.00, group: null },
  ],
};

/* status → badge meta is already in window.STAT (icons.jsx). colour group per §11.1-D:
   yellow: pending_request, specialist_approved · blue: shop_confirmed, in_progress, packaged
   orange: ready_for_courier, in_transit · green: delivered · red: rejected, cancelled */

window.DATA = { SERVER_NOW, CUTOFF_HOUR, SHOPS, PERSONAS, CATALOG, DATES, TEMPLATES, ORDERS };

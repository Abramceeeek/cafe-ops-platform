/* ════════════════════════════════════════════════════════════════
   Specialist (Hub App, dark) — data + screen registry.
   Three personas: Meat Specialist · Bread Baker · Pastry Chef.
   Each owns one product category (spec §C7 — strictly role-filtered).
   ════════════════════════════════════════════════════════════════ */

const SPEC_PERSONAS = [
  { key: 'meat_specialist', title: 'Meat', person: 'Yusuf Khan', initials: 'MS', cat: 'Meat & Smoke', icon: 'meat', unit: 'kg' },
  { key: 'bread_baker',     title: 'Bread', person: 'Sana Malik', initials: 'BB', cat: 'Kitchen Bread', icon: 'bread', unit: 'loaf' },
  { key: 'pastry_chef',     title: 'Pastry', person: 'Marcus Bell', initials: 'PC', cat: 'Pastry / Retail', icon: 'croiss', unit: 'tray' },
];

/* per-persona inbox (pending_request), board cards, and 86 catalog */
const SPEC_DATA = {
  meat_specialist: {
    inbox: [
      { id: 'C7A1', shop: 'Stratford', when: 'Today', urg: 'red', ago: '4m ago',
        lines: [ ['Smoked Lamb', 'Leg · Fully cooked', 8, 14.0], ['Halal Sausage', 'Thick cut', 5, 9.5], ['Pickled Goods', 'extra dill, less salt', 3, 6.0] ] },
      { id: 'D2B4', shop: 'Shoreditch', when: 'Tomorrow', urg: 'amber', ago: '12m ago',
        lines: [ ['Smoked Brisket', 'Sliced', 12, 16.0], ['Smoked Chicken', 'Whole', 6, 11.0] ] },
      { id: 'E0C2', shop: 'Wanstead', when: 'Wed 4 Jun', urg: 'green', ago: '31m ago',
        lines: [ ['Halal Bacon', 'Streaky', 4, 12.5], ['Beef', 'Minced · Raw', 6, 10.0] ] },
    ],
    board: [
      ['shop_confirmed', [['Stratford', 'C7A1', 'today', ['Smoked Lamb 8kg', 'Halal Sausage 5kg'], '3 lines']]],
      ['in_progress', [['Shoreditch', 'D2B4', 'tmrw', ['Smoked Brisket 12kg', 'Smoked Chicken 6kg'], '2 lines']]],
      ['packaged', [['Wanstead', 'E0C2', 'wed', ['Halal Bacon 4kg', 'Beef 6kg'], '2 lines']]],
      ['ready_for_courier', [['St. Albans', 'B7C2', 'today', ['Halal Sausage 9kg', 'Smoked Lamb 4kg'], '2 lines']]],
    ],
    catalog: [
      { name: 'Smoked Lamb', sub: 'per kg · 24h', on: true }, { name: 'Beef', sub: 'per kg · 24h', on: true },
      { name: 'Smoked Brisket', sub: 'per kg · 24h', on: false, note: 'Smoker at capacity — back tomorrow.' },
      { name: 'Halal Sausage', sub: 'per kg · 24h', on: true }, { name: 'Smoked Chicken', sub: 'per kg · 24h', on: true },
    ],
  },
  bread_baker: {
    inbox: [
      { id: 'M5B2', shop: 'Shoreditch', when: 'Thu 5 Jun', urg: 'green', ago: '6m ago',
        lines: [ ['Sourdough Loaf', 'Large · Extra Crispy', 20, 4.4], ['Focaccia', 'Rosemary', 6, 6.0] ] },
      { id: 'K2D9', shop: 'Clapham', when: 'Tomorrow', urg: 'amber', ago: '20m ago',
        lines: [ ['Burger Bun', 'Brioche', 48, 0.8], ['Baguette', '—', 24, 1.5] ] },
    ],
    board: [
      ['shop_confirmed', [['Clapham', 'K2D9', 'tmrw', ['Burger Bun ×48', 'Baguette ×24'], '2 lines']]],
      ['in_progress', [['St. Albans', 'B7X1', 'today', ['Sourdough ×30'], '1 line']]],
      ['packaged', []],
      ['ready_for_courier', [['Wanstead', 'W4K2', 'today', ['Focaccia ×8 trays'], '1 line']]],
    ],
    catalog: [
      { name: 'Sourdough Loaf', sub: 'per loaf · 48h', on: true }, { name: 'Focaccia', sub: 'per tray · 24h', on: true },
      { name: 'Burger Bun', sub: 'per unit · 24h', on: false, note: 'Out of brioche flour — back Wed AM.' },
      { name: 'Baguette', sub: 'per unit · 24h', on: true },
    ],
  },
  pastry_chef: {
    inbox: [
      { id: 'A4F2', shop: 'Camden', when: 'Wed 4 Jun', urg: 'amber', ago: '9m ago',
        lines: [ ['Almond Croissant', 'Golden · Tray of 6', 3, 9.5], ['Pain au Chocolat', 'Tray of 12', 6, 9.0], ['Pistachio Cardamom Bun', 'Box of 12', 24, 2.5], ['Honey Cake', 'Whole', 2, 12.0] ] },
      { id: 'F3D1', shop: 'Chigwell', when: 'Today', urg: 'red', ago: '2m ago',
        lines: [ ['Chocolate Chip Cookie', 'Box of 12', 10, 3.0], ['Carrot Cake Slice', '—', 18, 2.2] ] },
    ],
    board: [
      ['shop_confirmed', [['Camden', 'A4F2', 'wed', ['Almond Croissant ×3', 'Pain au Choc ×6', '+2'], '4 lines']]],
      ['in_progress', [['Chigwell', 'F3D1', 'today', ['Choc Chip ×10', 'Carrot Cake ×18'], '2 lines']]],
      ['packaged', [['Clapham', 'P9K3', 'tmrw', ['Honey Cake ×2'], '1 line']]],
      ['ready_for_courier', []],
    ],
    catalog: [
      { name: 'Almond Croissant', sub: 'per tray · 24h', on: true }, { name: 'Pain au Chocolat', sub: 'per tray · 24h', on: true },
      { name: 'Pistachio Cardamom Bun', sub: 'per unit · 24h', on: true }, { name: 'Honey Cake', sub: 'per cake · 24h', on: true },
      { name: 'Carrot Cake Slice', sub: 'per unit · 24h', on: false, note: 'No cream cheese delivery today.' },
    ],
  },
};

const URG = { red: ['var(--st-bad)', 'Today'], amber: ['var(--st-pend)', 'Tomorrow'], green: ['var(--st-done)', '2+ days'],
  today: ['var(--st-bad)', 'var(--st-bad-bg)', 'TODAY'], tmrw: ['var(--st-pend)', 'var(--st-pend-bg)', 'TOMORROW'],
  wed: ['var(--st-done)', 'var(--st-done-bg)', 'WED 4'] };
const COL_TITLES = { shop_confirmed: 'Confirmed', in_progress: 'In Production', packaged: 'Packaged', ready_for_courier: 'Ready · Courier' };

const SPEC_META = [
  { id: 'inbox', title: 'Inbox', group: 'Approve', kind: 'phone', frame: { dark: true }, root: true,
    sub: 'Pending requests for your category.',
    purpose: 'Approval 1 of the Two-Way Handshake. The specialist sees only pending_request orders whose items belong to their category, sorted by urgency.',
    behaviors: [
      'Strictly role-filtered: a Meat specialist never sees a Bread order (§C7, RLS §6).',
      'Cards sort by delivery date ascending; urgency colour = red today / amber tomorrow / green 2+ days (§11.2-B).',
      'Each card shows shop, item list w/ modifiers, delivery date, and time since submission (§11.2-A).',
      'Tap to open the request and Approve & Quote, or Reject.',
    ],
    data: ['orders WHERE status = pending_request AND category ∈ my role', 'order_items + order_item_modifiers'],
    spec: '§11.2-A · §8.1 · §C7' },
  { id: 'request', title: 'Approve & Quote', group: 'Approve', kind: 'phone', frame: { dark: true },
    sub: 'Set unit costs, then approve.',
    purpose: 'Review a request line-by-line, optionally set a unit_cost per item, and confirm capability — moving the order to specialist_approved.',
    behaviors: [
      'Specialist may set unit_cost on each order_item at approval; line + quote totals compute live (§8.1 step 2).',
      '"Approve & Quote" → status specialist_approved; FCM back to the originating shop to Final Confirm (§13).',
      '"Reject" requires a reason and is terminal — the shop opens a new Request (§7.3).',
      'Custom notes from the shop surface inline (e.g. "extra dill, less salt").',
    ],
    data: ['orders.status: pending_request → specialist_approved', 'order_items.unit_cost', 'specialist_approved_at'],
    spec: '§8.1 · §7.2 · §11.2-A' },
  { id: 'reject', title: 'Reject request', group: 'Approve', kind: 'phone', frame: { dark: true },
    sub: 'Reason required; terminal.',
    purpose: 'Decline a request the Hub cannot fulfil, with a reason the shop will see.',
    behaviors: [
      'A rejection reason is mandatory before submit (§11.2-A).',
      '→ status rejected (terminal, §7.3); FCM to shop with the reason (§13).',
      'The shop must open a new Request to try different terms.',
    ],
    data: ['orders.status → rejected', 'rejection reason → shop notification'],
    spec: '§7.3 · §11.2-A · §13' },
  { id: 'approved', title: 'Approved', group: 'Approve', kind: 'phone', frame: { dark: true },
    sub: 'Quote sent back to the shop.',
    purpose: 'Confirm the request is approved & priced and is now awaiting the shop\u2019s Final Confirm.',
    behaviors: ['status specialist_approved; the ball is back in the shop\u2019s court.', 'Order only joins the production board after the shop Final-Confirms (§8.1 step 3).'],
    data: ['orders.status = specialist_approved'],
    spec: '§8.1 · §7.1' },
  { id: 'board', title: 'To-Do Board', group: 'Production', kind: 'board', frame: { w: 1180, h: 700 }, root: true,
    sub: 'Ticket rail — drag states left → right.',
    purpose: 'Live production board. Confirmed orders flow through states to ready_for_courier. Designed for a wall-mounted Hub display.',
    behaviors: [
      'Columns: shop_confirmed → in_progress → packaged → ready_for_courier (§11.2-B).',
      'Tap "Advance" to move a ticket one state right; on ready_for_courier the Courier is notified (§8.1 step 4, §13).',
      'Card urgency colour: red = delivery today, amber = tomorrow, green = 2+ days.',
      'Only orders the shop has Final-Confirmed appear here (never pending/approved).',
      'Long-press a card to 86 a product (modelled on the Catalog screen here).',
    ],
    data: ['orders WHERE status ∈ {shop_confirmed..ready_for_courier}', 'order-state-change Edge Function (valid transitions only)'],
    spec: '§11.2-B · §7.2 · §7.4' },
  { id: 'eightysix', title: '86 Catalog', group: 'Catalog', kind: 'phone', frame: { dark: true }, root: true,
    sub: 'Toggle product availability.',
    purpose: 'The "86" protocol. Toggle a product off and it disappears from every shop\u2019s catalog instantly.',
    behaviors: [
      'Toggling off sets products.is_available = FALSE; Realtime hides it from all shops at once (§9.3).',
      'All FOH + Kitchen managers get an FCM: "[Product] is out of stock. Adjust your orders." (§13).',
      'Specialists can only toggle products in their OWN category (RLS §6).',
      'An optional note to shops can accompany the 86.',
      'Re-enabling broadcasts a restore and re-notifies shops.',
    ],
    data: ['products.is_available (+ unavailable_note)', 'Realtime broadcast', 'FCM to shop roles'],
    spec: '§9.3 · §6 · §13' },
  { id: 'account', title: 'Account', group: 'Account', kind: 'phone', frame: { dark: true }, root: true,
    sub: 'Profile & category ownership.',
    purpose: 'Identity for the Hub specialist. Hub roles have no shop_id and no offline mode.',
    behaviors: ['Bound to one production category (profiles constraint, §5.1).', 'Hub App has no offline mode — connectivity loss blocks interaction to avoid state corruption (§14).', 'Accounts issued by Admin; internal only (§C1).'],
    data: ['profiles (role, shop_id = NULL)', 'assigned category'],
    spec: '§5.1 · §14 · §C1' },
];

window.SPEC = { SPEC_PERSONAS, SPEC_DATA, SPEC_META, URG, COL_TITLES };

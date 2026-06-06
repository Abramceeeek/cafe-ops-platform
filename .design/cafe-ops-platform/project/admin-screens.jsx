/* ════ Admin Web (light, browser) — interactive screens ════ */
const { useState: aUS } = React;

const ADMIN_USER = { name: 'Rana Aziz', initials: 'RA', role: 'Brand Owner' };

function AdminShell({ view, title, sub, actions, children }) {
  const nav = window.useNav();
  const items = [['ops', I.grid, 'Live Operations'], ['catalog', I.box, 'Catalog'], ['finance', I.trend, 'Financial Reports'], ['users', I.user, 'Users']];
  return (
    <div className="scr" style={{ height: '100%', display: 'flex', background: 'var(--paper)', color: 'var(--ink)' }}>
      <div style={{ width: 232, flexShrink: 0, background: '#221A14', color: '#E9DECE', display: 'flex', flexDirection: 'column', padding: '20px 14px' }}>
        <div className="row" style={{ gap: 10, padding: '0 8px 20px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--terra)', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}><Icon d={I.flame} w={19} /></div>
          <div><div className="wordmark" style={{ fontSize: 16, color: '#F4E9D8' }}>Hub<em style={{ color: 'var(--terra-soft)' }}>Sync</em></div><div style={{ fontSize: 10.5, color: '#9B8B76', fontWeight: 600, letterSpacing: '.08em' }}>ADMIN · BRAND OWNER</div></div>
        </div>
        {items.map(([k, ic, l]) => (
          <button key={k} onClick={() => nav.go(k)} className="row" style={{ gap: 11, padding: '11px 12px', borderRadius: 10, marginBottom: 2, fontWeight: 650, fontSize: 14, border: 'none', cursor: 'pointer', textAlign: 'left',
            background: view === k ? 'rgba(226,112,58,.16)' : 'transparent', color: view === k ? '#F0A877' : '#C3B49E' }}>
            <Icon d={ic} w={19} />{l}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div className="row" style={{ gap: 10, padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#3A2C20', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, color: '#E9DECE' }}>{ADMIN_USER.initials}</div>
          <div><div style={{ fontSize: 13, fontWeight: 650 }}>{ADMIN_USER.name}</div><div style={{ fontSize: 11, color: '#9B8B76' }}>{ADMIN_USER.role}</div></div>
        </div>
      </div>
      <div className="grow col" style={{ minWidth: 0 }}>
        <div className="between" style={{ padding: '18px 26px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div><div className="serif" style={{ fontSize: 23 }}>{title}</div><div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 1 }}>{sub}</div></div>
          <div className="row" style={{ gap: 10 }}>{actions}</div>
        </div>
        <div className="thin grow" style={{ overflow: 'auto', padding: 26 }}>{children}</div>
      </div>
    </div>
  );
}

/* A · LIVE OPERATIONS ────────────────────────────────────────── */
function AdminOps() {
  const nav = window.useNav();
  const stats = [['Active orders', '34', 'var(--terra)'], ['Awaiting approval', '6', 'var(--st-pend)'], ['In transit', '5', 'var(--st-ready)'], ['Delivered today', '21', 'var(--st-done)']];
  const cols = [
    ['Pending', [['Stratford', 'Meat', 's-pend', 'Today', 'C7A1'], ['Camden', 'Pastry', 's-pend', 'Wed', 'A4F2']]],
    ['Confirmed', [['Wanstead', 'Bread', 's-prog', 'Today', 'M5B2'], ['Clapham', 'Meat', 's-prog', 'Wed', 'C7Z2'], ['Chigwell', 'Pastry', 's-prog', 'Wed', 'F3D1']]],
    ['In Production', [['Shoreditch', 'Meat', 's-prog', 'Today', 'D2B4']]],
    ['Ready / Transit', [['St. Albans', 'Pastry', 's-ready', 'Today', 'B7C2'], ['S. Woodford', 'Bread', 's-ready', 'Today', 'B7X1']]],
    ['Delivered', [['Wanstead', 'Pastry', 's-done', '8:54', 'E0C2'], ['St. Albans', 'Meat', 's-done', '8:32', 'B7C2']]],
  ];
  const [filter, setFilter] = aUS(false);
  return (
    <AdminShell view="ops" title="Live Operations" sub="34 active orders across 7 shops · updated live"
      actions={<><button onClick={() => setFilter((f) => !f)} className={'btn btn-sm ' + (filter ? 'btn-soft' : 'btn-ghost')}><Icon d={I.filter} w={16} /> Filter</button><button className="btn btn-ghost btn-sm"><Icon d={I.refresh} w={16} /> Live</button></>}>
      {filter && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="eyebrow">Filter</span>
          {['All shops', 'Meat', 'Bread', 'Pastry', 'Today', 'This week'].map((f, i) => <span key={f} className={'chip' + (i === 0 ? ' sel' : '')} style={{ fontSize: 12.5 }}>{f}</span>)}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {stats.map(([l, v, c]) => (
          <div key={l} className="card" style={{ padding: 16 }}><div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{l}</div><div className="serif" style={{ fontSize: 30, marginTop: 4, color: c }}>{v}</div></div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, alignItems: 'start' }}>
        {cols.map(([title, cards]) => (
          <div key={title}>
            <div className="between" style={{ marginBottom: 10, padding: '0 2px' }}><span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span><span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{cards.length}</span></div>
            <div className="col" style={{ gap: 10 }}>
              {cards.map(([shop, cat, st, when, id]) => (
                <button key={id + shop} onClick={() => nav.go('order', { id, shop, cat, st })} className="card" style={{ padding: 12, width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--surface)' }}>
                  <div className="between"><span style={{ fontWeight: 700, fontSize: 13.5 }}>{shop}</span><span className={'status ' + st} style={{ fontSize: 10, padding: '3px 7px' }}>{when}</span></div>
                  <div className="between" style={{ marginTop: 5 }}><span style={{ fontSize: 12, color: 'var(--muted)' }}>{cat}</span><span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)' }}>#{id}</span></div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

/* B · ORDER DETAIL ───────────────────────────────────────────── */
function AdminOrder() {
  const nav = window.useNav();
  const p = nav.params;
  const id = p.id || 'C7A1';
  const seq = [['Request submitted', '3 Jun · 2:14 PM', 'Amara (FOH, Stratford)'], ['Approved & priced', '3 Jun · 2:51 PM', 'Yusuf (Meat)'], ['Final confirmed', '3 Jun · 3:02 PM', 'Amara (FOH)'], ['In production', '3 Jun · 6:40 AM', 'Yusuf (Meat)'], ['Out for delivery', '—', 'Dani (Courier)'], ['Delivered & signed', '—', '—']];
  const reached = 3;
  const lines = [['Smoked Lamb', 'Leg · Fully cooked', '8 kg', 112.0], ['Halal Sausage', 'Thick cut', '5 kg', 47.5], ['Pickled Goods', 'extra dill, less salt', '3 kg', 18.0]];
  const total = lines.reduce((s, l) => s + l[3], 0);
  return (
    <AdminShell view="ops" title={'Order #' + id} sub={(p.shop || 'Stratford') + ' · ' + (p.cat || 'Meat') + ' · delivery Wed 4 Jun'}
      actions={<button onClick={nav.back} className="btn btn-ghost btn-sm"><Icon d={I.back} w={16} /> Back to board</button>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}><span className="eyebrow">Priced items</span></div>
          {lines.map(([n, m, q, c]) => (
            <div key={n} className="between" style={{ padding: '13px 18px', borderBottom: '1px solid var(--line)' }}>
              <div className="grow"><div style={{ fontWeight: 650, fontSize: 14 }}>{n}</div><div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{m}</div></div>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)', marginRight: 16 }}>{q}</span>
              <span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>£{c.toFixed(2)}</span>
            </div>
          ))}
          <div className="between" style={{ padding: '14px 18px' }}><span className="serif" style={{ fontSize: 17 }}>Total</span><span className="mono" style={{ fontWeight: 700, fontSize: 18 }}>£{total.toFixed(2)}</span></div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <span className="eyebrow">Lifecycle</span>
          <div style={{ position: 'relative', paddingLeft: 24, marginTop: 14 }}>
            <div style={{ position: 'absolute', left: 5, top: 6, bottom: 10, width: 2, background: 'var(--line-2)' }} />
            {seq.map(([l, t, who], i) => {
              const st = i < reached ? 'done' : i === reached ? 'now' : 'next';
              return (
                <div key={i} style={{ position: 'relative', paddingBottom: i < seq.length - 1 ? 16 : 0 }}>
                  <div className={'tl-dot' + (st === 'done' ? ' done' : st === 'now' ? ' on' : '')} style={{ position: 'absolute', left: -24, top: 1, opacity: st === 'next' ? .5 : 1 }} />
                  <div style={{ fontWeight: st === 'next' ? 500 : 700, fontSize: 13.5, color: st === 'next' ? 'var(--muted)' : 'var(--ink)' }}>{l}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{who}{t !== '—' ? ' · ' + t : ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

/* C · CATALOG MANAGEMENT ─────────────────────────────────────── */
function AdminCatalog() {
  const base = [
    ['Smoked Lamb', 'Meat', 'Yusuf', 'kg', '24h', true, 'Cut, Prep State'],
    ['Smoked Brisket', 'Meat', 'Yusuf', 'kg', '24h', false, 'Cut, Prep State'],
    ['Sourdough Loaf', 'Bread', 'Sana', 'loaf', '48h', true, 'Size, Crust'],
    ['Focaccia', 'Bread', 'Sana', 'tray', '24h', true, 'Topping'],
    ['Almond Croissant', 'Pastry', 'Marcus', 'tray', '24h', true, 'Bake, Pack size'],
    ['Pistachio C. Bun', 'Pastry', 'Marcus', 'unit', '24h', true, 'Pack size'],
    ['Halal Sausage', 'Meat', 'Yusuf', 'kg', '24h', true, 'Thickness'],
  ];
  const [rows, setRows] = aUS(() => base.map((r) => [...r]));
  const cats = [['Meat', 'var(--st-bad)'], ['Bread', 'var(--st-pend)'], ['Pastry', 'var(--terra)']];
  const grid = '1.4fr 1fr .9fr .6fr .6fr 1.3fr .9fr';
  return (
    <AdminShell view="catalog" title="Catalog Management" sub="3 categories · 31 products · 5 modifier groups"
      actions={<><button className="btn btn-ghost btn-sm"><Icon d={I.search} w={16} /> Search</button><button className="btn btn-primary btn-sm"><Icon d={I.plus} w={16} /> New product</button></>}>
      <div className="row" style={{ gap: 10, marginBottom: 18 }}>
        {cats.map(([n, c]) => {
          const count = rows.filter((r) => r[1] === n).length;
          const off = rows.filter((r) => r[1] === n && !r[5]).length;
          return (
            <div key={n} className="card" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: c }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>{n}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{count} live{off ? ` · ${off} 86’d` : ''}</span>
            </div>
          );
        })}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: grid, padding: '12px 18px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          <span>Product</span><span>Category</span><span>Specialist</span><span>Unit</span><span>Lead</span><span>Modifiers</span><span style={{ textAlign: 'right' }}>Available</span>
        </div>
        {rows.map((r, i) => (
          <div key={r[0]} style={{ display: 'grid', gridTemplateColumns: grid, padding: '11px 18px', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none', alignItems: 'center', fontSize: 13.5 }}>
            <span style={{ fontWeight: 700 }}>{r[0]}</span>
            <span style={{ color: 'var(--muted)' }}>{r[1]}</span>
            <span style={{ color: 'var(--ink-2)' }}>{r[2]}</span>
            <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{r[3]}</span>
            <span className="mono" style={{ fontSize: 12.5, color: r[4] === '48h' ? 'var(--st-pend)' : 'var(--ink-2)' }}>{r[4]}</span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{r[6]}</span>
            <span style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setRows((rs) => rs.map((x, j) => j === i ? x.map((v, k) => k === 5 ? !v : v) : x))} className={'toggle' + (r[5] ? ' on' : '')} style={{ width: 44, height: 26 }}>
                <span className="knob" style={{ width: 20, height: 20, left: r[5] ? 21 : 3 }} />
              </button>
            </span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

/* D · FINANCIAL REPORTS ──────────────────────────────────────── */
function AdminFinance() {
  const bars = [['Shoreditch', 4280, 'var(--terra)'], ['Clapham', 3120], ['St. Albans', 2740], ['Chigwell', 1980], ['Stratford', 3560], ['S. Woodford', 2210], ['Wanstead', 2630]];
  const max = 4500;
  const shops = [
    ['Shoreditch', 'Pastry · Meat · Bread', 86, '£4,280', '+12%'], ['Clapham', 'Meat · Bread', 71, '£3,120', '+4%'],
    ['Stratford', 'Pastry · Meat', 64, '£3,560', '+18%'], ['St. Albans', 'Pastry · Bread', 58, '£2,740', '−3%'],
    ['Wanstead', 'Meat · Pastry', 52, '£2,630', '+7%'], ['S. Woodford', 'Bread · Pastry', 47, '£2,210', '+2%'], ['Chigwell', 'Pastry', 39, '£1,980', '−6%'],
  ];
  const grid = '1.2fr 1.6fr .8fr 1fr .8fr 1fr';
  return (
    <AdminShell view="finance" title="Financial Reports" sub="May 2026 · internal transfer records across 7 shops"
      actions={<><button className="btn btn-ghost btn-sm"><Icon d={I.cal} w={16} /> May 2026</button><button className="btn btn-primary btn-sm"><Icon d={I.doc} w={16} /> Export CSV</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Total transfers · May</div>
          <div className="serif" style={{ fontSize: 38, marginTop: 4 }}>£20,520</div>
          <div className="row" style={{ gap: 7, marginTop: 6 }}><span className="status s-done" style={{ fontSize: 11 }}><Icon d={I.trend} w={13} /> +8.4% vs Apr</span><span style={{ fontSize: 12.5, color: 'var(--muted)' }}>· 312 receipts</span></div>
          <div className="divider" style={{ margin: '18px 0' }} />
          {[['Pastry / Retail', '£9,140', 'var(--terra)'], ['Smoked / Meat', '£7,260', 'var(--st-bad)'], ['Kitchen Bread', '£4,120', 'var(--st-pend)']].map(([l, v, c]) => (
            <div key={l} className="between" style={{ padding: '7px 0' }}><span className="row" style={{ gap: 9, fontSize: 13.5, fontWeight: 600 }}><span style={{ width: 9, height: 9, borderRadius: 99, background: c }} />{l}</span><span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{v}</span></div>
          ))}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="between" style={{ marginBottom: 18 }}><span style={{ fontWeight: 700, fontSize: 14 }}>Spend by shop</span><span style={{ fontSize: 12, color: 'var(--muted)' }}>£ this month</span></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 150 }}>
            {bars.map(([n, v, c]) => (
              <div key={n} className="col grow" style={{ alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{(v / 1000).toFixed(1)}k</span>
                <div style={{ width: '100%', maxWidth: 30, height: (v / max * 100) + '%', background: c || 'var(--terra-tint2)', borderRadius: '6px 6px 0 0' }} />
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textAlign: 'center', lineHeight: 1.1, height: 22 }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: grid, padding: '12px 18px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          <span>Shop</span><span>Categories</span><span>Orders</span><span>Total</span><span>Trend</span><span style={{ textAlign: 'right' }}>Statement</span>
        </div>
        {shops.map((r, i) => (
          <div key={r[0]} style={{ display: 'grid', gridTemplateColumns: grid, padding: '13px 18px', borderBottom: i < shops.length - 1 ? '1px solid var(--line)' : 'none', alignItems: 'center', fontSize: 13.5 }}>
            <span style={{ fontWeight: 700 }}>{r[0]}</span>
            <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{r[1]}</span>
            <span className="mono" style={{ fontSize: 13 }}>{r[2]}</span>
            <span className="mono" style={{ fontWeight: 700 }}>{r[3]}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: r[4][0] === '+' ? 'var(--st-done)' : 'var(--st-bad)' }}>{r[4]}</span>
            <span style={{ textAlign: 'right' }}><button className="btn btn-soft btn-sm"><Icon d={I.doc} w={14} /> PDF</button></span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

/* E · USER MANAGEMENT ────────────────────────────────────────── */
function AdminUsers() {
  const base = [
    ['Amara Okafor', 'FOH Manager', 'Camden', '2m ago', true], ['Tom Reyes', 'Kitchen Manager', 'Camden', '14m ago', true],
    ['Priya Nair', 'FOH Manager', 'St. Albans', '1h ago', true], ['Yusuf Khan', 'Meat Specialist', 'The Hub', '4m ago', true],
    ['Sana Malik', 'Bread Baker', 'The Hub', '22m ago', true], ['Marcus Bell', 'Pastry Chef', 'The Hub', '8m ago', true],
    ['Dani Cole', 'Courier', 'The Hub', 'now', true], ['Leon Frost', 'Kitchen Manager', 'Chigwell', '3d ago', false],
  ];
  const [users, setUsers] = aUS(() => base.map((u) => [...u]));
  const roleColor = { 'FOH Manager': 'var(--terra)', 'Kitchen Manager': 'var(--st-prog)', 'Meat Specialist': 'var(--st-bad)', 'Bread Baker': 'var(--st-pend)', 'Pastry Chef': 'var(--terra-deep)', 'Courier': 'var(--st-ready)' };
  const grid = '1.5fr 1.2fr 1fr 1fr 1fr';
  return (
    <AdminShell view="users" title="User Management" sub="19 profiles · 7 shops + Hub · 6 roles"
      actions={<><button className="btn btn-ghost btn-sm"><Icon d={I.filter} w={16} /> Role</button><button className="btn btn-primary btn-sm"><Icon d={I.plus} w={16} /> Add user</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[['Total profiles', '19'], ['Active now', users.filter((u) => u[4]).length], ['Shop roles', '14'], ['Hub roles', '5']].map(([l, v]) => (
          <div key={l} className="card" style={{ padding: 16 }}><div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{l}</div><div className="serif" style={{ fontSize: 28, marginTop: 3 }}>{v}</div></div>
        ))}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: grid, padding: '12px 18px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          <span>Name</span><span>Role</span><span>Location</span><span>Last login</span><span style={{ textAlign: 'right' }}>Account</span>
        </div>
        {users.map((u, i) => (
          <div key={u[0]} style={{ display: 'grid', gridTemplateColumns: grid, padding: '12px 18px', borderBottom: i < users.length - 1 ? '1px solid var(--line)' : 'none', alignItems: 'center', fontSize: 13.5, opacity: u[4] ? 1 : .55 }}>
            <span className="row" style={{ gap: 11 }}><span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, color: 'var(--ink-2)' }}>{u[0].split(' ').map((x) => x[0]).join('')}</span><span style={{ fontWeight: 700 }}>{u[0]}</span></span>
            <span className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: roleColor[u[1]] || 'var(--muted)' }} />{u[1]}</span>
            <span style={{ color: 'var(--muted)' }}>{u[2]}</span>
            <span className="mono" style={{ fontSize: 12.5, color: u[3] === 'now' ? 'var(--st-done)' : 'var(--muted)' }}>{u[3]}</span>
            <span style={{ textAlign: 'right' }}>
              <button onClick={() => setUsers((us) => us.map((x, j) => j === i ? x.map((v, k) => k === 4 ? !v : v) : x))} className={'btn btn-sm ' + (u[4] ? 'btn-ghost' : 'btn-soft')} style={u[4] ? null : { color: 'var(--st-done)' }}>{u[4] ? 'Disable' : 'Activate'}</button>
            </span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

window.mountConsole({
  brand: 'Hub<em>Sync</em>', brandSub: 'Admin Web — Brand Owner', flowTag: 'Working spec · v2.1',
  flow: ['Operations', 'Catalog', 'Finance', 'Users'],
  personas: [{ key: 'admin', title: 'Brand Owner', person: ADMIN_USER.name, initials: ADMIN_USER.initials, icon: 'flame' }],
  screens: window.ADMIN_META,
  components: { ops: AdminOps, order: AdminOrder, catalog: AdminCatalog, finance: AdminFinance, users: AdminUsers },
  defaultScreen: 'ops',
  caption: () => `Admin Web · Brand Owner · ${ADMIN_USER.name} · browser`,
  footHint: 'The Admin Web surface only (Next.js, browser). Admin has full read across all shops & roles (§6). Use the in-app sidebar or this directory to move between Operations, Catalog, Finance and Users. Shop, Specialist and Courier are separate systems.',
});

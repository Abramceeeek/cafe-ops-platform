/* ════ ADMIN WEB (light, browser) — Brand Owner command center ════ */

function AdminShell({ view, title, sub, children, actions }) {
  const nav = [['ops', I.grid, 'Live Operations'], ['catalog', I.box, 'Catalog'], ['finance', I.trend, 'Financial Reports'], ['users', I.user, 'Users']];
  return (
    <div className="scr" style={{ height: '100%', display: 'flex', background: 'var(--paper)' }}>
      {/* sidebar */}
      <div style={{ width: 232, flexShrink: 0, background: '#221A14', color: '#E9DECE', display: 'flex', flexDirection: 'column', padding: '20px 14px' }}>
        <div className="row" style={{ gap: 10, padding: '0 8px 20px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--terra)', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}><Icon d={I.flame} w={19} /></div>
          <div>
            <div className="wordmark" style={{ fontSize: 16, color: '#F4E9D8' }}>bobo <em>&</em> wild</div>
            <div style={{ fontSize: 10.5, color: '#9B8B76', fontWeight: 600, letterSpacing: '.08em' }}>HUBSYNC ADMIN</div>
          </div>
        </div>
        {nav.map(([k, ic, l]) => (
          <div key={k} className="row" style={{ gap: 11, padding: '11px 12px', borderRadius: 10, marginBottom: 2, fontWeight: 650, fontSize: 14,
            background: view === k ? 'rgba(226,112,58,.16)' : 'transparent', color: view === k ? '#F0A877' : '#C3B49E' }}>
            <Icon d={ic} w={19} />{l}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div className="row" style={{ gap: 10, padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#3A2C20', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, color: '#E9DECE' }}>RA</div>
          <div><div style={{ fontSize: 13, fontWeight: 650 }}>Rana A.</div><div style={{ fontSize: 11, color: '#9B8B76' }}>Brand Owner</div></div>
        </div>
      </div>
      {/* main */}
      <div className="grow col" style={{ minWidth: 0 }}>
        <div className="between" style={{ padding: '18px 26px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div>
            <div className="serif" style={{ fontSize: 23 }}>{title}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>
          </div>
          <div className="row" style={{ gap: 10 }}>{actions}</div>
        </div>
        <div className="thin grow" style={{ overflow: 'auto', padding: 26 }}>{children}</div>
      </div>
    </div>
  );
}

/* ── A · Live Operations Overview ──────────────────────────── */
function AdminOps() {
  const stats = [['Active orders', '34', 'var(--terra)'], ['Awaiting approval', '6', 'var(--st-pend)'], ['In transit', '5', 'var(--st-ready)'], ['Delivered today', '21', 'var(--st-done)']];
  const cols = [
    ['Pending', [['Stratford', 'Meat', 's-pend', 'Today'], ['Shoreditch', 'Pastry', 's-pend', 'Tmrw']]],
    ['Confirmed', [['Wanstead', 'Bread', 's-prog', 'Today'], ['Clapham', 'Meat', 's-prog', 'Wed'], ['Chigwell', 'Pastry', 's-prog', 'Wed']]],
    ['In Production', [['Shoreditch', 'Meat', 's-prog', 'Today']]],
    ['Ready / Transit', [['St. Albans', 'Pastry', 's-ready', 'Today'], ['S. Woodford', 'Bread', 's-ready', 'Today']]],
    ['Delivered', [['Wanstead', 'Pastry', 's-done', '8:54'], ['St. Albans', 'Meat', 's-done', '8:32']]],
  ];
  return (
    <AdminShell view="ops" title="Live Operations" sub="34 active orders across 7 shops · updated live"
      actions={<>
        <button className="btn btn-ghost btn-sm"><Icon d={I.filter} w={16} /> Filter</button>
        <button className="btn btn-ghost btn-sm"><Icon d={I.refresh} w={16} /> Live</button>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {stats.map(([l, v, c]) => (
          <div key={l} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{l}</div>
            <div className="serif" style={{ fontSize: 30, marginTop: 4, color: c }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, alignItems: 'start' }}>
        {cols.map(([title, cards]) => (
          <div key={title}>
            <div className="between" style={{ marginBottom: 10, padding: '0 2px' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{cards.length}</span>
            </div>
            <div className="col" style={{ gap: 10 }}>
              {cards.map(([shop, cat, st, when], i) => (
                <div key={i} className="card" style={{ padding: 12 }}>
                  <div className="between"><span style={{ fontWeight: 700, fontSize: 13.5 }}>{shop}</span><span className={'status ' + st} style={{ fontSize: 10, padding: '3px 7px' }}>{when}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>{cat}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

/* ── B · Catalog Management ────────────────────────────────── */
function AdminCatalog() {
  const rows = [
    ['Smoked Lamb', 'Smoked / Meat', 'Yusuf', 'per kg', '24h', true, 'Cut, Prep State'],
    ['Smoked Brisket', 'Smoked / Meat', 'Yusuf', 'per kg', '24h', false, 'Cut, Prep State'],
    ['Sourdough Bread', 'Kitchen Bread', 'Sana', 'per item', '48h', true, 'Size, Crust'],
    ['Focaccia', 'Kitchen Bread', 'Sana', 'per item', '24h', true, 'Size'],
    ['Almond Croissant', 'Pastry / Retail', 'Marcus', 'per item', '24h', true, 'Bake, Pack size'],
    ['Pistachio C.Buns', 'Pastry / Retail', 'Marcus', 'per item', '24h', true, 'Pack size'],
    ['Pickled Goods', 'Smoked / Meat', 'Yusuf', 'per kg', '24h', true, 'Note (optional)'],
  ];
  return (
    <AdminShell view="catalog" title="Catalog Management" sub="3 categories · 31 products · 5 modifier groups"
      actions={<><button className="btn btn-ghost btn-sm"><Icon d={I.search} w={16} /> Search</button><button className="btn btn-primary btn-sm"><Icon d={I.plus} w={16} /> New product</button></>}>
      <div className="row" style={{ gap: 10, marginBottom: 18 }}>
        {[['Smoked / Meat', '6', 'var(--st-bad)'], ['Kitchen Bread', '3', 'var(--st-pend)'], ['Pastry / Retail', '22', 'var(--terra)']].map(([n, c, col]) => (
          <div key={n} className="card" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: col }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{n}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{c} items</span>
          </div>
        ))}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr .8fr .7fr .6fr 1.3fr .8fr', padding: '12px 18px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          <span>Product</span><span>Category</span><span>Specialist</span><span>Unit</span><span>Lead</span><span>Modifiers</span><span style={{ textAlign: 'right' }}>Status</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr .8fr .7fr .6fr 1.3fr .8fr', padding: '13px 18px', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none', alignItems: 'center', fontSize: 13.5 }}>
            <span style={{ fontWeight: 700 }}>{r[0]}</span>
            <span style={{ color: 'var(--muted)' }}>{r[1]}</span>
            <span style={{ color: 'var(--ink-2)' }}>{r[2]}</span>
            <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{r[3]}</span>
            <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{r[4]}</span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{r[6]}</span>
            <span style={{ textAlign: 'right' }}>{r[5] ? <span className="status s-done" style={{ fontSize: 11 }}>Live</span> : <span className="status s-bad" style={{ fontSize: 11 }}>86'd</span>}</span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

Object.assign(window, { AdminShell, AdminOps, AdminCatalog });

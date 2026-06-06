/* ════ ADMIN WEB part 2 — Financial Reports + User Management ════ */

/* ── C · Financial Reports ─────────────────────────────────── */
function AdminFinance() {
  const bars = [
    ['Shoreditch', 4280, 'var(--terra)'], ['Clapham', 3120], ['St. Albans', 2740],
    ['Chigwell', 1980], ['Stratford', 3560], ['S. Woodford', 2210], ['Wanstead', 2630],
  ];
  const max = 4500;
  const shops = [
    ['Shoreditch', 'Pastry · Meat · Bread', 86, '£4,280', '+12%'],
    ['Clapham', 'Meat · Bread', 71, '£3,120', '+4%'],
    ['Stratford', 'Pastry · Meat', 64, '£3,560', '+18%'],
    ['St. Albans', 'Pastry · Bread', 58, '£2,740', '−3%'],
    ['Wanstead', 'Meat · Pastry', 52, '£2,630', '+7%'],
    ['S. Woodford', 'Bread · Pastry', 47, '£2,210', '+2%'],
    ['Chigwell', 'Pastry', 39, '£1,980', '−6%'],
  ];
  return (
    <AdminShell view="finance" title="Financial Reports" sub="May 2026 · internal transfer records across 7 shops"
      actions={<><button className="btn btn-ghost btn-sm"><Icon d={I.cal} w={16} /> May 2026</button><button className="btn btn-primary btn-sm"><Icon d={I.doc} w={16} /> Export CSV</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr', gap: 16, marginBottom: 20 }}>
        {/* totals */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Total transfers · May</div>
          <div className="serif" style={{ fontSize: 38, marginTop: 4 }}>£20,520</div>
          <div className="row" style={{ gap: 7, marginTop: 6 }}>
            <span className="status s-done" style={{ fontSize: 11 }}><Icon d={I.trend} w={13} /> +8.4% vs Apr</span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>· 312 receipts</span>
          </div>
          <div className="divider" style={{ margin: '18px 0' }} />
          {[['Pastry / Retail', '£9,140', 'var(--terra)'], ['Smoked / Meat', '£7,260', 'var(--st-bad)'], ['Kitchen Bread', '£4,120', 'var(--st-pend)']].map(([l, v, c]) => (
            <div key={l} className="between" style={{ padding: '7px 0' }}>
              <span className="row" style={{ gap: 9, fontSize: 13.5, fontWeight: 600 }}><span style={{ width: 9, height: 9, borderRadius: 99, background: c }} />{l}</span>
              <span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{v}</span>
            </div>
          ))}
        </div>
        {/* bar chart */}
        <div className="card" style={{ padding: 20 }}>
          <div className="between" style={{ marginBottom: 18 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Spend by shop</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>£ this month</span>
          </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr .8fr 1fr .8fr 1fr', padding: '12px 18px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          <span>Shop</span><span>Categories</span><span>Orders</span><span>Total</span><span>Trend</span><span style={{ textAlign: 'right' }}>Statement</span>
        </div>
        {shops.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr .8fr 1fr .8fr 1fr', padding: '13px 18px', borderBottom: i < shops.length - 1 ? '1px solid var(--line)' : 'none', alignItems: 'center', fontSize: 13.5 }}>
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

/* ── D · User Management ───────────────────────────────────── */
function AdminUsers() {
  const users = [
    ['Amara O.', 'FOH Manager', 'Shoreditch', '2m ago', true],
    ['Tom R.', 'Kitchen Manager', 'Clapham', '14m ago', true],
    ['Priya N.', 'FOH Manager', 'St. Albans', '1h ago', true],
    ['Yusuf K.', 'Meat Specialist', 'The Hub', '4m ago', true],
    ['Sana M.', 'Bread Baker', 'The Hub', '22m ago', true],
    ['Marcus B.', 'Pastry Chef', 'The Hub', '8m ago', true],
    ['Dani C.', 'Courier', 'The Hub', 'now', true],
    ['Leon F.', 'Kitchen Manager', 'Chigwell', '3d ago', false],
  ];
  const roleColor = { 'FOH Manager': 'var(--terra)', 'Kitchen Manager': 'var(--st-prog)', 'Meat Specialist': 'var(--st-bad)', 'Bread Baker': 'var(--st-pend)', 'Pastry Chef': 'var(--terra-deep)', 'Courier': 'var(--st-ready)' };
  return (
    <AdminShell view="users" title="User Management" sub="19 profiles · 7 shops + Hub · 6 roles"
      actions={<><button className="btn btn-ghost btn-sm"><Icon d={I.filter} w={16} /> Role</button><button className="btn btn-primary btn-sm"><Icon d={I.plus} w={16} /> Add user</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[['Total logins', '19'], ['Active now', '7'], ['Shop roles', '14'], ['Hub roles', '5']].map(([l, v]) => (
          <div key={l} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{l}</div>
            <div className="serif" style={{ fontSize: 28, marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1fr 1fr .9fr', padding: '12px 18px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          <span>Name</span><span>Role</span><span>Location</span><span>Last login</span><span style={{ textAlign: 'right' }}>Account</span>
        </div>
        {users.map((u, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1fr 1fr .9fr', padding: '12px 18px', borderBottom: i < users.length - 1 ? '1px solid var(--line)' : 'none', alignItems: 'center', fontSize: 13.5, opacity: u[4] ? 1 : .55 }}>
            <span className="row" style={{ gap: 11 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, color: 'var(--ink-2)' }}>{u[0].split(' ').map(x => x[0]).join('')}</span>
              <span style={{ fontWeight: 700 }}>{u[0]}</span>
            </span>
            <span className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: roleColor[u[1]] || 'var(--muted)' }} />{u[1]}</span>
            <span style={{ color: 'var(--muted)' }}>{u[2]}</span>
            <span className="mono" style={{ fontSize: 12.5, color: u[3] === 'now' ? 'var(--st-done)' : 'var(--muted)' }}>{u[3]}</span>
            <span style={{ textAlign: 'right' }}>{u[4] ? <span className="status s-done" style={{ fontSize: 11 }}>Active</span> : <span className="status s-bad" style={{ fontSize: 11 }}>Disabled</span>}</span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

Object.assign(window, { AdminFinance, AdminUsers });

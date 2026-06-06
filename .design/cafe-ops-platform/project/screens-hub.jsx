/* ════ HUB APP (dark) — Meat / Bread / Pastry Specialists ════ */

function HubHeader({ name, role, init, count }) {
  return (
    <div className="appbar">
      <div className="left">
        <div className="avatar" style={{ background: 'var(--terra-tint)', color: 'var(--terra-soft)', borderColor: 'var(--terra-tint2)' }}>{init}</div>
        <div className="col">
          <div style={{ fontWeight: 750, fontSize: 16, lineHeight: 1.1 }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{role} · The Hub</div>
        </div>
      </div>
      {count != null && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--terra-soft)', background: 'var(--terra-tint)', padding: '6px 11px', borderRadius: 99 }}>{count} pending</div>}
    </div>
  );
}

/* ── A · Specialist Inbox (pending requests) ───────────────── */
function HubInbox() {
  const reqs = [
    ['#C7A1', 'Stratford', 'Today', 6, '4m ago', 'red', ['Smoked Lamb · 8kg', 'Halal Sausage · 5kg']],
    ['#D2B4', 'Shoreditch', 'Tomorrow', 9, '12m ago', 'amber', ['Smoked Brisket · 12kg', 'Smoked Chicken · 6kg', '+3 more']],
    ['#E0C2', 'Wanstead', 'Wed 4 Jun', 4, '31m ago', 'green', ['Halal Bacon · 4kg', 'Pickled Goods · 3kg']],
  ];
  const ub = { red: 'var(--st-bad)', amber: 'var(--st-pend)', green: 'var(--st-done)' };
  return (
    <Screen dark>
      <HubHeader name="Meat & Smoke" role="Yusuf · Specialist" init="MS" count={3} />
      <Body style={{ padding: '4px 18px 18px' }}>
        <div className="seg" style={{ marginBottom: 16 }}>
          <button className="on">Inbox · 3</button>
          <button>Board · 5</button>
          <button>Catalog</button>
        </div>
        {reqs.map(([id, shop, when, n, ago, urg, items]) => (
          <div key={id} className="card" style={{ padding: 0, marginBottom: 13, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: 5, background: ub[urg], flexShrink: 0 }} />
            <div style={{ padding: 15, flex: 1 }}>
              <div className="between">
                <div className="row" style={{ gap: 9 }}>
                  <span style={{ fontWeight: 750, fontSize: 16 }}>{shop}</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{id}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{ago}</span>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <span className="status" style={{ color: ub[urg], background: 'var(--surface-3)', borderColor: 'var(--line)', fontSize: 11 }}><span className="dot" />{when}</span>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{n} items</span>
              </div>
              <div style={{ marginTop: 11, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                {items.map(it => <div key={it} className="row" style={{ gap: 7 }}><span style={{ width: 4, height: 4, borderRadius: 99, background: 'var(--terra-soft)' }} />{it}</div>)}
              </div>
              <button className="btn btn-primary btn-full btn-sm" style={{ marginTop: 13 }}>Review request <Icon d={I.chevR} w={15} /></button>
            </div>
          </div>
        ))}
      </Body>
    </Screen>
  );
}

/* ── B · Request detail → Approve & Quote / Reject ─────────── */
function HubApprove() {
  return (
    <Screen dark>
      <div className="appbar" style={{ paddingBottom: 4 }}>
        <div className="row" style={{ color: 'var(--ink-2)' }}><Icon d={I.back} w={22} /></div>
        <span style={{ fontWeight: 750, fontSize: 16 }}>Stratford · #C7A1</span>
        <span className="status" style={{ color: 'var(--st-bad)', background: 'var(--st-bad-bg)', borderColor: 'var(--st-bad-line)', fontSize: 11 }}><span className="dot" />Today</span>
      </div>
      <Body style={{ padding: '8px 18px 18px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Set unit cost as you approve</div>
        {[['Smoked Lamb', 'Leg · Fully cooked', '8 kg', '14.00'],
          ['Halal Sausage', 'Thick cut', '5 kg', '9.50'],
          ['Pickled Goods', 'Note: extra dill, less salt', '3 kg', '6.00']].map(([n, mod, q, cost], i) => (
          <div key={n} className="card" style={{ padding: 14, marginBottom: 11 }}>
            <div className="between">
              <div className="grow">
                <div style={{ fontWeight: 700, fontSize: 15 }}>{n}</div>
                <div style={{ fontSize: 12.5, color: i === 2 ? 'var(--terra-soft)' : 'var(--muted)', marginTop: 2, fontStyle: i === 2 ? 'italic' : 'normal' }}>{mod}</div>
              </div>
              <span className="mono" style={{ fontWeight: 700, fontSize: 15 }}>{q}</span>
            </div>
            <div className="between" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Unit cost / kg</span>
              <div className="row" style={{ gap: 8 }}>
                <div className="mono" style={{ background: 'var(--surface-3)', border: '1.5px solid var(--line-2)', borderRadius: 'var(--r-sm)', padding: '8px 12px', fontSize: 14, fontWeight: 700 }}>£ {cost}</div>
                <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>= £{(parseFloat(cost) * parseFloat(q)).toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
        <div className="between" style={{ padding: '6px 4px' }}>
          <span className="serif" style={{ fontSize: 18 }}>Quote total</span>
          <span className="mono" style={{ fontWeight: 700, fontSize: 20, color: 'var(--terra-soft)' }}>£177.50</span>
        </div>
      </Body>
      <div style={{ padding: '12px 18px 22px', borderTop: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" style={{ color: 'var(--st-bad)', borderColor: 'var(--st-bad-line)' }}><Icon d={I.x} w={17} /> Reject</button>
        <button className="btn btn-primary grow"><Icon d={I.check} w={18} /> Approve & Quote</button>
      </div>
    </Screen>
  );
}

/* ── C · 86 Toggle — catalog availability (Bread Baker) ────── */
function Hub86() {
  const items = [
    ['Sourdough Bread', 'per item · 48h', true, ''],
    ['Focaccia', 'per item · 24h', true, ''],
    ['Burger Bun', 'per item · 12h', false, 'Out of flour — back Wed AM'],
  ];
  return (
    <Screen dark>
      <HubHeader name="Bread" role="Sana · Baker" init="BB" />
      <Body style={{ padding: '4px 18px 18px' }}>
        <div className="seg" style={{ marginBottom: 16 }}>
          <button>Inbox · 2</button>
          <button>Board · 3</button>
          <button className="on">Catalog</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Toggle a product off to <strong style={{ color: 'var(--terra-soft)' }}>86</strong> it. Shops are notified instantly and it's hidden from their catalog.
        </div>
        {items.map(([n, sub, on, note]) => (
          <div key={n} className="card" style={{ padding: 15, marginBottom: 12 }}>
            <div className="between">
              <div className="row" style={{ gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: on ? 'var(--terra-tint)' : 'var(--st-bad-bg)', color: on ? 'var(--terra-soft)' : 'var(--st-bad)', display: 'grid', placeItems: 'center' }}><Icon d={I.bread} w={23} /></div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{n}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>
                </div>
              </div>
              {/* toggle */}
              <div style={{ width: 52, height: 30, borderRadius: 99, background: on ? 'var(--st-done)' : 'var(--line-2)', position: 'relative', flexShrink: 0, boxShadow: 'inset 0 1px 3px rgba(0,0,0,.3)' }}>
                <div style={{ width: 24, height: 24, borderRadius: 99, background: '#fff', position: 'absolute', top: 3, left: on ? 25 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.4)' }} />
              </div>
            </div>
            {!on && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--st-bad-bg)', border: '1px solid var(--st-bad-line)', display: 'flex', gap: 9, alignItems: 'center' }}>
                <Icon d={I.flame} w={16} style={{ color: 'var(--st-bad)', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{note}</span>
              </div>
            )}
          </div>
        ))}
      </Body>
    </Screen>
  );
}

Object.assign(window, { HubHeader, HubInbox, HubApprove, Hub86 });

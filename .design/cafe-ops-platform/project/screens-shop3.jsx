/* ════ SHOP APP part 3 — My Templates, Order History ════
   Spec §11.1-C (Templates, role-scoped, "Order Now" re-runs lead-time
   + cut-off validation) and §11.1-D (history, colour-coded status). ════ */

/* ── My Templates ──────────────────────────────────────────── */
function ShopTemplates() {
  const tpl = [
    { name: 'Standard Tuesday FOH Restock', items: 8, cat: 'Pastry · Retail Bakery', used: 'Used 2 days ago', ok: true },
    { name: 'Weekend Pastry Push', items: 14, cat: 'Pastry', used: 'Used last Fri', ok: true },
    { name: 'Mid-week Bread Top-up', items: 5, cat: 'Retail Bakery', used: 'Used last week', ok: false },
  ];
  return (
    <Screen>
      <div className="appbar" style={{ paddingBottom: 6 }}>
        <div className="row" style={{ color: 'var(--ink-2)' }}><Icon d={I.back} w={22} /></div>
        <span style={{ fontWeight: 750, fontSize: 16 }}>My Templates</span>
        <div className="row" style={{ color: 'var(--terra)' }}><Icon d={I.plus} w={22} /></div>
      </div>

      <Body style={{ padding: '6px 18px 18px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 2px 14px', lineHeight: 1.5 }}>
          Saved carts for your role. <strong style={{ color: 'var(--ink-2)' }}>Order Now</strong> re-checks lead times &amp; the 4 PM cut-off, then submits.
        </div>

        {tpl.map((t) => (
          <div key={t.name} className="card" style={{ padding: 15, marginBottom: 12 }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--terra-tint)', color: 'var(--terra-deep)', display: 'grid', placeItems: 'center', flexShrink: 0, border: '1px solid var(--terra-tint2)' }}><Icon d={I.list} w={21} /></div>
              <div className="grow">
                <div style={{ fontWeight: 750, fontSize: 15, lineHeight: 1.2 }}>{t.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{t.items} items · {t.cat}</div>
                <div className="row" style={{ gap: 6, marginTop: 5, fontSize: 11.5, color: 'var(--muted-2)' }}>
                  <Icon d={I.clock} w={13} /><span>{t.used}</span>
                </div>
              </div>
            </div>

            {!t.ok && (
              <div className="row" style={{ gap: 8, marginTop: 11, padding: '8px 11px', borderRadius: 'var(--r-sm)', background: 'var(--st-pend-bg)', border: '1px solid var(--st-pend-line)' }}>
                <Icon d={I.alert} w={14} style={{ color: 'var(--st-pend)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>1 item needs a later date — Sourdough 48h lead</span>
              </div>
            )}

            <div className="row" style={{ gap: 10, marginTop: 13 }}>
              <button className="btn btn-primary grow"><Icon d={I.send} w={16} /> Order Now</button>
              <button className="btn btn-ghost" style={{ flexShrink: 0, padding: '13px 15px' }}><Icon d={I.edit} w={17} /></button>
            </div>
          </div>
        ))}

        <button className="btn btn-soft btn-full" style={{ marginTop: 2 }}><Icon d={I.plus} w={17} /> New template from a cart</button>
      </Body>

      <ShopTabs active="orders" />
    </Screen>
  );
}

/* ── Order History (colour-coded list, grouped by date) ────── */
function ShopHistory() {
  const groups = [
    ['Today · 9 Jun', [
      ['#B1C8', 'Retail Bakery', '8 items', 'in_transit'],
      ['#9E3D', 'Pastry', '15 items', 'in_progress'],
      ['#C7A1', 'Meat', '13 kg', 'packaged'],
    ]],
    ['Yesterday · 8 Jun', [
      ['#A4F2', 'Pastry', '12 items', 'delivered'],
      ['#7K2D', 'Retail Bakery', '6 items', 'delivered'],
    ]],
    ['7 Jun', [
      ['#5R9P', 'Meat', '4 kg', 'rejected'],
      ['#3T1X', 'Pastry', '9 items', 'delivered'],
    ]],
  ];
  return (
    <Screen>
      <div className="appbar" style={{ paddingBottom: 8 }}>
        <span style={{ fontWeight: 750, fontSize: 17 }}>Order History</span>
        <div className="row" style={{ color: 'var(--ink-2)' }}><Icon d={I.search} w={21} /></div>
      </div>

      <div style={{ padding: '0 18px 6px' }}>
        <div className="row" style={{ gap: 7, overflowX: 'auto' }}>
          {['All', 'Active', 'Delivered', 'Rejected'].map((f, i) => (
            <span key={f} className={'chip' + (i === 0 ? ' sel' : '')} style={{ flexShrink: 0, fontSize: 12.5 }}>{f}</span>
          ))}
        </div>
      </div>

      <Body style={{ padding: '8px 18px 18px' }}>
        {groups.map(([label, rows]) => (
          <div key={label} style={{ marginBottom: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 9 }}>{label}</div>
            <div className="card" style={{ padding: '2px 14px' }}>
              {rows.map(([id, cat, qty, st], i) => (
                <div key={id} className="row" style={{ padding: '13px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-3)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon d={cat === 'Meat' ? I.meat : cat === 'Pastry' ? I.croiss : I.bread} w={20} />
                  </div>
                  <div className="grow">
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{cat}</div>
                    <div className="row" style={{ gap: 7, marginTop: 1 }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{id}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>·</span>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{qty}</span>
                    </div>
                  </div>
                  <Status s={st} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </Body>

      <ShopTabs active="history" />
    </Screen>
  );
}

Object.assign(window, { ShopTemplates, ShopHistory });

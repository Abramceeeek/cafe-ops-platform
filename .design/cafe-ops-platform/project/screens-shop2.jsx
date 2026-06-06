/* ════ SHOP APP part 2 — handshake, tracking, sign-off, kitchen ════ */

function ShopTabs({ active }) {
  const t = [['home', I.home, 'Home'], ['orders', I.bag, 'Orders'], ['new', I.plus, ''], ['history', I.clock, 'History'], ['me', I.user, 'Account']];
  return (
    <div className="tabbar">
      {t.map(([k, ic, lb]) => k === 'new' ? (
        <div key={k} style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--terra)', color: '#fff', display: 'grid', placeItems: 'center', marginTop: -18, boxShadow: '0 6px 16px rgba(194,65,12,.35)' }}><Icon d={I.plus} w={26} /></div>
      ) : (
        <div key={k} className={'tab' + (active === k ? ' on' : '')}><Icon d={ic} w={23} /><span>{lb}</span></div>
      ))}
    </div>
  );
}

/* ── D · Two-Way Handshake — Final Confirm ─────────────────── */
function ShopConfirm() {
  return (
    <Screen>
      <div className="appbar" style={{ paddingBottom: 6 }}>
        <div className="row" style={{ color: 'var(--ink-2)' }}><Icon d={I.back} w={22} /></div>
        <span style={{ fontWeight: 750, fontSize: 16 }}>Final Confirm</span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>#A4F2</span>
      </div>
      <Body style={{ padding: '6px 18px 18px' }}>
        {/* handshake stepper */}
        <div className="card" style={{ padding: '18px 16px 14px' }}>
          <div className="between" style={{ alignItems: 'flex-start' }}>
            {[['Request', 'sent', 'done'], ['Hub', 'approved', 'done'], ['Final', 'confirm', 'now']].map(([l, l2, st], i) => (
              <React.Fragment key={l}>
                {i > 0 && <div style={{ flex: 1, height: 2, background: st === 'now' ? 'var(--terra)' : 'var(--st-done)', margin: '14px 4px 0' }} />}
                <div className="col" style={{ alignItems: 'center', gap: 7, width: 72 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 99, display: 'grid', placeItems: 'center', color: '#fff',
                    background: st === 'done' ? 'var(--st-done)' : 'var(--terra)', boxShadow: st === 'now' ? '0 0 0 4px var(--terra-tint)' : 'none' }}>
                    {st === 'done' ? <Icon d={I.check} w={17} /> : <span style={{ fontWeight: 800, fontSize: 13 }}>3</span>}
                  </div>
                  <div className="col" style={{ alignItems: 'center', gap: 0 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: st === 'now' ? 'var(--ink)' : 'var(--ink-2)' }}>{l}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{l2}</span>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--st-done-bg)', border: '1px solid var(--st-done-line)', borderRadius: 'var(--r)', padding: 14, marginTop: 13, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: 99, background: 'var(--st-done)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon d={I.check} w={18} /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--st-done)' }}>Hub confirmed capacity</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.45 }}>Marcus (Pastry) approved &amp; priced your request. Review and confirm to lock it in.</div>
          </div>
        </div>

        {/* priced line items */}
        <div className="between" style={{ margin: '20px 2px 9px' }}>
          <span className="eyebrow">Approved items · priced</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Wed 4 Jun</span>
        </div>
        {[['Almond Croissant', 'Golden · Tray of 6 ×3', '£28.50'],
          ['Pain au Chocolate', 'Tray of 12 ×6', '£54.00'],
          ['Pistachio Cardamom Buns', '×24', '£60.00'],
          ['Honey Cake', '×2', '£24.00']].map(([n, m, p], i) => (
          <div key={n} className="between" style={{ padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="grow">
              <div style={{ fontWeight: 650, fontSize: 14 }}>{n}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{m}</div>
            </div>
            <span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{p}</span>
          </div>
        ))}
        <div className="between" style={{ padding: '14px 0 0' }}>
          <span className="serif" style={{ fontSize: 18 }}>Estimated total</span>
          <span className="mono" style={{ fontWeight: 700, fontSize: 21 }}>£166.50</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>Internal transfer record · not a VAT invoice</div>
      </Body>

      <div style={{ padding: '12px 18px 22px', borderTop: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" style={{ flexShrink: 0 }}>Cancel</button>
        <button className="btn btn-primary grow"><Icon d={I.check} w={18} /> Final Confirm Order</button>
      </div>
    </Screen>
  );
}

/* ── E · Order History & Tracking (timeline) ───────────────── */
function ShopTracking() {
  const steps = [
    ['Request submitted', '8 Jun · 2:14 PM', 'done'],
    ['Hub approved & priced', '8 Jun · 2:51 PM', 'done'],
    ['Final confirmed', '8 Jun · 3:02 PM', 'done'],
    ['In production', '9 Jun · 6:40 AM', 'done'],
    ['Packaged', '9 Jun · 8:05 AM', 'done'],
    ['Out for delivery', '9 Jun · 8:48 AM', 'now'],
    ['Delivered & signed', 'Awaiting sign-off', 'next'],
  ];
  return (
    <Screen>
      <div className="appbar" style={{ paddingBottom: 6 }}>
        <div className="row" style={{ color: 'var(--ink-2)' }}><Icon d={I.back} w={22} /></div>
        <span style={{ fontWeight: 750, fontSize: 16 }}>Order #B1C8</span>
        <Status s="in_transit" />
      </div>
      <Body style={{ padding: '8px 20px 18px' }}>
        <div className="card" style={{ padding: 15, marginBottom: 18, display: 'flex', gap: 13, alignItems: 'center', borderColor: 'var(--st-ready-line)' }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--st-ready-bg)', color: 'var(--st-ready)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon d={I.truck} w={24} /></div>
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 15 }}>Arriving ~9:20 AM</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Dani · stop 3 of 7 · 8 items</div>
          </div>
        </div>

        <div style={{ position: 'relative', paddingLeft: 26 }}>
          <div style={{ position: 'absolute', left: 6, top: 8, bottom: 16, width: 2, background: 'var(--line-2)' }} />
          {steps.map(([l, t, st], i) => (
            <div key={i} style={{ position: 'relative', paddingBottom: i < steps.length - 1 ? 22 : 0 }}>
              <div className={'tl-dot' + (st === 'done' ? ' done' : st === 'now' ? ' on' : '')} style={{ position: 'absolute', left: -26, top: 1, opacity: st === 'next' ? .5 : 1 }} />
              <div style={{ fontWeight: st === 'next' ? 500 : 700, fontSize: 14, color: st === 'next' ? 'var(--muted)' : 'var(--ink)' }}>{l}</div>
              <div className="mono" style={{ fontSize: 11.5, color: st === 'now' ? 'var(--st-ready)' : 'var(--muted)', marginTop: 2, fontWeight: st === 'now' ? 600 : 400 }}>{t}</div>
            </div>
          ))}
        </div>
      </Body>
      <ShopTabs active="history" />
    </Screen>
  );
}

/* ── F · Delivery Sign-off ─────────────────────────────────── */
function ShopSignoff() {
  return (
    <Screen>
      <div style={{ padding: '6px 18px 14px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--terra-tint)', color: 'var(--terra-deep)', display: 'grid', placeItems: 'center', margin: '0 auto', border: '1px solid var(--terra-tint2)' }}><Icon d={I.truck} w={30} /></div>
        <div className="serif" style={{ fontSize: 22, marginTop: 12 }}>Dani has arrived</div>
        <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 3 }}>Verify the items below, then confirm receipt.</div>
      </div>
      <Body style={{ padding: '4px 18px 14px' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="between" style={{ padding: '13px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
            <span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>#B1C8 · Retail Bakery</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>4 lines</span>
          </div>
          {[['Almond Croissant', '3 trays', true], ['Pain au Chocolate', '6 trays', true], ['Pistachio Cardamom Buns', '24', true], ['Honey Cake', '2', false]].map(([n, q, ok]) => (
            <div key={n} className="row" style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, border: '2px solid ' + (ok ? 'var(--st-done)' : 'var(--line-2)'), background: ok ? 'var(--st-done)' : 'transparent', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{ok && <Icon d={I.check} w={15} />}</div>
              <span className="grow" style={{ fontWeight: 650, fontSize: 14 }}>{n}</span>
              <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{q}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-full" style={{ marginTop: 12, color: 'var(--st-bad)', borderColor: 'var(--st-bad-line)' }}><Icon d={I.alert} w={17} /> Flag a discrepancy</button>
      </Body>
      <div style={{ padding: '12px 18px 22px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <button className="btn btn-primary btn-full btn-lg"><Icon d={I.check} w={18} /> Received &amp; Confirmed</button>
      </div>
    </Screen>
  );
}

/* ── G · Kitchen Manager Home (variant + 86 banner) ───────── */
function KitchenHome() {
  return (
    <Screen>
      <div className="appbar">
        <div className="left">
          <div className="avatar" style={{ background: 'var(--st-prog-bg)', color: 'var(--st-prog)', borderColor: 'var(--st-prog-line)' }}>CL</div>
          <div className="col">
            <div style={{ fontWeight: 750, fontSize: 16, lineHeight: 1.1 }}>Clapham</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tom · Kitchen Manager</div>
          </div>
        </div>
        <div style={{ position: 'relative', color: 'var(--ink-2)' }}><Icon d={I.bell} w={23} /></div>
      </div>
      <Body style={{ padding: '4px 18px 18px' }}>
        {/* 86 alert */}
        <div style={{ background: 'var(--st-bad-bg)', border: '1px solid var(--st-bad-line)', borderRadius: 'var(--r)', padding: '13px 15px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <Icon d={I.flame} w={20} style={{ color: 'var(--st-bad)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--st-bad)' }}>Smoked Brisket is 86'd</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 1 }}>Out at the Hub today — adjust your orders. Back tomorrow.</div>
          </div>
        </div>

        {/* compact countdown */}
        <div className="card" style={{ padding: '13px 16px', marginTop: 13, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--terra-tint)', color: 'var(--terra-deep)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon d={I.clock} w={21} /></div>
          <div className="grow">
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Cut-off for tomorrow</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 600, marginTop: 1 }}>1h 47m left</div>
          </div>
          <button className="btn btn-soft btn-sm">Order now</button>
        </div>

        <div className="between" style={{ margin: '22px 2px 11px' }}>
          <span className="serif" style={{ fontSize: 19 }}>Kitchen catalog</span>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Bread · Meat</span>
        </div>
        <div className="card" style={{ padding: '2px 14px' }}>
          {[['Sourdough Bread', I.bread, 'per loaf · 48h', false],
            ['Focaccia', I.bread, 'per tray · 24h', false],
            ['Smoked Lamb', I.meat, 'per kg · 24h', false],
            ['Smoked Brisket', I.meat, "per kg · 86'd", true],
            ['Halal Sausage', I.meat, 'per kg · 24h', false]].map(([n, ic, sub, off], i, a) => (
            <div key={n} className="row" style={{ padding: '12px 0', borderBottom: i < a.length - 1 ? '1px solid var(--line)' : 'none', opacity: off ? .55 : 1 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: off ? 'var(--st-bad-bg)' : 'var(--surface-3)', color: off ? 'var(--st-bad)' : 'var(--ink-2)', display: 'grid', placeItems: 'center' }}><Icon d={ic} w={21} /></div>
              <div className="grow">
                <div style={{ fontWeight: 650, fontSize: 14, textDecoration: off ? 'line-through' : 'none' }}>{n}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div>
              </div>
              {off ? <span className="status s-bad" style={{ fontSize: 11 }}>86</span> : <button className="btn btn-soft btn-sm">+ Add</button>}
            </div>
          ))}
        </div>
      </Body>
      <ShopTabs active="home" />
    </Screen>
  );
}

Object.assign(window, { ShopTabs, ShopConfirm, ShopTracking, ShopSignoff, KitchenHome });

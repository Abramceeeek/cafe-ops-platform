/* ════ HUB To-Do Board (landscape kitchen display) + COURIER ════ */

/* ── Hub To-Do Board — wall-mounted dark display ───────────── */
function HubBoard() {
  const cols = [
    ['Confirmed', 'shop_confirmed', [
      ['Stratford', '#C7A1', 'today', ['Smoked Lamb 8kg', 'Halal Sausage 5kg'], '6 items'],
      ['Chigwell', '#F3D1', 'tmrw', ['Smoked Chicken 7kg'], '3 items'],
    ]],
    ['In Production', 'in_progress', [
      ['Shoreditch', '#D2B4', 'today', ['Smoked Brisket 12kg', 'Smoked Chicken 6kg', '+2'], '9 items'],
    ]],
    ['Packaged', 'packaged', [
      ['Wanstead', '#E0C2', 'tmrw', ['Halal Bacon 4kg', 'Pickled Goods 3kg'], '4 items'],
      ['Clapham', '#A9E4', '2day', ['Smoked Lamb 6kg'], '2 items'],
    ]],
    ['Ready for Courier', 'ready_for_courier', [
      ['St. Albans', '#B7C2', 'today', ['Halal Sausage 9kg', 'Smoked Lamb 4kg'], '7 items'],
    ]],
  ];
  const urg = {
    today: ['var(--st-bad)', 'var(--st-bad-bg)', 'Today'],
    tmrw: ['var(--st-pend)', 'var(--st-pend-bg)', 'Tomorrow'],
    '2day': ['var(--st-done)', 'var(--st-done-bg)', '2+ days'],
  };
  return (
    <div className="scr hub" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 22 }}>
      <div className="between" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 14 }}>
          <div className="wordmark" style={{ fontSize: 21 }}>bobo <em>&</em> wild</div>
          <div style={{ width: 1, height: 22, background: 'var(--line-2)' }} />
          <div>
            <div style={{ fontWeight: 750, fontSize: 17 }}>Meat &amp; Smoke — Production Board</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yusuf · The Hub · live</div>
          </div>
        </div>
        <div className="row" style={{ gap: 16 }}>
          {Object.entries(urg).map(([k, [c, bg, l]]) => (
            <div key={k} className="row" style={{ gap: 6, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: c }} />{l}
            </div>
          ))}
          <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra-soft)' }}>09:12</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, flex: 1, minHeight: 0 }}>
        {cols.map(([title, st, cards], ci) => (
          <div key={title} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="between" style={{ padding: '13px 15px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
              <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', background: 'var(--surface-3)', borderRadius: 99, padding: '2px 9px' }}>{cards.length}</span>
            </div>
            <div className="thin" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 11, overflow: 'auto' }}>
              {cards.map(([shop, id, u, items, n]) => {
                const [c, bg, l] = urg[u];
                return (
                  <div key={id} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderLeft: '4px solid ' + c, borderRadius: 'var(--r)', padding: 13 }}>
                    <div className="between">
                      <span style={{ fontWeight: 750, fontSize: 15 }}>{shop}</span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{id}</span>
                    </div>
                    <span style={{ display: 'inline-block', marginTop: 7, fontSize: 10.5, fontWeight: 800, letterSpacing: '.03em', color: c, background: bg, padding: '3px 8px', borderRadius: 99 }}>{l.toUpperCase()}</span>
                    <div style={{ marginTop: 9, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                      {items.map(it => <div key={it}>{it}</div>)}
                    </div>
                    <div className="between" style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{n}</span>
                      {ci < 3 ? <span className="row" style={{ gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--terra-soft)' }}>Advance <Icon d={I.chevR} w={13} /></span>
                        : <span className="row" style={{ gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--st-ready)' }}><Icon d={I.truck} w={14} /> queued</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Courier · Today's Manifest ────────────────────────────── */
function CourierManifest() {
  const stops = [
    ['1', 'St. Albans', '12 St Peters St', 'done', '8:32 AM', '7 items · 2 orders'],
    ['2', 'Wanstead', '44 High St', 'done', '8:54 AM', '4 items'],
    ['3', 'Shoreditch', '9 Redchurch St', 'now', '~9:20 AM', '8 items · 2 orders'],
    ['4', 'Clapham', '210 Clapham High St', 'next', '~9:45 AM', '6 items'],
    ['5', 'Stratford', '3 The Gardens', 'next', '~10:10 AM', '11 items'],
  ];
  return (
    <Screen dark>
      <div className="appbar">
        <div className="left">
          <div className="avatar" style={{ background: 'var(--terra-tint)', color: 'var(--terra-soft)', borderColor: 'var(--terra-tint2)' }}>DC</div>
          <div className="col">
            <div style={{ fontWeight: 750, fontSize: 16, lineHeight: 1.1 }}>Today's Route</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Dani · Courier · Tue 3 Jun</div>
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--terra-soft)', background: 'var(--terra-tint)', padding: '6px 11px', borderRadius: 99 }}>2 / 5</div>
      </div>
      <Body style={{ padding: '4px 18px 18px' }}>
        <div className="card" style={{ padding: 15, marginBottom: 16, display: 'flex', gap: 13, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div className="row" style={{ gap: 16 }}>
              <div><div className="mono serif" style={{ fontSize: 22 }}>5</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>stops</div></div>
              <div><div className="mono serif" style={{ fontSize: 22 }}>36</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>items</div></div>
              <div><div className="mono serif" style={{ fontSize: 22 }}>14<span style={{ fontSize: 13 }}>mi</span></div><div style={{ fontSize: 11, color: 'var(--muted)' }}>route</div></div>
            </div>
          </div>
          <button className="btn btn-primary"><Icon d={I.pin} w={17} /> Maps</button>
        </div>

        <div style={{ position: 'relative', paddingLeft: 30 }}>
          <div style={{ position: 'absolute', left: 13, top: 12, bottom: 30, width: 2, background: 'var(--line-2)' }} />
          {stops.map(([n, shop, addr, st, eta, items]) => (
            <div key={n} style={{ position: 'relative', marginBottom: 12 }}>
              <div style={{ position: 'absolute', left: -30, top: 14, width: 28, height: 28, borderRadius: 99, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, color: '#fff',
                background: st === 'done' ? 'var(--st-done)' : st === 'now' ? 'var(--terra)' : 'var(--surface-3)', border: st === 'next' ? '2px solid var(--line-2)' : 'none', boxSizing: 'border-box',
                ...(st === 'next' ? { color: 'var(--muted)' } : {}) }}>
                {st === 'done' ? <Icon d={I.check} w={16} /> : n}
              </div>
              <div className="card" style={{ padding: 14, opacity: st === 'next' ? .7 : 1, borderColor: st === 'now' ? 'var(--terra)' : 'var(--line)', boxShadow: st === 'now' ? '0 0 0 3px var(--terra-tint)' : 'var(--sh-1)' }}>
                <div className="between">
                  <span style={{ fontWeight: 750, fontSize: 15.5 }}>{shop}</span>
                  <span className="mono" style={{ fontSize: 12, color: st === 'now' ? 'var(--terra-soft)' : 'var(--muted)', fontWeight: 600 }}>{eta}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{addr}</div>
                <div className="between" style={{ marginTop: 9 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>{items}</span>
                  {st === 'now' && <button className="btn btn-primary btn-sm">Confirm arrival</button>}
                  {st === 'done' && <span className="status s-done" style={{ fontSize: 11 }}>Signed</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Body>
    </Screen>
  );
}

/* ── Courier · Stop detail / hand-off checklist ────────────── */
function CourierStop() {
  return (
    <Screen dark>
      <div className="appbar" style={{ paddingBottom: 4 }}>
        <div className="row" style={{ color: 'var(--ink-2)' }}><Icon d={I.back} w={22} /></div>
        <span style={{ fontWeight: 750, fontSize: 16 }}>Stop 3 · Shoreditch</span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--terra-soft)' }}>~9:20</span>
      </div>
      <Body style={{ padding: '8px 18px 18px' }}>
        <div className="card" style={{ padding: 15, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--terra-tint)', color: 'var(--terra-soft)', display: 'grid', placeItems: 'center' }}><Icon d={I.pin} w={23} /></div>
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 15 }}>9 Redchurch St, E2</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Receiving: Amara (FOH)</div>
          </div>
        </div>

        <div className="eyebrow" style={{ marginBottom: 10 }}>Hand-off checklist · 2 orders</div>
        {[['Pastry · #A4F2', ['Almond Croissant ×3 trays', 'Pain au Chocolate ×6 trays', 'Honey Cake ×2'], true],
          ['Bread · #A4F9', ['Sourdough ×8', 'Focaccia ×6'], false]].map(([title, items, checked]) => (
          <div key={title} className="card" style={{ padding: 14, marginBottom: 12 }}>
            <div className="between" style={{ marginBottom: 10 }}>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{title}</span>
              <span className="status s-ready" style={{ fontSize: 11 }}>{items.length} lines</span>
            </div>
            {items.map((it, i) => (
              <div key={it} className="row" style={{ gap: 11, padding: '7px 0' }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid ' + (checked ? 'var(--st-done)' : 'var(--line-2)'), background: checked ? 'var(--st-done)' : 'transparent', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{checked && <Icon d={I.check} w={14} />}</div>
                <span style={{ fontSize: 14, fontWeight: 600, color: checked ? 'var(--ink)' : 'var(--ink-2)' }}>{it}</span>
              </div>
            ))}
          </div>
        ))}
      </Body>
      <div style={{ padding: '12px 18px 22px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <button className="btn btn-primary btn-full btn-lg">Mark delivered → request sign-off</button>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 9 }}>Shop must confirm receipt before stop closes</div>
      </div>
    </Screen>
  );
}

Object.assign(window, { HubBoard, CourierManifest, CourierStop });

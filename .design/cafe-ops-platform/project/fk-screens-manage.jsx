/* ════ FOH + Kitchen — manage & fulfilment screens ════
   templates · history · order(tracking) · signoff · discrepancy · account ══ */

/* H · MY TEMPLATES ──────────────────────────────────────────── */
function TemplatesScreen() {
  const nav = window.useNav();
  const tpl = window.DATA.TEMPLATES[nav.persona.role];
  return (
    <Screen>
      <AppBar left="back" title="My Templates" right={<button className="iconbtn" style={{ color: 'var(--terra)' }}><Icon d={I.plus} w={22} /></button>} />
      <Body style={{ padding: '6px 18px 18px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 2px 14px', lineHeight: 1.5 }}>Saved carts for your role. <strong style={{ color: 'var(--ink-2)' }}>Order Now</strong> re-checks lead times &amp; the 4 PM cut-off, then submits.</div>
        {tpl.map((t) => (
          <div key={t.id} className="card" style={{ padding: 15, marginBottom: 12 }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
              <div className="prodhero-ic" style={{ width: 42, height: 42 }}><Icon d={I.list} w={21} /></div>
              <div className="grow">
                <div style={{ fontWeight: 750, fontSize: 15, lineHeight: 1.2 }}>{t.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{t.items} items · {t.cats}</div>
                <div className="row" style={{ gap: 6, marginTop: 5, fontSize: 11.5, color: 'var(--muted-2)' }}><Icon d={I.clock} w={13} /><span>{t.used}</span></div>
              </div>
            </div>
            {t.warn && <div className="alert pend" style={{ marginTop: 11 }}><Icon d={I.alert} w={14} style={{ color: 'var(--st-pend)', flexShrink: 0 }} /><span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{t.warn}</span></div>}
            <div className="row" style={{ gap: 10, marginTop: 13 }}>
              <button onClick={() => nav.go('cart')} className="btn btn-primary grow"><Icon d={I.send} w={16} /> Order Now</button>
              <button className="btn btn-ghost" style={{ flexShrink: 0, padding: '13px 15px' }}><Icon d={I.edit} w={17} /></button>
            </div>
          </div>
        ))}
        <button onClick={() => nav.go('catalog')} className="btn btn-soft btn-full" style={{ marginTop: 2 }}><Icon d={I.plus} w={17} /> New template from a cart</button>
      </Body>
      <TabBar active="templates" />
    </Screen>
  );
}

/* I · ORDER HISTORY ─────────────────────────────────────────── */
function HistoryScreen() {
  const nav = window.useNav();
  const [filter, setFilter] = React.useState('All');
  const all = window.DATA.ORDERS[nav.persona.role];
  const active = ['shop_confirmed', 'in_progress', 'packaged', 'ready_for_courier', 'in_transit', 'specialist_approved', 'pending_request'];
  const match = (o) => filter === 'All' || (filter === 'Active' && active.includes(o.status)) || (filter === 'Delivered' && o.status === 'delivered') || (filter === 'Rejected' && (o.status === 'rejected' || o.status === 'cancelled'));
  const rows = all.filter(match);
  const groups = {};
  rows.forEach((o) => { (groups[o.date.replace(/^(Today|Yesterday) /, (m) => m)] = groups[o.date] || []).push(o); });
  const iconFor = (c) => c === 'Meat' ? I.meat : c === 'Pastry' ? I.croiss : c === 'General Pantry' ? I.box : I.bread;
  // group by date label
  const byDate = rows.reduce((acc, o) => { (acc[o.date] = acc[o.date] || []).push(o); return acc; }, {});
  return (
    <Screen>
      <AppBar title="Order History" right={<button className="iconbtn"><Icon d={I.search} w={21} /></button>} />
      <div style={{ padding: '0 18px 6px' }}>
        <div className="row" style={{ gap: 7, overflowX: 'auto' }}>
          {['All', 'Active', 'Delivered', 'Rejected'].map((f) => <button key={f} onClick={() => setFilter(f)} className={'chip' + (f === filter ? ' sel' : '')} style={{ flexShrink: 0, fontSize: 12.5 }}>{f}</button>)}
        </div>
      </div>
      <Body style={{ padding: '8px 18px 18px' }}>
        {Object.keys(byDate).length === 0 && <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, marginTop: 40 }}>No {filter.toLowerCase()} orders.</div>}
        {Object.entries(byDate).map(([date, list]) => (
          <div key={date} style={{ marginBottom: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 9 }}>{date}</div>
            <div className="card" style={{ padding: '2px 14px' }}>
              {list.map((o, i) => (
                <button key={o.id} onClick={() => nav.go('order', { id: o.id })} className="row prodrow" style={{ borderBottom: i < list.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <div className="thumb"><Icon d={iconFor(o.cat)} w={20} /></div>
                  <div className="grow" style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{o.cat}{o.group && <span style={{ fontWeight: 500, color: 'var(--muted)' }}> · {o.group}</span>}</div>
                    <div className="row" style={{ gap: 7, marginTop: 1 }}><span className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>#{o.id}</span><span style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>·</span><span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{o.qty}</span></div>
                  </div>
                  <Status s={o.status} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </Body>
      <TabBar active="history" />
    </Screen>
  );
}

/* J · ORDER DETAIL / TRACKING ───────────────────────────────── */
function OrderScreen() {
  const nav = window.useNav();
  const id = nav.params.id || 'B1C8';
  const order = [...window.DATA.ORDERS.foh_manager, ...window.DATA.ORDERS.kitchen_manager].find((o) => o.id === id) || window.DATA.ORDERS.foh_manager[1];

  if (order.status === 'rejected') {
    return (
      <Screen>
        <AppBar left="back" title={'Order #' + order.id} right={<Status s="rejected" />} />
        <Body style={{ padding: '10px 20px' }}>
          <div className="alert bad" style={{ alignItems: 'flex-start' }}>
            <Icon d={I.x} w={20} style={{ color: 'var(--st-bad)', flexShrink: 0, marginTop: 1 }} />
            <div><div style={{ fontWeight: 700, fontSize: 14, color: 'var(--st-bad)' }}>Request rejected by the Hub</div><div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.45 }}>{order.reject}</div></div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 14, lineHeight: 1.5 }}>Rejected is a terminal state (§7.3). Open a new Request to try a different date or quantity.</div>
          <button onClick={() => nav.go('catalog')} className="btn btn-soft btn-full" style={{ marginTop: 14 }}><Icon d={I.plus} w={17} /> New Request</button>
        </Body>
      </Screen>
    );
  }

  const seq = ['Request submitted', 'Hub approved & priced', 'Final confirmed', 'In production', 'Packaged', 'Out for delivery', 'Delivered & signed'];
  const stMap = { specialist_approved: 1, shop_confirmed: 2, in_progress: 3, packaged: 4, ready_for_courier: 5, in_transit: 5, delivered: 7 };
  const reached = stMap[order.status] ?? 2;
  const times = ['8 Jun · 2:14 PM', '8 Jun · 2:51 PM', '8 Jun · 3:02 PM', '9 Jun · 6:40 AM', '9 Jun · 8:05 AM', '9 Jun · 8:48 AM', 'Awaiting sign-off'];
  return (
    <Screen>
      <AppBar left="back" title={'Order #' + order.id} right={<Status s={order.status} />} />
      <Body style={{ padding: '8px 20px 18px' }}>
        {order.status === 'in_transit' && (
          <button onClick={() => nav.go('signoff', { id: order.id })} className="card" style={{ padding: 15, marginBottom: 18, display: 'flex', gap: 13, alignItems: 'center', borderColor: 'var(--st-ready-line)', width: '100%', textAlign: 'left', background: 'var(--surface)' }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--st-ready-bg)', color: 'var(--st-ready)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon d={I.truck} w={24} /></div>
            <div className="grow"><div style={{ fontWeight: 700, fontSize: 15 }}>Arriving ~9:20 AM</div><div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Dani · stop 3 of 7 · tap to sign off</div></div>
            <Icon d={I.chevR} w={18} style={{ color: 'var(--muted-2)' }} />
          </button>
        )}

        <div className="card" style={{ padding: 14, marginBottom: 18 }}>
          <div className="between"><span style={{ fontWeight: 700, fontSize: 14 }}>{order.cat}{order.group ? ' · ' + order.group : ''}</span><span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{order.qty}</span></div>
          <div className="between" style={{ marginTop: 8 }}><span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Delivery {order.date}</span><span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{order.spec}</span></div>
          {order.total > 0 && <div className="between" style={{ marginTop: 6 }}><span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Total</span><span className="mono" style={{ fontWeight: 700, fontSize: 13.5 }}>£{order.total.toFixed(2)}</span></div>}
        </div>

        <div style={{ position: 'relative', paddingLeft: 26 }}>
          <div style={{ position: 'absolute', left: 6, top: 8, bottom: 16, width: 2, background: 'var(--line-2)' }} />
          {seq.map((l, i) => {
            const st = i < reached ? 'done' : i === reached ? 'now' : 'next';
            return (
              <div key={i} style={{ position: 'relative', paddingBottom: i < seq.length - 1 ? 22 : 0 }}>
                <div className={'tl-dot' + (st === 'done' ? ' done' : st === 'now' ? ' on' : '')} style={{ position: 'absolute', left: -26, top: 1, opacity: st === 'next' ? .5 : 1 }} />
                <div style={{ fontWeight: st === 'next' ? 500 : 700, fontSize: 14, color: st === 'next' ? 'var(--muted)' : 'var(--ink)' }}>{l}</div>
                <div className="mono" style={{ fontSize: 11.5, color: st === 'now' ? 'var(--st-ready)' : 'var(--muted)', marginTop: 2, fontWeight: st === 'now' ? 600 : 400 }}>{i <= reached ? times[i] : ''}</div>
              </div>
            );
          })}
        </div>
      </Body>
      <TabBar active="history" />
    </Screen>
  );
}

/* K · DELIVERY SIGN-OFF ─────────────────────────────────────── */
function SignoffScreen() {
  const nav = window.useNav();
  const lines = [['Sourdough Loaf', '6 loaves', true], ['Focaccia', '4 trays', true], ['Baguette', '24', true]];
  const [checked, setChecked] = React.useState([true, true, true]);
  return (
    <Screen>
      <div style={{ padding: '6px 18px 14px', textAlign: 'center' }}>
        <div className="prodhero-ic" style={{ width: 56, height: 56, margin: '0 auto', borderRadius: 16 }}><Icon d={I.truck} w={30} /></div>
        <div className="serif" style={{ fontSize: 22, marginTop: 12 }}>Dani has arrived</div>
        <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 3 }}>Verify the items below, then confirm receipt.</div>
      </div>
      <Body style={{ padding: '4px 18px 14px' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="between" style={{ padding: '13px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}><span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>#B1C8 · Retail Bakery</span><span style={{ fontWeight: 700, fontSize: 13 }}>{lines.length} lines</span></div>
          {lines.map(([n, q], i) => (
            <button key={n} onClick={() => setChecked((c) => c.map((v, j) => j === i ? !v : v))} className="row" style={{ padding: '13px 16px', borderBottom: i < lines.length - 1 ? '1px solid var(--line)' : 'none', width: '100%', background: 'transparent', textAlign: 'left' }}>
              <div className="checkbox" style={{ borderColor: checked[i] ? 'var(--st-done)' : 'var(--line-2)', background: checked[i] ? 'var(--st-done)' : 'transparent' }}>{checked[i] && <Icon d={I.check} w={15} />}</div>
              <span className="grow" style={{ fontWeight: 650, fontSize: 14 }}>{n}</span>
              <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{q}</span>
            </button>
          ))}
        </div>
        <button onClick={() => nav.go('discrepancy')} className="btn btn-ghost btn-full" style={{ marginTop: 12, color: 'var(--st-bad)', borderColor: 'var(--st-bad-line)' }}><Icon d={I.alert} w={17} /> Flag a discrepancy</button>
      </Body>
      <div className="footer">
        <button onClick={() => nav.reset('home')} className="btn btn-primary btn-full btn-lg"><Icon d={I.check} w={18} /> Received &amp; Confirmed</button>
      </div>
    </Screen>
  );
}

/* L · DISCREPANCY ───────────────────────────────────────────── */
function DiscrepancyScreen() {
  const nav = window.useNav();
  const [issue, setIssue] = React.useState('Short');
  return (
    <Screen>
      <AppBar left="back" title="Flag a discrepancy" />
      <Body style={{ padding: '6px 18px 18px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 2px 16px', lineHeight: 1.5 }}>Tell the Hub what was wrong. Admin is notified and the exception is recorded against this delivery — the courier isn&rsquo;t held up.</div>
        <label className="lbl">Affected item</label>
        <div className="card" style={{ padding: '13px 15px', marginBottom: 16 }}>
          <div className="between"><span style={{ fontWeight: 650, fontSize: 14 }}>Focaccia</span><span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>4 trays</span></div>
        </div>
        <label className="lbl">Issue type</label>
        <div className="row" style={{ gap: 8, marginBottom: 16 }}>
          {['Short', 'Damaged', 'Wrong item'].map((t) => <button key={t} onClick={() => setIssue(t)} className={'chip' + (t === issue ? ' sel' : '')}>{t}</button>)}
        </div>
        <label className="lbl">Details</label>
        <textarea className="field" rows={4} placeholder="e.g. Only 2 trays of focaccia arrived, not 4." style={{ resize: 'none', fontFamily: 'var(--font-sans)' }} />
      </Body>
      <div className="footer" style={{ display: 'flex', gap: 10 }}>
        <button onClick={nav.back} className="btn btn-ghost" style={{ flexShrink: 0 }}>Cancel</button>
        <button onClick={() => nav.reset('home')} className="btn btn-primary grow" style={{ background: 'var(--st-bad)' }}><Icon d={I.send} w={17} /> Submit &amp; Confirm receipt</button>
      </div>
    </Screen>
  );
}

/* M · ACCOUNT ───────────────────────────────────────────────── */
function AccountScreen() {
  const nav = window.useNav();
  const p = nav.persona;
  const [offline, setOffline] = React.useState(false);
  return (
    <Screen>
      <AppBar title="Account" />
      <Body style={{ padding: '6px 18px 18px' }}>
        <div className="card" style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div className="avatar" style={{ width: 54, height: 54, borderRadius: 16, fontSize: 19 }}>{p.initials}</div>
          <div className="grow"><div style={{ fontWeight: 750, fontSize: 18 }}>{p.person}</div><div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 1 }}>{p.title}</div></div>
        </div>

        <div className="card" style={{ marginTop: 13, padding: '4px 16px' }}>
          {[['Shop', p.shop], ['Role', p.title], ['Catalog access', p.categories.join(' · ')], ['Account', 'Issued by Admin · internal only']].map(([k, v], i, a) => (
            <div key={k} className="between" style={{ padding: '13px 0', borderBottom: i < a.length - 1 ? '1px solid var(--line)' : 'none' }}><span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{k}</span><span style={{ fontWeight: 650, fontSize: 13.5, textAlign: 'right', maxWidth: 180 }}>{v}</span></div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 13, padding: '14px 16px' }}>
          <div className="between">
            <div className="row" style={{ gap: 11 }}><Icon d={I.refresh} w={20} style={{ color: offline ? 'var(--st-bad)' : 'var(--st-done)' }} /><div className="col"><span style={{ fontWeight: 700, fontSize: 14 }}>{offline ? 'Offline — read only' : 'Online'}</span><span style={{ fontSize: 12, color: 'var(--muted)' }}>{offline ? 'Submit & Confirm disabled (§14)' : 'Live sync active'}</span></div></div>
            <button onClick={() => setOffline((o) => !o)} className={'toggle' + (offline ? '' : ' on')}><span className="knob" /></button>
          </div>
        </div>

        <button className="btn btn-ghost btn-full" style={{ marginTop: 13 }}>Sign out</button>
        <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--muted-2)', marginTop: 14 }}>HubSync · Shop App · build {new Date().getFullYear()}.6</div>
      </Body>
      <TabBar active="account" />
    </Screen>
  );
}

Object.assign(window, { TemplatesScreen, HistoryScreen, OrderScreen, SignoffScreen, DiscrepancyScreen, AccountScreen });

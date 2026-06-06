/* ════ FOH + Kitchen — order-flow screens (interactive) ════
   home · catalog · product · cart · submitted · confirm · confirmed
   Uses window.useNav() (defined in shell), window.DATA, icons. ════ */
const { useState: useS } = React;

/* shared chrome ─────────────────────────────────────────────── */
function AppBar({ title, sub, left, right, persona }) {
  const nav = window.useNav();
  return (
    <div className="appbar" style={{ paddingBottom: 8 }}>
      {left === 'back'
        ? <button onClick={nav.back} className="iconbtn" aria-label="Back"><Icon d={I.back} w={22} /></button>
        : persona
          ? <div className="left">
              <div className="avatar">{persona.initials}</div>
              <div className="col">
                <div style={{ fontWeight: 750, fontSize: 16, lineHeight: 1.1 }}>{persona.shop.replace('Shop C — ', '')}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{persona.person} · {persona.title}</div>
              </div>
            </div>
          : <div className="col"><span style={{ fontWeight: 750, fontSize: 17 }}>{title}</span>{sub && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</span>}</div>}
      {left === 'back' && <span style={{ fontWeight: 750, fontSize: 16 }}>{title}</span>}
      <div className="row" style={{ gap: 14, color: 'var(--ink-2)' }}>{right}</div>
    </div>
  );
}

function TabBar({ active }) {
  const nav = window.useNav();
  const t = [['home', I.home, 'Home'], ['history', I.bag, 'Orders'], ['new', I.plus, ''], ['templates', I.list, 'Templates'], ['account', I.user, 'Account']];
  return (
    <div className="tabbar">
      {t.map(([k, ic, lb]) => k === 'new' ? (
        <button key={k} onClick={() => nav.go('catalog')} className="fab" aria-label="New Request"><Icon d={I.plus} w={26} /></button>
      ) : (
        <button key={k} onClick={() => nav.go(k)} className={'tab' + (active === k ? ' on' : '')}><Icon d={ic} w={23} /><span>{lb}</span></button>
      ))}
    </div>
  );
}

/* A · HOME ──────────────────────────────────────────────────── */
function HomeScreen() {
  const nav = window.useNav();
  const p = nav.persona;
  const kitchen = p.role === 'kitchen_manager';
  return (
    <Screen>
      <AppBar persona={p} right={<button onClick={() => nav.go('account')} className="iconbtn bellbtn"><Icon d={I.bell} w={23} /><span className="badge">1</span></button>} />
      <Body style={{ padding: '4px 18px 18px' }}>

        {kitchen && (
          <div className="alert bad" style={{ marginBottom: 13 }}>
            <Icon d={I.flame} w={20} style={{ color: 'var(--st-bad)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--st-bad)' }}>Smoked Brisket is 86&rsquo;d</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 1 }}>Out at the Hub today — adjust your orders. Back tomorrow.</div>
            </div>
          </div>
        )}

        {/* countdown */}
        <div className="countdown">
          <div className="between">
            <span className="cd-eyebrow">Cut-off · tomorrow&rsquo;s orders</span>
            <Icon d={I.clock} w={16} style={{ color: '#E2A878' }} />
          </div>
          <div className="mono cd-time">1<span>h</span> 47<span>m</span></div>
          <div className="cd-track"><div className="cd-fill" /></div>
          <div className="between" style={{ marginTop: 11 }}>
            <span style={{ fontSize: 12.5, color: '#CDB79E' }}>Closes 4:00 PM</span>
            <span style={{ fontSize: 12.5, color: '#CDB79E' }}>Next window · <strong style={{ color: '#EAD9C2', fontWeight: 700 }}>Wed 4 Jun</strong></span>
          </div>
        </div>

        {/* quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginTop: 14 }}>
          <button onClick={() => nav.go('catalog')} className="btn btn-primary tile"><Icon d={I.plus} w={21} /><span>New Request</span></button>
          <button onClick={() => nav.go('templates')} className="btn btn-soft tile"><Icon d={I.list} w={20} /><span>My Templates</span></button>
        </div>

        {/* needs action */}
        <div className="between sec-head"><span className="serif" style={{ fontSize: 19 }}>Needs your action</span><span className="status s-pend" style={{ fontSize: 11 }}><span className="dot" />1</span></div>
        <button onClick={() => nav.go('confirm', { id: kitchen ? 'M5B2' : 'A4F2' })} className="card actioncard">
          <div className="accent" />
          <div style={{ padding: 15 }}>
            <div className="between">
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>#{kitchen ? 'M5B2 · Bread' : 'A4F2 · Pastry'}</span>
              <Status s="specialist_approved" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 9, textAlign: 'left' }}>Hub approved &amp; priced your request</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2, textAlign: 'left' }}>{kitchen ? 'Priya quoted £88.00 · 5 lines · for Thu 5 Jun' : 'Marcus quoted £166.50 · 12 items · for Wed 4 Jun'}</div>
            <div className="btn btn-primary btn-full" style={{ marginTop: 13 }}>Review &amp; Final Confirm <Icon d={I.chevR} w={16} /></div>
          </div>
        </button>

        {/* active orders */}
        <div className="between sec-head"><span className="serif" style={{ fontSize: 19 }}>Active orders</span><span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{kitchen ? '2 live' : '3 live'}</span></div>

        {/* split group */}
        <button onClick={() => nav.go('order', { id: kitchen ? 'C7A1' : '9E3D' })} className="card groupcard">
          <div className="between" style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14.5 }}>Tuesday Request</span>
            <span className="pill-terra">2 orders</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, textAlign: 'left' }}>Split across 2 Hub specialists · delivery Wed 4 Jun</div>
          {[['Pastry', 'in_progress', I.croiss], ['Meat', 'packaged', I.meat]].map(([cat, st, ic]) => (
            <div key={cat} className="row linerow">
              <div className="thumb"><Icon d={ic} w={18} /></div>
              <div className="grow" style={{ textAlign: 'left' }}><div style={{ fontWeight: 650, fontSize: 13.5 }}>{cat}</div></div>
              <Status s={st} />
            </div>
          ))}
        </button>

        <button onClick={() => nav.go('order', { id: 'B1C8' })} className="card" style={{ padding: 15, marginTop: 11, width: '100%', textAlign: 'left', border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div className="between"><span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>#B1C8 · Retail Bakery</span><Status s="in_transit" /></div>
          <div className="row" style={{ marginTop: 9, gap: 9 }}><Icon d={I.truck} w={18} style={{ color: 'var(--st-ready)' }} /><span style={{ fontWeight: 650, fontSize: 14 }}>8 items · arriving ~9:20 AM</span></div>
        </button>
      </Body>
      <TabBar active="home" />
    </Screen>
  );
}

/* B · CATALOG ────────────────────────────────────────────────── */
function CatalogScreen() {
  const nav = window.useNav();
  const cats = nav.persona.categories;
  const [cat, setCat] = useS(cats[0]);
  const block = window.DATA.CATALOG[cat];
  const count = nav.cart.length;
  return (
    <Screen>
      <AppBar left="back" title="New Request" right={<span className="mono" style={{ fontSize: 13, color: count ? 'var(--terra)' : 'var(--muted-2)', fontWeight: 700 }}>{count} item{count !== 1 ? 's' : ''}</span>} />
      <Body style={{ padding: '4px 18px 18px' }}>
        <div className="row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={'chip' + (c === cat ? ' sel' : '')} style={{ flexShrink: 0 }}>{c}</button>)}
        </div>
        <div className="eyebrow" style={{ margin: '16px 2px 8px' }}>{cat} · {block.products.length} products</div>
        <div className="card" style={{ padding: '2px 14px' }}>
          {block.products.map((pr, i, a) => {
            const off = pr.a86;
            return (
              <button key={pr.id} disabled={off} onClick={() => !off && nav.go('product', { pid: pr.id, cat })}
                className="row prodrow" style={{ borderBottom: i < a.length - 1 ? '1px solid var(--line)' : 'none', opacity: off ? .55 : 1 }}>
                <div className="thumb" style={off ? { background: 'var(--st-bad-bg)', color: 'var(--st-bad)' } : null}><Icon d={I[block.icon]} w={21} /></div>
                <div className="grow" style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 650, fontSize: 14, textDecoration: off ? 'line-through' : 'none' }}>{pr.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>per {pr.unit} · {pr.lead}h lead{pr.mods.length ? ` · ${pr.mods.length} option${pr.mods.length > 1 ? 's' : ''}` : ''}</div>
                </div>
                {off ? <span className="status s-bad" style={{ fontSize: 11 }}>86</span> : <Icon d={I.chevR} w={18} style={{ color: 'var(--muted-2)' }} />}
              </button>
            );
          })}
        </div>
      </Body>
      <div className="footer">
        <button disabled={!count} onClick={() => nav.go('cart')} className="btn btn-primary btn-full btn-lg">{count ? <>Review Cart · {count} item{count !== 1 ? 's' : ''} <Icon d={I.chevR} w={17} /></> : 'Add an item to continue'}</button>
      </div>
    </Screen>
  );
}

/* C · PRODUCT + MODIFIER CHAIN ───────────────────────────────── */
function ProductScreen() {
  const nav = window.useNav();
  const { pid, cat } = nav.params;
  const block = window.DATA.CATALOG[cat];
  const pr = block.products.find((x) => x.id === pid);
  const [sel, setSel] = useS(() => Object.fromEntries(pr.mods.map((m, i) => [m.name, m.req && i === 0 ? m.opts[0] : null])));
  const [qty, setQty] = useS(pr.unit === 'kg' ? 5 : 3);
  const [note, setNote] = useS('');
  const missing = pr.mods.some((m) => m.req && !sel[m.name]);
  return (
    <Screen>
      <AppBar left="back" title={pr.name} />
      <Body style={{ padding: '4px 18px 18px' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="prodhero">
            <div className="prodhero-ic"><Icon d={I[block.icon]} w={30} /></div>
            <div className="grow"><div style={{ fontWeight: 750, fontSize: 17 }}>{pr.name}</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{cat} · per {pr.unit} · {pr.lead}h lead time</div></div>
          </div>
          <div style={{ padding: '14px 16px 16px' }}>
            {pr.mods.map((m) => (
              <div key={m.name} style={{ marginBottom: 14 }}>
                <div className="row" style={{ gap: 7, marginBottom: 8 }}>
                  <span className="eyebrow">{m.name}</span>
                  <span className="reqtag" style={m.req ? null : { color: 'var(--muted)', background: 'var(--surface-3)' }}>{m.req ? 'REQUIRED' : 'OPTIONAL'}</span>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {m.opts.map((o) => {
                    const on = sel[m.name] === o;
                    return <button key={o} onClick={() => setSel((s) => ({ ...s, [m.name]: on && !m.req ? null : o }))} className={'chip' + (on ? ' sel' : '')}>{on && <Icon d={I.check} w={14} />}{o}</button>;
                  })}
                </div>
              </div>
            ))}
            <div className="divider" style={{ margin: '16px 0' }} />
            <div className="between">
              <div className="col"><span style={{ fontSize: 13.5, fontWeight: 700 }}>Quantity</span><span style={{ fontSize: 12, color: 'var(--muted)' }}>{pr.unit === 'kg' ? 'kilograms' : pr.unit + 's'}</span></div>
              <div className="stepper"><button onClick={() => setQty((q) => Math.max(1, q - 1))}>–</button><span className="val">{qty}</span><button onClick={() => setQty((q) => q + 1)}>+</button></div>
            </div>
            <div className="field-wrap" style={{ marginTop: 14 }}>
              <input className="field" value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Add a note for the Hub (optional)…" style={{ fontSize: 14, padding: '12px 14px' }} />
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted-2)', marginTop: 5 }}>{note.length} / 200</div>
          </div>
        </div>
      </Body>
      <div className="footer">
        {missing && <div style={{ fontSize: 12, color: 'var(--st-pend)', textAlign: 'center', marginBottom: 9, fontWeight: 600 }}>Choose all required options to continue</div>}
        <button disabled={missing} onClick={() => nav.addToCart({ pid, cat, name: pr.name, unit: pr.unit, mods: sel, qty })} className="btn btn-soft btn-full btn-lg" style={{ background: missing ? 'var(--surface-3)' : 'var(--terra)', color: missing ? 'var(--muted-2)' : '#fff' }}><Icon d={I.plus} w={17} /> Add to request</button>
      </div>
    </Screen>
  );
}

/* D · CART + DATE PICKER ─────────────────────────────────────── */
function CartScreen() {
  const nav = window.useNav();
  const [date, setDate] = useS(4);
  const cart = nav.cart.length ? nav.cart : nav.demoCart();
  const cats = [...new Set(cart.map((c) => c.cat))];
  const split = cats.length > 1;
  const has48 = cart.some((c) => (window.DATA.CATALOG[c.cat].products.find((p) => p.id === c.pid) || {}).lead === 48);
  return (
    <Screen>
      <AppBar left="back" title="Your Cart" right={<span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{cats.join(' + ')}</span>} />
      <Body style={{ padding: '6px 18px 18px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Delivery date</div>
        <div className="row" style={{ gap: 7, overflowX: 'auto', paddingBottom: 4 }}>
          {window.DATA.DATES.map((dt) => {
            const blocked = dt.state === 'today' || dt.state === 'closed' || (has48 && dt.d === 4);
            const sel = dt.d === date;
            return (
              <button key={dt.d} disabled={blocked} onClick={() => setDate(dt.d)} className="datecell" style={{
                background: sel ? 'var(--terra)' : 'var(--surface)', color: sel ? '#fff' : blocked ? 'var(--muted-2)' : 'var(--ink)',
                borderColor: sel ? 'var(--terra)' : 'var(--line)', opacity: blocked ? .55 : 1 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, opacity: .85 }}>{dt.dow}</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{dt.d}</div>
                <div style={{ fontSize: 8, fontWeight: 800, marginTop: 2, height: 9, color: sel ? 'rgba(255,255,255,.8)' : (has48 && dt.d === 4) ? 'var(--st-pend)' : 'var(--muted-2)' }}>{dt.state === 'today' ? 'today' : dt.state === 'closed' ? 'closed' : (has48 && dt.d === 4) ? '48h' : ''}</div>
              </button>
            );
          })}
        </div>
        {has48 && <div className="alert pend" style={{ marginTop: 9 }}><Icon d={I.alert} w={15} style={{ color: 'var(--st-pend)', flexShrink: 0 }} /><span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Wed greyed — Sourdough needs 48h lead time (§9.2)</span></div>}

        {split && <div className="row" style={{ gap: 8, marginTop: 14 }}><Icon d={I.box} w={16} style={{ color: 'var(--terra)', flexShrink: 0 }} /><span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Spans {cats.length} categories — submits as <strong style={{ color: 'var(--ink)' }}>{cats.length} orders</strong>, one per Hub specialist.</span></div>}

        {cats.map((c) => (
          <div key={c} style={{ marginTop: 12 }}>
            <div className="row" style={{ gap: 7, margin: '6px 2px 2px' }}><span style={{ fontWeight: 750, fontSize: 13 }}>{c}</span><span className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>→ {window.DATA.CATALOG[c].role.replace('_', ' ')}</span></div>
            {cart.filter((it) => it.cat === c).map((it, i, arr) => (
              <div key={i} className="row" style={{ alignItems: 'flex-start', padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div className="thumb" style={{ background: 'var(--terra-tint)', color: 'var(--terra-deep)' }}><Icon d={I[window.DATA.CATALOG[c].icon]} w={21} /></div>
                <div className="grow"><div style={{ fontWeight: 700, fontSize: 14 }}>{it.name}</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>{Object.values(it.mods).filter(Boolean).join(' · ') || 'No options'}</div></div>
                <span className="mono" style={{ fontWeight: 700, fontSize: 13.5 }}>{it.qty} {it.unit}</span>
              </div>
            ))}
          </div>
        ))}

        <div className="costnote"><Icon d={I.card} w={18} style={{ flexShrink: 0 }} /><span>Costs are set by the Hub specialist at approval — you&rsquo;ll review prices at Final Confirm.</span></div>
      </Body>
      <div className="footer">
        <div className="between" style={{ marginBottom: 10 }}><span style={{ fontSize: 13.5, color: 'var(--muted)' }}>Delivery <strong style={{ color: 'var(--ink)' }}>{date === 4 ? 'Wed 4 Jun' : window.DATA.DATES.find((d) => d.d === date).label}</strong></span><span className="mono" style={{ fontWeight: 700, fontSize: 13.5 }}>{cart.length} lines · {cats.length} order{cats.length > 1 ? 's' : ''}</span></div>
        <button onClick={() => nav.go('submitted', { split, cats })} className="btn btn-primary btn-full btn-lg"><Icon d={I.send} w={17} /> Submit Request to Hub</button>
      </div>
    </Screen>
  );
}

/* E · SUBMITTED ──────────────────────────────────────────────── */
function SubmittedScreen() {
  const nav = window.useNav();
  const split = nav.params.split;
  const cats = nav.params.cats || ['Pastry'];
  return (
    <Screen>
      <Body style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="successmark pend"><Icon d={I.send} w={32} /></div>
          <div className="serif" style={{ fontSize: 24, marginTop: 16 }}>Request sent to the Hub</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>{split ? `Your cart spanned ${cats.length} categories, so it became ${cats.length} orders — one per specialist. You'll be notified when each is approved & priced.` : 'The pastry specialist has been notified. You\u2019ll get a push when it\u2019s approved & priced — then you Final Confirm.'}</div>
        </div>
        <div className="card" style={{ marginTop: 22, padding: 6 }}>
          {(split ? cats : ['Pastry']).map((c, i, a) => (
            <div key={c} className="row" style={{ padding: '12px 12px', borderBottom: i < a.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div className="thumb"><Icon d={I[(window.DATA.CATALOG[c] || {}).icon || 'croiss']} w={19} /></div>
              <div className="grow"><div style={{ fontWeight: 700, fontSize: 14 }}>{c}</div><div className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>#{['A4F2', 'C7A1'][i] || 'NEW'} · awaiting approval</div></div>
              <Status s="pending_request" />
            </div>
          ))}
        </div>
      </Body>
      <div className="footer">
        <button onClick={() => nav.reset('home')} className="btn btn-primary btn-full btn-lg">Back to Home</button>
      </div>
    </Screen>
  );
}

/* F · FINAL CONFIRM (HANDSHAKE) ──────────────────────────────── */
function ConfirmScreen() {
  const nav = window.useNav();
  const id = nav.params.id || 'A4F2';
  const lines = [['Almond Croissant', 'Golden · Tray of 6 ×3', 28.5], ['Pain au Chocolat', 'Tray of 12 ×6', 54], ['Pistachio Cardamom Bun', 'Box of 12 ×24', 60], ['Honey Cake', 'Whole ×2', 24]];
  const total = lines.reduce((s, l) => s + l[2], 0);
  return (
    <Screen>
      <AppBar left="back" title="Final Confirm" right={<span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>#{id}</span>} />
      <Body style={{ padding: '6px 18px 18px' }}>
        <div className="card" style={{ padding: '18px 16px 14px' }}>
          <div className="between" style={{ alignItems: 'flex-start' }}>
            {[['Request', 'sent', 'done'], ['Hub', 'approved', 'done'], ['Final', 'confirm', 'now']].map(([l, l2, st], i) => (
              <React.Fragment key={l}>
                {i > 0 && <div style={{ flex: 1, height: 2, background: st === 'now' ? 'var(--terra)' : 'var(--st-done)', margin: '14px 4px 0' }} />}
                <div className="col" style={{ alignItems: 'center', gap: 7, width: 72 }}>
                  <div className="hs-node" style={{ background: st === 'done' ? 'var(--st-done)' : 'var(--terra)', boxShadow: st === 'now' ? '0 0 0 4px var(--terra-tint)' : 'none' }}>{st === 'done' ? <Icon d={I.check} w={17} /> : <span style={{ fontWeight: 800, fontSize: 13 }}>3</span>}</div>
                  <div className="col" style={{ alignItems: 'center', gap: 0 }}><span style={{ fontSize: 11.5, fontWeight: 700, color: st === 'now' ? 'var(--ink)' : 'var(--ink-2)' }}>{l}</span><span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{l2}</span></div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="alert done" style={{ marginTop: 13, alignItems: 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: 99, background: 'var(--st-done)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon d={I.check} w={18} /></div>
          <div><div style={{ fontWeight: 700, fontSize: 14, color: 'var(--st-done)' }}>Hub confirmed capacity</div><div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.45 }}>Marcus (Pastry) approved &amp; priced your request. Review and confirm to lock it in.</div></div>
        </div>

        <div className="between sec-head" style={{ marginBottom: 9 }}><span className="eyebrow">Approved items · priced</span><span style={{ fontSize: 12, color: 'var(--muted)' }}>Wed 4 Jun</span></div>
        {lines.map(([n, m, p]) => (
          <div key={n} className="between" style={{ padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="grow"><div style={{ fontWeight: 650, fontSize: 14 }}>{n}</div><div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{m}</div></div>
            <span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>£{p.toFixed(2)}</span>
          </div>
        ))}
        <div className="between" style={{ padding: '14px 0 0' }}><span className="serif" style={{ fontSize: 18 }}>Estimated total</span><span className="mono" style={{ fontWeight: 700, fontSize: 21 }}>£{total.toFixed(2)}</span></div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>Internal transfer record · not a VAT invoice · immutable once confirmed (§C6)</div>
      </Body>
      <div className="footer" style={{ display: 'flex', gap: 10 }}>
        <button onClick={nav.back} className="btn btn-ghost" style={{ flexShrink: 0 }}>Cancel</button>
        <button onClick={() => nav.go('confirmed', { id })} className="btn btn-primary grow"><Icon d={I.check} w={18} /> Final Confirm</button>
      </div>
    </Screen>
  );
}

/* G · CONFIRMED ──────────────────────────────────────────────── */
function ConfirmedScreen() {
  const nav = window.useNav();
  const id = nav.params.id || 'A4F2';
  return (
    <Screen>
      <Body style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="successmark done"><Icon d={I.check} w={36} /></div>
          <div className="serif" style={{ fontSize: 24, marginTop: 16 }}>Order confirmed</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>Both approvals are complete — your order is live. The Hub specialist and the Courier have been notified.</div>
        </div>
        <div className="card" style={{ marginTop: 22, padding: 16 }}>
          <div className="between"><span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>#{id}</span><Status s="shop_confirmed" /></div>
          <div className="between" style={{ marginTop: 12 }}><span style={{ fontSize: 13, color: 'var(--muted)' }}>Delivery</span><span style={{ fontWeight: 700, fontSize: 14 }}>Wed 4 Jun</span></div>
          <div className="between" style={{ marginTop: 7 }}><span style={{ fontSize: 13, color: 'var(--muted)' }}>Total</span><span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>£166.50</span></div>
        </div>
      </Body>
      <div className="footer" style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => nav.reset('home')} className="btn btn-ghost grow">Home</button>
        <button onClick={() => nav.go('order', { id })} className="btn btn-primary grow">Track order <Icon d={I.chevR} w={16} /></button>
      </div>
    </Screen>
  );
}

Object.assign(window, { AppBar, TabBar, HomeScreen, CatalogScreen, ProductScreen, CartScreen, SubmittedScreen, ConfirmScreen, ConfirmedScreen });

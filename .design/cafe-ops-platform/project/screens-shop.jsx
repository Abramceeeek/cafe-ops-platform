/* ════ SHOP APP (light) — FOH + Kitchen Manager · part 1 ════
   Home, Catalog (modifier chain), Cart (lead-time + split-order).
   Terminology per spec §1.1: a shop's unconfirmed submission is a
   "Request"; it becomes an "Order" only after Final Confirm. ════ */

/* ── A · FOH Home / Dashboard ──────────────────────────────── */
function FohHome() {
  return (
    <Screen>
      <div className="appbar">
        <div className="left">
          <div className="avatar">SH</div>
          <div className="col">
            <div style={{ fontWeight: 750, fontSize: 16, lineHeight: 1.1 }}>Shoreditch</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Amara · FOH Manager</div>
          </div>
        </div>
        <div style={{ position: 'relative', color: 'var(--ink-2)' }}>
          <Icon d={I.bell} w={23} />
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 99, background: 'var(--terra)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', border: '2px solid var(--paper)' }}>1</span>
        </div>
      </div>

      <Body style={{ padding: '4px 18px 18px' }}>
        {/* countdown banner */}
        <div style={{ background: 'linear-gradient(150deg, #2A211A 0%, #3C2C1E 100%)', color: '#F6ECDC', borderRadius: 'var(--r-xl)', padding: '17px 20px 18px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--sh-2)' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: .55, background: 'radial-gradient(circle at 90% 8%, rgba(226,112,58,.55), transparent 58%)' }} />
          <div style={{ position: 'relative' }}>
            <div className="between">
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.13em', textTransform: 'uppercase', color: '#E2A878' }}>Cut-off · tomorrow's orders</span>
              <Icon d={I.clock} w={16} style={{ color: '#E2A878' }} />
            </div>
            <div className="mono" style={{ fontSize: 46, fontWeight: 600, letterSpacing: '-.03em', marginTop: 7, lineHeight: 1 }}>
              1<span style={{ fontSize: 22, opacity: .65, fontWeight: 500 }}>h</span> 47<span style={{ fontSize: 22, opacity: .65, fontWeight: 500 }}>m</span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,.12)', marginTop: 14, overflow: 'hidden' }}>
              <div style={{ width: '23%', height: '100%', background: 'var(--terra-soft)', borderRadius: 99 }} />
            </div>
            <div className="between" style={{ marginTop: 11 }}>
              <span style={{ fontSize: 12.5, color: '#CDB79E' }}>Closes 4:00 PM</span>
              <span style={{ fontSize: 12.5, color: '#CDB79E' }}>Next window · <strong style={{ color: '#EAD9C2', fontWeight: 700 }}>Wed 4 Jun</strong></span>
            </div>
          </div>
        </div>

        {/* quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginTop: 14 }}>
          <button className="btn btn-primary" style={{ justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'flex-start', gap: 12, height: 92, padding: 16, borderRadius: 'var(--r-lg)' }}>
            <Icon d={I.plus} w={21} />
            <span style={{ fontSize: 14.5 }}>New Request</span>
          </button>
          <button className="btn btn-soft" style={{ justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'flex-start', gap: 12, height: 92, padding: 16, borderRadius: 'var(--r-lg)' }}>
            <Icon d={I.list} w={20} />
            <span style={{ fontSize: 14.5 }}>My Templates</span>
          </button>
        </div>

        {/* needs action */}
        <div className="between" style={{ margin: '22px 2px 11px' }}>
          <span className="serif" style={{ fontSize: 19 }}>Needs your action</span>
          <span className="status s-pend" style={{ fontSize: 11 }}><span className="dot" />1</span>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderColor: 'var(--st-pend-line)' }}>
          <div style={{ height: 3, background: 'var(--st-pend)' }} />
          <div style={{ padding: 15 }}>
            <div className="between">
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>#A4F2 · Pastry</span>
              <Status s="specialist_approved" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 9 }}>Hub approved & priced your request</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Marcus quoted £166.50 · 12 items · for Wed 4 Jun</div>
            <button className="btn btn-primary btn-full" style={{ marginTop: 13 }}>Review &amp; Final Confirm <Icon d={I.chevR} w={16} /></button>
          </div>
        </div>

        {/* active today */}
        <div className="between" style={{ margin: '22px 2px 11px' }}>
          <span className="serif" style={{ fontSize: 19 }}>Active orders</span>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>3 live</span>
        </div>

        {/* split-order group card (spec §8.2) */}
        <div className="card" style={{ padding: 14 }}>
          <div className="between" style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14.5 }}>Tuesday Request</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--terra-deep)', background: 'var(--terra-tint)', padding: '3px 9px', borderRadius: 99 }}>2 orders</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Split across 2 Hub specialists · delivery Wed 4 Jun</div>
          {[['Pastry', '#9E3D', 'in_progress', I.croiss], ['Meat', '#C7A1', 'packaged', I.meat]].map(([cat, id, st, ic]) => (
            <div key={id} className="row" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-3)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center' }}><Icon d={ic} w={18} /></div>
              <div className="grow">
                <div style={{ fontWeight: 650, fontSize: 13.5 }}>{cat}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{id}</div>
              </div>
              <Status s={st} />
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 15, marginTop: 11 }}>
          <div className="between">
            <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>#B1C8 · Retail Bakery</span>
            <Status s="in_transit" />
          </div>
          <div className="row" style={{ marginTop: 9, gap: 9 }}>
            <Icon d={I.truck} w={18} style={{ color: 'var(--st-ready)' }} />
            <span style={{ fontWeight: 650, fontSize: 14 }}>8 items · arriving ~9:20 AM</span>
          </div>
        </div>
      </Body>

      <ShopTabs active="home" />
    </Screen>
  );
}

/* ── B · Catalog → Product + modifier chain ────────────────── */
function ShopCatalog() {
  return (
    <Screen>
      <div className="appbar" style={{ paddingBottom: 6 }}>
        <div className="row" style={{ color: 'var(--ink-2)' }}><Icon d={I.back} w={22} /></div>
        <span style={{ fontWeight: 750, fontSize: 16 }}>New Request</span>
        <span className="mono" style={{ fontSize: 13, color: 'var(--terra)', fontWeight: 700 }}>12 items</span>
      </div>

      <Body style={{ padding: '4px 18px 18px' }}>
        <div className="row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 2 }} >
          {['Pastry', 'Retail Bakery', 'Cookies & Cakes'].map((c, i) => (
            <span key={c} className={'chip' + (i === 0 ? ' sel' : '')} style={{ flexShrink: 0 }}>{c}</span>
          ))}
        </div>

        {/* selected product detail card */}
        <div className="card" style={{ marginTop: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 14, padding: 16, alignItems: 'center', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--terra-tint)', color: 'var(--terra-deep)', display: 'grid', placeItems: 'center', flexShrink: 0, border: '1px solid var(--terra-tint2)' }}>
              <Icon d={I.croiss} w={29} />
            </div>
            <div className="grow">
              <div style={{ fontWeight: 750, fontSize: 17 }}>Almond Croissant</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>per tray · 24h lead time</div>
            </div>
          </div>

          <div style={{ padding: '14px 16px 16px' }}>
            {/* modifier chain */}
            <ModGroup label="Bake" required options={[['Golden', 1], ['Well-baked', 0], ['Light', 0]]} />
            <ModGroup label="Pack size" required options={[['Single', 0], ['Tray of 6', 1], ['Tray of 12', 0]]} />

            <div className="divider" style={{ margin: '16px 0' }} />

            <div className="between">
              <div className="col">
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>Quantity</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>trays</span>
              </div>
              <div className="stepper">
                <button>–</button><span className="val">3</span><button>+</button>
              </div>
            </div>

            <div className="field-wrap" style={{ marginTop: 14 }}>
              <input className="field" placeholder="Add a note for the Hub (optional)…" maxLength={200} style={{ fontSize: 14, padding: '12px 14px' }} />
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted-2)', marginTop: 5 }}>0 / 200</div>

            <button className="btn btn-soft btn-full" style={{ marginTop: 6 }}><Icon d={I.plus} w={17} /> Add to request</button>
          </div>
        </div>

        {/* mini list of other items */}
        <div className="eyebrow" style={{ margin: '18px 2px 6px' }}>More in Pastry</div>
        <div className="card" style={{ padding: '2px 14px' }}>
          {[['Pain au Chocolate', I.croiss, '6', false], ['Pistachio Cardamom Buns', I.croiss, '4', false], ['Honey Cake', I.bread, '', true]].map(([n, ic, tag, add], i) => (
            <div key={n} className="row" style={{ padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-3)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center' }}><Icon d={ic} w={20} /></div>
              <div className="grow"><div style={{ fontWeight: 650, fontSize: 14 }}>{n}</div></div>
              {add
                ? <button className="btn btn-soft btn-sm">+ Add</button>
                : <span className="chip sel" style={{ fontSize: 12, padding: '6px 11px' }}>in cart · {tag}</span>}
            </div>
          ))}
        </div>
      </Body>

      <div style={{ padding: '12px 18px 22px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <button className="btn btn-primary btn-full btn-lg">Review Cart · 12 items <Icon d={I.chevR} w={17} /></button>
      </div>
    </Screen>
  );
}

/* modifier group helper — required badge + chips */
function ModGroup({ label, required, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="row" style={{ gap: 7, marginBottom: 8 }}>
        <span className="eyebrow">{label}</span>
        {required && <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', color: 'var(--terra)', background: 'var(--terra-tint)', padding: '2px 7px', borderRadius: 99 }}>REQUIRED</span>}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {options.map(([o, sel]) => (
          <span key={o} className={'chip' + (sel ? ' sel' : '')}>{sel ? <Icon d={I.check} w={14} /> : null}{o}</span>
        ))}
      </div>
    </div>
  );
}

/* ── C · Cart + delivery date picker (lead-time gating) ────── */
function ShopCart() {
  const days = [
    ['Tue', '3', 'past'],
    ['Wed', '4', 'sel'],
    ['Thu', '5', 'ok'],
    ['Fri', '6', 'lead'],
    ['Sat', '7', 'off'],
    ['Sun', '8', 'off'],
    ['Mon', '9', 'ok'],
  ];
  return (
    <Screen>
      <div className="appbar" style={{ paddingBottom: 6 }}>
        <div className="row" style={{ color: 'var(--ink-2)' }}><Icon d={I.back} w={22} /></div>
        <span style={{ fontWeight: 750, fontSize: 16 }}>Your Cart</span>
        <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Pastry + Meat</span>
      </div>

      <Body style={{ padding: '6px 18px 18px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Delivery date</div>
        <div className="row" style={{ gap: 7, overflowX: 'auto', paddingBottom: 4 }}>
          {days.map(([d, n, st]) => {
            const sel = st === 'sel';
            const blocked = st !== 'ok' && !sel;
            return (
              <div key={n} style={{ flexShrink: 0, width: 48, textAlign: 'center', padding: '9px 0 7px', borderRadius: 'var(--r)',
                background: sel ? 'var(--terra)' : 'var(--surface)', color: sel ? '#fff' : blocked ? 'var(--muted-2)' : 'var(--ink)',
                border: '1.5px solid ' + (sel ? 'var(--terra)' : 'var(--line)'), opacity: blocked ? .6 : 1, position: 'relative' }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, opacity: .85 }}>{d}</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 2, textDecoration: st === 'past' ? 'line-through' : 'none' }}>{n}</div>
                <div style={{ fontSize: 8, fontWeight: 800, marginTop: 2, height: 9, color: st === 'lead' ? 'var(--st-pend)' : 'var(--muted-2)' }}>{st === 'lead' ? '48h' : st === 'off' ? 'closed' : ''}</div>
              </div>
            );
          })}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 9, padding: '9px 12px', borderRadius: 'var(--r-sm)', background: 'var(--st-pend-bg)', border: '1px solid var(--st-pend-line)' }}>
          <Icon d={I.alert} w={15} style={{ color: 'var(--st-pend)', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Fri greyed — Sourdough needs 48h lead time</span>
        </div>

        {/* split notice */}
        <div className="row" style={{ gap: 8, marginTop: 14, marginBottom: 4 }}>
          <Icon d={I.box} w={16} style={{ color: 'var(--terra)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>This cart spans 2 categories — it'll submit as <strong style={{ color: 'var(--ink)' }}>2 orders</strong>, one per Hub specialist.</span>
        </div>

        {/* grouped line items */}
        <CartGroup title="Pastry" who="→ Marcus" items={[
          ['Almond Croissant', 'Golden · Tray of 6', '3 trays'],
          ['Pain au Chocolate', 'Tray of 12', '6 trays'],
          ['Pistachio Cardamom Buns', 'Single', '24'],
        ]} />
        <CartGroup title="Meat" who="→ Yusuf" items={[
          ['Smoked Lamb', 'Leg · Fully cooked', '8 kg'],
          ['Halal Sausage', 'Thick cut', '5 kg'],
        ]} />

        <div style={{ marginTop: 14, padding: 13, borderRadius: 'var(--r)', background: 'var(--surface-3)', border: '1px dashed var(--line-2)', fontSize: 12.5, color: 'var(--muted)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icon d={I.card} w={18} style={{ flexShrink: 0 }} />
          <span>Costs are set by the Hub specialist at approval.</span>
        </div>
      </Body>

      <div style={{ padding: '12px 18px 22px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div className="between" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>Delivery <strong style={{ color: 'var(--ink)' }}>Wed 4 Jun</strong></span>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13.5 }}>5 lines · 2 orders</span>
        </div>
        <button className="btn btn-primary btn-full btn-lg"><Icon d={I.send} w={17} /> Submit Request to Hub</button>
      </div>
    </Screen>
  );
}

function CartGroup({ title, who, items }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ gap: 7, margin: '6px 2px 2px' }}>
        <span style={{ fontWeight: 750, fontSize: 13 }}>{title}</span>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{who}</span>
      </div>
      {items.map(([n, mod, q], i) => (
        <div key={n} className="row" style={{ alignItems: 'flex-start', padding: '11px 0', borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--terra-tint)', color: 'var(--terra-deep)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon d={title === 'Meat' ? I.meat : I.croiss} w={21} /></div>
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 14 }}>{n}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>{mod}</div>
          </div>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13.5 }}>{q}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { FohHome, ShopCatalog, ShopCart, ModGroup, CartGroup });

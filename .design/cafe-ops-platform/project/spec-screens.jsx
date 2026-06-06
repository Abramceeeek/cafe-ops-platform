/* ════ Specialist (Hub App, dark) — interactive screens ════ */
const { useState: sUS } = React;

function HubBar({ title, sub, left, right }) {
  const nav = window.useNav();
  return (
    <div className="appbar" style={{ paddingBottom: 8 }}>
      {left === 'back'
        ? <button onClick={nav.back} className="iconbtn" style={{ color: 'var(--ink-2)' }}><Icon d={I.back} w={22} /></button>
        : <div className="left">
            <div className="avatar" style={{ background: 'var(--terra-tint)', color: 'var(--terra-soft)', borderColor: 'var(--terra-tint2)' }}>{nav.persona.initials}</div>
            <div className="col"><div style={{ fontWeight: 750, fontSize: 16, lineHeight: 1.1 }}>{title}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div></div>
          </div>}
      {left === 'back' && <span style={{ fontWeight: 750, fontSize: 16 }}>{title}</span>}
      <div className="row" style={{ gap: 12 }}>{right}</div>
    </div>
  );
}

function HubTabs({ active }) {
  const nav = window.useNav();
  const t = [['inbox', I.bag, 'Inbox'], ['board', I.grid, 'Board'], ['eightysix', I.flame, '86'], ['account', I.user, 'Account']];
  return (
    <div className="tabbar" style={{ background: 'var(--surface)' }}>
      {t.map(([k, ic, lb]) => (
        <button key={k} onClick={() => nav.go(k)} className={'tab' + (active === k ? ' on' : '')} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><Icon d={ic} w={22} /><span>{lb}</span></button>
      ))}
    </div>
  );
}

/* A · INBOX ──────────────────────────────────────────────────── */
function SpecInbox() {
  const nav = window.useNav();
  const d = window.SPEC.SPEC_DATA[nav.persona.key];
  return (
    <Screen dark>
      <HubBar title={nav.persona.cat} sub={`${nav.persona.person} · Specialist`}
        right={<span style={{ fontSize: 12, fontWeight: 700, color: 'var(--terra-soft)', background: 'var(--terra-tint)', padding: '6px 11px', borderRadius: 99 }}>{d.inbox.length} pending</span>} />
      <Body style={{ padding: '4px 18px 18px' }}>
        <div className="eyebrow" style={{ margin: '2px 2px 12px' }}>Pending requests · sorted by urgency</div>
        {d.inbox.map((r) => {
          const [c, lbl] = window.SPEC.URG[r.urg];
          return (
            <button key={r.id} onClick={() => nav.go('request', { id: r.id })} className="card" style={{ padding: 0, marginBottom: 13, overflow: 'hidden', display: 'flex', width: '100%', textAlign: 'left', cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' }}>
              <div style={{ width: 5, background: c, flexShrink: 0 }} />
              <div style={{ padding: 15, flex: 1, minWidth: 0 }}>
                <div className="between">
                  <div className="row" style={{ gap: 9 }}><span style={{ fontWeight: 750, fontSize: 16 }}>{r.shop}</span><span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>#{r.id}</span></div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.ago}</span>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <span className="status" style={{ color: c, background: 'var(--surface-3)', borderColor: 'var(--line)', fontSize: 11 }}><span className="dot" />{r.when}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{r.lines.length} lines</span>
                </div>
                <div style={{ marginTop: 11, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                  {r.lines.slice(0, 3).map((l) => <div key={l[0]} className="row" style={{ gap: 7 }}><span style={{ width: 4, height: 4, borderRadius: 99, background: 'var(--terra-soft)', flexShrink: 0 }} />{l[0]} · {l[2]} {nav.persona.unit === 'kg' ? 'kg' : ''}{l[1] && l[1] !== '—' ? ' · ' + l[1] : ''}</div>)}
                </div>
                <div className="btn btn-primary btn-full btn-sm" style={{ marginTop: 13 }}>Review request <Icon d={I.chevR} w={15} /></div>
              </div>
            </button>
          );
        })}
      </Body>
      <HubTabs active="inbox" />
    </Screen>
  );
}

/* B · APPROVE & QUOTE ────────────────────────────────────────── */
function SpecRequest() {
  const nav = window.useNav();
  const d = window.SPEC.SPEC_DATA[nav.persona.key];
  const req = d.inbox.find((r) => r.id === nav.params.id) || d.inbox[0];
  const unit = nav.persona.unit;
  const [costs, setCosts] = sUS(() => req.lines.map((l) => l[3]));
  const total = req.lines.reduce((s, l, i) => s + costs[i] * l[2], 0);
  const [c] = window.SPEC.URG[req.urg];
  return (
    <Screen dark>
      <HubBar left="back" title={`${req.shop} · #${req.id}`}
        right={<span className="status" style={{ color: c, background: 'var(--surface-3)', borderColor: 'var(--line)', fontSize: 11 }}><span className="dot" />{req.when}</span>} />
      <Body style={{ padding: '8px 18px 18px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Set unit cost as you approve</div>
        {req.lines.map((l, i) => {
          const note = l[1] && /,|extra|less|note/i.test(l[1]) && !/·/.test(l[1]);
          return (
            <div key={l[0]} className="card" style={{ padding: 14, marginBottom: 11 }}>
              <div className="between">
                <div className="grow"><div style={{ fontWeight: 700, fontSize: 15 }}>{l[0]}</div><div style={{ fontSize: 12.5, color: note ? 'var(--terra-soft)' : 'var(--muted)', marginTop: 2, fontStyle: note ? 'italic' : 'normal' }}>{note ? '“' + l[1] + '”' : l[1]}</div></div>
                <span className="mono" style={{ fontWeight: 700, fontSize: 15 }}>{l[2]} {unit}</span>
              </div>
              <div className="between" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Unit cost / {unit}</span>
                <div className="row" style={{ gap: 8 }}>
                  <div className="row" style={{ background: 'var(--surface-3)', border: '1.5px solid var(--line-2)', borderRadius: 'var(--r-sm)', padding: '6px 10px', gap: 4 }}>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>£</span>
                    <input className="mono" value={costs[i].toFixed(2)} onChange={(e) => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0; setCosts((cs) => cs.map((x, j) => j === i ? v : x)); }}
                      style={{ width: 52, border: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 14, fontWeight: 700, outline: 'none', fontFamily: 'var(--font-mono)' }} />
                  </div>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', minWidth: 58, textAlign: 'right' }}>= £{(costs[i] * l[2]).toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div className="between" style={{ padding: '6px 4px' }}><span className="serif" style={{ fontSize: 18 }}>Quote total</span><span className="mono" style={{ fontWeight: 700, fontSize: 20, color: 'var(--terra-soft)' }}>£{total.toFixed(2)}</span></div>
      </Body>
      <div style={{ padding: '12px 18px 22px', borderTop: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', gap: 10 }}>
        <button onClick={() => nav.go('reject', { id: req.id })} className="btn btn-ghost" style={{ color: 'var(--st-bad)', borderColor: 'var(--st-bad-line)' }}><Icon d={I.x} w={17} /> Reject</button>
        <button onClick={() => nav.go('approved', { id: req.id, total })} className="btn btn-primary grow"><Icon d={I.check} w={18} /> Approve &amp; Quote</button>
      </div>
    </Screen>
  );
}

/* C · REJECT ─────────────────────────────────────────────────── */
function SpecReject() {
  const nav = window.useNav();
  const reasons = ['At capacity for that date', 'Item unavailable / 86\u2019d', 'Quantity too large', 'Lead time too short'];
  const [r, setR] = sUS(reasons[0]);
  return (
    <Screen dark>
      <HubBar left="back" title="Reject request" />
      <Body style={{ padding: '6px 18px 18px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 2px 16px', lineHeight: 1.5 }}>A reason is required. The shop is notified and must open a new Request — rejection is terminal (§7.3).</div>
        <label className="lbl">Reason</label>
        <div className="col" style={{ gap: 8, marginBottom: 16 }}>
          {reasons.map((x) => (
            <button key={x} onClick={() => setR(x)} className="row" style={{ gap: 11, padding: '13px 14px', borderRadius: 'var(--r)', border: '1.5px solid ' + (r === x ? 'var(--terra)' : 'var(--line-2)'), background: r === x ? 'var(--terra-tint)' : 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: 18, height: 18, borderRadius: 99, border: '2px solid ' + (r === x ? 'var(--terra)' : 'var(--line-2)'), display: 'grid', placeItems: 'center', flexShrink: 0 }}>{r === x && <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--terra)' }} />}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: r === x ? 'var(--terra-deep)' : 'var(--ink-2)' }}>{x}</span>
            </button>
          ))}
        </div>
        <label className="lbl">Note to shop (optional)</label>
        <textarea className="field" rows={3} placeholder="e.g. Brisket smoker fully booked — try Thursday." style={{ resize: 'none', fontFamily: 'var(--font-sans)' }} />
      </Body>
      <div style={{ padding: '12px 18px 22px', borderTop: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', gap: 10 }}>
        <button onClick={nav.back} className="btn btn-ghost" style={{ flexShrink: 0 }}>Cancel</button>
        <button onClick={() => nav.reset('inbox')} className="btn btn-primary grow" style={{ background: 'var(--st-bad)' }}><Icon d={I.x} w={17} /> Send rejection</button>
      </div>
    </Screen>
  );
}

/* D · APPROVED ───────────────────────────────────────────────── */
function SpecApproved() {
  const nav = window.useNav();
  const total = nav.params.total || 0;
  return (
    <Screen dark>
      <Body style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="successmark done" style={{ width: 72, height: 72, borderRadius: 22, display: 'grid', placeItems: 'center', margin: '0 auto', color: '#fff', background: 'var(--st-done)' }}><Icon d={I.check} w={36} /></div>
          <div className="serif" style={{ fontSize: 24, marginTop: 16 }}>Approved &amp; priced</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>Quote sent to {nav.params.id ? '#' + nav.params.id : 'the shop'}. They&rsquo;ll Final Confirm to lock it — then it joins your board.</div>
        </div>
        <div className="card" style={{ marginTop: 22, padding: 16 }}>
          <div className="between"><span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>#{nav.params.id}</span><Status s="specialist_approved" /></div>
          {total > 0 && <div className="between" style={{ marginTop: 12 }}><span style={{ fontSize: 13, color: 'var(--muted)' }}>Quote total</span><span className="mono" style={{ fontWeight: 700, fontSize: 15, color: 'var(--terra-soft)' }}>£{total.toFixed(2)}</span></div>}
        </div>
      </Body>
      <div style={{ padding: '12px 18px 22px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <button onClick={() => nav.reset('inbox')} className="btn btn-primary btn-full btn-lg">Back to Inbox</button>
      </div>
    </Screen>
  );
}

/* E · TO-DO BOARD (wall display) ─────────────────────────────── */
function SpecBoard() {
  const nav = window.useNav();
  const base = window.SPEC.SPEC_DATA[nav.persona.key].board;
  const [cols, setCols] = sUS(() => base.map(([st, cards]) => [st, cards.map((c) => [...c])]));
  React.useEffect(() => { setCols(base.map(([st, cards]) => [st, cards.map((c) => [...c])])); }, [nav.persona.key]);
  const advance = (ci, idx) => setCols((cs) => {
    const next = cs.map(([st, cards]) => [st, cards.map((c) => [...c])]);
    const [card] = next[ci][1].splice(idx, 1);
    if (ci < next.length - 1) next[ci + 1][1].push(card);
    return next;
  });
  const order = window.SPEC.URG;
  return (
    <div className="scr hub" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 22 }}>
      <div className="between" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 14 }}>
          <div className="wordmark" style={{ fontSize: 21 }}>Hub<em style={{ color: 'var(--terra-soft)' }}>Sync</em></div>
          <div style={{ width: 1, height: 22, background: 'var(--line-2)' }} />
          <div><div style={{ fontWeight: 750, fontSize: 17 }}>{nav.persona.cat} — Production Board</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{nav.persona.person} · The Hub · live</div></div>
        </div>
        <div className="row" style={{ gap: 16 }}>
          {[['var(--st-bad)', 'Today'], ['var(--st-pend)', 'Tomorrow'], ['var(--st-done)', '2+ days']].map(([c, l]) => (
            <div key={l} className="row" style={{ gap: 6, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: c }} />{l}</div>
          ))}
          <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra-soft)' }}>09:12</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, flex: 1, minHeight: 0 }}>
        {cols.map(([st, cards], ci) => (
          <div key={st} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="between" style={{ padding: '13px 15px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{window.SPEC.COL_TITLES[st]}</span>
              <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', background: 'var(--surface-3)', borderRadius: 99, padding: '2px 9px' }}>{cards.length}</span>
            </div>
            <div className="thin" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 11, overflow: 'auto' }}>
              {cards.length === 0 && <div style={{ textAlign: 'center', color: 'var(--muted-2)', fontSize: 12, padding: '20px 0' }}>—</div>}
              {cards.map(([shop, id, u, items, n], idx) => {
                const [c, bg, l] = order[u];
                return (
                  <div key={id} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderLeft: '4px solid ' + c, borderRadius: 'var(--r)', padding: 13 }}>
                    <div className="between"><span style={{ fontWeight: 750, fontSize: 15 }}>{shop}</span><span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>#{id}</span></div>
                    <span style={{ display: 'inline-block', marginTop: 7, fontSize: 10.5, fontWeight: 800, letterSpacing: '.03em', color: c, background: bg, padding: '3px 8px', borderRadius: 99 }}>{l}</span>
                    <div style={{ marginTop: 9, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.65 }}>{items.map((it) => <div key={it}>{it}</div>)}</div>
                    <div className="between" style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{n}</span>
                      {ci < cols.length - 1
                        ? <button onClick={() => advance(ci, idx)} className="row" style={{ gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--terra-soft)', border: 'none', background: 'transparent', cursor: 'pointer' }}>Advance <Icon d={I.chevR} w={13} /></button>
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

/* F · 86 CATALOG ─────────────────────────────────────────────── */
function Spec86() {
  const nav = window.useNav();
  const base = window.SPEC.SPEC_DATA[nav.persona.key].catalog;
  const [items, setItems] = sUS(() => base.map((x) => ({ ...x })));
  React.useEffect(() => { setItems(base.map((x) => ({ ...x }))); }, [nav.persona.key]);
  const ic = nav.persona.icon;
  return (
    <Screen dark>
      <HubBar title={nav.persona.cat} sub={`${nav.persona.person} · Catalog`} />
      <Body style={{ padding: '4px 18px 18px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 2px 14px', lineHeight: 1.5 }}>Toggle a product off to <strong style={{ color: 'var(--terra-soft)' }}>86</strong> it. Shops are notified instantly and it&rsquo;s hidden from their catalog (§9.3).</div>
        {items.map((it, i) => (
          <div key={it.name} className="card" style={{ padding: 15, marginBottom: 12 }}>
            <div className="between">
              <div className="row" style={{ gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: it.on ? 'var(--terra-tint)' : 'var(--st-bad-bg)', color: it.on ? 'var(--terra-soft)' : 'var(--st-bad)', display: 'grid', placeItems: 'center' }}><Icon d={I[ic]} w={23} /></div>
                <div><div style={{ fontWeight: 700, fontSize: 15 }}>{it.name}</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>{it.sub}</div></div>
              </div>
              <button onClick={() => setItems((xs) => xs.map((x, j) => j === i ? { ...x, on: !x.on } : x))} className={'toggle' + (it.on ? ' on' : '')} style={{ width: 52, height: 30 }}>
                <span className="knob" style={{ width: 24, height: 24, left: it.on ? 25 : 3 }} />
              </button>
            </div>
            {!it.on && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--st-bad-bg)', border: '1px solid var(--st-bad-line)', display: 'flex', gap: 9, alignItems: 'center' }}>
                <Icon d={I.flame} w={16} style={{ color: 'var(--st-bad)', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{it.note || 'Out of stock — shops notified.'}</span>
              </div>
            )}
          </div>
        ))}
      </Body>
      <HubTabs active="eightysix" />
    </Screen>
  );
}

/* G · ACCOUNT ────────────────────────────────────────────────── */
function SpecAccount() {
  const nav = window.useNav();
  const p = nav.persona;
  return (
    <Screen dark>
      <HubBar title="Account" left="back" />
      <Body style={{ padding: '6px 18px 18px' }}>
        <div className="card" style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div className="avatar" style={{ width: 54, height: 54, borderRadius: 16, fontSize: 19, background: 'var(--terra-tint)', color: 'var(--terra-soft)', borderColor: 'var(--terra-tint2)' }}>{p.initials}</div>
          <div className="grow"><div style={{ fontWeight: 750, fontSize: 18 }}>{p.person}</div><div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 1 }}>{p.title} Specialist</div></div>
        </div>
        <div className="card" style={{ marginTop: 13, padding: '4px 16px' }}>
          {[['Category', p.cat], ['Location', 'The Hub'], ['Shop access', 'None — Hub role (shop_id = NULL)'], ['Offline mode', 'Disabled — Hub is always online (§14)'], ['Account', 'Issued by Admin · internal only']].map(([k, v], i, a) => (
            <div key={k} className="between" style={{ padding: '13px 0', borderBottom: i < a.length - 1 ? '1px solid var(--line)' : 'none' }}><span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{k}</span><span style={{ fontWeight: 650, fontSize: 13.5, textAlign: 'right', maxWidth: 190 }}>{v}</span></div>
          ))}
        </div>
        <button className="btn btn-ghost btn-full" style={{ marginTop: 13 }}>Sign out</button>
      </Body>
      <HubTabs active="account" />
    </Screen>
  );
}

window.mountConsole({
  brand: 'Hub<em>Sync</em>', brandSub: 'Hub App — Specialists', flowTag: 'Working spec · v2.1',
  flow: ['Inbox', 'Review', 'Quote', 'Approve', 'Board', 'Pack', 'Ready'],
  personas: window.SPEC.SPEC_PERSONAS,
  screens: window.SPEC.SPEC_META,
  components: { inbox: SpecInbox, request: SpecRequest, reject: SpecReject, approved: SpecApproved, board: SpecBoard, eightysix: Spec86, account: SpecAccount },
  defaultScreen: 'inbox',
  caption: (p) => `Hub App · ${p.title} Specialist · ${p.person}`,
  footHint: 'The Hub specialist surface only. Switch personas above (Meat / Bread / Pastry) — each role sees only its own category\u2019s requests, board and catalog (§C7). Shop, Courier and Admin are separate systems.',
});

/* ════════════════════════════════════════════════════════════════
   Courier (Hub App, dark) — working system. Single persona: Dani.
   Manifest → route → per-stop hand-off → two-party sign-off (§11.2-C).
   ════════════════════════════════════════════════════════════════ */
const { useState: kUS } = React;

const COURIER = { person: 'Dani Cole', initials: 'DC', date: 'Tue 3 Jun' };

/* today's manifest — stops ordered by optimized route */
const STOPS = [
  { n: 1, shop: 'St. Albans', addr: '12 St Peters St, AL1', state: 'done', eta: '8:32 AM', summary: '7 items · 2 orders',
    orders: [['Pastry · #B7C2', ['Almond Croissant ×3', 'Pain au Choc ×4']], ['Bread · #B7X1', ['Sourdough ×30']]] },
  { n: 2, shop: 'Wanstead', addr: '44 High St, E11', state: 'done', eta: '8:54 AM', summary: '4 items',
    orders: [['Meat · #E0C2', ['Halal Bacon ×4kg', 'Beef ×6kg']]] },
  { n: 3, shop: 'Shoreditch', addr: '9 Redchurch St, E2', state: 'now', eta: '~9:20 AM', summary: '8 items · 2 orders', receiver: 'Amara (FOH)',
    orders: [['Pastry · #A4F2', ['Almond Croissant ×3 trays', 'Pain au Chocolat ×6 trays', 'Honey Cake ×2']], ['Bread · #M5B2', ['Sourdough ×8', 'Focaccia ×6']]] },
  { n: 4, shop: 'Clapham', addr: '210 Clapham High St, SW4', state: 'next', eta: '~9:45 AM', summary: '6 items',
    orders: [['Meat · #C7A1', ['Smoked Lamb ×8kg']]] },
  { n: 5, shop: 'Camden', addr: '3 Inverness St, NW1', state: 'next', eta: '~10:10 AM', summary: '11 items · 2 orders',
    orders: [['Pastry · #F3D1', ['Choc Chip ×10']], ['Meat · #C9K2', ['Halal Sausage ×9kg']]] },
];

const CR_META = [
  { id: 'manifest', title: 'Today\u2019s Manifest', group: 'Route', kind: 'phone', frame: { dark: true }, root: true,
    sub: 'Optimised stop list + route stats.',
    purpose: 'The courier\u2019s day. All stops for today ordered by the Google-Maps-optimised route, with per-stop ETAs and item counts.',
    behaviors: [
      'Stops are ordered by the cached optimised route (Directions API), not by shop name (§11.2-C).',
      '"Maps" opens the optimised multi-stop waypoints in Google Maps.',
      'A stop bundles every order for that shop — including split orders that must all be handed off together (§8.2).',
      'Progress badge (e.g. 2 / 5) tracks completed stops.',
    ],
    data: ['delivery_manifests + manifest_stops (stop_sequence)', 'route_data (cached JSONB)', 'orders WHERE status ∈ {ready_for_courier, in_transit}'],
    spec: '§11.2-C · §8.2' },
  { id: 'stop', title: 'Stop · Hand-off', group: 'Route', kind: 'phone', frame: { dark: true },
    sub: 'Per-order checklist before delivery.',
    purpose: 'At a stop, the courier confirms arrival and ticks every line across all the shop\u2019s orders before marking delivered.',
    behaviors: [
      '"Confirm arrival" notifies the shop manager that the courier is here (§13).',
      'Hand-off checklist lists each order\u2019s lines; the courier verifies them physically.',
      '"Mark delivered" flips the order to the shop\u2019s sign-off — the courier cannot close the stop alone (§11.2-C).',
      'Split orders for one shop appear as separate checklists under the same stop.',
    ],
    data: ['orders.status → (pending shop sign-off)', 'manifest_stops.order_id'],
    spec: '§11.2-C · §8.1' },
  { id: 'signoff', title: 'Awaiting sign-off', group: 'Route', kind: 'phone', frame: { dark: true },
    sub: 'Two-party close-out — shop must confirm.',
    purpose: 'The blocking step: the stop cannot complete until the receiving shop manager confirms receipt in their app.',
    behaviors: [
      'Courier has marked delivered; the shop now sees its sign-off screen (§11.2-C, §11.1-E).',
      'On shop confirm → order status delivered, manifest_stops.signed_off_by/_at recorded, receipt generated (§8.1 step 5, §12.1).',
      'If the shop flags a discrepancy, the exception is recorded but the courier isn\u2019t held up indefinitely.',
    ],
    data: ['manifest_stops.signed_off_by / signed_off_at', 'orders.status → delivered', 'receipts (async)'],
    spec: '§11.2-C · §8.1 · §12.1' },
  { id: 'complete', title: 'Stop complete', group: 'Route', kind: 'phone', frame: { dark: true },
    sub: 'Signed; advance to next stop.',
    purpose: 'Confirm the stop closed cleanly and route the courier to the next optimised stop.',
    behaviors: ['Stop marked complete once the shop has signed (§11.2-C).', 'Surfaces the next stop + ETA from the route.'],
    data: ['manifest_stops.status', 'next stop_sequence'],
    spec: '§11.2-C' },
  { id: 'account', title: 'Account', group: 'Account', kind: 'phone', frame: { dark: true }, root: true,
    sub: 'Courier profile & vehicle.',
    purpose: 'Identity for the courier. A Hub role with no shop binding and no offline mode.',
    behaviors: ['Hub role: shop_id = NULL (§5.1).', 'Hub App has no offline mode (§14).', 'Account issued by Admin (§C1).'],
    data: ['profiles (role = courier, shop_id = NULL)'],
    spec: '§5.1 · §14 · §C1' },
];

function CRBar({ title, sub, left, right }) {
  const nav = window.useNav();
  return (
    <div className="appbar" style={{ paddingBottom: 8 }}>
      {left === 'back'
        ? <button onClick={nav.back} className="iconbtn" style={{ color: 'var(--ink-2)' }}><Icon d={I.back} w={22} /></button>
        : <div className="left">
            <div className="avatar" style={{ background: 'var(--terra-tint)', color: 'var(--terra-soft)', borderColor: 'var(--terra-tint2)' }}>{COURIER.initials}</div>
            <div className="col"><div style={{ fontWeight: 750, fontSize: 16, lineHeight: 1.1 }}>{title}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div></div>
          </div>}
      {left === 'back' && <span style={{ fontWeight: 750, fontSize: 16 }}>{title}</span>}
      <div className="row" style={{ gap: 12 }}>{right}</div>
    </div>
  );
}
function CRTabs({ active }) {
  const nav = window.useNav();
  return (
    <div className="tabbar" style={{ background: 'var(--surface)' }}>
      {[['manifest', I.truck, 'Route'], ['account', I.user, 'Account']].map(([k, ic, lb]) => (
        <button key={k} onClick={() => nav.go(k)} className={'tab' + (active === k ? ' on' : '')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', flex: 1 }}><Icon d={ic} w={22} /><span>{lb}</span></button>
      ))}
    </div>
  );
}

/* A · MANIFEST ───────────────────────────────────────────────── */
function CourierManifestScreen() {
  const nav = window.useNav();
  const done = STOPS.filter((s) => s.state === 'done').length;
  return (
    <Screen dark>
      <CRBar title="Today's Route" sub={`${COURIER.person} · Courier · ${COURIER.date}`}
        right={<span style={{ fontSize: 12, fontWeight: 700, color: 'var(--terra-soft)', background: 'var(--terra-tint)', padding: '6px 11px', borderRadius: 99 }}>{done} / {STOPS.length}</span>} />
      <Body style={{ padding: '4px 18px 18px' }}>
        <div className="card" style={{ padding: 15, marginBottom: 16, display: 'flex', gap: 13, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div className="row" style={{ gap: 18 }}>
              {[['5', 'stops'], ['36', 'items'], ['14mi', 'route']].map(([v, l]) => (
                <div key={l}><div className="mono serif" style={{ fontSize: 22 }}>{v}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{l}</div></div>
              ))}
            </div>
          </div>
          <button className="btn btn-primary"><Icon d={I.pin} w={17} /> Maps</button>
        </div>
        <div style={{ position: 'relative', paddingLeft: 30 }}>
          <div style={{ position: 'absolute', left: 13, top: 12, bottom: 30, width: 2, background: 'var(--line-2)' }} />
          {STOPS.map((s) => (
            <div key={s.n} style={{ position: 'relative', marginBottom: 12 }}>
              <div style={{ position: 'absolute', left: -30, top: 14, width: 28, height: 28, borderRadius: 99, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, color: s.state === 'next' ? 'var(--muted)' : '#fff', boxSizing: 'border-box',
                background: s.state === 'done' ? 'var(--st-done)' : s.state === 'now' ? 'var(--terra)' : 'var(--surface-3)', border: s.state === 'next' ? '2px solid var(--line-2)' : 'none' }}>
                {s.state === 'done' ? <Icon d={I.check} w={16} /> : s.n}
              </div>
              <button onClick={() => s.state !== 'done' && nav.go('stop', { n: s.n })} disabled={s.state === 'done'}
                className="card" style={{ padding: 14, opacity: s.state === 'next' ? .72 : 1, width: '100%', textAlign: 'left', cursor: s.state === 'done' ? 'default' : 'pointer',
                  borderColor: s.state === 'now' ? 'var(--terra)' : 'var(--line)', boxShadow: s.state === 'now' ? '0 0 0 3px var(--terra-tint)' : 'var(--sh-1)', background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <div className="between"><span style={{ fontWeight: 750, fontSize: 15.5 }}>{s.shop}</span><span className="mono" style={{ fontSize: 12, color: s.state === 'now' ? 'var(--terra-soft)' : 'var(--muted)', fontWeight: 600 }}>{s.eta}</span></div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{s.addr}</div>
                <div className="between" style={{ marginTop: 9 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>{s.summary}</span>
                  {s.state === 'now' && <span className="btn btn-primary btn-sm">Open stop</span>}
                  {s.state === 'done' && <span className="status s-done" style={{ fontSize: 11 }}>Signed</span>}
                </div>
              </button>
            </div>
          ))}
        </div>
      </Body>
      <CRTabs active="manifest" />
    </Screen>
  );
}

/* B · STOP · HAND-OFF CHECKLIST ──────────────────────────────── */
function CourierStopScreen() {
  const nav = window.useNav();
  const stop = STOPS.find((s) => s.n === (nav.params.n || 3)) || STOPS[2];
  const [arrived, setArrived] = kUS(false);
  const [checks, setChecks] = kUS(() => stop.orders.map((o) => o[1].map(() => false)));
  const allChecked = checks.every((o) => o.every(Boolean));
  const toggle = (oi, li) => setChecks((c) => c.map((o, i) => i === oi ? o.map((v, j) => j === li ? !v : v) : o));
  return (
    <Screen dark>
      <CRBar left="back" title={`Stop ${stop.n} · ${stop.shop}`} right={<span className="mono" style={{ fontSize: 12, color: 'var(--terra-soft)' }}>{stop.eta}</span>} />
      <Body style={{ padding: '8px 18px 18px' }}>
        <div className="card" style={{ padding: 15, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--terra-tint)', color: 'var(--terra-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon d={I.pin} w={23} /></div>
          <div className="grow"><div style={{ fontWeight: 700, fontSize: 15 }}>{stop.addr}</div><div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Receiving: {stop.receiver || 'Shop manager'}</div></div>
          {!arrived && <button onClick={() => setArrived(true)} className="btn btn-soft btn-sm">Arrived</button>}
          {arrived && <span className="status s-done" style={{ fontSize: 11 }}><Icon d={I.check} w={13} /> Here</span>}
        </div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Hand-off checklist · {stop.orders.length} orders</div>
        {stop.orders.map(([title, items], oi) => (
          <div key={title} className="card" style={{ padding: 14, marginBottom: 12 }}>
            <div className="between" style={{ marginBottom: 8 }}><span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{title}</span><span className="status s-ready" style={{ fontSize: 11 }}>{items.length} lines</span></div>
            {items.map((it, li) => (
              <button key={it} onClick={() => toggle(oi, li)} className="row" style={{ gap: 11, padding: '8px 0', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid ' + (checks[oi][li] ? 'var(--st-done)' : 'var(--line-2)'), background: checks[oi][li] ? 'var(--st-done)' : 'transparent', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{checks[oi][li] && <Icon d={I.check} w={14} />}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: checks[oi][li] ? 'var(--ink)' : 'var(--ink-2)' }}>{it}</span>
              </button>
            ))}
          </div>
        ))}
      </Body>
      <div style={{ padding: '12px 18px 22px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <button onClick={() => nav.go('signoff', { n: stop.n })} disabled={!arrived || !allChecked} className="btn btn-primary btn-full btn-lg" style={{ opacity: (!arrived || !allChecked) ? .5 : 1 }}>Mark delivered → request sign-off</button>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 9 }}>{!arrived ? 'Confirm arrival first' : !allChecked ? 'Tick every line to continue' : 'Shop must confirm receipt before the stop closes'}</div>
      </div>
    </Screen>
  );
}

/* C · AWAITING SIGN-OFF ──────────────────────────────────────── */
function CourierSignoffScreen() {
  const nav = window.useNav();
  const stop = STOPS.find((s) => s.n === (nav.params.n || 3)) || STOPS[2];
  return (
    <Screen dark>
      <CRBar left="back" title="Awaiting sign-off" />
      <Body style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, display: 'grid', placeItems: 'center', margin: '0 auto', color: '#fff', background: 'var(--terra)', position: 'relative' }}>
            <Icon d={I.user} w={34} />
            <span style={{ position: 'absolute', inset: -6, borderRadius: 26, border: '2px solid var(--terra)', opacity: .4 }} />
          </div>
          <div className="serif" style={{ fontSize: 23, marginTop: 16 }}>Handed off to {stop.shop}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>{stop.receiver || 'The shop manager'} is verifying the delivery in their app. The stop closes once they tap <strong style={{ color: 'var(--ink)' }}>Received &amp; Confirmed</strong>.</div>
        </div>
        <div className="card" style={{ marginTop: 22, padding: 16 }}>
          <div className="between"><span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>Stop {stop.n} · {stop.shop}</span><Status s="in_transit" label="Delivered" /></div>
          <div className="row" style={{ gap: 9, marginTop: 12, fontSize: 12.5, color: 'var(--muted)' }}><Icon d={I.clock} w={15} /> Waiting on shop confirmation…</div>
        </div>
      </Body>
      <div style={{ padding: '12px 18px 22px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <button onClick={() => nav.go('complete', { n: stop.n })} className="btn btn-primary btn-full btn-lg"><Icon d={I.check} w={18} /> Shop confirmed (demo)</button>
      </div>
    </Screen>
  );
}

/* D · STOP COMPLETE ──────────────────────────────────────────── */
function CourierCompleteScreen() {
  const nav = window.useNav();
  const stop = STOPS.find((s) => s.n === (nav.params.n || 3)) || STOPS[2];
  const next = STOPS.find((s) => s.n === stop.n + 1);
  return (
    <Screen dark>
      <Body style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, display: 'grid', placeItems: 'center', margin: '0 auto', color: '#fff', background: 'var(--st-done)' }}><Icon d={I.check} w={36} /></div>
          <div className="serif" style={{ fontSize: 24, marginTop: 16 }}>Stop {stop.n} complete</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>{stop.shop} signed off. Receipt generated and sent to Admin.</div>
        </div>
        {next && (
          <div className="card" style={{ marginTop: 22, padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Next stop</div>
            <div className="between"><div><div style={{ fontWeight: 750, fontSize: 16 }}>{next.shop}</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>{next.addr}</div></div><span className="mono" style={{ fontSize: 13, color: 'var(--terra-soft)', fontWeight: 600 }}>{next.eta}</span></div>
          </div>
        )}
      </Body>
      <div style={{ padding: '12px 18px 22px', borderTop: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', gap: 10 }}>
        <button onClick={() => nav.reset('manifest')} className="btn btn-ghost grow">Route</button>
        {next && <button onClick={() => nav.reset('manifest')} className="btn btn-primary grow">Next stop <Icon d={I.chevR} w={16} /></button>}
      </div>
    </Screen>
  );
}

/* E · ACCOUNT ────────────────────────────────────────────────── */
function CourierAccountScreen() {
  return (
    <Screen dark>
      <CRBar left="back" title="Account" />
      <Body style={{ padding: '6px 18px 18px' }}>
        <div className="card" style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div className="avatar" style={{ width: 54, height: 54, borderRadius: 16, fontSize: 19, background: 'var(--terra-tint)', color: 'var(--terra-soft)', borderColor: 'var(--terra-tint2)' }}>{COURIER.initials}</div>
          <div className="grow"><div style={{ fontWeight: 750, fontSize: 18 }}>{COURIER.person}</div><div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 1 }}>Courier</div></div>
        </div>
        <div className="card" style={{ marginTop: 13, padding: '4px 16px' }}>
          {[['Role', 'Courier'], ['Base', 'The Hub'], ['Shop access', 'None — Hub role (shop_id = NULL)'], ['Vehicle', 'Van · LR21 KXV'], ['Offline mode', 'Disabled — Hub is always online (§14)']].map(([k, v], i, a) => (
            <div key={k} className="between" style={{ padding: '13px 0', borderBottom: i < a.length - 1 ? '1px solid var(--line)' : 'none' }}><span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{k}</span><span style={{ fontWeight: 650, fontSize: 13.5, textAlign: 'right', maxWidth: 190 }}>{v}</span></div>
          ))}
        </div>
        <button className="btn btn-ghost btn-full" style={{ marginTop: 13 }}>Sign out</button>
      </Body>
      <CRTabs active="account" />
    </Screen>
  );
}

window.mountConsole({
  brand: 'Hub<em>Sync</em>', brandSub: 'Hub App — Courier', flowTag: 'Working spec · v2.1',
  flow: ['Manifest', 'Route', 'Arrive', 'Hand-off', 'Sign-off', 'Next'],
  personas: [{ key: 'courier', title: 'Courier', person: COURIER.person, initials: COURIER.initials, icon: 'truck' }],
  screens: CR_META,
  components: { manifest: CourierManifestScreen, stop: CourierStopScreen, signoff: CourierSignoffScreen, complete: CourierCompleteScreen, account: CourierAccountScreen },
  defaultScreen: 'manifest',
  caption: () => `Hub App · Courier · ${COURIER.person}`,
  footHint: 'The Courier surface only. The route is delivery-day scoped; a stop bundles all of a shop\u2019s orders (incl. split orders) and only closes after the shop signs off. Shop, Specialist and Admin are separate systems.',
});

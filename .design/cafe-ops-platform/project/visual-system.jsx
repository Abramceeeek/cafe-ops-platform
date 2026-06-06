/* ════ VISUAL SYSTEM panel — the language everything inherits ════ */
function VisualSystem() {
  const Sw = ({ c, n, hex, dark }) => (
    <div style={{ flex: 1 }}>
      <div style={{ height: 56, borderRadius: 10, background: c, border: '1px solid rgba(0,0,0,.08)' }} />
      <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 6, color: dark ? '#F3ECDF' : 'var(--ink)' }}>{n}</div>
      <div className="mono" style={{ fontSize: 10.5, color: dark ? '#9E9180' : 'var(--muted)' }}>{hex}</div>
    </div>
  );
  return (
    <div className="scr" style={{ height: '100%', padding: 34, background: 'var(--paper)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34, height: '100%' }}>
        {/* left: brand + type */}
        <div className="col" style={{ gap: 22 }}>
          <div>
            <div className="eyebrow">Brand · platform</div>
            <div className="wordmark" style={{ fontSize: 46, marginTop: 8, lineHeight: 1 }}>bobo <em>&</em> wild</div>
            <div className="row" style={{ gap: 9, marginTop: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#fff', background: 'var(--terra)', padding: '5px 11px', borderRadius: 99 }}>HubSync</span>
              <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>internal café operations platform · 7 shops + 1 hub</span>
            </div>
          </div>

          <div className="divider" />

          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Type system</div>
            <div className="serif" style={{ fontSize: 38, lineHeight: 1 }}>Newsreader</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>Display · titles, totals, brand voice</div>
            <div style={{ fontWeight: 750, fontSize: 30, marginTop: 18, lineHeight: 1 }}>Hanken Grotesk</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>UI · labels, body, controls</div>
            <div className="mono" style={{ fontWeight: 600, fontSize: 24, marginTop: 18 }}>IBM Plex Mono</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>Data · order IDs, quantities, timers, money</div>
          </div>
        </div>

        {/* right: color + components */}
        <div className="col" style={{ gap: 20 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Warm neutrals + terracotta</div>
            <div className="row" style={{ gap: 10 }}>
              <Sw c="#C2410C" n="Terracotta" hex="#C2410C" />
              <Sw c="#F4EEE3" n="Paper" hex="#F4EEE3" />
              <Sw c="#241D17" n="Ink" hex="#241D17" />
              <Sw c="#16120D" n="Hub dark" hex="#16120D" dark />
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Status colour code (spec §11)</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Status s="pending_request" /><Status s="shop_confirmed" /><Status s="ready_for_courier" /><Status s="delivered" /><Status s="rejected" />
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Components</div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary btn-sm">Final Confirm</button>
              <button className="btn btn-soft btn-sm">+ Add</button>
              <button className="btn btn-ghost btn-sm">Reject</button>
              <span className="chip sel"><Icon d={I.check} w={13} />Leg</span>
              <span className="chip">Minced</span>
              <div className="seg"><button className="on">Inbox</button><button>Board</button></div>
            </div>
          </div>
          <div className="card" style={{ padding: 14, marginTop: 2 }}>
            <div className="between">
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>#C7A1 · Meat</span>
              <Status s="in_progress" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 7 }}>Stratford · Smoked Lamb 8kg</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Leg · Fully cooked · delivery today</div>
          </div>
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { VisualSystem });

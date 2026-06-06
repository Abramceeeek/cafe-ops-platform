/* ════════════════════════════════════════════════════════════════
   FOH + Kitchen working console — shell, router, and mount.
   Center: a real navigable iOS app. Left: page-by-page directory.
   Right: per-screen handoff spec (purpose / behaviors / data / refs).
   ════════════════════════════════════════════════════════════════ */
const { useState: uS, useMemo: uM, useEffect: uE, useRef: uR } = React;

const NavCtx = React.createContext(null);
window.useNav = () => React.useContext(NavCtx);

const ROOTS = new Set(['home', 'history', 'templates', 'account']);
const SCREEN_CMP = {
  home: HomeScreen, catalog: CatalogScreen, product: ProductScreen, cart: CartScreen,
  submitted: SubmittedScreen, confirm: ConfirmScreen, confirmed: ConfirmedScreen,
  templates: TemplatesScreen, history: HistoryScreen, order: OrderScreen,
  signoff: SignoffScreen, discrepancy: DiscrepancyScreen, account: AccountScreen,
};

function demoCartFor(role) {
  if (role === 'kitchen_manager') return [
    { pid: 'm_lamb', cat: 'Meat', name: 'Lamb', unit: 'kg', mods: { Cut: 'Leg', 'Prep State': 'Fully Cooked' }, qty: 8 },
    { pid: 'm_saus', cat: 'Meat', name: 'Halal Sausage', unit: 'kg', mods: { Thickness: 'Thick cut' }, qty: 5 },
    { pid: 'b_sour', cat: 'Bread', name: 'Sourdough Loaf', unit: 'loaf', mods: { Size: 'Large', Crust: 'Extra Crispy' }, qty: 20 },
  ];
  return [
    { pid: 'p_almond', cat: 'Pastry', name: 'Almond Croissant', unit: 'tray', mods: { Bake: 'Golden', 'Pack size': 'Tray of 6' }, qty: 3 },
    { pid: 'p_pain', cat: 'Pastry', name: 'Pain au Chocolat', unit: 'tray', mods: { 'Pack size': 'Tray of 12' }, qty: 6 },
    { pid: 'r_sour', cat: 'Retail Bakery', name: 'Sourdough Loaf', unit: 'loaf', mods: { Size: 'Large', Crust: 'Extra Crispy' }, qty: 6 },
  ];
}

function App() {
  const [role, setRole] = uS('foh_manager');
  const [stack, setStack] = uS([{ id: 'home', params: {} }]);
  const [cart, setCart] = uS([]);
  const persona = window.DATA.PERSONAS[role];

  const nav = uM(() => ({
    persona, cart,
    get screen() { return stack[stack.length - 1].id; },
    get params() { return stack[stack.length - 1].params || {}; },
    go(id, params = {}) { ROOTS.has(id) ? setStack([{ id, params }]) : setStack((s) => [...s, { id, params }]); },
    back() { setStack((s) => s.length > 1 ? s.slice(0, -1) : s); },
    reset(id) { setStack([{ id, params: {} }]); setCart([]); },
    addToCart(item) { setCart((c) => [...c, item]); setStack((s) => s.slice(0, -1)); },
    demoCart() { return demoCartFor(role); },
  }), [stack, cart, persona, role]);

  const cur = stack[stack.length - 1].id;
  const Cmp = SCREEN_CMP[cur] || HomeScreen;

  // scale the 360×760 device to fit its (flexible) stage column
  uE(() => {
    const wrap = document.getElementById('deviceWrap');
    const stage = wrap && wrap.parentElement;
    if (!wrap || !stage) return;
    const fit = () => {
      const availW = stage.clientWidth - 36;
      const availH = stage.clientHeight - 132; // room for role switch + caption
      const s = Math.min(1, availW / 360, availH / 760);
      wrap.style.transform = `scale(${s.toFixed(3)})`;
      wrap.style.height = (760 * s) + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  const switchRole = (r) => { setRole(r); setStack([{ id: 'home', params: {} }]); setCart([]); };

  return (
    <NavCtx.Provider value={nav}>
      <div className="console">
        <DirectoryRail current={cur} go={(id) => nav.go(id)} role={role} />
        <div className="stage">
          <div className="stage-top">
            <div className="role-switch">
              {Object.values(window.DATA.PERSONAS).map((p) => (
                <button key={p.role} onClick={() => switchRole(p.role)} className={role === p.role ? 'on' : ''}>
                  <Icon d={p.role === 'foh_manager' ? I.bag : I.flame} w={16} />
                  <span>{p.title}</span>
                  <span className="who">· {p.person.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="device-wrap" id="deviceWrap">
            <div className="device">
              <div className="notch" />
              <div className="device-screen">
                <div className="statusbar"><span className="t">9:41</span><span className="r"><Icon d={I.refresh} w={14} /><span style={{ fontSize: 13, fontWeight: 700 }}>5G</span><span style={{ width: 22, height: 11, border: '1.5px solid var(--ink)', borderRadius: 3, position: 'relative', display: 'inline-block' }}><span style={{ position: 'absolute', inset: 1.5, background: 'var(--ink)', borderRadius: 1 }} /></span></span></div>
                <Cmp />
              </div>
            </div>
          </div>
          <div className="device-caption">Shop App · <b>{persona.title}</b> · {persona.shop} — tap to navigate, the flow is live</div>
        </div>
        <SpecPanel current={cur} />
      </div>
    </NavCtx.Provider>
  );
}

/* ── left: page-by-page directory ─────────────────────────────── */
function DirectoryRail({ current, go, role }) {
  const groups = ['Order flow', 'Manage', 'Fulfilment', 'Account'];
  let n = 0;
  return (
    <div className="panel thin rail">
      <div className="rail-head">
        <div className="rail-logo">Hub<em>Sync</em></div>
        <div className="rail-sub">Shop App — FOH &amp; Kitchen Managers</div>
        <div className="rail-tag"><Icon d={I.doc} w={12} /> Working spec · v2.1</div>
      </div>
      <div className="rail-flow">
        {['Browse', 'Cart', 'Submit', 'Approve', 'Confirm', 'Track', 'Sign-off'].map((s, i, a) => (
          <React.Fragment key={s}><span className="step">{s}</span>{i < a.length - 1 && <span className="arrow">›</span>}</React.Fragment>
        ))}
      </div>
      {groups.map((g) => (
        <div key={g}>
          <div className="rail-group">{g}</div>
          {window.SCREENS.filter((s) => s.group === g).map((s) => {
            n += 1; const num = String(n).padStart(2, '0');
            const on = current === s.id;
            return (
              <button key={s.id} onClick={() => go(s.id)} className={'rail-item' + (on ? ' on' : '')}>
                <span className="rail-num">{num}</span>
                <span>
                  <span className="rail-title">{s.title}</span>
                  <span className="rail-desc">{s.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── right: per-screen handoff spec ───────────────────────────── */
function SpecPanel({ current }) {
  const s = window.SCREENS.find((x) => x.id === current) || window.SCREENS[0];
  return (
    <div className="panel thin spec">
      <div className="spec-head">
        <div className="spec-kicker">{s.group}</div>
        <div className="spec-title">{s.title}</div>
        <div className="spec-sub">{s.sub}</div>
        <div className="spec-ref"><Icon d={I.doc} w={13} /> PROJECT_SPEC {s.spec}</div>
      </div>
      <div className="spec-body">
        <div className="spec-section">
          <div className="spec-label">Purpose</div>
          <div className="spec-purpose">{s.purpose}</div>
        </div>
        <div className="spec-section">
          <div className="spec-label">Behaviors &amp; rules</div>
          {s.behaviors.map((b, i) => <div key={i} className="spec-li"><span className="b">→</span><span>{b}</span></div>)}
        </div>
        <div className="spec-section">
          <div className="spec-label">Data / state touched</div>
          {s.data.map((d, i) => <div key={i} className="spec-data"><span className="dot">●</span><span>{d}</span></div>)}
        </div>
        <div className="spec-section">
          <div className="spec-label">Roles</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {s.roles.map((r) => <span key={r} className="spec-ref" style={{ marginTop: 0 }}>{window.DATA.PERSONAS[r].title}</span>)}
          </div>
        </div>
      </div>
      <div className="spec-foot">
        <div className="spec-hint">This console documents the FOH + Kitchen (Shop App) surface only. Hub specialist, Courier, and Admin Web are separate apps in the spec. Every screen here maps to a real status & table — switch personas above to see role-scoped catalogs and home states.</div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

/* ════════════════════════════════════════════════════════════════
   Shared console shell — generic router + rail + spec panel + frame.
   window.mountConsole(config) renders one working-system console.

   config = {
     brand, brandSub, flowTag,        // rail header
     flow: [..steps],                 // rail flow strip
     personas: [{key,title,person,initials,sub,icon}],  // optional switch
     screens: [{ id, title, group, kind, frame:{w,h,dark?}, root?,
                 sub, purpose, behaviors[], data[], spec, roles?[] }],
     components: { id: Component },    // each renders frame INNER content
     defaultScreen, footHint, caption(persona) }
   Screens read window.useNav(): { persona, screen, params, go, back, reset }
   ════════════════════════════════════════════════════════════════ */
const { useState: cS, useMemo: cM, useEffect: cE } = React;

const ConsoleNav = React.createContext(null);
window.useNav = () => React.useContext(ConsoleNav);

function StatusBar({ dark }) {
  const col = dark ? '#F3ECDF' : 'var(--ink)';
  return (
    <div className="statusbar" style={{ color: col }}>
      <span className="t">9:41</span>
      <span className="r"><Icon d={I.refresh} w={14} /><span style={{ fontSize: 13, fontWeight: 700 }}>5G</span>
        <span style={{ width: 22, height: 11, border: '1.5px solid ' + col, borderRadius: 3, position: 'relative', display: 'inline-block' }}><span style={{ position: 'absolute', inset: 1.5, background: col, borderRadius: 1 }} /></span>
      </span>
    </div>
  );
}

function Frame({ meta, children }) {
  const f = meta.frame || { w: 360, h: 760 };
  if (meta.kind === 'browser') {
    return (
      <div className="browser" style={{ width: f.w, height: f.h }}>
        <div className="browser-bar">
          <div className="browser-lights"><span style={{ background: '#E0685B' }} /><span style={{ background: '#E6B43E' }} /><span style={{ background: '#5FB85A' }} /></div>
          <div className="browser-url"><Icon d={I.refresh} w={13} /> {f.url || 'hubsync.app'}</div>
        </div>
        <div className="browser-body">{children}</div>
      </div>
    );
  }
  if (meta.kind === 'board') {
    return (
      <div className="board-mon" style={{ width: f.w, height: f.h }}>
        <div className="board-screen">{children}</div>
      </div>
    );
  }
  // phone
  return (
    <div className="device">
      <div className="notch" />
      <div className="device-screen" style={{ background: f.dark ? '#16120D' : 'var(--paper)' }}>
        <StatusBar dark={f.dark} />
        {children}
      </div>
    </div>
  );
}

function Console({ config }) {
  const personas = config.personas || [{ key: 'only', title: '', person: '', initials: '' }];
  const [pKey, setPKey] = cS(personas[0].key);
  const persona = personas.find((p) => p.key === pKey);
  const rootIds = new Set(config.screens.filter((s) => s.root).map((s) => s.id));
  const first = config.defaultScreen || config.screens.find((s) => s.root).id;
  const [stack, setStack] = cS([{ id: first, params: {} }]);
  const [focus, setFocus] = cS(false);

  const nav = cM(() => ({
    persona,
    get screen() { return stack[stack.length - 1].id; },
    get params() { return stack[stack.length - 1].params || {}; },
    go(id, params = {}) { rootIds.has(id) ? setStack([{ id, params }]) : setStack((s) => [...s, { id, params }]); },
    back() { setStack((s) => s.length > 1 ? s.slice(0, -1) : s); },
    reset(id, params = {}) { setStack([{ id, params }]); },
  }), [stack, persona]);

  const cur = stack[stack.length - 1].id;
  const meta = config.screens.find((s) => s.id === cur) || config.screens[0];
  const Cmp = config.components[cur] || (() => null);

  cE(() => {
    const wrap = document.getElementById('frameWrap');
    const stage = wrap && wrap.parentElement;
    if (!wrap || !stage) return;
    const fit = () => {
      const f = meta.frame || { w: 360, h: 760 };
      const fw = meta.kind === 'phone' ? 360 : f.w;
      const fh = meta.kind === 'phone' ? 760 : f.h;
      const availW = stage.clientWidth - 40;
      const availH = stage.clientHeight - 156;
      const s = Math.min(1, availW / fw, availH / fh);
      wrap.style.transform = `scale(${s.toFixed(3)})`;
      wrap.style.width = fw + 'px';
      wrap.style.height = (fh * s) + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [cur, meta.kind]);

  const switchPersona = (k) => { setPKey(k); setStack([{ id: first, params: {} }]); };

  return (
    <ConsoleNav.Provider value={nav}>
      <div className={'console' + (focus ? ' focus' : '')}>
        <DirectoryRail config={config} current={cur} go={(id) => nav.go(id)} />
        <div className="stage">
          <button className="focusbtn" onClick={() => setFocus((f) => !f)}>
            <Icon d={focus ? I.grid : I.x} w={14} />{focus ? 'Show panels' : 'Focus'}
          </button>
          {personas.length > 1 && (
            <div className="stage-top">
              <div className="role-switch">
                {personas.map((p) => (
                  <button key={p.key} onClick={() => switchPersona(p.key)} className={pKey === p.key ? 'on' : ''}>
                    <Icon d={p.icon || I.user} w={16} /><span>{p.title}</span>{p.person && personas.length <= 2 && <span className="who">· {p.person.split(' ')[0]}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="frame-wrap" id="frameWrap" style={{ transformOrigin: 'center center' }}>
            <Frame meta={meta}><Cmp /></Frame>
          </div>
          <div className="device-caption">{config.caption ? config.caption(persona) : config.brand} &nbsp;·&nbsp; tap to navigate — the flow is live</div>
        </div>
        <SpecPanel config={config} current={cur} personas={personas} />
      </div>
    </ConsoleNav.Provider>
  );
}

function DirectoryRail({ config, current, go }) {
  const groups = [...new Set(config.screens.map((s) => s.group))];
  let n = 0;
  const kindLabel = { phone: 'app', browser: 'web', board: 'display' };
  return (
    <div className="panel thin rail">
      <div className="rail-head">
        <div className="rail-logo" dangerouslySetInnerHTML={{ __html: config.brand }} />
        <div className="rail-sub">{config.brandSub}</div>
        <div className="rail-tag"><Icon d={I.doc} w={12} /> {config.flowTag || 'Working spec · v2.1'}</div>
      </div>
      {config.flow && (
        <div className="rail-flow">
          {config.flow.map((s, i, a) => (<React.Fragment key={s}><span className="step">{s}</span>{i < a.length - 1 && <span className="arrow">›</span>}</React.Fragment>))}
        </div>
      )}
      {groups.map((g) => (
        <div key={g}>
          <div className="rail-group">{g}</div>
          {config.screens.filter((s) => s.group === g).map((s) => {
            n += 1; const num = String(n).padStart(2, '0'); const on = current === s.id;
            return (
              <button key={s.id} onClick={() => go(s.id)} className={'rail-item' + (on ? ' on' : '')}>
                <span className="rail-num">{num}</span>
                <span>
                  <span className="rail-title">{s.title}<span className="rail-kind">{kindLabel[s.kind] || 'app'}</span></span>
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

function SpecPanel({ config, current, personas }) {
  const s = config.screens.find((x) => x.id === current) || config.screens[0];
  return (
    <div className="panel thin spec">
      <div className="spec-head">
        <div className="spec-kicker">{s.group}</div>
        <div className="spec-title">{s.title}</div>
        <div className="spec-sub">{s.sub}</div>
        <div className="spec-ref"><Icon d={I.doc} w={13} /> PROJECT_SPEC {s.spec}</div>
      </div>
      <div className="spec-body">
        <div className="spec-section"><div className="spec-label">Purpose</div><div className="spec-purpose">{s.purpose}</div></div>
        <div className="spec-section"><div className="spec-label">Behaviors &amp; rules</div>{s.behaviors.map((b, i) => <div key={i} className="spec-li"><span className="b">→</span><span>{b}</span></div>)}</div>
        <div className="spec-section"><div className="spec-label">Data / state touched</div>{s.data.map((d, i) => <div key={i} className="spec-data"><span className="dot">●</span><span>{d}</span></div>)}</div>
        {s.roles && <div className="spec-section"><div className="spec-label">Roles</div><div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{s.roles.map((r) => <span key={r} className="spec-ref" style={{ marginTop: 0 }}>{r}</span>)}</div></div>}
      </div>
      <div className="spec-foot"><div className="spec-hint">{config.footHint}</div></div>
    </div>
  );
}

window.mountConsole = (config) => {
  ReactDOM.createRoot(document.getElementById('root')).render(<Console config={config} />);
};

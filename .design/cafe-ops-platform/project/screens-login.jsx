/* ════ LOGIN / SIGN-IN — Shop (light), Hub (dark), Admin (web) ════ */

function BrandMark({ size = 56, dark }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.3, background: 'var(--terra)', display: 'grid', placeItems: 'center', color: '#fff', boxShadow: '0 8px 24px rgba(194,65,12,.32)' }}>
      <Icon d={I.flame} w={size * 0.5} />
    </div>
  );
}

function StaffNote({ dark }) {
  return (
    <div className="row" style={{ gap: 8, justifyContent: 'center', color: 'var(--muted)' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
      <span style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.4 }}>Internal staff only · accounts are issued by your administrator</span>
    </div>
  );
}

/* ── Shop App login (iOS light) ────────────────────────────── */
function ShopLogin() {
  return (
    <Screen>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
        <div className="col" style={{ alignItems: 'center', textAlign: 'center', marginBottom: 30 }}>
          <BrandMark />
          <div className="wordmark" style={{ fontSize: 32, marginTop: 16, lineHeight: 1 }}>bobo <em>&</em> wild</div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 11, color: '#fff', background: 'var(--terra)', padding: '3px 9px', borderRadius: 99 }}>HubSync</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Shop App</span>
          </div>
        </div>

        <div className="col" style={{ gap: 14 }}>
          <div>
            <label className="lbl">Work email</label>
            <div className="field-wrap">
              <input className="field" placeholder="amara@boboandwild.co" defaultValue="amara@boboandwild.co" />
            </div>
          </div>
          <div>
            <label className="lbl">Password</label>
            <div className="field-wrap">
              <input className="field" type="password" defaultValue="••••••••••" />
              <span className="fi"><Icon d={I.user} w={18} style={{ opacity: 0 }} /></span>
            </div>
          </div>
          <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 4 }}>Sign in <Icon d={I.chevR} w={17} /></button>
          <button className="btn" style={{ background: 'transparent', color: 'var(--muted)', fontSize: 13.5, padding: 6 }}>Forgot password?</button>
        </div>
      </div>
      <div style={{ padding: '0 26px 26px' }}><StaffNote /></div>
    </Screen>
  );
}

/* ── Hub App login (iOS dark terminal) ─────────────────────── */
function HubLogin() {
  return (
    <Screen dark>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
        <div className="col" style={{ alignItems: 'center', textAlign: 'center', marginBottom: 30 }}>
          <BrandMark dark />
          <div className="wordmark" style={{ fontSize: 32, marginTop: 16, lineHeight: 1 }}>bobo <em>&</em> wild</div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 11, color: '#fff', background: 'var(--terra-deep)', padding: '3px 9px', borderRadius: 99 }}>HubSync</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Hub Terminal</span>
          </div>
        </div>

        <div className="col" style={{ gap: 14 }}>
          <div>
            <label className="lbl">Hub login</label>
            <input className="field" placeholder="yusuf@boboandwild.co" defaultValue="yusuf@boboandwild.co" />
          </div>
          <div>
            <label className="lbl">Password</label>
            <input className="field" type="password" defaultValue="••••••••••" />
          </div>
          <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 4 }}>Open station <Icon d={I.chevR} w={17} /></button>
          <div className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 2, color: 'var(--muted)' }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--st-done)' }} />
            <span style={{ fontSize: 12.5 }}>Fixed connection · Hub network</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '0 26px 26px' }}><StaffNote dark /></div>
    </Screen>
  );
}

/* ── Admin Web login (browser, split) ──────────────────────── */
function AdminLogin() {
  return (
    <div className="scr" style={{ height: '100%', display: 'flex', background: 'var(--surface)' }}>
      {/* left brand panel */}
      <div style={{ width: '46%', flexShrink: 0, background: 'linear-gradient(160deg, #2A1F16, #3A2415)', color: '#EFE2CF', padding: 48, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .6, background: 'radial-gradient(circle at 80% 18%, rgba(226,112,58,.45), transparent 55%)' }} />
        <div className="row" style={{ gap: 12, position: 'relative' }}>
          <BrandMark size={40} />
          <div className="wordmark" style={{ fontSize: 22, color: '#F4E9D8' }}>bobo <em>&</em> wild</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <div className="serif" style={{ fontSize: 36, lineHeight: 1.15, color: '#F6ECDC' }}>Every order,<br />every shop,<br />one source of truth.</div>
          <div style={{ fontSize: 14.5, color: '#C3B29B', marginTop: 16, maxWidth: 340, lineHeight: 1.6 }}>HubSync Admin — live operations, catalog control, and financial records across all 7 shops and the Hub.</div>
          <div className="row" style={{ gap: 18, marginTop: 28 }}>
            {[['7', 'Shops'], ['19', 'Logins'], ['1', 'Hub']].map(([v, l]) => (
              <div key={l}><div className="serif" style={{ fontSize: 26, color: 'var(--terra-soft)' }}>{v}</div><div style={{ fontSize: 12, color: '#9B8B76', fontWeight: 600 }}>{l}</div></div>
            ))}
          </div>
        </div>
      </div>
      {/* right form */}
      <div className="grow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--terra)', letterSpacing: '.12em', textTransform: 'uppercase' }}>HubSync Admin</div>
          <div className="serif" style={{ fontSize: 30, marginTop: 8 }}>Sign in</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Brand owner access only.</div>

          <div className="col" style={{ gap: 16, marginTop: 28 }}>
            <div>
              <label className="lbl">Email</label>
              <input className="field" defaultValue="rana@boboandwild.co" />
            </div>
            <div>
              <label className="lbl">Password</label>
              <input className="field" type="password" defaultValue="••••••••••••" />
            </div>
            <div className="between">
              <label className="row" style={{ gap: 8, fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600 }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--terra)', display: 'grid', placeItems: 'center', color: '#fff' }}><Icon d={I.check} w={13} /></span>
                Keep me signed in
              </label>
              <span style={{ fontSize: 13.5, color: 'var(--terra)', fontWeight: 600 }}>Forgot password?</span>
            </div>
            <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 4 }}>Sign in to dashboard <Icon d={I.chevR} w={17} /></button>
          </div>
          <div style={{ marginTop: 26, paddingTop: 20, borderTop: '1px solid var(--line)' }}><StaffNote /></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ShopLogin, HubLogin, AdminLogin });

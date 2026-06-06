/* Shared icons + tiny helpers for HubSync screens.
   Exports to window. Load before screen files. */

const Icon = ({ d, w = 22, s = 1.8, fill = 'none', style }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const I = {
  home:    'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  grid:    ['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
  clock:   ['M12 7v5l3 2', 'M12 21a9 9 0 100-18 9 9 0 000 18z'],
  bag:     ['M6 7h12l-1 13H7L6 7z', 'M9 7a3 3 0 016 0'],
  doc:     ['M6 3h8l4 4v14H6z', 'M14 3v4h4'],
  bell:    ['M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 01-3.4 0'],
  user:    ['M20 21a8 8 0 10-16 0', 'M12 11a4 4 0 100-8 4 4 0 000 8z'],
  plus:    'M12 5v14M5 12h14',
  check:   'M4 12l5 5L20 6',
  chevR:   'M9 6l6 6-6 6',
  chevL:   'M15 6l-6 6 6 6',
  chevD:   'M6 9l6 6 6-6',
  back:    'M19 12H5M11 6l-6 6 6 6',
  search:  ['M11 19a8 8 0 100-16 8 8 0 000 16z', 'M21 21l-4-4'],
  filter:  'M3 5h18M6 12h12M10 19h4',
  truck:   ['M3 6h11v9H3z', 'M14 9h4l3 3v3h-7z', 'M7 18a2 2 0 100-4 2 2 0 000 4z', 'M18 18a2 2 0 100-4 2 2 0 000 4z'],
  pin:     ['M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z', 'M12 12a2 2 0 100-4 2 2 0 000 4z'],
  flame:   'M12 3c1 4-2 5-2 8a2 2 0 004 0c0-1 0-2-1-3 2 1 4 3 4 6a5 5 0 11-10 0c0-4 3-6 5-11z',
  box:     ['M3 8l9-5 9 5-9 5-9-5z', 'M3 8v8l9 5 9-5V8', 'M12 13v8'],
  bread:   ['M5 11a4 4 0 014-4h6a4 4 0 014 4l-1 8H6z', 'M9 11v8M13 11v8'],
  croiss:  ['M4 16c4-10 12-10 16 0', 'M4 16l5-1M20 16l-5-1M12 6v8'],
  meat:    ['M14 4a6 6 0 11-7 9l-3 3 2 2 3-3a6 6 0 015-11z', 'M9 9h.01'],
  edit:    ['M4 20h4L19 9l-4-4L4 16z', 'M14 5l4 4'],
  card:    ['M3 6h18v12H3z', 'M3 10h18'],
  trend:   ['M3 17l6-6 4 4 7-7', 'M21 8v-4h-4'],
  alert:   ['M12 9v4', 'M12 17h.01', 'M10.3 4l-7 12a2 2 0 002 3h13a2 2 0 002-3l-7-12a2 2 0 00-3 0z'],
  x:       'M6 6l12 12M18 6L6 18',
  send:    ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
  sliders: ['M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4', 'M14 4v4M6 10v4M12 16v4'],
  qr:      ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z', 'M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z'],
  refresh: ['M21 12a9 9 0 11-3-6.7M21 4v4h-4'],
  list:    'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  cal:     ['M4 5h16v16H4z', 'M4 9h16M9 3v4M15 3v4'],
  pkg2:    ['M21 16V8l-9-5-9 5v8l9 5z', 'M3 8l9 5 9-5M12 13v8'],
};

/* status meta: label + class per spec status code */
const STAT = {
  pending_request:     ['Pending Request', 's-pend'],
  specialist_approved: ['Approved · Confirm', 's-pend'],
  shop_confirmed:      ['Confirmed', 's-prog'],
  in_progress:         ['In Production', 's-prog'],
  packaged:            ['Packaged', 's-prog'],
  ready_for_courier:   ['Ready for Courier', 's-ready'],
  in_transit:          ['In Transit', 's-ready'],
  delivered:           ['Delivered', 's-done'],
  rejected:            ['Rejected', 's-bad'],
  cancelled:           ['Cancelled', 's-bad'],
};

const Status = ({ s, label }) => {
  const [l, c] = STAT[s] || [label || s, 's-pend'];
  return <span className={'status ' + c}><span className="dot" />{label || l}</span>;
};

/* phone screen scaffold: fixed top inset to clear status bar/island */
const Screen = ({ children, dark, pad = true, style }) => (
  <div className={'scr' + (dark ? ' hub' : '')}
       style={{ display: 'flex', flexDirection: 'column', height: '100%',
                paddingTop: 54, ...(style || {}) }}>
    {children}
  </div>
);

/* scrolling body region inside a phone */
const Body = ({ children, style }) => (
  <div className="thin grow" style={{ overflow: 'auto', ...(style || {}) }}>{children}</div>
);

Object.assign(window, { Icon, I, STAT, Status, Screen, Body });

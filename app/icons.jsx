/* tiny inline icons — kept here to avoid icon-library bloat
   All 16x16, currentColor strokes. Minimal stroke set: search, send, command,
   moon/sun, columns, x-close, target/cross-hair, sliders, arrow-right.
*/
const Icon = {
  search: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
    </svg>
  ),
  send: (p) => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" {...p}>
      <path d="M2 8l11-5-3 5 3 5z"/>
    </svg>
  ),
  cmd: (p) => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}>
      <rect x="2" y="2" width="4" height="4"/><rect x="10" y="2" width="4" height="4"/>
      <rect x="2" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/>
      <path d="M6 4h4M6 12h4M4 6v4M12 6v4"/>
    </svg>
  ),
  moon: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" {...p}>
      <path d="M11.5 9.2A4.5 4.5 0 0 1 6.8 4.5a4.5 4.5 0 0 0 4.7 7 4.5 4.5 0 0 0 3.5-1.7 4.5 4.5 0 0 1-3.5-.6z"/>
    </svg>
  ),
  sun: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}>
      <circle cx="8" cy="8" r="2.6"/>
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M3.5 12.5l1.1-1.1M11.4 4.6l1.1-1.1"/>
    </svg>
  ),
  columnsL: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}>
      <rect x="2" y="3" width="12" height="10" rx="1"/><path d="M6 3v10"/>
    </svg>
  ),
  columnsR: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}>
      <rect x="2" y="3" width="12" height="10" rx="1"/><path d="M10 3v10"/>
    </svg>
  ),
  close: (p) => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>
    </svg>
  ),
  pin: (p) => (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" {...p}>
      <path d="M8 1l3 3-1 1 1 4-3-1-3 3-1-3 3-3-1-1z"/>
    </svg>
  ),
  sliders: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}>
      <path d="M2 4h6M11 4h3M2 8h3M8 8h6M2 12h8M13 12h1"/>
      <circle cx="9.5" cy="4" r="1.3" fill="currentColor"/>
      <circle cx="6.5" cy="8" r="1.3" fill="currentColor"/>
      <circle cx="11.5" cy="12" r="1.3" fill="currentColor"/>
    </svg>
  ),
  arrow: (p) => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}>
      <path d="M3 8h9M9 5l3 3-3 3"/>
    </svg>
  ),
  branch: (p) => (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}>
      <path d="M3 2v9a2 2 0 0 0 2 2h3M13 6v1a2 2 0 0 1-2 2H8"/>
      <circle cx="3" cy="2" r="1.2" fill="currentColor"/>
      <circle cx="13" cy="4" r="1.2" fill="currentColor"/>
    </svg>
  ),
  graph: (p) => (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}>
      <circle cx="4" cy="4" r="1.6"/><circle cx="12" cy="4" r="1.6"/><circle cx="8" cy="12" r="1.6"/>
      <path d="M5 5l6 5M11 5l-6 5"/>
    </svg>
  ),
  doc: (p) => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}>
      <path d="M4 1.5h6l2.5 2.5v10a0.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-12a.5.5 0 0 1 .5-.5z"/>
      <path d="M9.5 1.5v3h3M5.5 7h5M5.5 9.5h5M5.5 12h3"/>
    </svg>
  ),
};

window.Icon = Icon;

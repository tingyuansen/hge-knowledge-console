/* Atlas — packed-circle map of the 62 GraphRAG themes, grouped into 8 named
   neighborhoods (tracers / extinction / distance / disk / bulge / kinematics /
   calibration / selection-and-methods).

   Why not force-directed: the current implementation is "topology, no semantics".
   Our audience already knows the themes — they need to *recognise* them at a
   glance. A named-neighborhood packed map gives spatial mnemonics and persistent
   labels for the large communities, and uses bridges only on selection.

   Two modes:
   - compact (rail): no labels, just colored circles, minimap-like
   - full (panel):   neighborhood headings, persistent labels for top circles per
                     neighborhood, bridges on hover/select, neighborhood chip filter

   Props:
   - mode: 'compact' | 'full'
   - activeThemeIds: number[]   (currently highlighted by the answer)
   - selectedThemeId: number|null
   - onSelectTheme: (id) => void
   - hoodFilter: string|null    (only this neighborhood is highlighted)
   - onHoodFilter: (id) => void
*/

function neighborhoodGrid(viewW, viewH, n) {
  // Always 4 cols × 2 rows for 8 neighborhoods — predictable, scannable.
  const cols = 4, rows = 2;
  const padX = 14, padY = 18;
  const cw = (viewW - padX * 2) / cols;
  const ch = (viewH - padY * 2) / rows;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        x: padX + c * cw,
        y: padY + r * ch,
        w: cw,
        h: ch,
        cx: padX + c * cw + cw / 2,
        cy: padY + r * ch + ch / 2,
      });
    }
  }
  return cells.slice(0, n);
}

function layoutAtlas(HGE, viewW, viewH, mode) {
  const cells = neighborhoodGrid(viewW, viewH, HGE.atlas.neighborhoods.length);
  const byHood = {};
  HGE.atlas.neighborhoods.forEach((h, i) => byHood[h.id] = { ...h, cell: cells[i], nodes: [] });
  HGE.atlas.nodes.forEach(n => byHood[n.hood].nodes.push(n));

  // radius scale
  const sizes = HGE.atlas.nodes.map(n => n.n_nodes);
  const sMax = Math.max(...sizes);
  const sMin = Math.min(...sizes);
  const rMin = mode === 'compact' ? 2 : 4;
  const rMax = mode === 'compact' ? 6 : 18;
  const r = (s) => rMin + (rMax - rMin) * Math.sqrt((s - sMin) / (sMax - sMin || 1));

  // pack inside each cell using a stable spiral
  const positions = {};
  for (const hood of Object.values(byHood)) {
    const cell = hood.cell;
    const nodes = [...hood.nodes].sort((a, b) => b.n_nodes - a.n_nodes);
    // place largest at slight offset from cell center for visual interest
    let placed = [];
    const innerW = cell.w - 16, innerH = cell.h - (mode === 'compact' ? 14 : 32);
    const offY = mode === 'compact' ? 8 : 22;
    const cx = cell.x + cell.w / 2;
    const cy = cell.y + offY + innerH / 2;

    // start: largest at centre, then spiral outward placing each node where it
    // doesn't overlap; if overlap, advance the spiral parameter t. This is a
    // tiny packing, runs in <1ms for 62 nodes total.
    const rng = seedRand(hood.id.charCodeAt(0) * 173 + nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const radius = r(n.n_nodes);
      let placedOk = false;
      const baseT = 0.5 + rng() * 0.5;
      for (let t = 0; t < 200 && !placedOk; t += 0.18) {
        // sunflower-ish
        const angle = t * 2.39996323 + i * 0.7;
        const rho = (mode === 'compact' ? 1.0 : 1.2) * Math.sqrt(t + baseT) * radius * 1.15;
        const x = cx + Math.cos(angle) * rho;
        const y = cy + Math.sin(angle) * rho;
        // bounds
        if (x - radius < cell.x + 4 || x + radius > cell.x + cell.w - 4) continue;
        if (y - radius < cell.y + offY || y + radius > cell.y + cell.h - 4) continue;
        // overlap check
        let ok = true;
        for (const p of placed) {
          const dx = p.x - x, dy = p.y - y, dd = Math.hypot(dx, dy);
          if (dd < (p.r + radius + 1.6)) { ok = false; break; }
        }
        if (ok) {
          placed.push({ x, y, r: radius, n });
          positions[n.id] = { x, y, r: radius, hood: hood.id };
          placedOk = true;
        }
      }
      if (!placedOk) {
        // last resort — place at cell margin
        const x = cell.x + 8 + (i % 5) * 8;
        const y = cell.y + cell.h - 12;
        positions[n.id] = { x, y, r: radius, hood: hood.id };
      }
    }
  }
  return { cells, byHood, positions };
}

function ThemeAtlas({ mode = 'full', activeThemeIds = [], selectedThemeId, onSelectTheme, hoodFilter, onHoodFilter }) {
  const HGE = window.HGE;
  // Re-render when the atlas finishes hydrating (background fetch from
  // /graph/communities). Without this the component stays bound to the
  // stub atlas object the bootstrap mounted with.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const h = () => setTick(t => t + 1);
    window.addEventListener('hge-atlas-ready', h);
    return () => window.removeEventListener('hge-atlas-ready', h);
  }, []);
  const W = mode === 'compact' ? 240 : 760;
  const H = mode === 'compact' ? 160 : 460;
  const isLoading = !HGE.atlas.nodes || HGE.atlas.nodes.length === 0;
  // ALL hooks must run before any early return — React rules of hooks.
  const layout = useMemo(() => isLoading ? null : layoutAtlas(HGE, W, H, mode), [HGE, W, H, mode, tick, isLoading]);
  const [hover, setHover] = useState(null);
  const [hoverAnchor, setHoverAnchor] = useState(null);
  const activeSet = useMemo(() => new Set(activeThemeIds), [activeThemeIds.join(',')]);

  // bridges (edges) to draw for currently hovered/selected node
  const focusId = hover ?? selectedThemeId;
  const focusBridges = useMemo(() => {
    if (focusId == null) return [];
    return HGE.atlas.edges
      .filter(e => e.source === focusId || e.target === focusId)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 12);
  }, [focusId]);
  // bridges between the question's active themes — drawn faintly so the user
  // sees the inter-theme network the synthesiser drew from.
  const activeBridges = useMemo(() => {
    if (activeSet.size < 2) return [];
    return HGE.atlas.edges
      .filter(e => activeSet.has(e.source) && activeSet.has(e.target))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 24);
  }, [activeSet]);

  const nodesById = useMemo(() => Object.fromEntries(HGE.atlas.nodes.map(n => [n.id, n])), [tick]);

  // Loading early-return AFTER all hooks have run.
  if (isLoading) {
    return (
      <div className="atlas-wrap" data-mode={mode}>
        {mode === 'full' && (
          <div className="atlas-h">
            <div className="title">Theme atlas <small>loading communities…</small></div>
          </div>
        )}
        <div className="atlas-svg-wrap" style={{ minHeight: mode === 'compact' ? 160 : 460, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="skel skel-line" style={{ width: '40%', height: 8 }}></div>
        </div>
      </div>
    );
  }

  const dimRule = (n) => {
    if (focusId === n.id) return 1;
    if (focusId != null) {
      const isBridge = HGE.atlas.edges.some(
        e => (e.source === focusId && e.target === n.id) || (e.target === focusId && e.source === n.id)
      );
      return isBridge ? 1 : 0.18;
    }
    if (hoodFilter && n.hood !== hoodFilter) return 0.16;
    if (activeSet.size && !activeSet.has(n.id)) return 0.4;
    return 1;
  };

  const showLabel = (n) => {
    if (mode === 'compact') return false;
    if (focusId === n.id) return true;
    if (activeSet.has(n.id)) return true;
    // top-3 per neighborhood get a persistent label
    const hoodNodes = layout.byHood[n.hood].nodes.slice().sort((a, b) => b.n_nodes - a.n_nodes);
    return hoodNodes.slice(0, 3).some(x => x.id === n.id);
  };

  return (
    <div className="atlas-wrap" data-mode={mode}>
      {mode === 'full' && (
        <>
          <div className="atlas-h">
            <div className="title">Theme atlas <small>{HGE.atlas.nodes.length} themes · {HGE.atlas.edges.length} bridges · grouped by neighborhood</small></div>
            <div className="status-pill"><span className="dot"></span>graph-rag · 459 communities</div>
          </div>
          <div className="atlas-chips">
            {HGE.atlas.neighborhoods.map(h => (
              <button
                key={h.id}
                className={`chip${hoodFilter === h.id ? ' active' : ''}`}
                onClick={() => onHoodFilter(hoodFilter === h.id ? null : h.id)}
                title={h.desc}
              >
                <span className="dot" style={{ background: h.color }}></span>
                {h.label}
                <span className="count">{layout.byHood[h.id].nodes.length}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="atlas-svg-wrap">
        <svg className="atlas-svg" viewBox={`0 0 ${W} ${H}`}>
          {/* neighborhood frames + headings */}
          {mode === 'full' && Object.values(layout.byHood).map(h => (
            <g key={h.id} opacity={hoodFilter && hoodFilter !== h.id ? 0.35 : 1}>
              <rect
                x={h.cell.x + 2} y={h.cell.y + 2}
                width={h.cell.w - 4} height={h.cell.h - 4}
                fill="none"
                stroke="var(--rule-soft)"
                strokeDasharray="2 3"
                strokeWidth="0.7"
                rx="2"
              />
              <text
                x={h.cell.x + 8} y={h.cell.y + 14}
                fontFamily="IBM Plex Mono, monospace" fontSize="10"
                fill="var(--ink-3)" letterSpacing="0.05em"
              >
                {h.label.toUpperCase()}
              </text>
              <circle cx={h.cell.x + h.cell.w - 12} cy={h.cell.y + 10} r="3.2" fill={h.color} />
            </g>
          ))}

          {/* faint bridges between the question's active themes */}
          {focusId == null && activeBridges.map((e, i) => {
            const a = layout.positions[e.source], b = layout.positions[e.target];
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2 - Math.abs(a.x - b.x) * 0.10;
            return (
              <path
                key={'ab' + i}
                d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                stroke="var(--accent)"
                strokeOpacity={0.10 + 0.30 * e.w}
                strokeWidth={0.45 + 1.0 * e.w}
                fill="none"
              />
            );
          })}

          {/* bridges from focused node */}
          {focusId != null && focusBridges.map((e, i) => {
            const a = layout.positions[e.source], b = layout.positions[e.target];
            if (!a || !b) return null;
            // gentle curve
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2 - Math.abs(a.x - b.x) * 0.12;
            return (
              <path
                key={i}
                d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                stroke="var(--accent)"
                strokeOpacity={0.18 + 0.5 * e.w}
                strokeWidth={0.6 + 1.6 * e.w}
                fill="none"
              />
            );
          })}

          {/* nodes */}
          {HGE.atlas.nodes.map(n => {
            const p = layout.positions[n.id];
            if (!p) return null;
            const isActive = activeSet.has(n.id);
            const isSelected = selectedThemeId === n.id;
            const isHover = hover === n.id;
            const dim = dimRule(n);
            return (
              <g key={n.id} opacity={dim} style={{ cursor: 'pointer' }}>
                {(isActive || isSelected) && (
                  <circle cx={p.x} cy={p.y} r={p.r + 4.5} fill="none" stroke="var(--accent)" strokeOpacity="0.45" strokeWidth="1.2" />
                )}
                <circle
                  cx={p.x} cy={p.y} r={p.r}
                  fill={n.color}
                  fillOpacity={isActive ? 0.92 : (isHover || isSelected ? 0.85 : 0.55)}
                  stroke={isSelected || isHover ? 'var(--ink)' : 'none'}
                  strokeWidth={isSelected ? 1.4 : 1}
                  onMouseEnter={(e) => { setHover(n.id); setHoverAnchor(e.currentTarget); }}
                  onMouseLeave={() => { setHover(null); setHoverAnchor(null); }}
                  onClick={() => onSelectTheme && onSelectTheme(n.id)}
                />
              </g>
            );
          })}

          {/* labels (top-3 per hood + active + focused) */}
          {HGE.atlas.nodes.map(n => {
            if (!showLabel(n)) return null;
            const p = layout.positions[n.id];
            if (!p) return null;
            const label = n.title;
            // truncate
            const max = mode === 'full' ? 28 : 20;
            const text = label.length > max ? label.slice(0, max - 1) + '…' : label;
            return (
              <g key={'l' + n.id} pointerEvents="none">
                <text
                  x={p.x} y={p.y + p.r + 9}
                  fontFamily="IBM Plex Sans, sans-serif" fontSize="9.5"
                  textAnchor="middle"
                  fill="var(--ink)"
                  opacity={dimRule(n)}
                  style={{ paintOrder: 'stroke', stroke: 'var(--paper)', strokeWidth: 3, strokeLinejoin: 'round' }}
                >{text}</text>
              </g>
            );
          })}
        </svg>

        {hover != null && hoverAnchor && (
          <HoverCard anchor={hoverAnchor}>
            <div className="hc-id">
              <span>theme · {hover}</span>
              <span className="muted">{nodesById[hover]?.n_nodes} entities</span>
            </div>
            <div className="hc-title">{nodesById[hover]?.title}</div>
            <div className="hc-scope">{(nodesById[hover]?.scope || '').slice(0, 240)}</div>
            <div className="hc-meta">
              <span>neighborhood</span>
              <span style={{ color: 'var(--ink)' }}>{HGE.atlas.neighborhoods.find(h => h.id === nodesById[hover]?.hood)?.label}</span>
            </div>
          </HoverCard>
        )}
      </div>

      {mode === 'full' && (
        <div className="atlas-legend">
          {HGE.atlas.neighborhoods.map(h => (
            <span className="lg" key={h.id}>
              <span className="sw" style={{ background: h.color }}></span>
              {h.label}
            </span>
          ))}
          <span style={{ marginLeft: 'auto' }}>circle size = n_entities · bridges shown on hover</span>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ThemeAtlas });

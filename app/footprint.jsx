/* GalacticFootprint — schematic (l, b) panel showing where the question's
   science cases live in the Galaxy. Coordinates here are *design coordinates*
   centred on l=0 (Galactic centre) at the middle of the panel, ±180° to either
   edge — much like an Aitoff-projection sketch but in raw rectangular form for
   density. Extinction tint comes from the zone's `extinction` flag.

   The intent: ground the dense literature talk in the Galaxy itself so an
   astronomer can flip from "radial migration" → where in the disk that
   discussion lives.
*/

function GalacticFootprint({ activeZoneIds = [], onSelectZone }) {
  const HGE = window.HGE;
  const W = 600, H = 180;
  const padX = 30, padY = 20;
  const innerW = W - padX * 2, innerH = H - padY * 2;

  // l: -180..180 → x;  b: -30..30 → y (zoom in on plane)
  const lToX = (l) => padX + innerW * ((l + 180) / 360);
  const bToY = (b) => padY + innerH * ((30 - b) / 60);

  // recenter so Galactic centre (l=0) is in middle visually (it already is)
  const active = new Set(activeZoneIds);

  return (
    <div className="scatter-wrap" style={{ marginTop: 24 }}>
      <div className="scatter-h">
        <div className="title">Galactic footprint <small>schematic — where this answer's science cases live in (l, b)</small></div>
        <div className="scatter-controls" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
          ↺ obscured-disk · bulge · halo
        </div>
      </div>
      <div style={{ padding: '14px 16px 18px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
          <defs>
            <pattern id="ext-stripe" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
              <rect width="4" height="4" fill="var(--paper-2)" />
              <line x1="0" y1="0" x2="0" y2="4" stroke="var(--rule)" strokeWidth="0.6" />
            </pattern>
          </defs>

          {/* sky background */}
          <rect x={padX} y={padY} width={innerW} height={innerH} fill="var(--paper-2)" stroke="var(--rule)" strokeWidth="0.6" />

          {/* extinction band (Galactic plane |b|<2°) */}
          <rect x={padX} y={bToY(2)} width={innerW} height={bToY(-2) - bToY(2)} fill="url(#ext-stripe)" opacity="0.6" />

          {/* meridians at l = -90, 0, 90, 180 */}
          {[-180, -90, 0, 90, 180].map(l => (
            <g key={l}>
              <line x1={lToX(l)} x2={lToX(l)} y1={padY} y2={padY + innerH} stroke="var(--rule-soft)" strokeWidth="0.5" strokeDasharray="2 3" />
              <text x={lToX(l)} y={H - 4} fontSize="10" textAnchor="middle" fill="var(--ink-3)" fontFamily="IBM Plex Mono, monospace">
                {l === 0 ? 'l=0°' : `${l}°`}
              </text>
            </g>
          ))}
          {/* parallels at b = -20, 0, 20 */}
          {[-20, 0, 20].map(b => (
            <g key={b}>
              <line x1={padX} x2={padX + innerW} y1={bToY(b)} y2={bToY(b)} stroke="var(--rule-soft)" strokeWidth="0.5" strokeDasharray="2 3" />
              <text x={padX - 6} y={bToY(b) + 3} fontSize="10" textAnchor="end" fill="var(--ink-3)" fontFamily="IBM Plex Mono, monospace">{b > 0 ? `+${b}°` : `${b}°`}</text>
            </g>
          ))}

          {/* zones */}
          {HGE.footprintZones.map(z => {
            const isActive = active.has(z.id);
            return (
              <g key={z.id}
                 style={{ cursor: 'pointer' }}
                 onClick={() => onSelectZone && onSelectZone(z.id)}>
                <ellipse
                  cx={lToX(z.cx)} cy={bToY(z.cy)}
                  rx={(z.rx / 360) * innerW} ry={(z.ry / 60) * innerH}
                  fill={z.color}
                  fillOpacity={isActive ? 0.55 : 0.18}
                  stroke={isActive ? z.color : 'var(--rule)'}
                  strokeWidth={isActive ? 1.6 : 0.8}
                />
                <text
                  x={lToX(z.cx)} y={bToY(z.cy) + 3}
                  fontSize="10.5" textAnchor="middle"
                  fill={isActive ? 'var(--ink)' : 'var(--ink-2)'}
                  fontFamily="IBM Plex Sans, sans-serif" fontWeight={isActive ? 600 : 500}
                  style={{ paintOrder: 'stroke', stroke: 'var(--paper)', strokeWidth: 2, strokeLinejoin: 'round' }}
                >{z.label}</text>
              </g>
            );
          })}

          {/* compass: centre marker for GC */}
          <g>
            <circle cx={lToX(0)} cy={bToY(0)} r="3" fill="none" stroke="var(--ink)" strokeWidth="0.8" />
            <line x1={lToX(0) - 5} y1={bToY(0)} x2={lToX(0) + 5} y2={bToY(0)} stroke="var(--ink)" strokeWidth="0.8" />
            <line x1={lToX(0)} y1={bToY(0) - 5} x2={lToX(0)} y2={bToY(0) + 5} stroke="var(--ink)" strokeWidth="0.8" />
          </g>
        </svg>

        <div style={{ display: 'flex', gap: 12, marginTop: 10, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 8, background: 'url(#ext-stripe)' }}></span> high extinction |b|&lt;2°</span>
          <span style={{ marginLeft: 'auto' }}>active in this answer: {activeZoneIds.length ? activeZoneIds.length : 'none'}</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { GalacticFootprint });

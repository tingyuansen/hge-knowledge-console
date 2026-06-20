/* DesignLever — the master HGE design-trade explorer.
   ====================================================
   Mental model the leadership uses:
     Total telescope time T_total is FIXED.
     Longer exposure t per field  → higher SNR
                                  → more elements meet σ target (SMR-SPEC-1)
                                  BUT fewer fields fit in T_total
                                  → fewer stars total
                                  → fewer science cases needing spatial volume survive.

   So one knob (exposure time per field) trades **element precision** against
   **sample size**. Magnitude limit is a secondary knob that controls both
   stars-per-field and required exposure to hit SNR.

   The widget is structured as:
     [ controls ]  →  derived figures (SNR / N_fields / N_stars)
     [ per-element σ bars ]  →  pass/warn/fail vs SMR-SPEC-1
     [ science-case matrix ]  →  the payoff: which cases survive BOTH filters

   Models (first-order, calibrated to HGE_CONTEXT.md):
     SNR(H, t)         = SNR_ref · √(t / t_ref) · 10^(0.2 · (H_ref − H))
                         SNR_ref=70, t_ref=10 hr, H_ref=14.5 (Nidever, May 6 telecon)
     σ(elem, SNR)      = σ_target(elem) · 75 / SNR    (pinned at SNR=75 boundary)
     stars_per_field   = 260 · 10^(0.4 · (H − H_ref)), capped at 900 (crowding)
     N_fields_in_T     = T_total / t
     N_stars_total     = N_fields · stars_per_field

   T_total comes from the baseline: 578 fields × 10 hr/field = 5780 hr.
*/

const ELEMENT_ORDER = ['Fe','Mg','Si','Ca','C','N','O','Ni','Ti','Al','Cr','Mn','Ce','K','V','Co','Na'];
const ELEMENT_GROUP = {
  Fe: 'ref', Mg: 'α', Si: 'α', Ca: 'α', Ti: 'α',
  C: 'light', N: 'light', O: 'light',
  Ni: 'Fe-pk', Cr: 'Fe-pk', Mn: 'Fe-pk', Co: 'Fe-pk', V: 'Fe-pk',
  Al: 'odd-Z', K: 'odd-Z', Na: 'odd-Z',
  Ce: 'n-cap',
};
const GROUP_COLOR = {
  'ref':   'var(--ink)',
  'α':     '#3e7c54',
  'light': '#356ea0',
  'Fe-pk': '#8a4423',
  'odd-Z': '#7d4a8b',
  'n-cap': '#8a6a2b',
};

// Science cases drawn from SRD §6.1 + HGE_CONTEXT §4. Each case has:
//   needs:    elements that must meet SRD σ (or within 1.5×)
//   min_stars: minimum total stars to recover the case at 15% distance σ
const SCIENCE_CASES = [
  { id: 'so1-grad',     short: 'Far-side abundance gradients',           needs: ['Fe','Mg','Si','Ca','C','N','O'], min_stars: 100000 },
  { id: 'so2-disk',     short: '[α/Fe]–[Fe/H] disk patterns',            needs: ['Fe','Mg','Si','Ca'],             min_stars: 80000  },
  { id: 'so3-asym',     short: 'Disk + bar asymmetries',                 needs: ['Fe','Mg'],                       min_stars: 60000  },
  { id: 'so4-bulge',    short: 'Bulge / bar chemo-kinematics',           needs: ['Fe','Mg','Al','Mn'],             min_stars: 50000  },
  { id: 'inside-out',   short: 'Inside-out disk formation',              needs: ['Fe','C','N','Mg'],               min_stars: 40000  },
  { id: 'mw-thick',     short: 'Metal-weak thick disk',                  needs: ['Fe','Mg','Al','Mn'],             min_stars: 25000  },
  { id: 'fe-peak',      short: 'Fe-peak family fingerprints',            needs: ['Fe','Ni','Cr','Mn','Co'],        min_stars: 30000  },
  { id: 'n-capture',    short: 'n-capture (Ce) population structure',    needs: ['Fe','Ce'],                       min_stars: 15000  },
];

// Per-element corpus IQR — fractional spread of σ_obs around σ_target at SNR≈75
// from the curated abundance-precision distributions. Tough elements (Mn, Co,
// V, Ce) have much wider literature disagreement; α-elements are tight.
const CORPUS_IQR = {
  Fe: 0.18, Mg: 0.22, Si: 0.28, Ca: 0.32, Ti: 0.42,
  C:  0.30, N:  0.38, O:  0.45,
  Ni: 0.25, Cr: 0.45, Mn: 0.55, Co: 0.65, V: 0.70,
  Al: 0.42, K:  0.55, Na: 0.55,
  Ce: 0.80,
};

// Dust-map effect on far-side stars-yield (fractional, +/- around baseline).
// From synthpop tests under Marshall+2006, VVV/Surot, Galaxia3D, Bayestar+DECaPS.
const DUST_YIELD_SPREAD = 0.22;

function snrFromHt(H, t, ops) {
  return ops.SNR_ref * Math.sqrt(t / ops.t_ref_hr) * Math.pow(10, 0.2 * (ops.H_ref - H));
}
function starsPerField(H, ops) {
  return Math.min(900, 260 * Math.pow(10, 0.4 * (H - ops.H_ref)));
}

function DesignLever({ hints, onAskAboutConfig, isAsking, leverRelevant }) {
  const HGE = window.HGE;
  const bl = HGE.hgeBaseline;
  // Baseline T_total = 578 fields × 10 hr/field = 5,780 hr (reference, not fixed)
  const T_baseline = bl.sample.fields_total * bl.ops.t_ref_hr;

  const [H, setH] = useState(bl.ops.H_ref);
  const [t, setT] = useState(bl.ops.t_ref_hr);
  const [T_total, setT_total] = useState(T_baseline);
  const [hoverCase, setHoverCase] = useState(null);
  const [touched, setTouched] = useState(false);
  const [provElem, setProvElem] = useState(null);     // element symbol whose provenance drawer is open
  const [provData, setProvData] = useState(null);     // { element, n_rows, rows } or { loading: true }
  const openProv = (sym) => {
    if (provElem === sym) { setProvElem(null); setProvData(null); return; }
    setProvElem(sym);
    setProvData({ loading: true });
    window.HGE_ELEMENT_PROVENANCE(sym, 30).then(setProvData).catch(e => setProvData({ error: e.message }));
  };

  // When a new turn arrives whose question parses into knob hints, seed the
  // sliders. The user can then override; touching any slider sets `touched`
  // so subsequent same-question reseeds don't clobber an in-flight tweak.
  useEffect(() => {
    if (!hints) return;
    let nextH = H, nextT = t, nextTT = T_total;
    if (typeof hints.H === 'number') nextH = hints.H;
    if (typeof hints.t === 'number') nextT = hints.t;
    if (typeof hints.T_total === 'number') nextTT = hints.T_total;
    if (typeof hints.SNR_target === 'number') {
      const baseH = typeof hints.H === 'number' ? hints.H : nextH;
      const r = hints.SNR_target / (bl.ops.SNR_ref * Math.pow(10, 0.2 * (bl.ops.H_ref - baseH)));
      const solvedT = bl.ops.t_ref_hr * r * r;
      if (Number.isFinite(solvedT) && solvedT >= 1 && solvedT <= 25) nextT = parseFloat(solvedT.toFixed(1));
    }
    setH(nextH); setT(nextT); setT_total(nextTT); setTouched(false);
  }, [hints]);

  // wrap setters so we can mark "touched"
  const setH_ = (v) => { setTouched(true); setH(v); };
  const setT_ = (v) => { setTouched(true); setT(v); };
  const setTT_ = (v) => { setTouched(true); setT_total(v); };

  // derived — three knobs are independent. T_total controls fields, t controls
  // SNR with H, H controls stars-per-field. No artificial coupling between them.
  const snr = snrFromHt(H, t, bl.ops);
  const nFields = Math.round(T_total / t);
  const sPerField = starsPerField(H, bl.ops);
  const nStars = Math.round(nFields * sPerField);
  // Dust-map sensitivity range on stars-yield (Marshall vs VVV vs Bayestar give ±22%)
  const nStarsLo = Math.round(nStars * (1 - DUST_YIELD_SPREAD));
  const nStarsHi = Math.round(nStars * (1 + DUST_YIELD_SPREAD));

  // per-element table — each row carries σ_model AND a corpus IQR around it.
  // IQR is fractional; at σ_model=1.0× target, an IQR of 0.55 means the
  // literature reports σ_obs in [0.45×, 1.55×] of σ_target.
  const rows = ELEMENT_ORDER.map(sym => {
    const tgt = bl.element_targets[sym];
    const sigma = tgt * 75 / snr;
    const ratio = sigma / tgt;
    const iqr = CORPUS_IQR[sym] ?? 0.4;
    const lo = ratio * (1 - iqr);
    const hi = ratio * (1 + iqr);
    let status = 'pass';
    if (lo > 1.5)        status = 'fail';
    else if (hi > 1.0)   status = ratio > 1.0 ? 'warn' : 'warn';
    if (ratio > 1.5)     status = 'fail';
    else if (ratio > 1.0) status = 'warn';
    return { sym, group: ELEMENT_GROUP[sym], target: tgt, sigma, ratio, lo, hi, iqr, status };
  });
  const passCount = rows.filter(r => r.status !== 'fail').length;

  // science case viability
  const cases = SCIENCE_CASES.map(sc => {
    const elemRows = sc.needs.map(s => rows.find(r => r.sym === s));
    const elementsOk = elemRows.every(r => r && r.status !== 'fail');
    const starsOk = nStars >= sc.min_stars;
    const weakElem = elemRows.reduce((a, b) => (a && a.ratio > b.ratio) ? a : b, null);
    const viable = elementsOk && starsOk;
    return { ...sc, elementsOk, starsOk, viable, weakElem };
  });
  const viableCount = cases.filter(c => c.viable).length;

  const isBaseline = Math.abs(H - bl.ops.H_ref) < 0.025
    && Math.abs(t - bl.ops.t_ref_hr) < 0.05
    && Math.abs(T_total - T_baseline) < 5;
  const reset = () => { setH(bl.ops.H_ref); setT(bl.ops.t_ref_hr); setT_total(T_baseline); };

  // ---------- per-element bar chart ----------
  const W = 600, H_svg = 200;
  const padX = 32, padT = 18, padB = 44;
  const innerW = W - padX * 2;
  const innerH = H_svg - padT - padB;
  const colW = innerW / rows.length;
  const yMaxRatio = 2.4;
  const yScale = (r) => padT + innerH - (Math.min(r, yMaxRatio) / yMaxRatio) * innerH;
  const colorFor = (s) => s === 'pass' ? 'var(--good)' : s === 'warn' ? 'var(--warn)' : 'var(--bad)';

  const hoverElem = hoverCase ? new Set(hoverCase.needs) : null;

  // Lever → question: build a question that asks the synthesiser what the
  // current knob configuration means for the survey, and submit it as a new
  // turn (which threads conversation history). The lever stays put; the new
  // answer renders in the main pane.
  const askAboutConfig = () => {
    if (!onAskAboutConfig || isAsking || isBaseline) return;
    const parts = [];
    if (Math.abs(H - bl.ops.H_ref) > 0.025) parts.push(`H = ${H.toFixed(2)}`);
    if (Math.abs(t - bl.ops.t_ref_hr) > 0.05) parts.push(`${t.toFixed(1)} hr per field`);
    if (Math.abs(T_total - T_baseline) > 5) parts.push(`${T_total.toLocaleString()} hr total budget`);
    const q =
      `At ${parts.join(', ')} (model SNR ≈ ${snr.toFixed(0)}/pix, ` +
      `~${(nStars / 1000).toFixed(0)}k stars, ${nFields} fields), ` +
      `which SRD elements drop below σ target and which science cases stay viable? ` +
      `Compare this to the HGE baseline (H=${bl.ops.H_ref}, ${bl.ops.t_ref_hr} hr/field, ${T_baseline.toLocaleString()} hr).`;
    onAskAboutConfig(q);
  };

  return (
    <div className="design-lever" data-relevant={leverRelevant ? 'on' : 'off'}>
      <div className="dl-h">
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>Design lever</div>
          <div className="dl-sub mono">
            {leverRelevant ? 'sliders seeded from your question · ' : 'HGE baseline · '}
            change → SNR · stars · element σ · science cases
          </div>
        </div>
        <div className="dl-baseline-pill" data-baseline={isBaseline}>
          {isBaseline
            ? <><span className="dot"></span> at HGE baseline</>
            : <button className="link mono" onClick={reset} style={{ cursor: 'pointer' }}>↺ reset to baseline</button>}
        </div>
      </div>

      <div className="dl-grid">
        {/* ---------- controls ---------- */}
        <div className="dl-col-controls">
          <div className="dl-knob">
            <div className="dl-knob-h">
              <span className="dl-knob-name">Exposure per field</span>
              <span className="mono dl-val" data-changed={t !== bl.ops.t_ref_hr}>{t.toFixed(1)} hr</span>
            </div>
            <input type="range" min="1" max="25" step="0.5" value={t} onChange={(e) => setT_(parseFloat(e.target.value))} aria-label="Exposure per field, hours" />
            <div className="dl-ticks mono">
              <span>1</span><span>5</span><span style={{ color: 'var(--accent)' }}>·10</span><span>15</span><span>20</span><span>25</span>
            </div>
            <div className="dl-knob-foot mono">long-visit baseline {bl.ops.long_visit_hours} hr/field</div>
          </div>

          <div className="dl-knob">
            <div className="dl-knob-h">
              <span className="dl-knob-name">H magnitude limit</span>
              <span className="mono dl-val" data-changed={H !== bl.ops.H_ref}>H = {H.toFixed(2)}</span>
            </div>
            <input type="range" min="12" max="17" step="0.05" value={H} onChange={(e) => setH_(parseFloat(e.target.value))} aria-label="H magnitude limit" />
            <div className="dl-ticks mono">
              <span>12</span><span>13</span><span>14</span><span style={{ color: 'var(--accent)' }}>·14.5</span><span>15</span><span>16</span><span>17</span>
            </div>
            <div className="dl-knob-foot mono">SRD-TARG-1 limit H = {bl.spec.H_limit}</div>
          </div>

          <div className="dl-knob">
            <div className="dl-knob-h">
              <span className="dl-knob-name">Total telescope time</span>
              <span className="mono dl-val" data-changed={Math.abs(T_total - T_baseline) > 5}>{T_total.toLocaleString()} hr</span>
            </div>
            <input type="range" min="1000" max="15000" step="100" value={T_total} onChange={(e) => setTT_(parseFloat(e.target.value))} aria-label="Total telescope time, hours" />
            <div className="dl-ticks mono">
              <span>1k</span><span>3k</span><span style={{ color: 'var(--accent)' }}>·5.8k</span><span>8k</span><span>12k</span><span>15k</span>
            </div>
            <div className="dl-knob-foot mono">baseline = 578 fields × 10 hr · independent of other knobs</div>
          </div>

          <div className="dl-derived">
            <div className="dl-derived-row">
              <span className="dl-d-name">SNR / pix @ 1.6 μm</span>
              <div className="dl-d-val">
                <span className="mono big" data-status={snr >= 75 ? 'pass' : snr >= 50 ? 'warn' : 'fail'}>{snr.toFixed(0)}</span>
                <span className="mono delta">
                  {snr >= 75 ? '✓ SMR-SPEC-2' : snr >= 50 ? '⚠ below SMR-SPEC-2' : '✕ below pipeline floor'}
                </span>
              </div>
            </div>
            <div className="dl-d-bar">
              <div className="dl-d-marker" style={{ left: `${(50 / 150) * 100}%` }}><span className="mono">50</span></div>
              <div className="dl-d-marker" style={{ left: `${(75 / 150) * 100}%`, color: 'var(--accent)' }}><span className="mono">·SRD 75</span></div>
              <div className="dl-d-fill" style={{ width: `${Math.min(100, (snr / 150) * 100)}%`, background: snr >= 75 ? 'var(--good)' : snr >= 50 ? 'var(--warn)' : 'var(--bad)' }}></div>
            </div>
            <div className="dl-derived-row">
              <span className="dl-d-name">Fields covered</span>
              <div className="dl-d-val">
                <span className="mono big">{nFields.toLocaleString()}</span>
                <span className="mono delta">baseline {bl.sample.fields_total} · Δ {nFields - bl.sample.fields_total >= 0 ? '+' : ''}{nFields - bl.sample.fields_total}</span>
              </div>
            </div>
            <div className="dl-derived-row">
              <span className="dl-d-name">Stars total (dust-map range)</span>
              <div className="dl-d-val">
                <span className="mono big" data-status={nStars >= 150000 ? 'pass' : nStars >= 80000 ? 'warn' : 'fail'}>{(nStars / 1000).toFixed(0)}k</span>
                <span className="mono delta">
                  {(nStarsLo / 1000).toFixed(0)}k–{(nStarsHi / 1000).toFixed(0)}k · {sPerField.toFixed(0)} / field
                </span>
              </div>
            </div>
            <div className="dl-derived-row">
              <span className="dl-d-name">SMR-SAMP-1 (100k far-side giants)</span>
              <div className="dl-d-val">
                <span className="mono big" data-status={nStars >= 150000 ? 'pass' : nStarsHi >= 150000 ? 'warn' : 'fail'}>
                  {nStars >= 150000 ? '✓ met' : nStarsHi >= 150000 ? '~ if low extinction' : '✕ short'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- element σ + science cases ---------- */}
        <div className="dl-col-viz">
          <div className="dl-section-h">
            <span className="up">Per-element σ vs SMR-SPEC-1 target</span>
            <span className="mono">{passCount}/{rows.length} pass</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '0 0 6px', lineHeight: 1.4 }}>
            Each bar = modelled σ ÷ SRD target σ for that element at the current SNR.
            <br /><b>≤ 1.0× = meets SRD</b> (green); 1.0–1.5× = warn (amber); &gt; 1.5× = fails SRD (red).
            Dashed envelope = corpus-observed spread at this SNR (wider for Mn/Co/V/Ce, tight for α-elements).
          </div>
          <svg viewBox={`0 0 ${W} ${H_svg}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
            {[0.5, 1, 1.5, 2].map(r => (
              <g key={r}>
                <line x1={padX} x2={W - padX + 8} y1={yScale(r)} y2={yScale(r)}
                  stroke={r === 1 ? 'var(--accent)' : 'var(--rule-soft)'}
                  strokeWidth={r === 1 ? 1.1 : 0.5}
                  strokeDasharray={r === 1 ? '4 3' : '2 3'} />
                <text x={padX - 4} y={yScale(r) + 3} fontSize="9.5" textAnchor="end"
                  fill={r === 1 ? 'var(--accent)' : 'var(--ink-3)'} fontFamily="IBM Plex Mono, monospace">
                  {r === 1 ? '1.0× SRD' : r.toFixed(1) + '×'}
                </text>
              </g>
            ))}
            {rows.map((r, i) => {
              const x = padX + i * colW + 3;
              const bw = colW - 6;
              const yTop = yScale(r.ratio);
              const yLo  = yScale(Math.max(0, r.lo));
              const yHi  = yScale(r.hi);
              const yBase = yScale(0);
              const dim = hoverElem && !hoverElem.has(r.sym) ? 0.22 : 1;
              const isOpen = provElem === r.sym;
              return (
                <g key={r.sym} opacity={dim}
                   style={{ cursor: 'pointer' }}
                   onClick={() => openProv(r.sym)}>
                  {/* SRD-target reference shading below 1.0 */}
                  <rect x={x} y={yScale(1)} width={bw} height={yBase - yScale(1)} fill={colorFor(r.status)} fillOpacity="0.10" />
                  {/* corpus IQR band — literature disagreement at this SNR */}
                  <rect x={x - 1} y={yHi} width={bw + 2} height={yLo - yHi}
                    fill="none"
                    stroke={colorFor(r.status)} strokeOpacity="0.55"
                    strokeWidth="1" strokeDasharray="2 2" />
                  {/* model prediction bar */}
                  <rect x={x + 2} y={yTop} width={bw - 4} height={yBase - yTop}
                    fill={colorFor(r.status)}
                    fillOpacity={r.status === 'pass' ? 0.7 : 0.88} />
                  {/* model marker line at top of bar */}
                  <line x1={x} x2={x + bw} y1={yTop} y2={yTop} stroke="var(--ink)" strokeWidth="0.8" strokeOpacity="0.7" />
                  {/* open-drawer underline on hover/open */}
                  {isOpen && (
                    <rect x={x} y={padT + innerH + 30} width={bw} height={1.5} fill="var(--accent)" />
                  )}
                  <text x={x + bw / 2} y={padT + innerH + 14} fontSize="11" textAnchor="middle"
                    fill={isOpen ? 'var(--accent)' : 'var(--ink)'} fontFamily="IBM Plex Sans, sans-serif"
                    fontWeight={isOpen || (hoverElem && hoverElem.has(r.sym)) ? 700 : 500}>{r.sym}</text>
                  <text x={x + bw / 2} y={padT + innerH + 27} fontSize="9.5" textAnchor="middle"
                    fill="var(--ink-3)" fontFamily="IBM Plex Mono, monospace">{r.sigma.toFixed(2)}</text>
                  {/* invisible click target covering the whole column */}
                  <rect x={x - 1} y={padT} width={bw + 2} height={innerH + 32} fill="transparent">
                    <title>{`Click to see the corpus rows that anchor ${r.sym} σ_target`}</title>
                  </rect>
                </g>
              );
            })}
          </svg>

          <div className="dl-section-h" style={{ marginTop: 10 }}>
            <span className="up">Science cases viable at this knob</span>
            <span className="mono"><b style={{ color: 'var(--good)' }}>{viableCount}</b>/{cases.length}</span>
          </div>
          <div className="dl-case-grid">
            {cases.map(c => (
              <div
                key={c.id}
                className="dl-case-card"
                data-viable={c.viable}
                data-elements={c.elementsOk}
                data-stars={c.starsOk}
                onMouseEnter={() => setHoverCase(c)}
                onMouseLeave={() => setHoverCase(null)}
              >
                <div className="dl-case-name">{c.short}</div>
                <div className="dl-case-row mono">
                  <span title={`needs σ ≤ target on ${c.needs.join(', ')}`}>
                    <span className="dl-tick" data-ok={c.elementsOk}>{c.elementsOk ? '✓' : '✕'}</span> elements
                  </span>
                  <span title={`needs ${c.min_stars.toLocaleString()} stars`}>
                    <span className="dl-tick" data-ok={c.starsOk}>{c.starsOk ? '✓' : '✕'}</span> {(c.min_stars / 1000).toFixed(0)}k stars
                  </span>
                  <span className="muted">{c.weakElem ? `weakest: ${c.weakElem.sym} ${c.weakElem.ratio.toFixed(2)}×` : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dl-ask-strip">
        <div className="dl-ask-text mono">
          {isBaseline
            ? 'Move a slider to explore the trade. The lever stays at HGE baseline until you do.'
            : 'Send this configuration as a question — the synthesiser will compare it against the corpus.'}
        </div>
        <button
          className="dl-ask-btn"
          disabled={isAsking || isBaseline}
          onClick={askAboutConfig}
          title={isBaseline ? 'Move a slider first' : 'Ask the corpus what this configuration means'}
        >
          {isAsking ? 'asking…' : '↗ Ask about this configuration'}
        </button>
      </div>
      <div className="dl-foot mono">
        Knobs are independent. SNR ∝ √t · 10<sup>0.2(H_ref − H)</sup>; σ_model ∝ 1/SNR pinned to SRD at SNR=75.
        Dashed IQR around each bar is the corpus-observed σ spread at that SNR — wider for Mn/Co/V/Ce, tight for α-elements.
        Stars-yield range = ±{Math.round(DUST_YIELD_SPREAD * 100)} % from dust-map choice (Marshall+2006 / VVV / Bayestar+DECaPS).
        <span style={{ color: 'var(--ink-3)' }}> · click any element label or bar to see the corpus rows behind its σ_target.</span>
      </div>

      {provElem && (
        <div className="dl-prov">
          <div className="dl-prov-h">
            <div>
              <span className="up" style={{ color: 'var(--accent)' }}>Provenance · {provElem}</span>
              <span className="mono" style={{ marginLeft: 10, color: 'var(--ink-3)', fontSize: 11 }}>
                spec rows whose evidence quote mentions {provElem} or [{provElem}/Fe]
              </span>
            </div>
            <button className="link mono" style={{ cursor: 'pointer' }} onClick={() => { setProvElem(null); setProvData(null); }}>
              × close
            </button>
          </div>
          {(!provData || provData.loading) && (
            <div className="mono" style={{ color: 'var(--ink-3)', fontSize: 12, padding: '8px 0' }}>loading…</div>
          )}
          {provData && provData.error && (
            <div className="mono" style={{ color: 'var(--bad)', fontSize: 12, padding: '8px 0' }}>
              error: {provData.error}
            </div>
          )}
          {provData && provData.rows && (
            <>
              <div className="mono" style={{ color: 'var(--ink-3)', fontSize: 11, marginBottom: 8 }}>
                {provData.n_rows} matching {provData.n_rows === 1 ? 'row' : 'rows'} from the parametric spec table
              </div>
              {provData.rows.length === 0 ? (
                <div className="mono" style={{ color: 'var(--ink-3)', fontSize: 12, fontStyle: 'italic' }}>
                  no spec rows in the corpus mention this element in an abundance-precision context
                </div>
              ) : (
                <ul className="dl-prov-list">
                  {provData.rows.map((row, i) => {
                    const v = row.value ?? row.value_min ?? row.value_max ?? '—';
                    const unit = row.unit || '';
                    const band = row.confidence_band || '';
                    return (
                      <li key={i} className="dl-prov-row">
                        <div className="dl-prov-meta mono">
                          <a href={`https://arxiv.org/abs/${row.paper_id}`} target="_blank" rel="noopener" className="link">
                            arXiv:{row.paper_id}
                          </a>
                          <span style={{ color: 'var(--ink-2)' }}>{v}{unit ? ` ${unit}` : ''}</span>
                          {band && <span className="dl-prov-band" data-band={band}>{band}</span>}
                          {row.condition && <span style={{ color: 'var(--ink-3)' }}>· {row.condition}</span>}
                        </div>
                        <div className="dl-prov-quote">"{row.evidence_quote}"</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { DesignLever });

/* Right rail — context-aware detail panel.
   Modes (driven by main state):
     - 'turn-context' (default): the themes active in the current turn, primitives that ran, papers cited overview
     - 'theme': theme drilldown (scope, key entities, key relationships, top papers)
     - 'paper': paper card (arxiv id, communities it appears in, related)
     - 'entity': concept card from conceptLookup
     - 'atlas-full': full atlas takes over (rendered into MAIN; this rail keeps the active theme summary)
*/

function TurnContextPanel({ turn, onSelectTheme, onSelectPaper, activeThemeIds }) {
  const HGE = window.HGE;
  const nodesById = useMemo(() => Object.fromEntries(HGE.atlas.nodes.map(n => [n.id, n])), []);
  return (
    <>
      <div className="panel">
        <div className="panel-h">
          <span>Turn context</span>
          <span>{turn.plan?.calls?.length || 0} primitives</span>
        </div>
        <div className="kv-list">
          <div className="kv"><span className="k">question</span><span className="serif" style={{ fontSize: 13 }}>{turn.question}</span></div>
          <div className="kv"><span className="k">themes hit</span><span className="mono" style={{ fontSize: 12 }}>{turn.themeIds.length || '—'}</span></div>
          <div className="kv"><span className="k">cited papers</span><span className="mono" style={{ fontSize: 12 }}>{turn.digest.cited.length}</span></div>
          <div className="kv"><span className="k">primitives</span><span className="mono" style={{ fontSize: 12 }}>{(turn.plan?.calls || []).map(c => c.primitive).join(', ')}</span></div>
        </div>
      </div>

      {turn.themeIds.length > 0 && (
        <div className="panel">
          <div className="panel-h">
            <span>Themes informing this answer</span>
            <span>{turn.themeIds.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {turn.themeIds.map(id => {
              const n = nodesById[id];
              if (!n) return (
                <button key={id} className="paper-row" onClick={() => onSelectTheme(id)} style={{ display:'flex' }}>
                  <span className="pid">theme · {id}</span>
                  <span className="pw">unsummarised</span>
                </button>
              );
              return (
                <button key={id} className="paper-row" onClick={() => onSelectTheme(id)} style={{ textAlign: 'left' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink)', fontWeight: 500, marginBottom: 2 }}>{n.title}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      <span className="mono" style={{ color: HGE.atlas.neighborhoods.find(h => h.id === n.hood)?.color }}>● </span>
                      {HGE.atlas.neighborhoods.find(h => h.id === n.hood)?.label}
                    </div>
                  </div>
                  <div className="pw">{n.n_nodes}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-h"><span>Open atlas full-screen</span></div>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 8px', lineHeight: 1.45 }}>
          The thumbnail in the left rail is a minimap. Open the full atlas to browse all 62 themes and see inter-theme bridges.
        </p>
        <button className="chip" onClick={() => onSelectTheme('__atlas__')} style={{ width: '100%', justifyContent: 'center' }}>
          Open atlas →
        </button>
      </div>

    </>
  );
}

function ThemeDetail({ themeId, onSelectPaper, onSelectTheme, onBack }) {
  const HGE = window.HGE;
  const node = HGE.atlas.nodes.find(n => n.id === themeId);
  // For theme 8 we have rich detail (graph_community_8.json)
  const detail = themeId === 8 ? HGE.community8 : null;
  if (!node) return null;
  const hood = HGE.atlas.neighborhoods.find(h => h.id === node.hood);
  const bridges = HGE.atlas.edges
    .filter(e => e.source === themeId || e.target === themeId)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);
  return (
    <div className="theme-detail">
      <div className="panel">
        <div className="panel-h">
          <span>Theme · {themeId} · {hood?.label}</span>
          <div className="h-actions">
            <button className="icon-btn" onClick={onBack} title="Back"><Icon.close /></button>
          </div>
        </div>
        <h2 className="title">{node.title}</h2>
        <div className="meta">
          <span>{node.n_nodes.toLocaleString()} entities</span>
          <span style={{ color: hood?.color }}>● {hood?.label}</span>
        </div>
        <p className="scope">{node.scope}</p>
      </div>

      <div className="panel">
        <div className="panel-h"><span>Key entities</span><span>{node.key_entities.length}</span></div>
        <div className="entity-list">
          {node.key_entities.map(e => <span key={e}>{e}</span>)}
        </div>
      </div>

      {detail && detail.internal_edges?.length > 0 && (
        <div className="panel">
          <div className="panel-h"><span>Typed relationships (internal)</span><span>{detail.n_internal_edges}</span></div>
          <div className="rel-list">
            {detail.internal_edges.slice(0, 10).map((r, i) => (
              <div key={i} className="rel">
                <div className="text">
                  <strong>{r.src_canonical}</strong>
                  <span className="pred"> {r.predicate} </span>
                  <strong>{r.tgt_canonical}</strong>
                </div>
                <div className="n">n={r.paper_count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bridges.length > 0 && (
        <div className="panel">
          <div className="panel-h"><span>Bridges to other themes</span><span>{bridges.length}</span></div>
          <div className="rel-list">
            {bridges.map((b, i) => {
              const otherId = b.source === themeId ? b.target : b.source;
              const other = HGE.atlas.nodes.find(n => n.id === otherId);
              if (!other) return null;
              return (
                <button key={i} className="rel" style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }}
                        onClick={() => onSelectTheme(otherId)}>
                  <div className="text">
                    <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>→ </span>
                    <strong className="link">{other.title}</strong>
                  </div>
                  <div className="n">w={b.weight}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-h"><span>Top papers</span><span>{node.top_papers.length}</span></div>
        {node.top_papers.map(arxiv => (
          <button key={arxiv} className="paper-row" onClick={() => onSelectPaper(arxiv)}>
            <span className="pid">arXiv:{arxiv}</span>
            <span className="pw mono">open ›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Normalise text for fuzzy comparison: NFKC + collapse whitespace.
// Used to find an evidence-quote inside the cleaned OCR even when the
// cleanup pass made small whitespace / Unicode-form changes.
function normaliseText(s) {
  if (!s) return '';
  try { s = s.normalize('NFKC'); } catch {}
  return s.replace(/\s+/g, ' ').trim();
}

// Escape a string for use as the source of a RegExp (only meta chars).
function reEscape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Locate evidence quotes inside `cleanMd`. Returns {ranges, perQuote}
// where ranges is the sorted list of {start, end, quoteIdx} highlight
// spans in the ORIGINAL cleanMd indexing, and perQuote[i] is the
// status: 'exact' | 'normalised' | 'unaligned'.
function locateQuotes(cleanMd, quotes) {
  const ranges = [];
  const perQuote = [];
  if (!cleanMd) {
    quotes.forEach(() => perQuote.push('unaligned'));
    return { ranges, perQuote };
  }
  // Build a map from positions in normalised text → positions in original
  // text, so we can find a normalised-substring match and project its
  // span back into the original text.
  const norm = []; const map = []; // map[i] = original index of norm[i]
  let inWs = false;
  for (let i = 0; i < cleanMd.length; i++) {
    const c = cleanMd[i];
    if (/\s/.test(c)) {
      if (!inWs) { norm.push(' '); map.push(i); inWs = true; }
    } else {
      norm.push(c); map.push(i); inWs = false;
    }
  }
  const normStr = norm.join('').trim();
  const normStartOffset = norm.length && norm[0] === ' ' ? 1 : 0; // for the trim

  quotes.forEach((q, qi) => {
    const text = q.text || '';
    if (!text) { perQuote.push('unaligned'); return; }
    // 1. exact substring
    let pos = cleanMd.indexOf(text);
    if (pos >= 0) {
      ranges.push({ start: pos, end: pos + text.length, quoteIdx: qi });
      perQuote.push('exact'); return;
    }
    // 2. normalised substring
    const qNorm = normaliseText(text);
    if (qNorm) {
      const npos = normStr.indexOf(qNorm);
      if (npos >= 0) {
        const startNorm = npos + normStartOffset;
        const endNorm = startNorm + qNorm.length - 1;
        if (startNorm < map.length && endNorm < map.length) {
          ranges.push({ start: map[startNorm], end: map[endNorm] + 1, quoteIdx: qi });
          perQuote.push('normalised'); return;
        }
      }
    }
    perQuote.push('unaligned');
  });

  ranges.sort((a, b) => a.start - b.start);
  // Resolve overlapping ranges by keeping the earlier one (synthesised
  // quotes can overlap when one is a substring of another).
  const merged = [];
  for (const r of ranges) {
    if (!merged.length || r.start >= merged[merged.length - 1].end) {
      merged.push({ ...r });
    } else {
      // overlap — extend the last range, attach both quoteIdxs
      const last = merged[merged.length - 1];
      last.end = Math.max(last.end, r.end);
      last.quoteIdx = `${last.quoteIdx},${r.quoteIdx}`;
    }
  }
  return { ranges: merged, perQuote };
}

// Render `cleanMd` with `ranges` as inline highlight spans. Uses a
// purely-textual renderer (preserves line breaks but does NOT render
// markdown syntax) — the goal is readability + faithful quote location,
// not pretty typography.
function renderOcrWithHighlights(cleanMd, ranges, activeQuoteIdx, onClickQuote) {
  if (!cleanMd) return null;
  const out = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) out.push(cleanMd.slice(cursor, r.start));
    const text = cleanMd.slice(r.start, r.end);
    const qidx = String(r.quoteIdx).split(',')[0]; // first quote in the merged span
    const active = String(activeQuoteIdx) === qidx;
    out.push(
      <mark
        key={'h' + i}
        id={`q-${qidx}`}
        className="ocr-hl"
        data-active={active}
        onClick={() => onClickQuote && onClickQuote(parseInt(qidx, 10))}
      >{text}</mark>
    );
    cursor = r.end;
  });
  if (cursor < cleanMd.length) out.push(cleanMd.slice(cursor));
  return out;
}

function PaperDetail({ paperId, onBack, onSelectTheme }) {
  const HGE = window.HGE;
  // find which themes have this paper in top_papers
  const inThemes = HGE.atlas.nodes.filter(n => (n.top_papers || []).includes(paperId));
  const [bibState, setBibState] = useState('idle'); // 'idle' | 'loading' | 'copied' | 'error'
  const copyBibtex = async () => {
    setBibState('loading');
    try {
      const bib = await window.HGE_BIBTEX(paperId);
      if (!bib) throw new Error('empty');
      await navigator.clipboard.writeText(bib);
      setBibState('copied');
      setTimeout(() => setBibState('idle'), 1800);
    } catch (e) {
      setBibState('error');
      setTimeout(() => setBibState('idle'), 2400);
    }
  };
  const bibLabel = {
    idle:    'Copy BibTeX',
    loading: 'fetching…',
    copied:  '✓ copied',
    error:   '× failed',
  }[bibState];

  // Lazy-load the cleaned OCR + evidence-quote list on first render.
  const [ocrState, setOcrState] = useState({ status: 'idle' }); // 'idle'|'loading'|'ready'|'error'|'none'
  const [activeQuote, setActiveQuote] = useState(null);
  const ocrBodyRef = useRef(null);
  useEffect(() => {
    let alive = true;
    setOcrState({ status: 'loading' });
    setActiveQuote(null);
    window.HGE_PAPER_OCR(paperId).then(d => {
      if (!alive) return;
      if (d === null) { setOcrState({ status: 'none' }); return; }
      const { ranges, perQuote } = locateQuotes(d.clean_md || '', d.evidence_quotes || []);
      setOcrState({ status: 'ready', data: d, ranges, perQuote });
    }).catch(e => {
      if (alive) setOcrState({ status: 'error', error: e.message });
    });
    return () => { alive = false; };
  }, [paperId]);

  const onClickQuote = (i) => {
    setActiveQuote(i);
    // Scroll the highlight into view.
    requestAnimationFrame(() => {
      const el = document.getElementById(`q-${i}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  return (
    <div className="theme-detail">
      <div className="panel">
        <div className="panel-h">
          <span>Paper</span>
          <div className="h-actions">
            <button className="icon-btn" onClick={onBack} title="Back"><Icon.close /></button>
          </div>
        </div>
        <h2 className="title mono" style={{ fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--accent)' }}>arXiv:{paperId}</h2>
        <div className="meta">
          <span>cited by synthesiser in current answer</span>
        </div>
      </div>

      {/* OCR + evidence quotes — lazy-loaded from /paper/{aid}/ocr */}
      {ocrState.status === 'loading' && (
        <div className="panel">
          <div className="panel-h"><span>Cleaned OCR</span><span className="mono">loading…</span></div>
        </div>
      )}
      {ocrState.status === 'error' && (
        <div className="panel">
          <div className="panel-h"><span>Cleaned OCR</span><span className="mono" style={{ color: 'var(--bad)' }}>error</span></div>
          <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>could not load: {ocrState.error}</p>
        </div>
      )}
      {ocrState.status === 'none' && (
        <div className="panel">
          <div className="panel-h"><span>Cleaned OCR</span><span className="mono">unavailable</span></div>
          <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            This paper's OCR did not survive the cleanup pass. The raw deep-read JSON is still
            available via the backend; evidence quotes verify against the original OCR.
          </p>
        </div>
      )}
      {ocrState.status === 'ready' && (
        <>
          <div className="panel">
            <div className="panel-h">
              <span>Evidence quotes</span>
              <span className="mono">{ocrState.data.evidence_quotes.length}</span>
            </div>
            <div className="quote-list">
              {ocrState.data.evidence_quotes.map((q, i) => {
                const status = ocrState.perQuote[i];
                return (
                  <button
                    key={i}
                    className="quote-row"
                    data-active={activeQuote === i}
                    data-status={status}
                    onClick={() => onClickQuote(i)}
                    disabled={status === 'unaligned'}
                    title={status === 'unaligned' ? 'this quote does not appear verbatim in the cleaned OCR' : 'click to jump to the highlight'}
                  >
                    <div className="quote-meta mono">
                      <span className="quote-field">{q.field}</span>
                      {q.topic && <span className="quote-topic">· {q.topic}</span>}
                      <span className={'quote-status quote-status-' + status}>{status === 'exact' ? '●' : status === 'normalised' ? '◐' : '○'}</span>
                    </div>
                    <div className="quote-text">"{q.text.length > 180 ? q.text.slice(0, 180) + '…' : q.text}"</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="panel ocr-body-panel">
            <div className="panel-h">
              <span>Cleaned OCR</span>
              <span className="mono">{(ocrState.data.clean_md || '').length.toLocaleString()} chars</span>
            </div>
            <div className="ocr-body" ref={ocrBodyRef}>
              {renderOcrWithHighlights(ocrState.data.clean_md, ocrState.ranges, activeQuote, onClickQuote)}
            </div>
          </div>
        </>
      )}

      {inThemes.length > 0 && (
        <div className="panel">
          <div className="panel-h"><span>Appears in themes</span><span>{inThemes.length}</span></div>
          {inThemes.map(t => (
            <button key={t.id} className="paper-row" onClick={() => onSelectTheme(t.id)} style={{ textAlign: 'left' }}>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{t.title}</div>
                <div className="muted" style={{ fontSize: 11 }}>theme · {t.id}</div>
              </div>
              <div className="pw">open ›</div>
            </button>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="panel-h"><span>Quick actions</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <a className="chip" href={`https://arxiv.org/abs/${paperId}`} target="_blank" rel="noreferrer" style={{ justifyContent: 'center' }}>Open on arXiv ↗</a>
          <button
            className="chip"
            style={{ justifyContent: 'center', cursor: 'pointer' }}
            onClick={copyBibtex}
            disabled={bibState === 'loading'}
            data-state={bibState}
            title={bibState === 'error' ? 'Could not fetch — try again' : 'Copy a BibTeX entry from arXiv export'}
          >
            {bibLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntityDetail({ name, onBack, onSelectTheme }) {
  const HGE = window.HGE;
  const concept = HGE.conceptLookup[name.toLowerCase()];
  const themeMatches = HGE.atlas.nodes.filter(n =>
    (n.title || '').toLowerCase().includes(name.toLowerCase()) ||
    (n.key_entities || []).some(e => e.toLowerCase() === name.toLowerCase())
  );
  return (
    <div className="theme-detail">
      <div className="panel">
        <div className="panel-h">
          <span>Concept</span>
          <div className="h-actions">
            <button className="icon-btn" onClick={onBack} title="Back"><Icon.close /></button>
          </div>
        </div>
        <h2 className="title">{name}</h2>
        {concept?.def && <p className="scope">{concept.def}</p>}
        <div className="meta">
          <span>{concept?.sources?.length || 0} retrieval sources</span>
        </div>
      </div>

      {themeMatches.length > 0 && (
        <div className="panel">
          <div className="panel-h"><span>Lives in themes</span><span>{themeMatches.length}</span></div>
          {themeMatches.slice(0, 6).map(t => (
            <button key={t.id} className="paper-row" onClick={() => onSelectTheme(t.id)} style={{ textAlign: 'left' }}>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{t.title}</div>
                <div className="muted" style={{ fontSize: 11 }}>theme · {t.id} · {t.n_nodes} entities</div>
              </div>
              <div className="pw">open ›</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailPanel({ mode, payload, turn, onSelectTheme, onSelectPaper, onSelectEntity, onClose, activeThemeIds, onAskAboutConfig, isAsking }) {
  if (mode === 'theme') return <ThemeDetail themeId={payload} onSelectPaper={onSelectPaper} onSelectTheme={onSelectTheme} onBack={onClose} />;
  if (mode === 'paper') return <PaperDetail paperId={payload} onSelectTheme={onSelectTheme} onBack={onClose} />;
  if (mode === 'entity') return <EntityDetail name={payload} onSelectTheme={onSelectTheme} onBack={onClose} />;
  if (!turn) {
    return (
      <div style={{ padding: 28, color: 'var(--ink-3)', fontSize: 12.5, fontFamily: 'var(--serif)', lineHeight: 1.5 }}>
        Ask a question to surface its retrieval plan, supporting themes, and cited papers here.
      </div>
    );
  }
  return <TurnContextPanel turn={turn} onSelectTheme={onSelectTheme} onSelectPaper={onSelectPaper} activeThemeIds={activeThemeIds} />;
}

Object.assign(window, { DetailPanel });

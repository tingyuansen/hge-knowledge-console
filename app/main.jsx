/* HGE Knowledge Console — root component.
   ----------------------------------------
   Mounts the three-pane shell (rail · main · detail) plus the splitter
   handles, asking overlay, theme atlas full-screen takeover, and global
   keyboard shortcuts (`/` focus ask, `g` open atlas, `esc` close detail,
   `t` toggle theme).

   State this component owns:
     - turns[] (mirror of window.HGE.turns; updated on `hge-turn-added`)
     - activeTurnId, query, isAsking, askError
     - detailMode + detailPayload  (turn-context | theme | paper | entity | atlas)
     - pinnedCites, hoverCite, hoverEntity
     - railOpen, detailOpen, theme, atlasFull, hoodFilter

   Asking flow:
     onSubmit → runAsk(query)
       → window.HGE_ASK(query)  // POST /ask + parallel /community_overview
       → fires `hge-turn-added` event with the new turn
       → handler updates turns + selects the new turn
     askSuggested = "Try" chip in rail → runAsk(q, {fresh:true})
       (flushes turns first; suggestions start a new conversation)
     askAboutConfig = lever → /ask follow-up in same thread

   Empty state (no turns yet) renders <EmptyAskView/> with the science-context
   landing copy and the suggested questions; once the first turn lands,
   <AnswerView/> replaces it.
*/

function App() {
  const ready = useDataReady();
  if (!ready) {
    return (
      <div style={{ padding: 60, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ink-3)' }}>
        <div style={{ marginBottom: 16 }}>HGE Console</div>
        <div className="skel skel-line" style={{ width: 320 }}></div>
        <div className="skel skel-line" style={{ width: 220 }}></div>
        <div className="skel skel-line" style={{ width: 280 }}></div>
      </div>
    );
  }
  return <Console />;
}

function Console() {
  const HGE = window.HGE;

  // Conversation state — empty on first load; populated as the user asks.
  const [turns, setTurns] = useState(HGE.turns);
  const [activeTurnId, setActiveTurnId] = useState(HGE.turns.length ? HGE.turns[HGE.turns.length - 1].id : null);
  const activeTurn = turns.find(t => t.id === activeTurnId) || null;
  const [query, setQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState(null);

  // listen for new turns added by HGE_ASK
  useEffect(() => {
    const onTurn = (e) => {
      setTurns(window.HGE.turns);
      setActiveTurnId(e.detail.id);
    };
    window.addEventListener('hge-turn-added', onTurn);
    return () => window.removeEventListener('hge-turn-added', onTurn);
  }, []);

  // Right-rail detail state
  // mode: 'turn-context' | 'theme' | 'paper' | 'entity' | 'atlas'
  const [detailMode, setDetailMode] = useState('turn-context');
  const [detailPayload, setDetailPayload] = useState(null);

  // Citation pinning + hovercards
  const [pinnedCites, setPinnedCites] = useState(new Set());
  const [hoverCite, setHoverCite] = useState(null);     // { id, anchor }
  const [hoverEntity, setHoverEntity] = useState(null); // { name, anchor }

  // Layout toggles
  const [railOpen, setRailOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(true);
  const [theme, setTheme] = useState(() =>
    (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  );

  // Atlas full-screen
  const [atlasFull, setAtlasFull] = useState(false);
  const [hoodFilter, setHoodFilter] = useState(null);

  // listen for tweaks state from HGETweaks
  useEffect(() => {
    const onTw = (e) => setTheme(e.detail?.theme || 'light');
    window.addEventListener('hge-tweaks', onTw);
    return () => window.removeEventListener('hge-tweaks', onTw);
  }, []);

  // when turn changes, reset detail to turn-context
  useEffect(() => {
    setDetailMode('turn-context');
    setDetailPayload(null);
    setPinnedCites(new Set());
    // scroll main to top
    const main = document.querySelector('.main');
    if (main) main.scrollTo(0, 0);
  }, [activeTurnId]);

  // Selection handlers
  const onSelectTheme = useCallback((id) => {
    if (id === '__atlas__') {
      setAtlasFull(true);
      return;
    }
    setDetailMode('theme');
    setDetailPayload(id);
    setDetailOpen(true);
  }, []);
  const onSelectPaper = useCallback((id) => {
    setDetailMode('paper');
    setDetailPayload(id);
    setDetailOpen(true);
  }, []);
  const onSelectEntity = useCallback((name) => {
    setDetailMode('entity');
    setDetailPayload(name);
    setDetailOpen(true);
  }, []);
  const closeDetail = useCallback(() => {
    setDetailMode('turn-context');
    setDetailPayload(null);
  }, []);

  // Ask — calls live backend, threads multi-turn history.
  // opts.fresh=true flushes the conversation first (so suggestions and
  // ask-about-config from the right pane start clean threads).
  const runAsk = useCallback(async (q, opts) => {
    opts = opts || {};
    if (!q.trim()) return;
    if (opts.fresh) {
      window.HGE.turns = [];
      setTurns([]);
      setActiveTurnId(null);
    }
    setIsAsking(true);
    setAskError(null);
    try {
      await window.HGE_ASK(q);
      setQuery('');
    } catch (e) {
      console.error(e);
      setAskError(String(e.message || e));
    } finally {
      setIsAsking(false);
    }
  }, []);

  const onSubmit = useCallback(() => runAsk(query), [query, runAsk]);
  // Suggestions in the rail are "Try" — they start a fresh conversation.
  const askSuggested = useCallback((q) => { setQuery(q); runAsk(q, { fresh: true }); }, [runAsk]);
  // Lever→question round-trip: configuration becomes a follow-up to the current thread.
  const askAboutConfig = useCallback((q) => { setQuery(q); runAsk(q); }, [runAsk]);

  // "New conversation" — flush turns and reset state.
  const newConversation = useCallback(() => {
    window.HGE.turns = [];
    setTurns([]);
    setActiveTurnId(null);
    setDetailMode('turn-context');
    setDetailPayload(null);
    setPinnedCites(new Set());
    setQuery('');
    setAskError(null);
    const main = document.querySelector('.main');
    if (main) main.scrollTo(0, 0);
  }, []);

  // Branch from a paragraph: prefill ask with a tailored follow-up
  const onBranch = useCallback((block) => {
    const lead = block.lead || '';
    const q = lead ? `Tell me more about ${lead} — what are the key observational signatures?` : 'Tell me more about this claim.';
    setQuery(q);
    if (window.__hge_focus_ask) window.__hge_focus_ask();
  }, []);

  // Suggested follow-ups, contextual to current turn.
  // These are leadership-grade survey-design questions framed in HGE terms.
  // They may sometimes return "not directly in corpus" — that is the honest
  // answer the synthesiser is constrained to give. The dispatcher prompt is
  // tuned (in hge_stack/agent.py) to fall back from narrow spec_query/
  // relationship_query to broader concept_search/community_overview when the
  // question implies a parametric trade rather than a literal numeric lookup.
  const suggestedQs = useMemo(() => {
    if (!activeTurn) return [
      'What does the literature say about achieving SNR ≥ 75 per pixel at 1.6 μm for abundance work?',
      'How does dust-map choice (Marshall, Surot/VVV, Galaxia3D, Bayestar) affect H-band target distributions in obscured regions?',
      'What target-selection methods give >80% efficiency for log g ≤ 1.5 luminous giants?',
      'How does distance uncertainty bias measured radial abundance gradients in the Galactic disk?',
    ];
    const i = activeTurn.index;
    if (i === 0) return [
      'At SNR=75 we hit α-element SRD targets — which elements drop out at SNR=60?',
      'How does Marshall+2006 vs VVV/Surot shift the far-side H-mag distribution?',
      'Which 2×2 kpc far-disk bins are dense enough for 1,000-star gradient recovery?',
    ];
    if (i === 1) return [
      'Which elements are most diagnostic of radial migration that HGE can deliver?',
      'What\u2019s the minimum sample size for an unbiased far-side gradient at 15% distance σ?',
      'Compare guiding-radius vs instantaneous R_GC as the dispatch axis for HGE.',
    ];
    if (i === 2) return [
      'How many H < 14.5 giants does Gaia XP add at b > 2° for off-midplane targeting?',
      'How does σ(age) propagate into inside-out vs upside-down disambiguation?',
      'What\u2019s the field count for inside-out tests under the 578-field baseline?',
    ];
    // Turn 4 — design-trade
    return [
      'Drop SNR target to 50 — which elements lose SRD coverage and by how much?',
      'Sample-yield at 5 hr vs 20 hr per field — what\u2019s the science-case delta?',
      'Mixed-depth (SNR 70 bulk + SNR 120 sub-carton for Mn/Co/V) — feasible in 5,800 hr?',
      'If 15% distance σ stays — how many extra stars to recover the SRD gradient?',
    ];
  }, [activeTurnId]);

  // keyboard
  useKeyboard({
    '/': (e) => { e.preventDefault(); if (window.__hge_focus_ask) window.__hge_focus_ask(); },
    'Escape': () => {
      if (atlasFull) { setAtlasFull(false); return; }
      if (detailMode !== 'turn-context') closeDetail();
    },
    'g': () => setAtlasFull(true),
    'e': () => {
      const node = document.querySelector('.main-inner > section');
      if (node) node.scrollIntoView({ block: 'start' }); // jump to evidence digest
    },
    't': () => setTheme(t => t === 'light' ? 'dark' : 'light'),
  });

  // sync theme with html dataset (for when toggled from header — tweaks panel
  // listens separately and applies the rest)
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (window.__hge_set_theme) window.__hge_set_theme(theme);
  }, [theme]);

  const activeThemeIds = activeTurn ? activeTurn.themeIds : [];

  return (
    <div
      className="shell"
      data-rail={railOpen ? 'on' : 'off'}
      data-detail={detailOpen ? (detailMode === 'theme' || detailMode === 'paper' ? 'wide' : 'on') : 'off'}
    >
      <Header
        query={query} setQuery={setQuery} onSubmit={onSubmit} isAsking={isAsking}
        theme={theme} onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        railOpen={railOpen} onToggleRail={() => setRailOpen(v => !v)}
        detailOpen={detailOpen} onToggleDetail={() => setDetailOpen(v => !v)}
        onOpenTweaks={() => window.postMessage({ type: '__activate_edit_mode' }, '*')}
        activeTurn={activeTurn}
        hasTurns={turns.length > 0}
        onNewConversation={newConversation}
      />

      <HGEBaselineStrip />

      <Splitter side="left" />
      <Splitter side="right" />

      <aside className="rail" aria-label="Conversation + atlas overview">
        <ConversationRail
          turns={turns}
          activeTurnId={activeTurnId}
          onSelectTurn={setActiveTurnId}
          onSelectTheme={onSelectTheme}
          selectedThemeId={detailMode === 'theme' ? detailPayload : null}
          activeThemeIds={activeThemeIds}
          suggestedQs={suggestedQs}
          onAskSuggested={askSuggested}
        />
      </aside>

      <main className="main">
        {isAsking && <AskingOverlay />}
        {atlasFull ? (
          <div className="main-inner" style={{ maxWidth: 1100 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
              <h1 className="serif" style={{ fontSize: 26, margin: 0, fontWeight: 500, letterSpacing: '-0.012em' }}>Theme atlas</h1>
              <button className="chip" onClick={() => setAtlasFull(false)}><Icon.close /> close atlas</button>
            </div>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, fontFamily: 'var(--serif)', marginBottom: 22, maxWidth: 720 }}>
              Each circle is a GraphRAG <em>theme</em>: a community of co-occurring entities in the curated corpus.
              Circles are sized by entity count and grouped into 8 named neighborhoods. Hover any circle to see its bridges
              to other themes (inter-community edges, weighted by paper count). Themes informing the current turn are ringed.
            </p>
            <ThemeAtlas
              mode="full"
              activeThemeIds={activeThemeIds}
              selectedThemeId={detailMode === 'theme' ? detailPayload : null}
              onSelectTheme={onSelectTheme}
              hoodFilter={hoodFilter}
              onHoodFilter={setHoodFilter}
            />
          </div>
        ) : !activeTurn ? (
          <EmptyAskView
            askError={askError} suggestedQs={suggestedQs} onAskSuggested={askSuggested}
            onAskAboutConfig={askAboutConfig} isAsking={isAsking}
          />
        ) : (
          <AnswerView
            turn={activeTurn}
            onSelectTheme={onSelectTheme}
            onSelectPaper={onSelectPaper}
            onSelectEntity={onSelectEntity}
            onAskFollowup={onBranch}
            onAskAboutConfig={askAboutConfig}
            onAskQuestion={(q) => runAsk(q)}
            isAsking={isAsking}
            pinnedCites={pinnedCites}
            setPinnedCites={setPinnedCites}
            hoverCite={hoverCite}
            setHoverCite={setHoverCite}
            hoverEntity={hoverEntity}
            setHoverEntity={setHoverEntity}
          />
        )}
      </main>

      <aside className="detail" aria-label="Detail panel">
        <DetailPanel
          mode={detailMode}
          payload={detailPayload}
          turn={activeTurn}
          onSelectTheme={onSelectTheme}
          onSelectPaper={onSelectPaper}
          onSelectEntity={onSelectEntity}
          onClose={closeDetail}
          activeThemeIds={activeThemeIds}
          onAskAboutConfig={askAboutConfig}
          isAsking={isAsking}
        />
      </aside>

      {/* citation hovercard */}
      {hoverCite && (
        <HoverCard anchor={hoverCite.anchor}>
          <CitationHoverContent arxivId={hoverCite.id} />
        </HoverCard>
      )}
      {hoverEntity && (
        <HoverCard anchor={hoverEntity.anchor}>
          <EntityHoverContent name={hoverEntity.name} />
        </HoverCard>
      )}

      <HGETweaks />
    </div>
  );
}

function CitationHoverContent({ arxivId }) {
  const HGE = window.HGE;
  // find a community the paper appears in
  let home = null;
  for (const n of HGE.atlas.nodes) {
    if ((n.top_papers || []).includes(arxivId)) { home = n; break; }
  }
  return (
    <>
      <div className="hc-id">
        <span>arXiv:{arxivId}</span>
        <span className="muted">click to pin</span>
      </div>
      {home ? (
        <>
          <div className="hc-title">{home.title}</div>
          <div className="hc-scope">{(home.scope || '').slice(0, 220)}…</div>
          <div className="hc-meta">
            <span>theme · {home.id}</span>
            <span style={{ color: 'var(--ink)' }}>{HGE.atlas.neighborhoods.find(h => h.id === home.hood)?.label}</span>
          </div>
        </>
      ) : (
        <div className="hc-scope">Cited paper · click to open its card.</div>
      )}
    </>
  );
}

function EntityHoverContent({ name }) {
  const HGE = window.HGE;
  const concept = HGE.conceptLookup[name.toLowerCase()];
  return (
    <>
      <div className="hc-id">
        <span>concept</span>
        <span className="muted">{concept?.sources?.length || 0} sources</span>
      </div>
      <div className="hc-title">{name}</div>
      {concept?.def ? (
        <div className="hc-scope">{concept.def}</div>
      ) : (
        <div className="hc-scope muted">Entity from the curated vocabulary. Click to see themes it appears in.</div>
      )}
    </>
  );
}

function Splitter({ side }) {
  // Drag a vertical handle to resize the left or right rail. Updates the
  // CSS custom property `--rail-l` / `--rail-r` which the .shell grid reads.
  const onDown = useCallback((e) => {
    e.preventDefault();
    const cssVar = side === 'left' ? '--rail-l' : '--rail-r';
    const min = 200, max = Math.min(720, window.innerWidth * 0.45);
    const startX = e.clientX;
    const startVal = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(cssVar)) ||
      (side === 'left' ? 280 : 380);
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      let next = side === 'left' ? startVal + dx : startVal - dx;
      next = Math.max(min, Math.min(max, next));
      document.documentElement.style.setProperty(cssVar, next + 'px');
    };
    const onUp = () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // persist to localStorage so the layout survives reload
      try { localStorage.setItem('hge-' + cssVar, getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()); } catch (_) {}
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [side]);
  // restore from localStorage on first mount
  useEffect(() => {
    const cssVar = side === 'left' ? '--rail-l' : '--rail-r';
    try {
      const v = localStorage.getItem('hge-' + cssVar);
      if (v) document.documentElement.style.setProperty(cssVar, v);
    } catch (_) {}
  }, [side]);
  return (
    <div
      className={'split-h ' + (side === 'left' ? 'split-l' : 'split-r')}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? 'Resize conversation rail' : 'Resize detail rail'}
      onMouseDown={onDown}
      title="Drag to resize"
    />
  );
}

function AskingOverlay() {
  // top-of-main banner with a determinate-ish phased message + animated dots.
  // Gemini-3.5-Flash dispatches (~2-4s), then primitives execute (~1-3s),
  // then Gemini-3.5-Flash synthesises (~4-10s). We rotate phases on a timer to
  // give a sense of progress without faking a real timeline.
  const PHASES = [
    'planning · selecting retrieval primitives',
    'executing · concept_search · spec_query · community_overview',
    'synthesising answer · grounding every claim to evidence',
  ];
  const [phase, setPhase] = useState(0);
  const [t0] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const a = setInterval(() => setPhase(p => Math.min(p + 1, PHASES.length - 1)), 4500);
    const b = setInterval(() => setTick(t => t + 1), 250);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const dots = '.'.repeat(1 + (tick % 3));
  return (
    <div className="ask-overlay" role="status" aria-live="polite">
      <div className="ask-overlay-bar"><span className="ask-overlay-fill" /></div>
      <div className="ask-overlay-text mono">
        <span className="ask-overlay-spinner" aria-hidden="true" />
        asking{dots} <span style={{ color: 'var(--ink-3)' }}>· {PHASES[phase]} · {elapsed}s</span>
      </div>
    </div>
  );
}

function EmptyAskView({ askError, suggestedQs, onAskSuggested, onAskAboutConfig, isAsking }) {
  return (
    <div className="main-inner" style={{ maxWidth: 760, paddingTop: 32 }}>
      <div className="welcome-hero" aria-hidden="true">
        <img src="images/welcome-hero.jpg" alt="" />
      </div>
      <div className="up" style={{ marginTop: 24, marginBottom: 8, color: 'var(--accent)' }}>Hidden Galaxy Explorer · After Sloan 5</div>
      <h1 className="serif" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.014em', margin: '0 0 18px', lineHeight: 1.18 }}>
        Mapping the obscured half of the Milky Way.
      </h1>

      <div style={{ fontFamily: 'var(--serif)', color: 'var(--ink-2)', fontSize: 16.5, lineHeight: 1.62, marginBottom: 32 }}>
        <p style={{ margin: '0 0 14px' }}>
          The Milky Way's far side — the disk and bar regions hidden behind the dust of the inner
          Galaxy — has stayed largely off-limits to the spectroscopic surveys that have rewritten
          our understanding of stellar populations. Optical light cannot get through; the
          stars beyond the Galactic centre are essentially invisible to the surveys we have today.
        </p>
        <p style={{ margin: '0 0 14px' }}>
          The <b>Hidden Galaxy Explorer</b> is the proposed near-infrared spectroscopic survey
          inside <b>After Sloan 5</b>, the next chapter of the Sloan Digital Sky Surveys. Its
          aim is to bring the precision chemo-kinematic toolkit that APOGEE established for the
          near side to the obscured far side and the Galactic bulge — recovering radial
          abundance gradients, testing inside-out disk formation, and resolving the
          chemo-dynamics of the bar and bulge with hundreds of thousands of luminous giants.
        </p>
        <p style={{ margin: '0 0 14px' }}>
          Designing the survey is its own scientific exercise. Which dust-extinction maps
          should anchor target selection? What signal-to-noise is needed at <span className="mono">H = 14.5</span> to
          deliver α-element abundances at the precision the science cases require? How do
          field count, exposure depth, and footprint geometry trade against each other under a
          fixed telescope budget?
        </p>
        <p style={{ margin: 0 }}>
          This console is the working surface the HGE leadership council uses to interrogate
          those questions against the curated literature on galactic archaeology — six-and-a-half
          thousand papers spanning APOGEE, Gaia, GALAH, 2MASS/VVV, asteroseismic age catalogues,
          and the methodological literature on extinction, distances, and abundance pipelines.
          Every claim in an answer traces back to a verbatim quote from a specific paper.
        </p>
      </div>

      {askError && (
        <div style={{ background: 'var(--paper-2)', padding: 12, borderLeft: '3px solid var(--bad)', fontFamily: 'var(--mono)', fontSize: 12.5, marginBottom: 24, color: 'var(--bad)' }}>
          {askError}
        </div>
      )}
      <div className="up" style={{ marginBottom: 10 }}>Try a question</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestedQs.map((q, i) => (
          <button key={i} className="suggestion" onClick={() => onAskSuggested(q)}
            style={{ textAlign: 'left', fontFamily: 'var(--serif)', fontSize: 14.5, lineHeight: 1.45, color: 'var(--ink-2)', padding: '10px 12px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--rule-soft)' }}>
            {q}
          </button>
        ))}
      </div>
      <style>{`.suggestion:hover { background: var(--paper-2); color: var(--ink) !important; border-color: var(--rule); }`}</style>

      {/* Design lever — visible by default so leadership can play with the
          HGE survey knobs before/while asking anything. */}
      <div style={{ marginTop: 36 }}>
        <CollapsibleLever defaultOpen={true} leverRelevant={false} onAskAboutConfig={onAskAboutConfig} isAsking={isAsking} />
      </div>

      <div style={{ marginTop: 48, paddingTop: 16, borderTop: '1px solid var(--rule-soft)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.55 }}>
        Console for the HGE survey-design council. Driven by a curated galactic-archaeology
        literature corpus; every claim is traceable to a source paper. Maintained as part of the
        After Sloan 5 / HGE design cycle; not a public release.
      </div>
    </div>
  );
}

Object.assign(window, { EmptyAskView });

ReactDOM.createRoot(document.getElementById('app')).render(<App />);

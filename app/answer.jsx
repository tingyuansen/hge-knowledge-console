/* AnswerView — the primary reading surface.
   ------------------------------------------
   Layout: question + agent-plan strip + answer blocks, each block paired with
   a margin-stack of evidence cards. Below the answer: an auto-injected
   "context strip" with SpecScatter, Galactic footprint, and element-precision
   panels — but ONLY when the turn's content actually relates (data.js sets
   .showSpec/.showFootprint/.showElements per turn).

   The "Evidence digest" at the bottom collects all cited papers across the
   answer for one-glance audit.

   Citation interactions:
   - hover an arXiv:NNNN → hovercard (paper meta + theme it surfaced from)
   - click an arXiv:NNNN → opens paper detail in the right rail AND marks the
     cite pinned. The matching evidence card in the margin glows.
   - click a bold entity (concept) → opens entity hovercard with definition;
     "open theme" link inside opens the relevant theme drilldown.
*/

function CollapsibleLever({ defaultOpen, leverHints, leverRelevant, onAskAboutConfig, isAsking }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ marginTop: 28, border: '1px solid var(--rule-soft)', borderRadius: 4, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left',
          padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: open ? 'var(--paper-2)' : 'transparent',
          borderBottom: open ? '1px solid var(--rule-soft)' : 'none',
          fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)',
          cursor: 'pointer',
        }}
      >
        <span>
          <span style={{ color: 'var(--ink)' }}>Design lever</span>
          <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>
            {leverRelevant ? 'auto-seeded from this question' : 'play with HGE survey knobs'}
          </span>
        </span>
        <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{open ? '▾ hide' : '▸ open'}</span>
      </button>
      {open && (
        <DesignLever
          hints={leverHints}
          leverRelevant={leverRelevant}
          onAskAboutConfig={onAskAboutConfig}
          isAsking={isAsking}
        />
      )}
    </div>
  );
}

function PlanStrip({ plan }) {
  if (!plan) return null;
  return (
    <div className="plan-strip" aria-label="Agent dispatcher plan">
      <span className="up" style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'none', fontSize: 11, color: 'var(--ink-3)' }}>plan</span>
      {plan.calls.map((c, i) => (
        <span key={i} className="primitive" title={JSON.stringify(c.args)}>
          <b>{c.primitive}</b>
          {Object.entries(c.args).slice(0, 2).map(([k, v]) => (
            <span key={k} style={{ color: 'var(--ink-3)' }}>  {k}=<span style={{ color: 'var(--ink-2)' }}>{String(v)}</span></span>
          ))}
        </span>
      ))}
      <span className="rationale">— {plan.rationale}</span>
    </div>
  );
}

function EvidenceCard({ ev, isPinned, onClick, onHover }) {
  return (
    <div
      className="ev-card"
      data-pinned={isPinned}
      onClick={(e) => onClick && onClick(ev, e.currentTarget)}
      role="button"
      tabIndex={0}
    >
      <div className="ev-head">
        <span className="id">
          {ev.kind === 'paper'    && `arXiv:${ev.arxivId}`}
          {ev.kind === 'community' && `theme · ${ev.communityId}`}
          {ev.kind === 'concept'   && `concept`}
        </span>
        <span>{ev.primitive === 'top_concepts' ? 'top_concepts' : ev.primitive === 'community_overview' ? 'community_overview' : ev.primitive === 'concept_search' ? 'concept_search' : ''}</span>
      </div>
      {ev.kind !== 'paper' && ev.title && (
        <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 4, color: 'var(--ink)' }}>{ev.title}</div>
      )}
      {ev.kind === 'paper' && ev.communityTitle && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 3 }}>surfaced via <span style={{ color: 'var(--ink-2)' }}>{ev.communityTitle}</span></div>
      )}
      {ev.text && <div className="ev-quote">{ev.text.length > 220 ? ev.text.slice(0, 220) + '…' : ev.text}</div>}
      {ev.meta && <div className="ev-from">{ev.meta}</div>}
    </div>
  );
}

function ParagraphRow({ block, evidence, onCite, onCiteHover, onEntity, onEntityHover, onBranch, pinnedCites, conceptLookup, isHighlighted }) {
  // Render a paragraph or a list item with its margin evidence stack.
  // For list items, we render the bullet dash via .answer li styling, so the
  // markup uses <li> when the block is type 'li'.
  const Tag = block.type === 'li' ? 'li' : 'p';
  const content = renderInline(block.text, { onCite, onCiteHover, onEntity, onEntityHover, pinnedCites, conceptLookup });

  // group consecutive list items: in our flat block list, every 'li' is its own
  // paragraph row to allow per-bullet evidence. CSS .answer li ::before handles
  // the dash bullet.
  return (
    <div className={`paragraph-row${evidence.length === 0 ? ' no-margin' : ''}`} data-block-id={block.idx}>
      <div className={`para${isHighlighted ? ' is-highlighted' : ''}`} style={isHighlighted ? { background: 'var(--highlight-soft)', borderRadius: 3, padding: '2px 4px', margin: '-2px -4px' } : null}>
        {block.type === 'li' ? (
          <ul style={{ marginBottom: 0 }}>
            <Tag>{content}</Tag>
          </ul>
        ) : (
          <Tag className="serif">{content}</Tag>
        )}
        {!block.isTrailer && (
          <button className="branch-btn mono" onClick={() => onBranch && onBranch(block)} title="Ask a follow-up rooted in this claim">
            ↩ branch
          </button>
        )}
      </div>
      <div className="margin-stack">
        {evidence.map((ev, i) => {
          const pin = ev.kind === 'paper' && pinnedCites.has(ev.arxivId);
          return <EvidenceCard key={i} ev={ev} isPinned={pin} onClick={(c, anchor) => onCite && onCite(c.kind === 'paper' ? c.arxivId : null, anchor, c)} />;
        })}
      </div>
    </div>
  );
}

function EvidenceDigest({ digest, onSelectPaper, citedPaperIds }) {
  if (!digest.cited.length) return null;
  return (
    <section style={{ marginTop: 36, paddingTop: 18, borderTop: '1px solid var(--rule)' }}>
      <div className="up" style={{ marginBottom: 12 }}>
        Evidence digest · {digest.cited.length} cited papers
        <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginLeft: 10, fontFamily: 'IBM Plex Mono, monospace' }}>
          (every claim traces back to one of these)
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
        {digest.cited.map(p => (
          <div key={p.id} className="paper-row" style={{ padding: '8px 12px', border: '1px solid var(--rule-soft)', borderRadius: 3 }}
               onClick={() => onSelectPaper(p.id)}>
            <div>
              <div className="pid">arXiv:{p.id}</div>
              {p.communities.length > 0 && (
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                  via {p.communities.map(c => c.title || `theme ${c.id}`).join(' · ').slice(0, 80)}
                </div>
              )}
            </div>
            <div className="pw">w={p.weight}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnswerView({ turn, onSelectTheme, onSelectPaper, onSelectEntity, onBranch, pinnedCites, setPinnedCites, hoverCite, setHoverCite, hoverEntity, setHoverEntity, onAskFollowup, onAskAboutConfig, onAskQuestion, isAsking }) {
  const conceptLookup = window.HGE.conceptLookup;
  const [highlightedBlocks, setHighlightedBlocks] = useState(new Set());

  // citation handlers
  const handleCite = useCallback((arxivId, anchor, evOrNull) => {
    if (arxivId) {
      setPinnedCites(prev => {
        const next = new Set(prev);
        if (next.has(arxivId)) next.delete(arxivId);
        else next.add(arxivId);
        return next;
      });
      onSelectPaper(arxivId);
    } else if (evOrNull) {
      if (evOrNull.kind === 'community') onSelectTheme(evOrNull.communityId);
      else if (evOrNull.kind === 'concept') onSelectEntity(evOrNull.title);
    }
  }, [setPinnedCites, onSelectPaper, onSelectTheme, onSelectEntity]);

  const handleCiteHover = useCallback((arxivId, anchor) => {
    setHoverCite(arxivId ? { id: arxivId, anchor } : null);
  }, [setHoverCite]);

  const handleEntity = useCallback((name, anchor) => {
    onSelectEntity(name);
  }, [onSelectEntity]);

  const handleEntityHover = useCallback((name, anchor) => {
    setHoverEntity(name ? { name, anchor } : null);
  }, [setHoverEntity]);

  // For each paragraph: figure out if it's "highlighted" (i.e. tied to a selected theme)
  // We'd plug in a selectedThemeId prop — kept simple here.

  return (
    <div className="main-inner">
      <div className="q-block">
        <div className="q-num">Q{turn.index + 1}</div>
        <h1 className="q-text">{turn.question}</h1>
      </div>

      <PlanStrip plan={turn.plan} />

      <div className="answer">
        {turn.blocks.map(b => (
          <ParagraphRow
            key={b.idx}
            block={b}
            evidence={b.evidence || []}
            onCite={handleCite}
            onCiteHover={handleCiteHover}
            onEntity={handleEntity}
            onEntityHover={handleEntityHover}
            onBranch={(blk) => onAskFollowup && onAskFollowup(blk)}
            pinnedCites={pinnedCites}
            conceptLookup={conceptLookup}
          />
        ))}
      </div>

      {/* The Design lever is always shown so leadership can frame any answer
          back into the HGE survey-design context. When the question parses
          into knob hints (H, exposure, SNR target), the sliders auto-seed
          and the panel gets a subtle glow. */}
      {turn.scorecard && turn.scorecard.length > 0 && (
        <section className="scorecard" style={{ marginTop: 28 }}>
          <div className="up" style={{ marginBottom: 8 }}>Science-case scorecard</div>
          <div className="scorecard-grid">
            {turn.scorecard.map((row, i) => (
              <div key={i} className={'scorecard-row' + (row.beyond ? ' is-beyond' : '')}>
                <div className="sc-effect" data-effect={row.effect}>
                  <span className="sc-arrow">{row.effect}</span>
                  {row.prior_effect && row.prior_effect !== row.effect && (
                    <span className="sc-delta">was {row.prior_effect}</span>
                  )}
                </div>
                <div className="sc-case">{row.beyond && <span className="sc-beyond-tag">beyond</span>}{row.case_name}</div>
                <div className="sc-why">{row.why}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {turn.followups && turn.followups.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div className="up" style={{ marginBottom: 8 }}>Follow-up questions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {turn.followups.map((q, i) => (
              <button
                key={i}
                className="followup-chip"
                onClick={() => onAskQuestion && onAskQuestion(q)}
                disabled={isAsking}
                title="Ask this as a follow-up in the same conversation"
              >
                <span style={{ color: 'var(--ink-3)', marginRight: 6, fontFamily: 'var(--mono)', fontSize: 11 }}>↪</span>
                {q}
              </button>
            ))}
          </div>
        </section>
      )}

      <CollapsibleLever
        defaultOpen={true}
        leverHints={turn.leverHints}
        leverRelevant={!!turn.leverRelevant}
        onAskAboutConfig={onAskAboutConfig}
        isAsking={isAsking}
      />
      {/* SpecScatter is intentionally removed from the answer flow — the
          DesignLever already covers the SNR / abundance-precision parameter
          space prospectively, while the SpecScatter is just a retrospective
          plot of literature reports. The component is retained in the code
          base for opt-in surfaces (atlas exploration, debugging). */}
      {turn.showFootprint && (
        <GalacticFootprint
          activeZoneIds={turn.activeZones}
        />
      )}

      <EvidenceDigest digest={turn.digest} onSelectPaper={onSelectPaper} citedPaperIds={pinnedCites} />

      {/* keyboard hints */}
      <div className="kbd-strip" style={{ marginTop: 36, justifyContent: 'flex-end' }}>
        <span><kbd>/</kbd> ask</span>
        <span><kbd>g</kbd> atlas</span>
        <span><kbd>e</kbd> evidence</span>
        <span><kbd>t</kbd> theme</span>
        <span><kbd>esc</kbd> close</span>
      </div>
    </div>
  );
}

Object.assign(window, { AnswerView });

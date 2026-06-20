/* Header — brand mark, ask box, view toggles, theme toggle.
   The ask box lives in the header (not the rail) because asking is the
   primary action; we want it within thumb reach regardless of which view
   the user is on, and we want it to stay anchored when the user scrolls
   long answers.
*/

function HGEBaselineStrip() {
  const bl = window.HGE.hgeBaseline;
  return (
    <div className="hge-baseline" aria-label="Current HGE survey design baseline">
      <span className="bl-tag">HGE baseline</span>
      <span className="bl-cell"><span className="bl-k">far-side giants</span><span className="bl-v"><b>{(bl.sample.far_side_giants / 1000).toFixed(0)}k</b> · log g ≤ {bl.sample.log_g_max}</span></span>
      <span className="bl-cell"><span className="bl-k">bulge / bar</span><span className="bl-v"><b>{(bl.sample.bulge_bar_giants / 1000).toFixed(0)}k</b> giants</span></span>
      <span className="bl-cell"><span className="bl-k">footprint</span><span className="bl-v"><b>{bl.sample.sky_deg2.toLocaleString()}</b> deg² · {bl.sample.fields_apo}+{bl.sample.fields_lco} fields</span></span>
      <span className="bl-cell"><span className="bl-k">R ≥</span><span className="bl-v"><b>{(bl.spec.R_min / 1000).toFixed(0)}k</b></span></span>
      <span className="bl-cell"><span className="bl-k">SNR ≥</span><span className="bl-v"><b>{bl.spec.SNR}</b> @ {bl.spec.wavelength_um} μm</span></span>
      <span className="bl-cell"><span className="bl-k">σ[Fe/H]</span><span className="bl-v">≤ <b>{bl.spec.feh_dex}</b> dex</span></span>
      <span className="bl-cell"><span className="bl-k">RV</span><span className="bl-v">≤ <b>{bl.spec.rv_kms}</b> km/s</span></span>
      <span className="bl-cell"><span className="bl-k">H limit</span><span className="bl-v">{bl.spec.H_limit} · {bl.spec.target_eff_pct}% eff</span></span>
      <span className="bl-cell"><span className="bl-k">dust map</span><span className="bl-v">{bl.dust_maps[0].name}</span></span>
      <span className="bl-cell tension"><span className="bl-k">live tensions</span><span className="bl-v">{bl.open_tensions.length} open</span></span>
    </div>
  );
}

function Header({
  query, setQuery, onSubmit, isAsking,
  theme, onToggleTheme,
  railOpen, onToggleRail,
  detailOpen, onToggleDetail,
  onOpenTweaks,
  activeTurn,
  hasTurns,
  onNewConversation,
}) {
  const inputRef = useRef(null);

  // expose focus to the global '/' key
  useEffect(() => {
    window.__hge_focus_ask = () => inputRef.current && inputRef.current.focus();
  }, []);

  return (
    <header className="head">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"></span>
        <span className="brand-text">HGE Console</span>
      </div>

      <form
        className="askbar"
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        role="search"
        aria-label="Ask the corpus"
      >
        <Icon.search />
        <input
          ref={inputRef}
          type="text"
          placeholder={activeTurn ? `Follow up on “${activeTurn.question.slice(0, 60)}${activeTurn.question.length > 60 ? '…' : ''}”` : 'Ask a survey-design question — e.g. “what does the literature say about SNR ≥ 75 at 1.6 μm?”'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Ask the corpus"
          disabled={isAsking}
        />
        <span className="kbd">/</span>
        <button type="submit" className="send" disabled={!query.trim() || isAsking} data-busy={isAsking ? 'true' : 'false'}>
          {isAsking ? 'asking' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon.send /> ask</span>}
        </button>
      </form>

      <div className="head-meta">
        <span><b>6,415</b> papers</span>
        <span>·</span>
        <span><b>64,691</b> entities</span>
        <span>·</span>
        <span><b>459</b> themes</span>
      </div>

      <div className="head-tools">
        {hasTurns && (
          <button className="icon-btn new-conv-btn" onClick={onNewConversation} title="Start a new conversation (flush turns)">
            <span className="mono" style={{ fontSize: 11 }}>+ new</span>
          </button>
        )}
        <button className="icon-btn" aria-pressed={railOpen} onClick={onToggleRail} title="Toggle conversation rail"><Icon.columnsL /></button>
        <button className="icon-btn" aria-pressed={detailOpen} onClick={onToggleDetail} title="Toggle detail rail"><Icon.columnsR /></button>
        <button className="icon-btn" onClick={onToggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Icon.sun /> : <Icon.moon />}
        </button>
        <button className="icon-btn" onClick={onOpenTweaks} title="Tweaks"><Icon.sliders /></button>
      </div>
    </header>
  );
}

Object.assign(window, { Header, HGEBaselineStrip });

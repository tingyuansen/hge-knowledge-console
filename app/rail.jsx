/* Left rail — conversation history + a small persistent atlas thumbnail.
   Why both in the rail: turns + atlas are the two "spatial" indexes the user
   uses to orient themselves. The rail acts as the document-outline equivalent.
*/

function ConversationRail({ turns, activeTurnId, onSelectTurn, onSelectTheme, selectedThemeId, activeThemeIds, suggestedQs, onAskSuggested }) {
  return (
    <div>
      <div className="rail-section">
        <div className="rail-title">
          Conversation
          <span className="pill">{turns.length} {turns.length === 1 ? 'turn' : 'turns'}</span>
        </div>
        <div style={{ position: 'relative' }}>
          {turns.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: '8px 4px', lineHeight: 1.4, fontFamily: 'var(--serif)' }}>
              No turns yet. Ask a question above (or pick a suggestion below).
            </div>
          )}
          {turns.length > 0 && <div className="thread-line" />}
          {turns.map((t, i) => (
            <button
              key={t.id}
              className="turn"
              aria-current={activeTurnId === t.id}
              onClick={() => onSelectTurn(t.id)}
            >
              <div className="num mono">{i + 1}</div>
              <div className="q">{t.question}</div>
              <div className="meta mono">
                <span>{t.plan?.calls?.length || 0} calls</span>
                <span>·</span>
                <span>{t.digest.cited.length} cites</span>
                <span>·</span>
                <span>{t.themeIds.length} themes</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rail-section">
        <div className="rail-title">
          Theme atlas
          <span className="pill">overview</span>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '0 0 10px', lineHeight: 1.4 }}>
          62 themes across 8 neighborhoods. Active themes from this turn are ringed.
        </p>
        <ThemeAtlas
          mode="compact"
          activeThemeIds={activeThemeIds}
          selectedThemeId={selectedThemeId}
          onSelectTheme={onSelectTheme}
        />
      </div>

      <div className="rail-section">
        <div className="rail-title">
          Try
          <span className="pill">starts new conversation</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '0 0 8px', lineHeight: 1.4 }}>
          Picking a suggestion flushes the current thread and asks fresh.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {suggestedQs.map((q, i) => (
            <button
              key={i}
              onClick={() => onAskSuggested(q)}
              style={{
                textAlign: 'left',
                fontFamily: 'var(--serif)',
                fontSize: 12.5,
                lineHeight: 1.35,
                color: 'var(--ink-2)',
                padding: '6px 8px 7px',
                borderRadius: 3,
                cursor: 'pointer',
              }}
              className="suggestion"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .suggestion:hover {
          background: var(--paper-2);
          color: var(--ink) !important;
        }
      `}</style>
    </div>
  );
}

Object.assign(window, { ConversationRail });

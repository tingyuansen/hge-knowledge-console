/* shared hooks + helpers
   - useDataReady: waits for window.HGE to populate (data.js fires 'hge-ready')
   - useKeyboard: global keymap dispatcher
   - HoverCard: portal-rendered hovercard, follows mouse, dismisses on leave
   - clamp / lerp / log / hashColor — math helpers
   - renderInline: turns answer markdown into React nodes (bold, italic, citations, entities)
*/

const { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } = React;

function useDataReady() {
  const [ready, setReady] = useState(!!window.HGE);
  useEffect(() => {
    if (window.HGE) return;
    const h = () => setReady(true);
    window.addEventListener('hge-ready', h);
    return () => window.removeEventListener('hge-ready', h);
  }, []);
  return ready;
}

function useKeyboard(handlers) {
  useEffect(() => {
    const h = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const inField = tag === 'input' || tag === 'textarea';
      const key = e.key;
      if (inField && key !== 'Escape') return;
      if (handlers[key]) handlers[key](e);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handlers]);
}

// pin a hovercard via portal anchored to mouse / element
function HoverCard({ anchor, children, interactive }) {
  const [pos, setPos] = useState({ x: -1000, y: -1000 });
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const card = ref.current;
    if (!card) return;
    const cw = card.offsetWidth || 320;
    const ch = card.offsetHeight || 120;
    let x = r.left;
    let y = r.bottom + 6;
    if (x + cw > window.innerWidth - 8) x = window.innerWidth - cw - 8;
    if (y + ch > window.innerHeight - 8) y = r.top - ch - 6;
    if (x < 8) x = 8;
    setPos({ x, y });
  }, [anchor]);
  if (!anchor) return null;
  return ReactDOM.createPortal(
    <div ref={ref} className={`hovercard${interactive ? ' interactive' : ''}`} style={{ left: pos.x, top: pos.y }}>
      {children}
    </div>,
    document.body
  );
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* Inline markdown→nodes for the synthesiser's small dialect.
   Handles: **bold**, *italic*, arXiv:NNNN.NNNNN citations, and entity-link
   anchors for any bolded term that maps to a concept in window.HGE.conceptLookup.
   onCite(arxiv, target) — clicked / hovered citation.
   onEntity(name, target) — clicked / hovered entity.
*/
function renderInline(text, { onCite, onCiteHover, onEntity, onEntityHover, pinnedCites, conceptLookup }) {
  if (!text) return null;
  // Tokenize: bold, italic, arxiv
  const out = [];
  let i = 0;
  let key = 0;
  // Citation forms we recognise:
  //   modern:  arXiv:NNNN.NNNNN          (e.g. arXiv:1805.11415)
  //   legacy:  arXiv:astro-ph-NNNNNNN    (our internal slug for old archive prefixes)
  //   legacy:  arXiv:astro-ph/NNNNNNN    (the canonical legacy form)
  const re = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(arXiv:(?:[a-z\-]+[\-\/])?\d{4,8}(?:\.\d{4,5})?)|(\\\()|(\\\))/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > i) out.push(<React.Fragment key={key++}>{text.slice(i, m.index)}</React.Fragment>);
    const tok = m[0];
    if (tok.startsWith('**')) {
      const inner = tok.slice(2, -2);
      const isConcept = !!conceptLookup[inner.toLowerCase()];
      if (isConcept) {
        out.push(
          <strong
            key={key++}
            className="entity-link"
            onClick={(e) => onEntity && onEntity(inner, e.currentTarget)}
            onMouseEnter={(e) => onEntityHover && onEntityHover(inner, e.currentTarget)}
            onMouseLeave={() => onEntityHover && onEntityHover(null, null)}
            tabIndex={0}
            role="link"
          >{inner}</strong>
        );
      } else {
        out.push(<strong key={key++}>{inner}</strong>);
      }
    } else if (tok.startsWith('*')) {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith('arXiv:')) {
      const id = tok.slice(6);
      const pinned = pinnedCites && pinnedCites.has(id);
      out.push(
        <span
          key={key++}
          className="cite"
          aria-pressed={pinned}
          onClick={(e) => onCite && onCite(id, e.currentTarget)}
          onMouseEnter={(e) => onCiteHover && onCiteHover(id, e.currentTarget)}
          onMouseLeave={() => onCiteHover && onCiteHover(null, null)}
          role="button"
          tabIndex={0}
          title={`arXiv:${id} — click to pin to margin`}
        >{tok}</span>
      );
    } else if (tok === '\\(' || tok === '\\)') {
      // LaTeX-ish escaped parens; render as literal
      out.push(<React.Fragment key={key++}>{tok.slice(1)}</React.Fragment>);
    }
    i = m.index + tok.length;
  }
  if (i < text.length) out.push(<React.Fragment key={key++}>{text.slice(i)}</React.Fragment>);
  return out;
}

/* small deterministic seeded RNG so atlas/footprint layouts are stable */
function seedRand(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

Object.assign(window, { useDataReady, useKeyboard, HoverCard, clamp, lerp, renderInline, seedRand });

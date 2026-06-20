/* HGE — data layer (live).
   ------------------------
   Wires the static console to the live FastAPI at API_BASE. Multi-turn
   conversation history is threaded through every /ask call so the
   dispatcher can resolve pronouns. All evidence quotes, retrieval
   rankings, theme membership, etc. come from the real backend (which runs
   hybrid BM25+dense retrieval, T3 default-exclusion, and a Gemini-3.5-Flash
   dispatch + synth loop).

   Two-stage bootstrap: stage 0 mounts the React tree IMMEDIATELY with
   stub atlas + scatter so the page renders without waiting; stage 1
   hydrates atlas and scatter in the background and dispatches
   `hge-atlas-ready` / `hge-scatter-ready` events. Components listen for
   these to re-render. This makes the perceived load time near-zero.

   Exposes:
     window.HGE   — atlas, scatter, conceptLookup, footprintZones,
                    hgeBaseline, srdRequirements
     window.HGE_ASK(question, opts) → Promise<turn>
     window.HGE_PAPER(arxivId)      → Promise<paper>
     window.HGE.turns               — live array of completed turns

   Static config (not a hallucination risk; each value is well-known):
   - SRD baseline + requirement IDs (transcribed from sources/srd_v0.md;
     SMR-SPEC-1..5, SMR-TARG-1..2, SMR-SAMP-1..4)
   - Neighborhood grouping (UI-only heuristic for the atlas — title-keyword
     classification of GraphRAG communities into 8 readable groups; NOT
     from GraphRAG itself)
   - Galactic footprint zones (UI schematic rectangles in (l, b))

   Backend unavailable: bootstrap() shows a hand-styled error overlay
   pointing the user at ting.74@osu.edu. No demo-mode fallback by design —
   we never want users seeing fixture data and thinking it's live retrieval.
*/
(function () {
  const API_BASE =
    (typeof window !== 'undefined' && window.__HGE_API__) ||
    'http://127.0.0.1:8000';

  // ---------- Static SRD baseline (from sources/srd_v0.md) ----------
  // These are the survey requirements as written in the SRD. Not synthesised,
  // not estimated — direct transcription of SMR-SPEC-* / SMR-SAMP-* / SMR-TARG-*.
  const hgeBaseline = {
    mission: { name: 'Hidden Galaxy Explorer', successor: 'APOGEE / Galactic Genesis' },
    sample: {
      far_side_giants: 100000,    // SMR-SAMP-1
      bulge_bar_giants: 50000,    // SMR-SMAP-4
      bin_min: 1000,              // SMR-SAMP-3
      footprint_l_max: 60, footprint_b_max: 5,   // SMR-SAMP-2
      bulge_l_max: 10, bulge_b_max: 10,
      sky_deg2: 2000,
      fields_apo: 95, fields_lco: 483, fields_total: 578,
      log_g_max: 1.5,             // SMR-TARG-2
    },
    spec: {
      R_min: 20000,               // SMR-SPEC-5
      SNR: 75, SNR_min_pct: 80,   // SMR-SPEC-2
      wavelength_um: 1.6,
      rv_kms: 0.5,                // SMR-SPEC-3
      teff_K: 50, logg_dex: 0.10, feh_dex: 0.05,  // SMR-SPEC-4
      H_limit: 16, photometric_pct: 2,            // SMR-TARG-1
      target_eff_pct: 90,         // SMR-TARG-2
    },
    ops: {
      // Operating reference points used by the DesignLever's first-order
      // SNR(H, t) model. NOT requirements — flagged as such in the lever footer.
      seeing_arcsec: 1.4,
      margin_pct: 20,
      long_visit_hours: 20,
      H_ref: 14.5,
      t_ref_hr: 10,
      SNR_ref: 70,
    },
    // SMR-SPEC-1 verbatim
    element_targets: {
      Fe: 0.05, C: 0.05, N: 0.05, O: 0.05, Mg: 0.05, Si: 0.05, Ca: 0.05, Ni: 0.05,
      Ti: 0.07, Al: 0.07, Cr: 0.07, Mn: 0.07,
      Ce: 0.10, K: 0.10, V: 0.10, Co: 0.10,
      Na: 0.15,
    },
    dust_maps: [
      { id: 'marshall', name: 'Marshall+2006', coverage: 'inner Galaxy NIR', status: 'baseline' },
      { id: 'surot',    name: 'Surot / VVV',   coverage: 'inner Galaxy NIR', status: 'comparator' },
      { id: 'galaxia3d',name: 'Galaxia3D',     coverage: 'synthetic MW',     status: 'comparator' },
      { id: 'bayestar', name: 'Bayestar+DECaPS', coverage: 'opt+NIR',        status: 'under-investigation' },
    ],
    open_tensions: [
      { id: 'targeting',  label: 'Targeting efficiency = master variable', src: 'wiki/Targeting' },
      { id: 'extinction', label: 'Dust map choice changes H-mag dist',     src: 'synthpop doc' },
      { id: 'snr-tradeoff', label: 'SNR=70 uniform vs mixed-depth',         src: 'telecon May 6' },
      { id: 'distance',   label: '15% distance uncertainty biases gradient', src: 'Imig, telecon Apr 23' },
      { id: 'snr-floor',  label: 'BACCHUS/BAWLES floor SNR≥50',             src: 'Szabolcs, Mar 19' },
    ],
  };

  // ---------- Static SRD requirement table (from sources/srd_v0.md) ----------
  const srdRequirements = {
    'SMR-SPEC-1': '[X/Fe] precision ≤ 0.05 dex for Fe/C/N/O/Mg/Si/Ca/Ni; ≤ 0.07 for Ti/Al/Cr/Mn; ≤ 0.10 for Ce/K/V/Co; ≤ 0.15 for Na.',
    'SMR-SPEC-2': 'SNR ≥ 75 per native APOGEE pixel at 1.6 μm for ≥80% of the sample.',
    'SMR-SPEC-3': 'Radial velocity precision ≤ 0.5 km/s.',
    'SMR-SPEC-4': 'σ(T_eff) ≲ 50 K, σ(log g) ≲ 0.10 dex, σ([Fe/H]) ≲ 0.05 dex.',
    'SMR-SPEC-5': 'Spectral resolving power R ≥ 20,000 on average across fibers.',
    'SMR-TARG-1': 'PSF photometric accuracy ≤ 2% in H-band to depth H=16.',
    'SMR-TARG-2': 'Target selection of luminous giants (log g ≤ 1.5) at 90% efficiency.',
    'SMR-SAMP-1': '100,000 luminous giants on far side of MW disk (X_gc>0, 3.5<R_gc<15 kpc, |z_gc|<1 kpc).',
    'SMR-SAMP-2': 'Footprint |l|≤60° and |b|≤5°, plus |l|≤10° and |b|≤10°.',
    'SMR-SAMP-3': '≥1,000 stars per 2×2 kpc spatial bin (~85 bins).',
    'SMR-SMAP-4': 'Sample MW bar and bulge with 50,000 luminous giants.',
  };

  // ---------- Neighborhood grouping (UI-only heuristic for the atlas) ----------
  // Title-keyword classification of the 62 GraphRAG themes into 8 readable
  // groups. NOT from GraphRAG — a UI grouping so the atlas reads as a
  // thematic map instead of a force-directed blob.
  const NEIGHBORHOODS = [
    { id: 'tracers',     label: 'Stellar tracers',     desc: 'Red clump, giants, asteroseismology, halo tracers',     color: '#2f6f57' },
    { id: 'extinction',  label: 'Dust & extinction',   desc: 'Mapping, correction, reddening systematics',           color: '#a85a35' },
    { id: 'distance',    label: 'Distance & parallax', desc: 'Parallax zero-points, spectrophotometric distances',   color: '#5a6dc1' },
    { id: 'disk',        label: 'Disk science',        desc: 'Gradients, migration, ages, inside-out formation',     color: '#356ea0' },
    { id: 'bulge',       label: 'Bulge & bar',         desc: 'Boxy/peanut, long bar, inner-Galaxy structure',        color: '#7d4a8b' },
    { id: 'kinematics',  label: 'Kinematics',          desc: 'RV, proper motions, membership, 6-D phase space',      color: '#326f78' },
    { id: 'calibration', label: 'Calibration & systematics', desc: 'Abundance, atmospheric, NLTE, cross-survey',     color: '#8a6a2b' },
    { id: 'selection',   label: 'Selection & methods', desc: 'Selection functions, ML, completeness',                color: '#6b6b6b' },
  ];
  const NEIGHBORHOOD_BY_ID = Object.fromEntries(NEIGHBORHOODS.map(n => [n.id, n]));

  function classify(title, entities) {
    const s = (title + ' ' + (entities || []).join(' ')).toLowerCase();
    if (/bulge|bar|peanut|inner.galax|nuclear|cmz/.test(s))                    return 'bulge';
    if (/red.clump|giant|asteroseism|halo|tracer/.test(s))                     return 'tracers';
    if (/extinction|reddening|dust|opacity/.test(s))                           return 'extinction';
    if (/distance|parallax/.test(s))                                           return 'distance';
    if (/disk|migration|gradient|metallicity-age|inside-out|flare/.test(s))    return 'disk';
    if (/radial.velocity|proper.motion|kinematic|membership|phase.space|rv\b/.test(s)) return 'kinematics';
    if (/calibrat|nlte|surface.gravity|abundance|atmospher|spectroscop/.test(s)) return 'calibration';
    return 'selection';
  }

  // ---------- Galactic footprint zones (UI schematic) ----------
  const footprintZones = [
    { id: 'bulge',     label: 'Bulge / Bar',           cx: 0,    cy: 0,   rx: 16, ry: 12, color: 'var(--accent)',
      cases: ['boxy/peanut bulge','nuclear stellar disc','metal-weak thick disk'], extinction: 'high' },
    { id: 'inner-far', label: 'Inner disk (far side)', cx: -55,  cy: 0,   rx: 35, ry: 6,  color: '#8a6a2b',
      cases: ['radial migration','inside-out disk formation','radial abundance gradient'], extinction: 'very high' },
    { id: 'inner-near',label: 'Inner disk (near side)', cx: 50,  cy: 0,   rx: 30, ry: 6,  color: '#8a6a2b',
      cases: ['radial migration','radial abundance gradient'], extinction: 'high' },
    { id: 'outer-far', label: 'Outer disk (anti-centre)', cx: 165, cy: 1, rx: 30, ry: 5,  color: '#3e7c54',
      cases: ['disk flare','radial abundance gradient'], extinction: 'low' },
    { id: 'thick-disk',label: 'Thick disk',            cx: 80,   cy: 18,  rx: 70, ry: 8,  color: '#5a6dc1',
      cases: ['metal-weak thick disk','Galactic archaeology'], extinction: 'medium' },
  ];

  // ---------- Extract the synth's `**Science-case scorecard**` table so the
  // AnswerView can render it as a structured visual instead of a raw markdown
  // table. Returns { body (with scorecard removed), scorecard: [{case, effect,
  // prior_effect?, why}] }. If no scorecard found, scorecard is []. ----------
  function extractScorecard(md) {
    if (!md) return { body: md, scorecard: [] };
    const m = md.match(/\n\*\*Science-case scorecard\*\*\s*\n+(\|[\s\S]+?)(?=\n\*\*|\nSources:|$)/);
    if (!m) return { body: md, scorecard: [] };
    const tableText = m[1];
    const rows = [];
    for (const line of tableText.split('\n')) {
      // skip header + separator
      if (!line.trim().startsWith('|')) continue;
      const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length < 3) continue;
      if (/^[-:\s|]+$/.test(line)) continue;          // separator
      if (/^case$/i.test(cells[0])) continue;          // header
      let caseName = cells[0]
        .replace(/^\*\*|\*\*$/g, '')                  // strip surrounding bold
        .replace(/^\+\s*Beyond:\s*/i, '')             // strip "+ Beyond:" prefix
        .replace(/^\+\s*/, '')
        .trim();
      const isBeyond = /\+\s*Beyond/i.test(cells[0]) || cells[0].toLowerCase().includes('beyond:');
      const effectCell = cells[1];
      // Parse "↑" / "→" / "↓" / "↑ (was →)" forms (also accept upArrow/down words)
      const effectMatch = effectCell.match(/([↑→↓])(?:\s*\(was\s*([↑→↓])\s*\))?/);
      if (!effectMatch) continue;
      rows.push({
        case_name: caseName,
        effect: effectMatch[1],
        prior_effect: effectMatch[2] || null,
        why: (cells[2] || '').trim(),
        beyond: isBeyond,
      });
    }
    const body = (md.slice(0, m.index) + md.slice(m.index + m[0].length)).trim();
    return { body, scorecard: rows };
  }

  // ---------- Strip the synth's `**Follow-up questions**` block out of the
  // markdown so the AnswerView can render the bullets as clickable chips. ----------
  function extractFollowUps(md) {
    if (!md) return { body: md, followups: [] };
    const m = md.match(/\n\*\*Follow-up questions\*\*\s*\n([\s\S]+?)(?=\n\*\*|\nSources:|\n\Z|$)/);
    if (!m) return { body: md, followups: [] };
    const block = m[1];
    const followups = block.split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('·') || l.startsWith('-') || l.startsWith('*'))
      .map(l => l.replace(/^[·\-*]\s*/, '').trim())
      .filter(l => l.length > 4 && l.length < 220)
      .slice(0, 4);
    const body = (md.slice(0, m.index) + md.slice(m.index + m[0].length)).trim();
    return { body, followups };
  }

  // ---------- Markdown answer parser ----------
  function parseAnswer(md) {
    const blocks = [];
    const lines = (md || '').replace(/\r/g, '').split('\n');
    let buf = []; let mode = null;
    const flush = () => {
      if (!buf.length) return;
      if (mode === 'ul') buf.forEach(item => blocks.push({ type: 'li', text: item, idx: blocks.length }));
      else blocks.push({ type: 'p', text: buf.join('\n').trim(), idx: blocks.length });
      buf = []; mode = null;
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) { flush(); continue; }
      if (line.match(/^-\s+/)) {
        if (mode !== 'ul') { flush(); mode = 'ul'; }
        buf.push(line.replace(/^-\s+/, ''));
      } else {
        if (mode === 'ul') flush();
        if (mode !== 'p') mode = 'p';
        buf.push(line);
      }
    }
    flush();
    for (const b of blocks) {
      b.citations = Array.from(new Set([...(b.text.matchAll(/arXiv:([\w\.\-]+\d{4,5}|\d{4}\.\d{4,5})/g))].map(m => m[1])));
      const leadBold = b.text.match(/\*\*([^*]+)\*\*/);
      b.lead = leadBold ? leadBold[1] : null;
      b.isTrailer = /^Sources:/i.test(b.text) || /corpus does\s*\*\*not\*\*/i.test(b.text);
    }
    return blocks;
  }

  // ---------- Evidence card builder ----------
  // Surfaces real evidence_quote fields verbatim from the backend's primitives.
  function findCommunityForLead(turn, lead) {
    if (!lead) return null;
    const needle = lead.toLowerCase();
    for (const r of turn.results || []) {
      for (const row of (r.rows || [])) {
        const hay = [row.canonical, row.title, ...(row.key_entities || [])]
          .filter(Boolean).map(x => String(x).toLowerCase());
        if (hay.some(h => h === needle || h.includes(needle) || needle.includes(h))) {
          return { row, primitive: r.primitive };
        }
      }
    }
    return null;
  }

  function buildEvidenceForTurn(turn, atlasNodes) {
    const blocks = parseAnswer(turn.answer || '');
    for (const b of blocks) {
      b.evidence = [];
      if (b.isTrailer) continue;
      const match = findCommunityForLead(turn, b.lead);
      if (match) {
        const row = match.row;
        if (match.primitive === 'top_concepts' || match.primitive === 'concept_search') {
          b.evidence.push({
            kind: 'concept', title: row.canonical,
            meta: `${row.class || ''} · ${row.tier || ''} · ${row.n_papers || 0} papers`,
            text: row.definition || '', primitive: match.primitive,
          });
        } else if (match.primitive === 'community_overview') {
          const rels = (row.key_relationships || []);
          const lead = (b.lead || '').toLowerCase();
          const pickRel = rels.find(r => r.toLowerCase().includes(lead)) || rels[0];
          b.evidence.push({
            kind: 'community', title: row.title || `Theme ${row.community_id}`,
            meta: `theme · ${row.community_id}`, text: pickRel || row.scope || '',
            communityId: row.community_id, primitive: match.primitive,
          });
        } else if (match.primitive === 'spec_query' || match.primitive === 'relationship_query') {
          const ev = row.evidence_quote || (row.evidence_quotes && row.evidence_quotes[0]) || '';
          b.evidence.push({
            kind: 'concept', title: row.parameter || row.predicate || 'fact',
            meta: `${match.primitive} · ${row.confidence_band || ''}`, text: ev,
            primitive: match.primitive,
          });
        }
      }
      for (const arxiv of b.citations.slice(0, 2)) {
        let homeCommunity = null;
        for (const r of turn.results || []) {
          for (const row of (r.rows || [])) {
            const tps = (row.top_papers || []).map(p => p.arxiv_id || p);
            if (tps.includes(arxiv)) { homeCommunity = row; break; }
          }
          if (homeCommunity) break;
        }
        if (!homeCommunity && atlasNodes) {
          homeCommunity = atlasNodes.find(n => (n.top_papers || []).includes(arxiv));
        }
        b.evidence.push({
          kind: 'paper', arxivId: arxiv,
          meta: `arXiv · ${arxiv}`,
          text: homeCommunity ? (homeCommunity.scope || '') : '',
          communityId: homeCommunity ? (homeCommunity.community_id ?? homeCommunity.id) : null,
          communityTitle: homeCommunity ? homeCommunity.title : null,
          primitive: 'paper_evidence',
        });
      }
    }
    return blocks;
  }

  function buildPaperDigest(turn) {
    const all = new Map();
    for (const r of (turn.results || [])) {
      for (const row of (r.rows || [])) {
        for (const p of (row.top_papers || [])) {
          const id = p.arxiv_id || p;
          const prev = all.get(id) || { id, weight: 0, communities: [] };
          prev.weight = Math.max(prev.weight, p.weight || 1);
          if (row.title && !prev.communities.find(c => c.id === row.community_id)) {
            prev.communities.push({ id: row.community_id, title: row.title });
          }
          all.set(id, prev);
        }
      }
    }
    const citedIds = new Set();
    [...(turn.answer || '').matchAll(/arXiv:([\w\.\-]+\d{4,5}|\d{4}\.\d{4,5})/g)].forEach(m => citedIds.add(m[1]));
    const cited = [...citedIds].map(id => all.get(id) || { id, weight: 0, communities: [] });
    return { cited, all: [...all.values()].sort((a, b) => b.weight - a.weight) };
  }

  function detectSpecRelevant(turn) {
    const s = ((turn.question || '') + ' ' + (turn.answer || '')).toLowerCase();
    return /spectral\s+resolv|\br\s*[≥>=]|snr|signal.to.noise|resolving\s+power|\bdex\b|abundance\s+precision|km\s*\/?s|km·s|\bsrd\b|requirement|\bnoise\b/.test(s);
  }
  function detectFootprintRelevant(turn) {
    const s = ((turn.question || '') + ' ' + (turn.answer || '')).toLowerCase();
    return /bulge|disk|halo|inner.galax|outer|footprint|coverage|obscured|extinction|plane/.test(s);
  }
  // Parse a question for design-knob hints — used to set the lever's initial
  // values when an answer is design-relevant. Pure regex, no LLM round-trip.
  // Returns an object with any subset of {H, t, T_total} that the question
  // mentioned. Unrecognised questions return {} and the lever stays at the
  // HGE baseline.
  function parseQuestionForLever(q) {
    const out = {};
    if (!q) return out;
    const s = q.toLowerCase();
    // H magnitude: "H = 14.5", "H<14", "H ≤ 16", "h-mag of 14.5", "H=14.5"
    const mH = s.match(/\bh\s*[=≤<>≥]\s*(\d{1,2}(?:\.\d{1,2})?)/) || s.match(/h[-\s]?mag\w*\s*(?:of|=|≈)?\s*(\d{1,2}(?:\.\d{1,2})?)/);
    if (mH) { const v = parseFloat(mH[1]); if (v >= 10 && v <= 18) out.H = v; }
    // exposure time: "10 hr", "12 hours", "5-hour", "exposure of 8 hr"
    const mT = s.match(/\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:hr|hour|hours|h\s*\/\s*field|h\s*per\s*field)\b/);
    if (mT) { const v = parseFloat(mT[1]); if (v >= 0.5 && v <= 30) out.t = v; }
    // total budget: "5800 hr total", "12,000 hour budget"
    const mTT = s.match(/\b(\d{1,2}[,.]?\d{0,3})\s*(?:hr|hour|hours)\s*(?:total|budget)\b/);
    if (mTT) { const v = parseFloat(mTT[1].replace(/,/g, '')); if (v >= 500 && v <= 30000) out.T_total = v; }
    // SNR target: "SNR = 60", "SNR ≥ 75", "drop SNR to 50"
    const mSNR = s.match(/snr\s*[=≤≥<>]\s*(\d{2,3})/) || s.match(/snr\s*(?:to|of|at)\s*(\d{2,3})/);
    if (mSNR) { const v = parseInt(mSNR[1], 10); if (v >= 20 && v <= 300) out.SNR_target = v; }
    return out;
  }

  function detectLeverRelevant(turn) {
    const s = ((turn.question || '') + ' ' + (turn.answer || '')).toLowerCase();
    return /\bsnr\b|signal.to.noise|exposure|\bhours?\b|\bhr\b|\bh\s*=|h\s*mag|magnitude|\bdex\b|precision|smr-spec|srd|science[- ]case|yield|sample/.test(s);
  }

  // ---------- Concept lookup ----------
  function recordConcept(lookup, name, def, source) {
    if (!name) return;
    const k = String(name).toLowerCase().trim();
    if (!lookup[k]) lookup[k] = { name, def: def || '', sources: [] };
    if (def && !lookup[k].def) lookup[k].def = def;
    if (source) lookup[k].sources.push(source);
  }
  function refreshConceptLookup(turns, atlas) {
    const lookup = {};
    for (const t of turns) {
      for (const r of (t.results || [])) {
        for (const row of (r.rows || [])) {
          if (row.canonical) recordConcept(lookup, row.canonical, row.definition, { primitive: r.primitive });
          if (row.title) recordConcept(lookup, row.title.replace(/^\(unsummarised\)\s*/, ''), row.scope, { primitive: r.primitive, communityId: row.community_id });
          (row.key_entities || []).forEach(e => recordConcept(lookup, e, '', { primitive: r.primitive, communityId: row.community_id }));
        }
      }
    }
    atlas.nodes.forEach(n => recordConcept(lookup, n.title, n.scope, { communityId: n.id }));
    return lookup;
  }

  // ---------- Live API wrappers ----------
  async function jget(path) {
    const r = await fetch(API_BASE + path);
    if (!r.ok) throw new Error(`${path} → ${r.status}`);
    return r.json();
  }
  async function jpost(path, body) {
    const r = await fetch(API_BASE + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${path} → ${r.status}`);
    return r.json();
  }

  // ---------- Wrap a /ask response into a "turn" the design renders ----------
  function wrapTurn(askResponse, atlasNodes, turnIndex) {
    // Pull the synth's structured blocks (scorecard, follow-up bullets) out
    // of the markdown so they render as styled UI rather than raw text.
    const sc = extractScorecard(askResponse.answer || '');
    const fu = extractFollowUps(sc.body);
    const body = fu.body;
    const followups = fu.followups;
    const scorecard = sc.scorecard;
    askResponse = { ...askResponse, answer: body, followups, scorecard };
    const blocks = buildEvidenceForTurn(askResponse, atlasNodes);
    const digest = buildPaperDigest(askResponse);
    const themeIds = new Set();
    for (const r of (askResponse.results || [])) {
      for (const row of (r.rows || [])) {
        if (row.community_id != null) themeIds.add(row.community_id);
      }
    }
    return {
      id: `t${turnIndex + 1}`,
      index: turnIndex,
      question: askResponse.question,
      answer: askResponse.answer,
      plan: askResponse.plan,
      results: askResponse.results,
      blocks, digest,
      followups: followups || [],
      scorecard: scorecard || [],
      themeIds: [...themeIds],
      showSpec: detectSpecRelevant(askResponse),
      showFootprint: detectFootprintRelevant(askResponse),
      // Lever is always shown at the bottom of the answer; mark relevance
      // so it gets a glow + sliders auto-seed when the question parses to
      // knob hints.
      showLever: true,
      leverRelevant: detectLeverRelevant(askResponse),
      leverHints: parseQuestionForLever(askResponse.question || ''),
      activeZones: footprintZones.filter(z =>
        z.cases.some(c => (askResponse.answer || '').toLowerCase().includes(c.toLowerCase()))
      ).map(z => z.id),
    };
  }

  // ---------- Bootstrap ----------
  // Two-stage: render the page IMMEDIATELY with empty atlas/scatter, then
  // hydrate them in the background. The user can read the landing copy and
  // start typing a question while the atlas data is in flight.
  async function bootstrap() {
    // Stage 0: stub atlas + scatter so the React tree can render now.
    const turns = [];
    const atlas = {
      nodes: [], edges: [], neighborhoods: NEIGHBORHOODS,
      __loading: true,
    };
    const scatter = {
      x_param: 'spectral_resolution_R', y_param: 'snr',
      points: [], n_total: 0, n_clean: 0,
      srd: { R_min: 20000, SNR_min: 75, labels: ['SMR-SPEC-5 · R ≥ 20,000', 'SMR-SPEC-2 · SNR ≥ 75 / pix'] },
      __loading: true,
    };
    const conceptLookup = {};
    window.HGE = {
      turns, atlas, scatter, conceptLookup,
      footprintZones, hgeBaseline, srdRequirements,
    };

    // Stage 1: signal ready so React mounts. Atlas thumbnail will show a
    // loading state via atlas.__loading.
    window.HGE_READY = true;
    window.dispatchEvent(new CustomEvent('hge-ready'));

    // Stage 2: hydrate atlas + scatter in background. Each finishes
    // independently and dispatches its own event so the UI updates piecewise.
    (async () => {
      try {
        const gC = await jget('/graph/communities?min_size=20&max_communities=80');
        const atlasNodes = gC.nodes.map(n => {
          const hood = classify(n.title || '', n.key_entities || []);
          return { ...n, hood, color: NEIGHBORHOOD_BY_ID[hood].color };
        });
        const maxEdgeW = Math.max(1, ...gC.edges.map(e => e.weight));
        window.HGE.atlas = {
          nodes: atlasNodes,
          edges: gC.edges.map(e => ({ ...e, w: e.weight / maxEdgeW })),
          neighborhoods: NEIGHBORHOODS,
        };
        Object.assign(window.HGE.conceptLookup, refreshConceptLookup(window.HGE.turns, window.HGE.atlas));
        window.dispatchEvent(new CustomEvent('hge-atlas-ready'));
      } catch (e) { console.warn('atlas hydrate failed', e); }
    })();
    (async () => {
      try {
        const sc = await jget('/spec_scatter?x=spectral_resolution_R&y=snr&max_points=600');
        const cleanScatter = (sc.points || []).filter(p =>
          Number.isFinite(p.x) && Number.isFinite(p.y) &&
          p.x >= 100 && p.x <= 250000 && p.y >= 1 && p.y <= 2000 &&
          p.x_unit === 'R' && (p.y_unit === 'snr' || p.y_unit === '')
        );
        window.HGE.scatter = {
          x_param: sc.x_param, y_param: sc.y_param,
          points: cleanScatter, n_total: sc.n_points || 0, n_clean: cleanScatter.length,
          srd: window.HGE.scatter.srd,
        };
        window.dispatchEvent(new CustomEvent('hge-scatter-ready'));
      } catch (e) { console.warn('scatter hydrate failed', e); }
    })();

    window.HGE_ASK = async function (question, opts) {
      opts = opts || {};
      const history = (opts.history === undefined)
        ? window.HGE.turns.map(t => ({ question: t.question, answer: t.answer, plan: t.plan }))
        : opts.history;
      // Run /ask and a parallel /community_overview so the atlas always has
      // themes to highlight even when the dispatcher's plan never calls
      // community_overview itself.
      const [resp, atlasCommunities] = await Promise.all([
        jpost('/ask', history.length ? { question, history } : { question }),
        jpost('/community_overview', { query: question, k: 6 }).catch(() => []),
      ]);
      const turn = wrapTurn(resp, atlas.nodes, window.HGE.turns.length);
      // Merge atlas-overview community ids into themeIds so the rail thumbnail
      // and the full atlas always ring relevant themes.
      const extra = new Set(turn.themeIds);
      for (const c of (atlasCommunities || [])) {
        if (c && c.community_id != null) extra.add(c.community_id);
      }
      turn.themeIds = [...extra];
      window.HGE.turns = [...window.HGE.turns, turn];
      Object.assign(window.HGE.conceptLookup, refreshConceptLookup([turn], atlas));
      window.dispatchEvent(new CustomEvent('hge-turn-added', { detail: turn }));
      return turn;
    };

    window.HGE_PAPER = async function (arxivId) {
      try { return await jget(`/paper/${encodeURIComponent(arxivId)}`); }
      catch { return null; }
    };

    window.HGE_ELEMENT_PROVENANCE = async function (element, maxRows = 20) {
      try { return await jpost('/element_provenance', { element, max_rows: maxRows }); }
      catch (e) { return { element, n_rows: 0, rows: [], error: e.message }; }
    };

    window.HGE_BIBTEX = async function (arxivId) {
      const r = await fetch(API_BASE + `/bibtex/${encodeURIComponent(arxivId)}`);
      if (!r.ok) throw new Error(`/bibtex/${arxivId} → ${r.status}`);
      return r.text();
    };

    window.HGE_PAPER_OCR = async function (arxivId) {
      const r = await fetch(API_BASE + `/paper/${encodeURIComponent(arxivId)}/ocr`);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`/paper/${arxivId}/ocr → ${r.status}`);
      return r.json();
    };
  }

  bootstrap().catch(e => {
    console.error('HGE bootstrap failed', e);
    document.getElementById('app').innerHTML = `
      <div style="
        max-width: 560px; margin: 80px auto; padding: 32px;
        font-family: 'Newsreader', Georgia, serif; color: #1a1a17;
        background: #f6f2e9; border: 1px solid #cdc2a5; border-radius: 6px;
        line-height: 1.55;
      ">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#1f3d6b;margin-bottom:10px">
          HGE Knowledge Console · backend unavailable
        </div>
        <div style="font-size:18px;font-weight:600;letter-spacing:-0.012em;margin-bottom:10px">
          The retrieval backend is not currently reachable.
        </div>
        <p style="font-size:14.5px;color:#4a4640;margin:0 0 14px">
          The console talks to a knowledge-base service that needs to be running for any
          question to be answered. The service appears to be offline or restarting.
        </p>
        <p style="font-size:14.5px;color:#4a4640;margin:0 0 14px">
          If this persists, please contact
          <a href="mailto:ting.74@osu.edu" style="color:#1f3d6b;text-decoration:underline;text-underline-offset:2px">ting.74@osu.edu</a>
          and we'll bring the backend back up.
        </p>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#756e62;margin-top:18px;padding-top:14px;border-top:1px solid #ddd2b3">
          backend: <code>${API_BASE}</code><br>
          error: ${e.message}
        </div>
      </div>`;
  });
})();

/* HGE Tweaks — exposed in the host toolbar AND via the gear button in the header.
   Controls:
   - theme (light/dark)
   - accent color (4 options)
   - density (compact/regular/roomy)
   - paper grid (on/off)
   - margin evidence position (right/inline)
*/

const HGE_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "ink-blue",
  "density": "regular",
  "grid": "on",
  "marginEvidence": "right",
  "showFootprint": true,
  "showElements": true,
  "showSpec": true
}/*EDITMODE-END*/;

function HGETweaks() {
  // Use useTweaks hook from tweaks-panel.jsx (already loaded)
  const [t, setTweak] = useTweaks(HGE_TWEAK_DEFAULTS);

  // Apply to <html> dataset so CSS variables update.
  useEffect(() => {
    document.documentElement.dataset.theme   = t.theme;
    document.documentElement.dataset.accent  = t.accent;
    document.documentElement.dataset.density = t.density;
    document.documentElement.dataset.grid    = t.grid;
    document.documentElement.dataset.marginEvidence = t.marginEvidence;
    window.__hge_tweaks = t;
    window.dispatchEvent(new CustomEvent('hge-tweaks', { detail: t }));
  }, [t]);

  // expose theme toggle for header
  useEffect(() => {
    window.__hge_set_theme = (newTheme) => setTweak('theme', newTheme);
  }, [setTweak]);

  return (
    <TweaksPanel>
      <TweakSection label="Theme" />
      <TweakRadio
        label="Mode" value={t.theme}
        options={['light', 'dark']}
        onChange={(v) => setTweak('theme', v)}
      />
      <TweakColor
        label="Accent" value={t.accent}
        options={[
          { value: 'ink-blue', color: '#1f3d6b' },
          { value: 'copper',   color: '#8a4423' },
          { value: 'forest',   color: '#2c5d3f' },
          { value: 'plum',     color: '#5a2a5a' },
        ].map(o => o.color)}
        onChange={(c) => {
          const map = { '#1f3d6b': 'ink-blue', '#8a4423': 'copper', '#2c5d3f': 'forest', '#5a2a5a': 'plum' };
          setTweak('accent', map[c] || 'ink-blue');
        }}
      />

      <TweakSection label="Density" />
      <TweakRadio
        label="Spacing" value={t.density}
        options={['compact', 'regular', 'roomy']}
        onChange={(v) => setTweak('density', v)}
      />

      <TweakSection label="Layout" />
      <TweakRadio
        label="Evidence position" value={t.marginEvidence}
        options={['right', 'inline']}
        onChange={(v) => setTweak('marginEvidence', v)}
      />
      <TweakToggle
        label="Paper grid"
        value={t.grid === 'on'}
        onChange={(v) => setTweak('grid', v ? 'on' : 'off')}
      />

      <TweakSection label="Auto-inject" />
      <TweakToggle label="Spec scatter"     value={t.showSpec}      onChange={(v) => setTweak('showSpec', v)} />
      <TweakToggle label="Galactic footprint" value={t.showFootprint} onChange={(v) => setTweak('showFootprint', v)} />
      <TweakToggle label="Element precision"  value={t.showElements}  onChange={(v) => setTweak('showElements', v)} />
    </TweaksPanel>
  );
}

Object.assign(window, { HGETweaks, HGE_TWEAK_DEFAULTS });

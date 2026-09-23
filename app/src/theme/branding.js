/* ═══════════════════════════════════════════════════════════════════════════
   THEME CONTROLLER  (W1)
   ─────────────────────────────────────────────────────────────────────────
   One place decides what the app looks like. Four modes:

     auto      follow Telegram's theme if we're inside Telegram, otherwise
               follow the OS via prefers-color-scheme
     light     force light
     dark      force dark
     sunlight  maximum-contrast, for direct outdoor sun

   The subtle part is precedence. Telegram writes its theme as INLINE custom
   properties on <html>, which beats any :root[data-theme] rule because it is
   the same element with higher specificity. That is correct for `auto` — the
   Mini App should look like the user's Telegram — but it would silently
   defeat an explicit choice, and worse, it would defeat sunlight mode, which
   is an accessibility override that must always win. So choosing anything
   other than `auto` strips the inline Telegram properties rather than trying
   to out-specify them.

   Phase 1 note: only the Theme controller lives here. `applyStoreBranding`
   (remote catalog branding — colors, logo, business name, currency, language)
   stays in main.js for now because it reads/writes `config` and calls
   changeLanguage()/saveJSON() — it's state-coupled, not a leaf, so it moves
   once state.js exists (see modularization plan §5, Phase 2 onward).

   Phase 9 note (see modularization plan §5): ingestTelegramParams() is
   still exported from here — the Theme controller still owns applying it —
   but it's no longer called from main.js directly. platform/telegram.js's
   ingestTheme() calls it now, from behind the platform-adapter interface,
   so this file no longer needs to know when or whether Telegram pushed a
   theme update. What's still a direct `window.Telegram.WebApp` read here on
   purpose: the `colorScheme` check inside apply() (for 'auto' mode) and
   setBackgroundColor() inside syncBrowserChrome(). Both are synchronous,
   repeatedly-re-evaluated queries the Theme controller makes of whatever
   runtime is present, not a one-time push — the Phase 9 interface doesn't
   define a query method for them, and adding one was out of scope for this
   extraction (see platform/telegram.js's scoping note).
   ═══════════════════════════════════════════════════════════════════════════ */
export const Theme = (() => {
  const ROOT = document.documentElement;
  const KEY = 'sl_theme';
  const DENSITY_KEY = 'sl_density';
  const MODES = ['auto', 'light', 'dark', 'sunlight'];

  // The exact set of custom properties Telegram is allowed to write.
  const TG_PROPS = ['--paper', '--ink', '--ink-soft', '--paper-dim', '--teal', '--teal-solid', '--primary-color'];
  let tgParams = null;

  function readStored(key, allowed, fallback) {
    try {
      const v = localStorage.getItem(key);
      return allowed.includes(v) ? v : fallback;
    } catch (e) { return fallback; }
  }

  function clearTelegramOverrides() {
    TG_PROPS.forEach(p => ROOT.style.removeProperty(p));
  }

  function applyTelegramOverrides() {
    if (!tgParams) return;
    const tp = tgParams;
    const set = (prop, val) => { if (val) ROOT.style.setProperty(prop, val); };
    set('--paper', tp.bg_color);
    set('--ink', tp.text_color);
    set('--ink-soft', tp.hint_color);
    set('--paper-dim', tp.secondary_bg_color);
    // button_color is a FILL, so it has to land on both members of the accent
    // triple, otherwise buttons take the merchant's color but their labels
    // keep computing contrast against the old one.
    set('--teal', tp.button_color);
    set('--teal-solid', tp.button_color);
    set('--primary-color', tp.button_color);
  }

  /* Keep the Telegram header/OS status bar in step with the actual page
     background, resolved AFTER theming so it is never a stale hardcode. */
  function syncBrowserChrome() {
    const bg = getComputedStyle(ROOT).getPropertyValue('--paper').trim() || '#F2F1EC';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', bg);
    try {
      const twa = window.Telegram && window.Telegram.WebApp;
      if (twa && twa.setBackgroundColor) twa.setBackgroundColor(bg);
    } catch (e) {}
  }

  function apply() {
    const mode = readStored(KEY, MODES, 'auto');
    const density = readStored(DENSITY_KEY, ['normal', 'large'], 'normal');

    if (mode === 'auto') {
      // Inside Telegram, its colorScheme is a far better signal than the OS
      // media query, which Telegram's webview does not always forward.
      let resolved = 'auto';
      try {
        const twa = window.Telegram && window.Telegram.WebApp;
        if (twa && twa.colorScheme) resolved = twa.colorScheme === 'dark' ? 'dark' : 'light';
      } catch (e) {}
      ROOT.setAttribute('data-theme', resolved);
      applyTelegramOverrides();
    } else {
      clearTelegramOverrides();
      ROOT.setAttribute('data-theme', mode);
    }

    ROOT.setAttribute('data-density', density);
    syncBrowserChrome();
  }

  function set(mode) {
    if (!MODES.includes(mode)) return;
    try { localStorage.setItem(KEY, mode); } catch (e) {}
    apply();
  }

  function setDensity(d) {
    try { localStorage.setItem(DENSITY_KEY, d === 'large' ? 'large' : 'normal'); } catch (e) {}
    apply();
  }

  function current() { return readStored(KEY, MODES, 'auto'); }
  function currentDensity() { return readStored(DENSITY_KEY, ['normal', 'large'], 'normal'); }

  function cycle() {
    const order = ['auto', 'light', 'dark', 'sunlight'];
    set(order[(order.indexOf(current()) + 1) % order.length]);
    return current();
  }

  function ingestTelegramParams(tp) { tgParams = tp; apply(); }

  // Re-resolve when the OS flips, but only while we're in auto.
  try {
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => { if (current() === 'auto') apply(); });
  } catch (e) {}

  return { apply, set, setDensity, current, currentDensity, cycle, ingestTelegramParams };
})();

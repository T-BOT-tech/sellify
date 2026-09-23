// storage/json.js
// Phase 2 extraction (see modularization plan §5): loadJSON/saveJSON, moved
// out of main.js unchanged.
//
// NOTE on the `../main.js` import below: saveJSON's error path shows a toast
// (`showToast(t('storageFull'))`), and showToast/t still live in main.js at
// this phase (they move out in Phase 7 per the plan's migration order —
// ui/toast.js and i18n/index.js). Importing them back from main.js creates a
// harmless circular import: main.js imports storage/json.js at module-eval
// time, but storage/json.js only *calls* showToast/t from inside saveJSON's
// function body, long after both modules have finished evaluating. This is
// the same temporary pattern window-bridge.js uses. It goes away once
// showToast/t have their own modules and this file can import from there
// directly instead.
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { t } from '../ui/i18n.js';
import { showToast } from '../ui/toast.js';
import { idbSet, isIdbUnavailable, setIdbUnavailable } from './idb.js';

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('Storage read failed for', key, e);
    return fallback;
  }
}

// Internals run on IndexedDB, with a localStorage fallback if IndexedDB is
// unavailable this session. Signature and every call site are unchanged —
// this still fires and forgets, it just doesn't write to localStorage as its
// primary path.
//
// Known residual gap (flagged in review, not fixed here): a write is async, so
// a tab closed in the instant after a mutation can lose that last write before
// the IndexedDB transaction commits. A beforeunload/visibilitychange listener
// narrows this window but can't close it (the page can be torn down before an
// async promise settles) — that's a separate, deliberate follow-up, not part
// of this phase.
export function saveJSON(key, value) {
  if (isIdbUnavailable()) {
    // IndexedDB isn't usable this session (unsupported, blocked, or corrupted
    // — see idbOpen()'s failure paths). Fall back to the old localStorage path
    // so a write is never silently dropped.
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage write failed for', key, e);
      showToast(t('storageFull'));
    }
    return;
  }

  idbSet(key, value).catch(e => {
    console.error('IndexedDB write failed for', key, e);
    // Treat this as IndexedDB going unusable for the rest of the session, and
    // fall back to localStorage so this write (and future ones) aren't lost.
    setIdbUnavailable(true);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e2) {
      console.error('Storage write failed for', key, e2);
    }
    showToast(t('storageFull'));
  });
}

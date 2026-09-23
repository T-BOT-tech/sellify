// storage/migration.js
// Phase 2 extraction (see modularization plan §5): one-time localStorage ->
// IndexedDB migration, moved out of main.js unchanged.
//
// Copies every STORAGE_KEYS value that currently lives in localStorage into the
// IndexedDB store from storage/idb.js. Idempotent: safe to call on every boot, and
// safe to resume if the tab closes mid-migration, because it always re-derives from
// localStorage (which is left untouched here) rather than from partial IDB state.
//
// Deliberately NOT wired into loadJSON/saveJSON here, and NOT deleting the
// localStorage originals — loadJSON/saveJSON's IndexedDB wiring lives in
// storage/json.js.

import { STORAGE_KEYS, LEDGER_MIGRATION_FLAG_KEY } from '../constants.js';
import { idbSet, isIdbUnavailable, setIdbUnavailable } from './idb.js';
import { toMinorUnits } from '../utils/money.js';

export function ledgerIsMigrated() {
  try {
    return localStorage.getItem(LEDGER_MIGRATION_FLAG_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export function ledgerMarkMigrated() {
  try {
    localStorage.setItem(LEDGER_MIGRATION_FLAG_KEY, 'true');
  } catch (e) {
    console.error('Could not set migration flag', e);
  }
}

// Migrates a single key. Reads the raw JSON string from localStorage (mirroring
// loadJSON's own parsing so the copied value has the exact same shape), and
// writes the parsed value into IndexedDB under the same key. If the key doesn't
// exist in localStorage yet (fresh install, or a key added in a later app
// version), it's simply skipped — idbGet will fall through to caller-supplied
// defaults later, same as loadJSON does today.
export function migrateOneKey(key) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch (e) {
    console.error('Migration: localStorage read failed for', key, e);
    return Promise.resolve({ key, status: 'read-error', error: e });
  }

  if (raw === null) {
    return Promise.resolve({ key, status: 'skipped-empty' });
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('Migration: JSON parse failed for', key, e);
    return Promise.resolve({ key, status: 'parse-error', error: e });
  }

  return idbSet(key, parsed)
    .then(() => ({ key, status: 'migrated' }))
    .catch(e => {
      console.error('Migration: IndexedDB write failed for', key, e);
      return { key, status: 'write-error', error: e };
    });
}

// Runs the full migration once. Returns a Promise resolving to a summary array
// (one entry per key) so the caller can decide what to do if something failed
// partway through (e.g. keep the migration flag unset and retry next boot).
export function runLedgerMigration() {
  if (ledgerIsMigrated()) {
    return Promise.resolve({ alreadyMigrated: true, results: [] });
  }

  if (isIdbUnavailable()) {
    // IndexedDB isn't usable in this browser/session at all — nothing to
    // migrate to. Leave the flag unset so the app keeps using localStorage
    // (handled by the loadJSON/saveJSON fallback in storage/json.js) and can
    // retry migration if IDB becomes available in a future session.
    return Promise.resolve({ alreadyMigrated: false, skippedNoIdb: true, results: [] });
  }

  const keys = Object.values(STORAGE_KEYS);

  return Promise.all(keys.map(migrateOneKey)).then(results => {
    const anyWriteFailed = results.some(r => r.status === 'write-error');
    if (!anyWriteFailed) {
      ledgerMarkMigrated();
    } else {
      console.error('Migration incomplete, will retry on next boot:', results.filter(r => r.status === 'write-error'));
    }
    return { alreadyMigrated: false, results };
  }).catch(e => {
    // idbOpen() itself rejected (blocked, unsupported, corrupted). Don't mark
    // migrated — next boot will try again.
    console.error('Migration aborted, IndexedDB unavailable this session:', e);
    setIdbUnavailable(true);
    return { alreadyMigrated: false, aborted: true, error: e, results: [] };
  });
}

// ---------- Phase 4: money migration (float major units -> integer minor units) ----------
//
// Converts legacy `price`/`total`/`cash_tendered`/`change_due` fields that
// were stored as raw major-unit floats (₹19.99) into integer minor units
// (1999) — see utils/money.js for why. Called from two places (state.js,
// right after the synchronous localStorage-backed load, and
// storage/hydrate.js, after IndexedDB hydration potentially replaces those
// values) rather than gated behind one global "already migrated" flag:
// IndexedDB and localStorage can each hold a different snapshot of this
// data depending on which one last wrote, and a single flag set after the
// first call could cause the second call to skip converting whichever
// snapshot didn't happen to be loaded yet. Marking migration per-record
// (`_priceMinor` / `_moneyMinor`) instead makes every call idempotent
// regardless of how many times or in what order it runs — a record that's
// already minor-unit is left untouched, and a genuinely-unmigrated one
// gets converted exactly once, however many times this is called on it.
//
// New records created after this phase (addProduct, saveOrder, etc.) set
// their own `_priceMinor`/`_moneyMinor: true` at creation time, since
// their price/total was already computed in minor units — this function
// only ever needs to touch records old enough to predate that.
export function migrateProductMoney(products) {
  let changed = false;
  for (const p of (Array.isArray(products) ? products : [])) {
    if (!p || p._priceMinor) continue;
    p.price = toMinorUnits(p.price);
    p._priceMinor = true;
    changed = true;
  }
  return changed;
}

export function migrateOrderMoney(orders) {
  let changed = false;
  for (const o of (Array.isArray(orders) ? orders : [])) {
    if (!o || o._moneyMinor) continue;
    if (Array.isArray(o.items)) {
      o.items.forEach(i => { if (i) i.price = toMinorUnits(i.price); });
    }
    o.total = toMinorUnits(o.total);
    if (o.cash_tendered !== null && o.cash_tendered !== undefined) o.cash_tendered = toMinorUnits(o.cash_tendered);
    if (o.change_due !== null && o.change_due !== undefined) o.change_due = toMinorUnits(o.change_due);
    o._moneyMinor = true;
    changed = true;
  }
  return changed;
}

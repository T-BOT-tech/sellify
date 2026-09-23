// b2b/accounts.js
// Phase 6 extraction (see modularization plan §5): wholesale/B2B account
// state and its core lookups/persistence, moved out of main.js unchanged.
// b2bAccounts itself already lives in state.js (Phase 2 — storage/hydrate.js
// needs to reach into it), so this file just owns the pieces that were still
// plain `let`s in main.js: which account is currently selected on the Order
// tab, and the wholesale-enabled check + account lookup/save helpers that
// the UI layer (b2b/ui.js) and orders/checkout.js build on.
import { STORAGE_KEYS } from '../constants.js';
import { config, b2bAccounts } from '../state.js';
import { saveJSON } from '../storage/json.js';

// Phase 4 export (see modularization plan §5): orders/checkout.js's
// saveOrder() reads this directly and resets it via the setter once an
// order is saved — that bridge now points here instead of main.js.
export let selectedB2BAccountId = null;
export function setSelectedB2BAccountId(next) { selectedB2BAccountId = next; }

export function isWholesaleEnabled() {
  return !!config.wholesaleEnabled;
}
export function getB2BAccountById(id) {
  return b2bAccounts.find(a => a.id === id);
}
export function saveB2BAccounts() {
  saveJSON(STORAGE_KEYS.b2bAccounts, b2bAccounts);
}

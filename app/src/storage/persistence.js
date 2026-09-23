// storage/persistence.js
// Phase 2 extraction (see modularization plan §5): storage hardening
// (persistent-storage request, quota display, manual data export), moved
// out of main.js unchanged.
//
// See storage/json.js for why `t`/`showToast` are imported back from
// main.js at this phase — same harmless circular-import pattern, resolved
// once i18n/index.js and ui/toast.js exist (Phase 7 of the plan).
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { t } from '../ui/i18n.js';
import { showToast } from '../ui/toast.js';
import { STORAGE_KEYS } from '../constants.js';
import { idbGetAll, isIdbUnavailable } from './idb.js';
import {
  config, products, orders, staffList, currentStaff, orderViewMode,
  b2bAccounts, pricingTiers, volumeDiscountTiers, stockTransactions, warehouseLocations, inventoryMovements, organizationLocations, inventoryBalances
} from '../state.js';

// Tracks whether the browser granted "persistent" storage (i.e. opted this
// origin out of the automatic eviction that can otherwise clear IndexedDB
// under storage pressure). Null = not yet checked / unsupported browser.
let ledgerStoragePersisted = null;

// Requests persistent storage once at boot. This is a best-effort browser
// permission (Chrome grants it heuristically based on site engagement;
// Firefox may prompt; Safari has no such API) — we don't block or retry on
// denial, just record the outcome so Settings can surface it to the vendor.
export async function requestLedgerStoragePersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      ledgerStoragePersisted = await navigator.storage.persist();
    } else {
      ledgerStoragePersisted = null; // unsupported in this browser
    }
  } catch (e) {
    console.error('navigator.storage.persist() failed', e);
    ledgerStoragePersisted = null;
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let val = bytes;
  let i = -1;
  do {
    val /= 1024;
    i++;
  } while (val >= 1024 && i < units.length - 1);
  return val.toFixed(val >= 10 ? 0 : 1) + ' ' + units[i];
}

// Exports are portable backups, not credential or payment-evidence archives.
// Keep customer/order/product fields intact, but remove local station PINs,
// the tenant sync credential, and the captured payment-proof object (which can
// contain an image data URL or an OPFS filename).
//
// Matching is word/compound-based rather than an exact-string allowlist, so
// a future field doesn't silently ship in exports just because nobody
// remembered to add its exact name here. A key is split on camelCase and
// snake_case boundaries ("pinHash" -> ["pin","hash"], "payment_proof" ->
// ["payment","proof"]); it's redacted if any individual word is a known
// sensitive term (pin, secret, token, password) or if the joined words
// match a known sensitive compound (apikey, paymentproof) — compounds are
// used for words that are only sensitive together (a "proof" or "key"
// field alone isn't necessarily credential material, but "paymentProof"
// and "apiKey" are). This intentionally leans toward over-redacting
// anything containing "pin" as a whole word, since this app has no
// legitimate non-secret field shaped that way today.
const SENSITIVE_KEY_WORDS = new Set(['pin', 'secret', 'token', 'password', 'passwd']);
const SENSITIVE_KEY_COMPOUNDS = new Set(['apikey', 'paymentproof']);

function isSensitiveKey(key) {
  const words = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.some(w => SENSITIVE_KEY_WORDS.has(w))) return true;
  return SENSITIVE_KEY_COMPOUNDS.has(words.join(''));
}

function redactExportValue(value) {
  if (Array.isArray(value)) return value.map(redactExportValue);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveKey(key)) continue;
    output[key] = redactExportValue(child);
  }
  return output;
}

// Populates the "Data & storage" section of the Settings modal. Called each
// time Settings is opened (not at boot) — quota/persist status is cheap to
// query but only relevant when the vendor is actually looking at it.
export async function updateStorageInfoDisplay() {
  const persistEl = document.getElementById('storagePersistInfo');
  const quotaEl = document.getElementById('storageQuotaInfo');
  if (!persistEl || !quotaEl) return;

  if (ledgerStoragePersisted === true) {
    persistEl.textContent = t('storagePersistedYes');
  } else if (ledgerStoragePersisted === false) {
    persistEl.textContent = t('storagePersistedNo');
  } else {
    persistEl.textContent = t('storagePersistedUnknown');
  }

  quotaEl.textContent = '…';
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      quotaEl.textContent = t('storageUsageLabel') + ': ' + formatBytes(usage) + ' / ' + formatBytes(quota);
    } else {
      quotaEl.textContent = t('storageUsageUnknown');
    }
  } catch (e) {
    console.error('navigator.storage.estimate() failed', e);
    quotaEl.textContent = t('storageUsageUnknown');
  }
}

// "Export my data" — pulls every STORAGE_KEYS value (preferring IndexedDB,
// falling back to whatever's already in the in-memory state.js variables if
// IndexedDB is unavailable, so the export never silently omits data the
// vendor can see on screen) and triggers a JSON file download.
export async function exportLedgerData() {
  const inMemoryByKey = {
    [STORAGE_KEYS.config]: config,
    [STORAGE_KEYS.products]: products,
    [STORAGE_KEYS.orders]: orders,
    [STORAGE_KEYS.staff]: staffList,
    [STORAGE_KEYS.activeStaff]: currentStaff,
    [STORAGE_KEYS.orderViewMode]: orderViewMode,
    [STORAGE_KEYS.b2bAccounts]: b2bAccounts,
    [STORAGE_KEYS.pricingTiers]: pricingTiers,
    [STORAGE_KEYS.volumeDiscounts]: volumeDiscountTiers,
    [STORAGE_KEYS.stockTransactions]: stockTransactions,
    [STORAGE_KEYS.warehouseLocations]: warehouseLocations,
    [STORAGE_KEYS.organizationLocations]: organizationLocations,
    [STORAGE_KEYS.inventoryBalances]: inventoryBalances,
    [STORAGE_KEYS.inventoryMovements]: inventoryMovements,
    [STORAGE_KEYS.outboxEvents]: outboxEvents
  };

  let payload = {};
  try {
    if (!isIdbUnavailable()) {
      const fromIdb = await idbGetAll(Object.values(STORAGE_KEYS));
      for (const key of Object.values(STORAGE_KEYS)) {
        payload[key] = (fromIdb[key] !== null && fromIdb[key] !== undefined)
          ? fromIdb[key]
          : inMemoryByKey[key];
      }
    } else {
      payload = inMemoryByKey;
    }

    const backup = {
      exportedAt: new Date().toISOString(),
      app: 'sellify-ledger',
      version: 2,
      redactions: ['staff PINs', 'sync API key', 'payment-proof metadata and image references'],
      data: redactExportValue(payload)
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showToast(t('exportDataSuccess'));
  } catch (e) {
    console.error('Export failed', e);
    showToast(t('exportDataFailed'));
  }
}

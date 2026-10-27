// storage/hydrate.js
// Phase 2 extraction (see modularization plan §5): boot-time IndexedDB
// hydration, moved out of main.js unchanged.
//
// The state.js module-level variables (config, products, orders, staffList,
// etc.) are already populated synchronously from localStorage/IndexedDB
// fallback when state.js is evaluated, so the app has an instant first paint
// with no wait. This step runs after that first paint and, if IndexedDB
// turns out to hold newer data, reassigns those same state.js variables via
// their setters — every function that imports the live binding (render
// functions, event handlers) sees the new value automatically, with no
// call-site changes (this is Rule 1 from the modularization plan, §1).
import { STORAGE_KEYS, DEFAULT_PAYMENT_METHODS, defaultSyncServerUrl } from '../constants.js';
import { idbGetAll, idbUpdateAndSet, isIdbUnavailable } from './idb.js';
import { runLedgerMigration, migrateProductMoney, migrateOrderMoney } from './migration.js';
import { saveJSON } from './json.js';
import {
  getOutboxIndexedDbBaseline,
  mergeOutboxSnapshots,
  removeOutboxRecoveryOperations,
  restoreOutboxRecoveryOperations,
  writeOutboxRecoveryJournal,
  OUTBOX_RECOVERY_COMMIT_KEY,
  OUTBOX_FALLBACK_CHECKPOINT_KEY,
  resetOutboxIndexedDbBaseline,
  resetOutboxRecoveryBaseline,
  restoreOutboxRecoveryJournal as restoreRecoveryJournal,
} from '../sync/outbox-recovery-journal.js';
import {
  config, products, orders, staffList, currentStaff, orderViewMode,
  b2bAccounts, pricingTiers, volumeDiscountTiers, stockTransactions, warehouseLocations, inventoryMovements, organizationLocations, inventoryBalances, outboxEvents,
  setConfig, setProducts, setOrders, setStaffList, setCurrentStaff, setOrderViewModeValue,
  setB2bAccounts, setPricingTiers, setVolumeDiscountTiers, setStockTransactions, setWarehouseLocations, setInventoryMovements, setOrganizationLocations, setInventoryBalances, setOutboxEvents
} from '../state.js';

// Phase 4: re-run the per-record money migration (see storage/migration.js)
// against whatever products/orders are current at this point, in case
// IndexedDB just replaced the localStorage-loaded values state.js already
// migrated once at boot with an older, not-yet-migrated snapshot. Called
// from every exit path below (not just the success path), so a session
// where IndexedDB is unavailable or fails to read still ends up on
// migrated data — it just migrates whatever state.js already loaded
// synchronously instead of an IndexedDB copy.
function migrateMoneyNow() {
  const productsChanged = migrateProductMoney(products);
  if (productsChanged) saveJSON(STORAGE_KEYS.products, products);
  const ordersChanged = migrateOrderMoney(orders);
  if (ordersChanged) saveJSON(STORAGE_KEYS.orders, orders);
  return productsChanged || ordersChanged;
}

// Restore the synchronous outbox journal after IndexedDB hydration, or when
// IndexedDB is unavailable. This protects queued intent from a stale IDB
// snapshot after a tab closed before its latest transaction committed.
function restoreOutboxRecoveryJournal({ indexedDbCommit = null } = {}) {
  const restored = restoreRecoveryJournal({
    setOutboxEvents,
    saveOutbox: recovered => saveJSON(STORAGE_KEYS.outboxEvents, recovered),
    indexedDbCommit,
  });
  // If no valid recovery journal exists, IndexedDB hydration may still have
  // replaced the startup localStorage snapshot. Make that hydrated state the
  // baseline before the first post-hydration mutation is persisted.
  if (!restored) {
    const snapshotId = indexedDbCommit?.journalWritten === true
      ? indexedDbCommit.attemptId
      : indexedDbCommit?.previousSnapshotId;
    resetOutboxRecoveryBaseline(outboxEvents, snapshotId);
  }
  return restored;
}

function restoreOutboxFallbackOperations({ persistLocalFallback = true, checkpointedOperationIds = [] } = {}) {
  return restoreOutboxRecoveryOperations({
    events: outboxEvents,
    checkpointedOperationIds,
    setOutboxEvents,
    // When IndexedDB is available, the caller checkpoints replayed operations
    // in the atomic outbox + commit-marker transaction below. Do not launch a
    // separate fire-and-forget save that can poison the session on abort.
    saveOutbox: persistLocalFallback
      ? recovered => saveJSON(STORAGE_KEYS.outboxEvents, recovered)
      : undefined,
  });
}

let ledgerHydrated = false;

export function isLedgerHydrated() {
  return ledgerHydrated;
}

// Mirrors the normalization block that runs immediately after config's
// synchronous load in state.js. A config object pulled from IndexedDB needs
// the same defaults applied, since migration copies the raw
// pre-normalization localStorage value.
export function reapplyConfigDefaults() {
  if (config.niche === undefined) config.niche = '';
  if (!config.businessModel) config.businessModel = 'retail';
  if (config.wholesaleEnabled === undefined) config.wholesaleEnabled = false;
  if (config.volumeDiscountEnabled === undefined) config.volumeDiscountEnabled = false;
  if (config.warehouseEnabled === undefined) config.warehouseEnabled = false;
  if (config.logisticsEnabled === undefined) config.logisticsEnabled = false;
  if (!config.syncUrl && defaultSyncServerUrl) config.syncUrl = defaultSyncServerUrl;
  if (!Array.isArray(config.paymentMethods) || config.paymentMethods.length === 0) {
    config.paymentMethods = DEFAULT_PAYMENT_METHODS.map(pm => ({ ...pm }));
  }
  if (!config.currencyCode) config.currencyCode = 'INR';
}

export async function hydrateFromIndexedDB() {
  try {
    await runLedgerMigration();
  } catch (e) {
    // Shouldn't happen — runLedgerMigration() catches internally — but guard
    // against any unforeseen throw so hydration never crashes boot.
    console.error('Ledger migration threw unexpectedly', e);
  }

  if (isIdbUnavailable()) {
    restoreOutboxRecoveryJournal();
    restoreOutboxFallbackOperations();
    // No usable IndexedDB this session (unsupported, blocked, or corrupted).
    // The values already loaded synchronously from localStorage stand as-is
    // (already money-migrated by state.js at load time; re-run here anyway
    // since it's a cheap no-op when nothing changed).
    migrateMoneyNow();
    ledgerHydrated = true;
    return false;
  }

  let fromIdb;
  try {
    fromIdb = await idbGetAll([...Object.values(STORAGE_KEYS), OUTBOX_RECOVERY_COMMIT_KEY, OUTBOX_FALLBACK_CHECKPOINT_KEY]);
  } catch (e) {
    console.error('IndexedDB hydration read failed, restoring local outbox journal and keeping localStorage-loaded values', e);
    restoreOutboxRecoveryJournal();
    restoreOutboxFallbackOperations();
    migrateMoneyNow();
    ledgerHydrated = true;
    return false;
  }

  let changed = false;
  const apply = (key, currentValue, setter) => {
    const v = fromIdb[key];
    if (v !== null && v !== undefined) {
      setter(v);
      changed = true;
    }
  };

  apply(STORAGE_KEYS.config, config, v => { setConfig(v); reapplyConfigDefaults(); });
  apply(STORAGE_KEYS.products, products, v => setProducts(v));
  apply(STORAGE_KEYS.orders, orders, v => setOrders(v));
  apply(STORAGE_KEYS.staff, staffList, v => setStaffList(v));
  apply(STORAGE_KEYS.activeStaff, currentStaff, v => setCurrentStaff(v));
  apply(STORAGE_KEYS.orderViewMode, orderViewMode, v => setOrderViewModeValue(v));
  apply(STORAGE_KEYS.b2bAccounts, b2bAccounts, v => setB2bAccounts(v));
  apply(STORAGE_KEYS.pricingTiers, pricingTiers, v => setPricingTiers(v));
  apply(STORAGE_KEYS.volumeDiscounts, volumeDiscountTiers, v => setVolumeDiscountTiers(v));
  apply(STORAGE_KEYS.stockTransactions, stockTransactions, v => setStockTransactions(v));
  apply(STORAGE_KEYS.warehouseLocations, warehouseLocations, v => setWarehouseLocations(v));
  apply(STORAGE_KEYS.inventoryMovements, inventoryMovements, v => setInventoryMovements(v));
  apply(STORAGE_KEYS.organizationLocations, organizationLocations, v => setOrganizationLocations(v));
  apply(STORAGE_KEYS.inventoryBalances, inventoryBalances, v => setInventoryBalances(v));
  apply(STORAGE_KEYS.outboxEvents, outboxEvents, v => setOutboxEvents(v));
  resetOutboxIndexedDbBaseline(Array.isArray(fromIdb[STORAGE_KEYS.outboxEvents])
    ? fromIdb[STORAGE_KEYS.outboxEvents]
    : []);
  restoreOutboxRecoveryJournal({
    indexedDbCommit: Array.isArray(fromIdb[STORAGE_KEYS.outboxEvents])
      ? fromIdb[OUTBOX_RECOVERY_COMMIT_KEY]
      : null,
  });

  // Replay a prior localStorage-only session over this IDB snapshot, then
  // checkpoint atomically; keep log keys until the transaction commits.
  const checkpointedIds = Array.isArray(fromIdb[OUTBOX_FALLBACK_CHECKPOINT_KEY]) ? fromIdb[OUTBOX_FALLBACK_CHECKPOINT_KEY] : [];
  const fallbackRecovery = restoreOutboxFallbackOperations({ persistLocalFallback: false, checkpointedOperationIds: checkpointedIds });
  if (fallbackRecovery.checkpointedKeys?.length) removeOutboxRecoveryOperations(fallbackRecovery.checkpointedKeys);
  if (fallbackRecovery.keys.length) {
    const indexedDbBaseline = getOutboxIndexedDbBaseline() || [];
    const recoveredEvents = fallbackRecovery.events;
    let journalWrite = null;
    let journalSnapshot = recoveredEvents;
    await idbUpdateAndSet(STORAGE_KEYS.outboxEvents, storedEvents => {
      journalWrite = writeOutboxRecoveryJournal(recoveredEvents, {
        onMerged: merged => { journalSnapshot = merged; setOutboxEvents(merged); },
      });
      return mergeOutboxSnapshots(indexedDbBaseline, journalSnapshot, Array.isArray(storedEvents) ? storedEvents : []);
    }, [
      { key: OUTBOX_RECOVERY_COMMIT_KEY, value: () => ({
        version: 1,
        attemptId: journalWrite.attemptId,
        previousSnapshotId: journalWrite.previousSnapshotId,
        journalWritten: journalWrite.written,
      }) },
      { key: OUTBOX_FALLBACK_CHECKPOINT_KEY, value: () => [...new Set([...checkpointedIds, ...(fallbackRecovery.operationIds || [])])] },
    ]).then(merged => {
      setOutboxEvents(merged);
      resetOutboxIndexedDbBaseline(merged);
      resetOutboxRecoveryBaseline(merged);
      removeOutboxRecoveryOperations(fallbackRecovery.keys);
    }).catch(error => {
      console.error('Failed to migrate append-only outbox recovery records into IndexedDB; retaining fallback log', error);
    });
  }

  const moneyMigrated = migrateMoneyNow();

  ledgerHydrated = true;
  return changed || moneyMigrated;
}

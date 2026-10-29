// Durable local recovery journal for the offline outbox.
//
// The journal remains a snapshot for crash recovery, but writers reconcile
// their local changes against the latest shared snapshot before replacing it.
// This prevents a stale tab from overwriting unrelated additions or
// resurrecting entries removed by another tab. It is not a transactional
// cross-tab lock: simultaneous edits to the same event remain last-writer-wins.
export const OUTBOX_RECOVERY_KEY = 'sellify.outbox.recovery.v1';
export const OUTBOX_RECOVERY_COMMIT_KEY = 'ledger_outbox_recovery_commit_v1';
export const OUTBOX_FALLBACK_LOG_PREFIX = 'sellify.outbox.recovery.log.v1:';
export const OUTBOX_FALLBACK_CHECKPOINT_KEY = 'ledger_outbox_fallback_checkpoint_v1';
const fallbackWriterId = newSnapshotId();
let fallbackSequence = 0;
let lastSnapshot = null;
let lastSnapshotId = null;
// Keep the recovery-journal merge baseline separate from IndexedDB's last
// committed snapshot. The journal may advance before the IDB transaction
// commits; conflating those baselines can erase additions/deletions in the
// delta that the IDB reconciliation needs to apply.
let lastIndexedDbSnapshot = null;

// Snapshot nested event data as well as the top-level object. Payloads are
// JSON-persisted records; shallow copies let an in-place payload mutation
// rewrite the supposed common ancestor and hide a real local delta.
function cloneEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.map(event => {
    if (!event || typeof event !== 'object') return event;
    return JSON.parse(JSON.stringify(event));
  });
}

// Serialize the recovery-journal + IndexedDB commit sequence across tabs
// where the browser supports the Web Locks API. The lock must cover both the
// journal replacement and its matching IndexedDB commit marker; locking only
// localStorage read/write would still allow commit markers to cross in flight.
// Browsers without Web Locks retain the existing IndexedDB transaction guard,
// but cannot guarantee atomic localStorage journal writes across tabs.
// Serialize overlapping persistence calls in this JavaScript realm even
// when Web Locks are unavailable. This does not coordinate separate tabs;
// only the Web Locks path provides cross-tab serialization.
let fallbackPersistenceTail = Promise.resolve();
let fallbackPersistencePending = 0;

export function withOutboxPersistenceLock(callback, lockManager = globalThis.navigator?.locks) {
  if (typeof callback !== 'function') throw new TypeError('Outbox persistence callback is required');
  if (typeof lockManager?.request === 'function') {
    return lockManager.request('sellify-outbox-persistence-v1', { mode: 'exclusive' }, () => callback(true));
  }

  // Preserve the existing synchronous behavior for a standalone synchronous
  // fallback, but queue subsequent calls while an async persistence operation
  // is still pending. Otherwise same-tab journal/IDB markers can interleave on
  // browsers without Web Locks even though IDB transactions themselves queue.
  if (fallbackPersistencePending === 0) {
    const result = callback(false);
    if (!result || typeof result.then !== 'function') return result;
    fallbackPersistencePending += 1;
    const tracked = Promise.resolve(result).finally(() => { fallbackPersistencePending -= 1; });
    fallbackPersistenceTail = tracked.catch(() => {});
    return tracked;
  }

  fallbackPersistencePending += 1;
  const tracked = fallbackPersistenceTail.then(() => callback(false)).finally(() => { fallbackPersistencePending -= 1; });
  fallbackPersistenceTail = tracked.catch(() => {});
  return tracked;
}

export function initializeOutboxRecoveryBaseline(events) {
  if (Array.isArray(lastSnapshot)) return;
  if (Array.isArray(events)) {
    resetOutboxRecoveryBaseline(events);
    return;
  }
  // Avoid importing application state here: state.js and sync modules can
  // participate in a cycle. The synchronous boot fallback uses this same key.
  try {
    const raw = globalThis.localStorage?.getItem('ledger_outbox_events');
    const stored = raw ? JSON.parse(raw) : [];
    resetOutboxRecoveryBaseline(Array.isArray(stored) ? stored : []);
  } catch {
    resetOutboxRecoveryBaseline([]);
  }
}

// Compare the complete ordered snapshot, not just event IDs. During an
// IndexedDB transaction an existing event can change status/attempt metadata
// without changing its ID; a length/ID-only check would then overwrite that
// newer same-tab mutation with the older transaction result.
export function sameOutboxSnapshot(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((event, index) => JSON.stringify(event) === JSON.stringify(right[index]));
}

export function getOutboxRecoveryBaseline() {
  return Array.isArray(lastSnapshot) ? cloneEvents(lastSnapshot) : null;
}

export function resetOutboxRecoveryBaseline(events, snapshotId = null) {
  lastSnapshot = cloneEvents(events);
  lastSnapshotId = typeof snapshotId === 'string' ? snapshotId : null;
}

export function getOutboxIndexedDbBaseline() {
  return Array.isArray(lastIndexedDbSnapshot) ? cloneEvents(lastIndexedDbSnapshot) : null;
}

export function resetOutboxIndexedDbBaseline(events) {
  lastIndexedDbSnapshot = cloneEvents(events);
}

function byId(events) {
  return new Map((Array.isArray(events) ? events : [])
    .filter(event => event && typeof event.eventId === 'string')
    .map(event => [event.eventId, event]));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compareText(left, right) { return left === right ? 0 : left < right ? -1 : 1; }

function compareFallbackRevision(left, right) {
  if (left.kind !== right.kind) return left.kind === 'delete' ? 1 : -1;
  return left.counter - right.counter
    || compareText(left.writerId, right.writerId)
    || left.sequence - right.sequence;
}

function readFallbackOperationRecords(storage) {
  const records = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key !== 'string' || !key.startsWith(OUTBOX_FALLBACK_LOG_PREFIX)) continue;
    try {
      const operation = JSON.parse(storage.getItem(key));
      const operationId = key.slice(OUTBOX_FALLBACK_LOG_PREFIX.length);
      if (operation?.version !== 1 || typeof operation.operationId !== 'string'
          || operation.operationId !== operationId
          || typeof operation.eventId !== 'string' || !operation.eventId
          || typeof operation.writerId !== 'string' || !operation.writerId
          || !Number.isSafeInteger(operation.sequence) || operation.sequence < 1
          || !Number.isSafeInteger(operation.counter) || operation.counter < 1
          || !['put', 'delete'].includes(operation.kind)
          || (operation.kind === 'put' && (!operation.event || operation.event.eventId !== operation.eventId))) continue;
      records.push({ key, operation });
    } catch { /* Ignore malformed records without hiding valid records. */ }
  }
  return records;
}

// Each mutation has its own key, avoiding cross-tab read/merge/write races.
// Deletes are durable tombstones so an older local snapshot cannot resurrect work.
export function appendOutboxRecoveryOperations(events, {
  storage = globalThis.localStorage, previousEvents, writerId = fallbackWriterId, logger = console,
} = {}) {
  const baseline = Array.isArray(lastSnapshot) ? lastSnapshot : previousEvents;
  const previous = byId(baseline);
  const current = byId(events);
  const ids = [...new Set([...previous.keys(), ...current.keys()])].sort(compareText);
  const changes = ids.flatMap(eventId => {
    const before = previous.get(eventId);
    const now = current.get(eventId);
    if (before && !now) return [{ eventId, kind: 'delete', event: null }];
    if (now && (!before || !sameValue(before, now))) return [{ eventId, kind: 'put', event: now }];
    return [];
  });
  const existing = readFallbackOperationRecords(storage);
  let counter = existing.reduce((max, { operation }) => Math.max(max, operation.counter), 0);
  const keys = [];
  try {
    for (const change of changes) {
      fallbackSequence += 1;
      counter += 1;
      const operationId = `${writerId}:${fallbackSequence}`;
      const key = `${OUTBOX_FALLBACK_LOG_PREFIX}${operationId}`;
      storage.setItem(key, JSON.stringify({ version: 1, operationId, writerId,
        sequence: fallbackSequence, counter, ...change }));
      keys.push(key);
    }
  } catch (error) {
    logger.error('Outbox append-only fallback write failed; retaining existing records', error);
    throw error;
  }
  lastSnapshot = cloneEvents(events);
  return { written: true, operationCount: keys.length, keys };
}

export function restoreOutboxRecoveryOperations({
  storage = globalThis.localStorage, events = [], setOutboxEvents, saveOutbox, logger = console,
  checkpointedOperationIds = [],
} = {}) {
  try {
    const allRecords = readFallbackOperationRecords(storage);
    const checkpointed = new Set(Array.isArray(checkpointedOperationIds) ? checkpointedOperationIds : []);
    const checkpointedKeys = allRecords.filter(({ operation }) => checkpointed.has(operation.operationId)).map(record => record.key);
    const records = allRecords.filter(({ operation }) => !checkpointed.has(operation.operationId));
    if (!records.length) return { restored: false, changed: false, events, keys: [], checkpointedKeys, operationIds: [] };
    const latest = new Map();
    for (const { operation } of records) {
      const current = latest.get(operation.eventId);
      if (!current || compareFallbackRevision(operation, current) > 0) latest.set(operation.eventId, operation);
    }
    const baseline = Array.isArray(events) ? events : [];
    const resolved = byId(baseline);
    for (const [eventId, operation] of latest) {
      if (operation.kind === 'delete') resolved.delete(eventId);
      else resolved.set(eventId, operation.event);
    }
    const result = [];
    const seen = new Set();
    for (const event of baseline) if (resolved.has(event.eventId)) {
      result.push(resolved.get(event.eventId)); seen.add(event.eventId);
    }
    for (const [id, event] of [...resolved].filter(([id]) => !seen.has(id)).sort(([a], [b]) => compareText(a, b))) result.push(event);
    const changed = !sameValue(baseline, result);
    if (changed) { setOutboxEvents?.(result); saveOutbox?.(result); }
    lastSnapshot = cloneEvents(result);
    return { restored: true, changed, events: result, keys: records.map(record => record.key), checkpointedKeys, operationIds: records.map(({ operation }) => operation.operationId) };
  } catch (error) {
    logger.error('Outbox append-only fallback replay failed', error);
    return { restored: false, changed: false, events, keys: [], checkpointedKeys: [], operationIds: [] };
  }
}

export function removeOutboxRecoveryOperations(keys, { storage = globalThis.localStorage, logger = console } = {}) {
  try {
    for (const key of keys || []) if (typeof key === 'string' && key.startsWith(OUTBOX_FALLBACK_LOG_PREFIX)) storage.removeItem(key);
    return true;
  } catch (error) {
    logger.error('Outbox fallback log cleanup failed; retained records will replay', error);
    return false;
  }
}

// Merge an event using the tab's previous snapshot as the common ancestor.
// Independent field changes from both tabs survive. If both tabs changed the
// same field differently, keep the shared journal's value: it is the latest
// cross-tab snapshot observed by this writer. This is a deterministic conflict
// policy, not proof that the shared value is causally newer.
function mergeConcurrentEvent(before, local, shared) {
  const merged = { ...shared };
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(local || {}),
    ...Object.keys(shared || {}),
  ]);

  for (const key of keys) {
    const localChanged = !sameValue(before?.[key], local?.[key]);
    const sharedChanged = !sameValue(before?.[key], shared?.[key]);
    if (!localChanged || sharedChanged) continue;

    if (Object.prototype.hasOwnProperty.call(local, key)) merged[key] = local[key];
    else delete merged[key];
  }
  return merged;
}

export function mergeOutboxSnapshots(previousEvents, localEvents, sharedEvents) {
  const previous = byId(previousEvents);
  const local = byId(localEvents);
  const merged = byId(sharedEvents);
  const ids = new Set([...previous.keys(), ...local.keys()]);

  for (const id of ids) {
    const hadBefore = previous.has(id);
    const hasNow = local.has(id);
    const before = previous.get(id);
    const now = local.get(id);
    if (hadBefore && !hasNow) {
      // A local completion/removal is an explicit deletion.
      merged.delete(id);
    } else if (hadBefore && hasNow && !merged.has(id)) {
      // Once the shared journal has removed an existing event, a stale tab
      // must not resurrect it merely because its local copy was also updated
      // (for example, an attempt counter changed while another tab completed
      // the command). This deliberately prefers completion over stale retries.
      continue;
    } else if (hasNow && !hadBefore) {
      merged.set(id, now);
    } else if (hasNow && !sameValue(before, now)) {
      const sharedEvent = merged.get(id);
      merged.set(id, mergeConcurrentEvent(before, now, sharedEvent));
    }
  }

  const ordered = [];
  const seen = new Set();
  for (const event of localEvents || []) {
    const id = event?.eventId;
    if (typeof id === 'string' && merged.has(id) && !seen.has(id)) {
      ordered.push(merged.get(id));
      seen.add(id);
    }
  }
  for (const event of sharedEvents || []) {
    const id = event?.eventId;
    if (typeof id === 'string' && merged.has(id) && !seen.has(id)) {
      ordered.push(merged.get(id));
      seen.add(id);
    }
  }
  for (const [id, event] of merged) if (!seen.has(id)) ordered.push(event);
  return ordered;
}

function parseRecoverySnapshot(raw) {
  if (raw == null) return null;
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return { events: parsed, snapshotId: null };
  if (parsed?.version === 1 && typeof parsed.snapshotId === 'string' && Array.isArray(parsed.events)) {
    return { events: parsed.events, snapshotId: parsed.snapshotId };
  }
  return null;
}

function newSnapshotId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function writeOutboxRecoveryJournal(
  events,
  { storage = globalThis.localStorage, logger = console, previousEvents, onMerged } = {}
) {
  const attemptId = newSnapshotId();
  let previousSnapshotId = lastSnapshotId;
  let snapshot = events;
  try {
    const baseline = Array.isArray(lastSnapshot) ? lastSnapshot : previousEvents;
    if (Array.isArray(baseline)) {
      let shared = [];
      try {
        const raw = storage.getItem(OUTBOX_RECOVERY_KEY);
        // No journal yet means this tab's baseline is the best available
        // seed. An existing empty array, by contrast, is an explicit snapshot
        // that must not be treated as missing data.
        const parsed = parseRecoverySnapshot(raw);
        previousSnapshotId = parsed?.snapshotId ?? null;
        if (raw === null) shared = baseline;
        else if (parsed) shared = parsed.events;
      } catch (readError) {
        // Do not replace a potentially newer shared journal when it cannot be
        // read. The caller still persists through the normal IndexedDB path.
        logger.error('Outbox recovery journal read-before-write failed; preserving shared snapshot', readError);
        return { written: false, attemptId, previousSnapshotId };
      }
      snapshot = mergeOutboxSnapshots(baseline, events, shared);
    }
    storage.setItem(OUTBOX_RECOVERY_KEY, JSON.stringify({ version: 1, snapshotId: attemptId, events: snapshot }));
    lastSnapshot = cloneEvents(snapshot);
    lastSnapshotId = attemptId;
    if (typeof onMerged === 'function') onMerged(snapshot);
    return { written: true, attemptId, previousSnapshotId };
  } catch (error) {
    // Keep the last known-good recovery snapshot. Deleting it after a failed
    // replacement can destroy unrelated pending work if IndexedDB also fails
    // or the app exits before the normal persistence path completes.
    logger.error('Outbox recovery journal write failed; preserving previous snapshot', error);
    return { written: false, attemptId, previousSnapshotId };
  }
}

export function restoreOutboxRecoveryJournal({
  storage = globalThis.localStorage,
  setOutboxEvents,
  saveOutbox,
  logger = console,
  indexedDbCommit = null,
} = {}) {
  try {
    const raw = storage.getItem(OUTBOX_RECOVERY_KEY);
    if (!raw) return false;
    const journal = parseRecoverySnapshot(raw);
    if (!journal) return false;
    const commitMatchesJournal = indexedDbCommit?.version === 1 && (
      indexedDbCommit.journalWritten === true
        ? journal.snapshotId === indexedDbCommit.attemptId
        : journal.snapshotId === indexedDbCommit.previousSnapshotId
    );
    if (commitMatchesJournal) return false;
    setOutboxEvents(journal.events);
    saveOutbox(journal.events);
    lastSnapshot = cloneEvents(journal.events);
    lastSnapshotId = journal.snapshotId;
    return true;
  } catch (error) {
    logger.error('Outbox recovery journal read/restore failed', error);
    return false;
  }
}

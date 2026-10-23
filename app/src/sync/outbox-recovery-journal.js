// Durable local recovery journal for the offline outbox.
//
// The journal remains a snapshot for crash recovery, but writers reconcile
// their local changes against the latest shared snapshot before replacing it.
// This prevents a stale tab from overwriting unrelated additions or
// resurrecting entries removed by another tab. It is not a transactional
// cross-tab lock: simultaneous edits to the same event remain last-writer-wins.
export const OUTBOX_RECOVERY_KEY = 'sellify.outbox.recovery.v1';
let lastSnapshot = null;

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

export function resetOutboxRecoveryBaseline(events) {
  lastSnapshot = Array.isArray(events) ? events.map(event => ({ ...event })) : [];
}

function byId(events) {
  return new Map((Array.isArray(events) ? events : [])
    .filter(event => event && typeof event.eventId === 'string')
    .map(event => [event.eventId, event]));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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
    } else if (hasNow && (!hadBefore || !sameValue(before, now))) {
      merged.set(id, now);
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

export function writeOutboxRecoveryJournal(
  events,
  { storage = globalThis.localStorage, logger = console, previousEvents, onMerged } = {}
) {
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
        const parsed = raw === null ? baseline : JSON.parse(raw);
        if (Array.isArray(parsed)) shared = parsed;
      } catch (readError) {
        // Do not replace a potentially newer shared journal when it cannot be
        // read. The caller still persists through the normal IndexedDB path.
        logger.error('Outbox recovery journal read-before-write failed; preserving shared snapshot', readError);
        return false;
      }
      snapshot = mergeOutboxSnapshots(baseline, events, shared);
    }
    storage.setItem(OUTBOX_RECOVERY_KEY, JSON.stringify(snapshot));
    lastSnapshot = snapshot.map(event => ({ ...event }));
    if (typeof onMerged === 'function') onMerged(snapshot);
    return true;
  } catch (error) {
    logger.error('Outbox recovery journal write failed; removing any stale snapshot', error);
    try {
      storage.removeItem(OUTBOX_RECOVERY_KEY);
    } catch (cleanupError) {
      logger.error('Outbox recovery journal cleanup failed', cleanupError);
    }
    return false;
  }
}

export function restoreOutboxRecoveryJournal({
  storage = globalThis.localStorage,
  setOutboxEvents,
  saveOutbox,
  logger = console,
} = {}) {
  try {
    const raw = storage.getItem(OUTBOX_RECOVERY_KEY);
    if (!raw) return false;
    const recovered = JSON.parse(raw);
    if (!Array.isArray(recovered)) return false;
    setOutboxEvents(recovered);
    saveOutbox(recovered);
    lastSnapshot = recovered.map(event => ({ ...event }));
    return true;
  } catch (error) {
    logger.error('Outbox recovery journal read/restore failed', error);
    return false;
  }
}

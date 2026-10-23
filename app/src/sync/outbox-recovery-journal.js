// Durable local recovery journal for the offline outbox.
//
// Kept dependency-free so storage failure and recovery behavior can be tested
// with deterministic adapters in Node, without importing browser app state.
export const OUTBOX_RECOVERY_KEY = 'sellify.outbox.recovery.v1';

export function writeOutboxRecoveryJournal(
  events,
  { storage = globalThis.localStorage, logger = console } = {}
) {
  try {
    storage.setItem(OUTBOX_RECOVERY_KEY, JSON.stringify(events));
    return true;
  } catch (error) {
    logger.error('Outbox recovery journal write failed; removing any stale snapshot', error);
    // A stale journal could resurrect a command that was already completed.
    // Cleanup is best-effort if the storage quota/security failure persists.
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
    return true;
  } catch (error) {
    logger.error('Outbox recovery journal read/restore failed', error);
    return false;
  }
}

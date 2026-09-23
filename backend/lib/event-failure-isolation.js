// Phase 13.11.12 — failure isolation policy for event batches.
// This module owns no persistence and performs no domain mutation. It provides
// the boundary used by the HTTP batch handler to convert one event failure
// into an isolated result while allowing independent events to continue.

export function isolatedEventFailure(event, error) {
  return Object.freeze({
    eventId: event?.eventId || event?.event_id || null,
    status: 'rejected',
    error: String(error?.message || 'Event processing failed'),
    code: error?.code || null,
    retryable: Boolean(error?.retryable),
  });
}

export async function processEventIsolated(event, process) {
  if (typeof process !== 'function') throw new TypeError('Event processor is required');
  try {
    return await process(event);
  } catch (error) {
    return isolatedEventFailure(event, error);
  }
}

export function eventFailureIsolationContract() {
  return Object.freeze({
    transaction_scope: 'one event per database transaction',
    batch_scope: 'one result per event; one failure does not abort sibling events',
    rollback_authority: 'backend/lib/store-sqlite.js#processSyncEvent',
    persistence_authority: 'existing sync_events',
    partial_commit: false,
    shared_transaction_across_batch: false,
    retry_queue: false,
    duplicate_failure_store: false,
  });
}

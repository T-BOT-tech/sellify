// Phase 13.11.10 — canonical versioned event boundary.
//
// This module defines the event envelope shared by domain transactions,
// the existing durable outbox, and future consumers. It is intentionally
// persistence-neutral: the existing outbox and backend sync_events remain
// authoritative. No event bus, broker, consumer registry, or new event store
// is introduced here.

const VERSION = '1.0';
const VERSION_NUMBER = 1;
const ID_PATTERN = /^[^\s:]+(?::[^\s:]+)*$/;

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Event ${field} must be a non-empty string`);
  return result;
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Event ${field} must be an object`);
  }
  return value;
}

function eventIdOf(value) {
  const eventId = text(value, 'event_id');
  if (!ID_PATTERN.test(eventId)) throw new TypeError('Event event_id has an invalid format');
  return eventId;
}

/**
 * Build a versioned domain event envelope without publishing or persisting it.
 * The transaction/domain that owns the aggregate supplies the payload and
 * event identity; this boundary only normalizes the cross-system envelope.
 */
export function buildVersionedEvent({
  eventId,
  eventType,
  aggregateType,
  aggregateId,
  organizationId,
  payload,
  occurredAt,
  correlationId = null,
  causationId = null,
  idempotencyKey = null,
  metadata = {},
} = {}) {
  const normalizedEventId = eventIdOf(eventId);
  const normalizedType = text(eventType, 'event_type');
  const normalizedAggregateType = text(aggregateType, 'aggregate_type');
  const normalizedOrganization = text(organizationId, 'organization_id');
  const normalizedPayload = object(payload, 'payload');
  const normalizedMetadata = object(metadata, 'metadata');

  if (aggregateId == null || String(aggregateId).trim() === '') {
    throw new TypeError('Event aggregate_id must be a non-empty value');
  }

  const event = {
    event_version: VERSION,
    event_version_number: VERSION_NUMBER,
    event_id: normalizedEventId,
    event_type: normalizedType,
    aggregate_type: normalizedAggregateType,
    aggregate_id: String(aggregateId),
    organization_id: normalizedOrganization,
    payload: normalizedPayload,
    occurred_at: occurredAt == null ? new Date().toISOString() : text(occurredAt, 'occurred_at'),
    correlation_id: correlationId == null ? null : text(correlationId, 'correlation_id'),
    causation_id: causationId == null ? null : text(causationId, 'causation_id'),
    idempotency_key: idempotencyKey == null ? normalizedEventId : text(idempotencyKey, 'idempotency_key'),
    metadata: normalizedMetadata,
  };

  return Object.freeze(event);
}

export function isVersionedEvent(value) {
  return Boolean(value && typeof value === 'object' &&
    value.event_version === VERSION &&
    value.event_version_number === VERSION_NUMBER &&
    typeof value.event_id === 'string' &&
    typeof value.event_type === 'string' &&
    typeof value.aggregate_type === 'string' &&
    typeof value.aggregate_id === 'string' &&
    typeof value.organization_id === 'string' &&
    value.payload && typeof value.payload === 'object' && !Array.isArray(value.payload) &&
    typeof value.occurred_at === 'string' &&
    (value.correlation_id == null || typeof value.correlation_id === 'string') &&
    (value.causation_id == null || typeof value.causation_id === 'string') &&
    typeof value.idempotency_key === 'string' &&
    value.metadata && typeof value.metadata === 'object' && !Array.isArray(value.metadata));
}

/**
 * Convert the canonical envelope to the existing outbox shape. This is an
 * adapter only; the existing outbox remains the persistence boundary.
 */
export function toOutboxEvent(versionedEvent) {
  if (!isVersionedEvent(versionedEvent)) throw new TypeError('Valid versioned event is required');
  return Object.freeze({
    eventId: versionedEvent.event_id,
    eventType: versionedEvent.event_type,
    aggregateType: versionedEvent.aggregate_type,
    aggregateId: versionedEvent.aggregate_id,
    occurredAt: versionedEvent.occurred_at,
    payload: {
      ...versionedEvent.payload,
      _event: {
        event_version: versionedEvent.event_version,
        event_version_number: versionedEvent.event_version_number,
        organization_id: versionedEvent.organization_id,
        correlation_id: versionedEvent.correlation_id,
        causation_id: versionedEvent.causation_id,
        idempotency_key: versionedEvent.idempotency_key,
        metadata: versionedEvent.metadata,
      },
    },
  });
}

/**
 * Dependency-injected outbox handoff. This avoids importing browser/PWA state
 * into the contract and keeps enqueueEvent() as the existing persistence path.
 */
export function enqueueVersionedEvent(versionedEvent, enqueue) {
  if (typeof enqueue !== 'function') throw new TypeError('Existing outbox enqueue capability is required');
  const outboxEvent = toOutboxEvent(versionedEvent);
  return enqueue(outboxEvent.eventType, outboxEvent.payload, {
    aggregateType: outboxEvent.aggregateType,
    aggregateId: outboxEvent.aggregateId,
    eventId: outboxEvent.eventId,
    occurredAt: outboxEvent.occurredAt,
  });
}

export function eventBoundaryContract() {
  return Object.freeze({
    version: VERSION,
    version_number: VERSION_NUMBER,
    flow: 'Transaction → Outbox → Versioned Event → Consumer',
    envelope_owner: 'canonical event boundary; domain transaction remains aggregate authority',
    outbox_authority: 'app/src/sync/outbox.js#enqueueEvent',
    backend_event_authority: 'backend/lib/store-sqlite.js#processSyncEvent',
    consumer_policy: 'existing supported event handlers only',
    idempotency: 'event_id / existing backend sync_events uniqueness',
    persistence: 'existing outbox and sync_events only',
    publication: 'no new broker or event bus',
    duplicate_event_store: false,
    duplicate_domain_authority: false,
  });
}

// Phase 13.12.14 — vertical event / outbox integration boundary.
//
// This adapter composes the existing versioned event envelope with the existing
// durable outbox. It owns no event store, broker, consumer registry, dispatch
// queue, or domain mutation authority.

import {
  buildVersionedEvent,
  isVersionedEvent,
  enqueueVersionedEvent,
} from '../events/event-boundary.js';

const SUPPORTED_PACKS = Object.freeze(new Set([
  'agriculture',
  'restaurant',
  'warehouse',
  'logistics',
]));

// These are the only event types the current backend processSyncEvent() accepts.
// Do not widen this list until a corresponding backend consumer is implemented.
const CURRENT_BACKEND_EVENT_TYPES = Object.freeze(new Set([
  'inventory.movement.record',
  'customer.upsert',
]));

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Vertical event ${field} must be a non-empty string`);
  return result;
}

function assertPack(packId) {
  const id = text(packId, 'pack_id').toLowerCase();
  if (!SUPPORTED_PACKS.has(id)) throw new TypeError(`Unknown vertical pack: ${packId}`);
  return id;
}

export function buildVerticalVersionedEvent({
  packId,
  eventId,
  eventType,
  aggregateType,
  aggregateId,
  organizationId,
  payload,
  occurredAt = null,
  correlationId = null,
  causationId = null,
  idempotencyKey = null,
  metadata = {},
} = {}) {
  const pack_id = assertPack(packId);
  const event = buildVersionedEvent({
    eventId,
    eventType,
    aggregateType,
    aggregateId,
    organizationId,
    payload,
    occurredAt,
    correlationId,
    causationId,
    idempotencyKey,
    metadata: { ...metadata, pack_id },
  });
  return Object.freeze(event);
}

export function enqueueVerticalVersionedEvent(event, { enqueue } = {}) {
  if (typeof enqueue !== 'function') throw new TypeError('Existing outbox enqueue capability is required');
  if (!isVersionedEvent(event)) throw new TypeError('Valid versioned event is required');
  const packId = assertPack(event.metadata?.pack_id);
  if (!CURRENT_BACKEND_EVENT_TYPES.has(event.event_type)) {
    const error = new Error(`Unsupported vertical event type: ${event.event_type}`);
    error.code = 'VERTICAL_EVENT_UNSUPPORTED';
    error.statusCode = 400;
    throw error;
  }
  return enqueueVersionedEvent(event, enqueue);
}

export function verticalEventIntegrationContract() {
  return Object.freeze({
    version: '1.0',
    flow: 'Vertical Capability → Versioned Event → Existing Outbox → Existing Backend Consumer',
    event_envelope_authority: 'app/src/events/event-boundary.js',
    outbox_authority: 'app/src/sync/outbox.js#enqueueEvent',
    backend_consumer_authority: 'backend/lib/store-sqlite.js#processSyncEvent',
    supported_packs: Object.freeze([...SUPPORTED_PACKS]),
    currently_supported_backend_event_types: Object.freeze([...CURRENT_BACKEND_EVENT_TYPES]),
    unsupported_event_behavior: 'fail_closed_until_backend_consumer_exists',
    event_authorization: 'Phase 13.12 security boundary; no new event authorization evaluator here',
    persistence: 'existing outbox and sync_events only',
    duplicate_event_store: false,
    duplicate_consumer_registry: false,
    duplicate_domain_authority: false,
  });
}

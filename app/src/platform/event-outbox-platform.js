// Phase 16.7 — Platform Event / Outbox Composition Boundary.
//
// This module formalizes the existing Transaction → Outbox → Versioned Event →
// Consumer flow for platform consumers. It deliberately delegates persistence
// to app/src/sync/outbox.js and backend consumption to the existing consumer
// authority. No broker, event store, consumer registry, or duplicate outbox is
// introduced.

import {
  buildVersionedEvent,
  enqueueVersionedEvent,
  eventBoundaryContract,
  isVersionedEvent,
} from '../events/event-boundary.js';

export const PLATFORM_EVENT_OUTBOX_CONTRACT_VERSION = '1.0';

const SUPPORTED_EVENT_TYPES = Object.freeze([
  'inventory.movement.record',
  'customer.upsert',
]);

const FORBIDDEN_PLATFORM_EVENT_AUTHORITIES = Object.freeze([
  'eventStore', 'broker', 'consumerRegistry', 'database', 'persistence',
  'ledger', 'transactionEngine', 'authorization', 'identityStore', 'apiGateway',
]);

function fail(message) {
  const error = new Error(`Invalid platform event/outbox boundary: ${message}`);
  error.code = 'PLATFORM_EVENT_OUTBOX_INVALID';
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim();
}

export function listPlatformSupportedEventTypes() {
  return [...SUPPORTED_EVENT_TYPES];
}

export function isPlatformSupportedEventType(eventType) {
  return typeof eventType === 'string' && SUPPORTED_EVENT_TYPES.includes(eventType.trim());
}

export function buildPlatformVersionedEvent(input = {}) {
  const eventType = text(input.eventType, 'eventType');
  if (!isPlatformSupportedEventType(eventType)) {
    const error = new Error(`Unsupported platform event type: ${eventType}`);
    error.code = 'PLATFORM_EVENT_UNSUPPORTED';
    throw error;
  }

  return buildVersionedEvent(input);
}

export function enqueuePlatformVersionedEvent(versionedEvent, enqueue) {
  if (!isVersionedEvent(versionedEvent)) fail('valid versioned event is required');
  if (!isPlatformSupportedEventType(versionedEvent.event_type)) {
    const error = new Error(`Unsupported platform event type: ${versionedEvent.event_type}`);
    error.code = 'PLATFORM_EVENT_UNSUPPORTED';
    throw error;
  }
  return enqueueVersionedEvent(versionedEvent, enqueue);
}

export function assertPlatformEventOutboxBoundary() {
  const contract = platformEventOutboxContract();
  if (contract.outbox_authority !== 'app/src/sync/outbox.js#enqueueEvent') fail('unexpected outbox authority');
  if (contract.backend_consumer_authority !== 'backend/lib/store-sqlite.js#processSyncEvent') fail('unexpected consumer authority');
  if (contract.duplicate_event_store || contract.duplicate_broker || contract.duplicate_consumer_registry) {
    fail('platform event boundary cannot own a duplicate event infrastructure');
  }
  return contract;
}

export function platformEventOutboxContract() {
  return Object.freeze({
    version: PLATFORM_EVENT_OUTBOX_CONTRACT_VERSION,
    flow: 'Transaction → Outbox → Versioned Event → Consumer',
    event_envelope_authority: 'app/src/events/event-boundary.js',
    outbox_authority: 'app/src/sync/outbox.js#enqueueEvent',
    backend_consumer_authority: 'backend/lib/store-sqlite.js#processSyncEvent',
    supported_event_types: [...SUPPORTED_EVENT_TYPES],
    unsupported_event_behavior: 'fail_closed_until_existing_backend_consumer_exists',
    idempotency: 'existing event_id and backend sync_events uniqueness',
    persistence: 'existing outbox and sync_events only',
    execution: 'dependency-injected existing enqueue capability',
    authorization: 'existing canonical authorization boundary',
    duplicate_event_store: false,
    duplicate_broker: false,
    duplicate_consumer_registry: false,
    duplicate_domain_authority: false,
    forbidden_authorities: [...FORBIDDEN_PLATFORM_EVENT_AUTHORITIES],
    canonical_event_contract: eventBoundaryContract(),
  });
}

export function definePlatformEventOutboxContract(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('manifest must be an object');
  for (const key of FORBIDDEN_PLATFORM_EVENT_AUTHORITIES) {
    const claim = `owns${key[0].toUpperCase()}${key.slice(1)}`;
    if (Object.prototype.hasOwnProperty.call(input, claim)) fail(`forbidden authority claim: ${claim}`);
  }
  if (input.persistence !== undefined && input.persistence !== 'none') fail('persistence must be none');
  if (input.store !== undefined || input.database !== undefined) fail('event platform cannot declare storage');
  if (input.broker !== undefined || input.eventStore !== undefined) fail('event platform cannot declare event infrastructure');
  return Object.freeze({
    version: PLATFORM_EVENT_OUTBOX_CONTRACT_VERSION,
    flow: 'Transaction → Outbox → Versioned Event → Consumer',
    persistence: 'none',
    ...input,
  });
}

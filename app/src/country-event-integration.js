// Phase 14.12 — Ethiopia country event integration boundary.
// Country events reuse the canonical versioned event envelope and existing
// outbox/backend consumer. This module owns no event persistence, broker,
// consumer registry, domain authority, or country-specific event store.
import { getCountryPack } from './country-pack-contract.js';
import { buildVersionedEvent, isVersionedEvent, enqueueVersionedEvent } from './events/event-boundary.js';

const CURRENT_BACKEND_EVENT_TYPES = Object.freeze(new Set([
  'inventory.movement.record',
  'customer.upsert',
]));

function normalizeCountry(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function buildCountryVersionedEvent({
  countryCode = 'ET',
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
  const country = normalizeCountry(countryCode);
  const pack = getCountryPack(country);
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
    metadata: { ...metadata, country_code: pack.countryCode },
  });
  return Object.freeze(event);
}

export function enqueueCountryVersionedEvent(event, { enqueue } = {}) {
  if (!isVersionedEvent(event)) throw new TypeError('Valid versioned event is required');
  const country = normalizeCountry(event.metadata?.country_code);
  const pack = getCountryPack(country);
  if (pack.countryCode !== 'ET') throw new Error(`Unsupported country event: ${country}`);
  if (!CURRENT_BACKEND_EVENT_TYPES.has(event.event_type)) {
    const error = new Error(`Unsupported country event type: ${event.event_type}`);
    error.code = 'COUNTRY_EVENT_UNSUPPORTED';
    error.statusCode = 400;
    throw error;
  }
  return enqueueVersionedEvent(event, enqueue);
}

export function countryEventIntegrationContract() {
  return Object.freeze({
    version: '1.0',
    country_code: 'ET',
    flow: 'Country Capability → Versioned Event → Existing Outbox → Existing Backend Consumer',
    event_envelope_authority: 'app/src/events/event-boundary.js',
    outbox_authority: 'app/src/sync/outbox.js#enqueueEvent',
    backend_consumer_authority: 'backend/lib/store-sqlite.js#processSyncEvent',
    currently_supported_backend_event_types: Object.freeze([...CURRENT_BACKEND_EVENT_TYPES]),
    unsupported_event_behavior: 'fail_closed_until_backend_consumer_exists',
    persistence: 'existing outbox and sync_events only',
    duplicate_event_store: false,
    duplicate_consumer_registry: false,
    duplicate_country_domain_authority: false,
    country_event_execution: 'adapter_only',
  });
}

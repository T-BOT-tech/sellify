// Phase 15.18 — Country Events / Outbox Expansion.
// Country event metadata composes over the canonical versioned event boundary
// and the existing durable outbox/backend consumer. It does not create a
// country event store, broker, consumer registry, or domain authority.
import { getCountryPack } from './country-pack-contract.js';
import { buildVersionedEvent, isVersionedEvent, enqueueVersionedEvent } from './events/event-boundary.js';

export const COUNTRY_EVENT_EXPANSION_VERSION = '1.0';

const ACTIVE_COUNTRIES = Object.freeze(new Set(['ET', 'KE', 'TZ', 'NG']));
const CANDIDATE_COUNTRIES = Object.freeze(new Set(['GH', 'ZM']));
const REGIONAL_COUNTRIES = Object.freeze(new Set([
  'BI','CD','KE','RW','SO','SS','TZ','UG',
  'BJ','BF','CI','GW','ML','NE','SN','TG',
  'CM','CF','TD','CG','GQ','GA'
]));

// These are the only backend event types already supported by the canonical
// consumer. Country expansion must not invent a second consumer registry.
const SUPPORTED_BACKEND_EVENT_TYPES = Object.freeze(new Set([
  'inventory.movement.record',
  'customer.upsert',
]));

const normalise = (value) => String(value ?? '').trim().toUpperCase();

export function countryEventExpansionStatus(countryCode) {
  const code = normalise(countryCode);
  if (ACTIVE_COUNTRIES.has(code)) return 'active_country_pack';
  if (CANDIDATE_COUNTRIES.has(code)) return 'strategic_candidate';
  if (REGIONAL_COUNTRIES.has(code)) return 'regional_country_boundary_only';
  return 'unknown';
}

export function buildExpandedCountryVersionedEvent({ countryCode = 'ET', ...input } = {}) {
  const code = normalise(countryCode);
  if (countryEventExpansionStatus(code) !== 'active_country_pack') {
    const error = new Error(`Country event activation unavailable: ${code || countryCode}`);
    error.code = 'COUNTRY_EVENT_COUNTRY_INACTIVE';
    error.statusCode = 400;
    throw error;
  }
  const pack = getCountryPack(code);
  return buildVersionedEvent({
    ...input,
    metadata: { ...(input.metadata || {}), country_code: pack.countryCode },
  });
}

export function enqueueExpandedCountryVersionedEvent(event, { enqueue } = {}) {
  if (!isVersionedEvent(event)) throw new TypeError('Valid versioned event is required');
  const code = normalise(event.metadata?.country_code);
  if (countryEventExpansionStatus(code) !== 'active_country_pack') {
    const error = new Error(`Country event activation unavailable: ${code || 'unknown'}`);
    error.code = 'COUNTRY_EVENT_COUNTRY_INACTIVE';
    error.statusCode = 400;
    throw error;
  }
  if (!SUPPORTED_BACKEND_EVENT_TYPES.has(event.event_type)) {
    const error = new Error(`Unsupported country event type: ${event.event_type}`);
    error.code = 'COUNTRY_EVENT_UNSUPPORTED';
    error.statusCode = 400;
    throw error;
  }
  return enqueueVersionedEvent(event, enqueue);
}

export function countryEventExpansionContract() {
  return Object.freeze({
    version: COUNTRY_EVENT_EXPANSION_VERSION,
    authority: 'country_event_expansion_boundary',
    activeCountryEvents: [...ACTIVE_COUNTRIES],
    candidateCountries: [...CANDIDATE_COUNTRIES],
    regionalCountryBoundaryOnly: [...REGIONAL_COUNTRIES].filter((c) => !ACTIVE_COUNTRIES.has(c)),
    eventEnvelopeAuthority: 'app/src/events/event-boundary.js',
    outboxAuthority: 'app/src/sync/outbox.js#enqueueEvent',
    backendConsumerAuthority: 'backend/lib/store-sqlite.js#processSyncEvent',
    supportedBackendEventTypes: [...SUPPORTED_BACKEND_EVENT_TYPES],
    activation: 'active_country_pack_only',
    candidateActivation: 'manual_country_pack_activation_required',
    regionalActivation: 'country_overlay_required',
    persistence: 'existing outbox and sync_events only',
    ownsEventStore: false,
    ownsOutbox: false,
    ownsConsumerRegistry: false,
    ownsDomainAuthority: false,
    ownsRegionalEventAuthority: false,
    failClosed: true,
    implementationStatus: 'boundary_only',
  });
}

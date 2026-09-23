// Phase 16.2 — Canonical Authority Registry.
//
// Machine-verifiable map of existing Sellify domain authorities. This registry
// is declarative only: it does not execute, persist, authorize, or replace any
// authority. Consumers must delegate to the referenced existing authority.
//
// Platform rule:
//   Capability → Authority Registry → Existing Authority
//
// No platform database, ledger, transaction engine, permission store, or event
// store is introduced here.

export const PLATFORM_AUTHORITY_REGISTRY_VERSION = '1.0';

const FORBIDDEN_PLATFORM_OWNERSHIP = Object.freeze([
  'database',
  'persistence',
  'ledger',
  'eventStore',
  'broker',
  'authorization',
  'identityStore',
  'transactionEngine',
  'apiGateway',
]);

const DEFINITIONS = Object.freeze([{ authority:'procurement', domains:Object.freeze(['demand_intake','sourcing_workflow','supplier_participation','supplier_relationships','supplier_discovery','rfq','supplier_responses','comparison','award','execution']), source:'backend/lib/store-sqlite.js#procurement domain authorities', capabilityPrefix:'procurement.', execution:'existing_domain_authority' },
  {
    authority: 'supplier_network',
    domains: Object.freeze(['supplier_profile','supplier_capability','supplier_catalog','supplier_service_area','supplier_capacity','supplier_qualification','supplier_performance','supplier_trust','supplier_discovery','marketplace_integration']),
    source: 'backend/lib/store-sqlite.js#supplier network domain authorities',
    capabilityPrefix: 'supplier-network.',
    execution: 'existing_domain_authority',
  },
  {
    authority: 'commerce',
    domains: Object.freeze(['orders', 'products']),
    source: 'existing commerce/order and product authorities',
    capabilityPrefix: 'commerce.',
    execution: 'existing_domain_authority',
  },
  {
    authority: 'inventory',
    domains: Object.freeze(['stock', 'movements']),
    source: 'app/src/warehouse/inventory.js#applyStockChange',
    capabilityPrefix: 'inventory.',
    execution: 'existing_domain_authority',
  },
  {
    authority: 'payments',
    domains: Object.freeze(['payments', 'settlement']),
    source: 'existing payment authority / backend payment modules',
    capabilityPrefix: 'payments.',
    execution: 'existing_domain_authority',
  },
  {
    authority: 'customers',
    domains: Object.freeze(['customer_identity']),
    source: 'app/src/customers.js',
    capabilityPrefix: 'customers.',
    execution: 'existing_domain_authority',
  },
  {
    authority: 'locations',
    domains: Object.freeze(['organization_location_scope']),
    source: 'existing organization/location authority',
    capabilityPrefix: 'locations.',
    execution: 'existing_domain_authority',
  },
  {
    authority: 'fulfillment',
    domains: Object.freeze(['fulfillment_lifecycle']),
    source: 'app/src/logistics/fulfillment.js',
    capabilityPrefix: 'fulfillment.',
    execution: 'existing_domain_authority',
  },
  {
    authority: 'logistics',
    domains: Object.freeze(['courier','route','shipment','delivery','proof','return']),
    source: 'app/src/verticals/logistics/authority-map.js + existing Logistics Pack authorities',
    capabilityPrefix: 'logistics.',
    execution: 'existing_domain_authority',
  },
  {
    authority: 'documents',
    domains: Object.freeze(['b2b_invoices']),
    source: 'backend/lib/store-sqlite.js#invoices + existing B2B invoice authority',
    capabilityPrefix: 'documents.',
    execution: 'existing_domain_authority',
  },
  {
    authority: 'audit',
    domains: Object.freeze(['audit_history']),
    source: 'existing audit/compliance authority',
    capabilityPrefix: 'audit.',
    execution: 'existing_domain_authority',
  },
  {
    authority: 'country',
    domains: Object.freeze(['country_configuration']),
    source: 'app/src/country-configuration.js',
    capabilityPrefix: 'country.',
    execution: 'existing_configuration_authority',
  },
  {
    authority: 'vertical',
    domains: Object.freeze(['vertical_configuration']),
    source: 'app/src/verticals/configuration.js',
    capabilityPrefix: 'vertical.',
    execution: 'existing_configuration_authority',
  },
  {
    authority: 'events',
    domains: Object.freeze(['versioned_events']),
    source: 'app/src/events/event-boundary.js + existing outbox',
    capabilityPrefix: 'events.',
    execution: 'existing_event_boundary',
  },
]);

const BY_AUTHORITY = new Map(DEFINITIONS.map((entry) => [entry.authority, entry]));

function normalize(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`Invalid platform authority: ${field} must be a non-empty string`);
    error.code = 'PLATFORM_AUTHORITY_INVALID';
    throw error;
  }
  return value.trim().toLowerCase();
}

function clone(entry) {
  return Object.freeze({
    ...entry,
    domains: Object.freeze([...entry.domains]),
  });
}

export function listPlatformAuthorities() {
  return [...BY_AUTHORITY.keys()];
}

export function getPlatformAuthority(authorityName) {
  const authority = normalize(authorityName, 'authority');
  const entry = BY_AUTHORITY.get(authority);
  if (!entry) {
    const error = new Error(`Unknown platform authority: ${authorityName}`);
    error.code = 'PLATFORM_AUTHORITY_UNKNOWN';
    throw error;
  }
  return clone(entry);
}

export function resolveAuthorityForCapability(capabilityName) {
  const capability = normalize(capabilityName, 'capability');
  const entry = DEFINITIONS.find((item) => capability.startsWith(item.capabilityPrefix));
  if (!entry) {
    const error = new Error(`No canonical authority registered for capability: ${capabilityName}`);
    error.code = 'PLATFORM_AUTHORITY_UNRESOLVED';
    throw error;
  }
  return clone(entry);
}

export function platformAuthorityRegistryContract() {
  return Object.freeze({
    version: PLATFORM_AUTHORITY_REGISTRY_VERSION,
    authority: 'existing Sellify domain authorities',
    execution: 'declaration_and_resolution_only',
    persistence: 'none',
    authorization: 'backend/lib/authorization.js',
    transactionAuthority: 'existing domain transaction authorities',
    duplicateAuthority: false,
    duplicatePersistence: false,
    duplicateAuthorization: false,
    duplicateEventStore: false,
    forbiddenPlatformOwnership: FORBIDDEN_PLATFORM_OWNERSHIP,
    authorityCount: DEFINITIONS.length,
  });
}

export function assertNoPlatformAuthorityClaim(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return true;
  for (const forbidden of FORBIDDEN_PLATFORM_OWNERSHIP) {
    const key = `owns${forbidden[0].toUpperCase()}${forbidden.slice(1)}`;
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const error = new Error(`Platform authority registry cannot claim ${key}`);
      error.code = 'PLATFORM_AUTHORITY_FORBIDDEN';
      throw error;
    }
  }
  return true;
}

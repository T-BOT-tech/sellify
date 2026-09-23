// Phase 21.2 — Supply Capability composition contract.
//
// Supplier Network remains the sole authority for supplier capability state.
// Phase 21 exposes a read/composition shape for deterministic sourcing
// coordination without copying capability records or creating a second store.
//
// Canonical flow:
// Supplier Network Capability -> Phase 21 Supply Capability projection
//                             -> matching / sourcing coordination
//
// This module has no persistence, mutation, authorization, transaction,
// inventory, procurement, payment, or provider execution authority.

export const PHASE21_SUPPLY_CAPABILITY_CONTRACT_VERSION = '1.0';
export const PHASE21_SUPPLY_CAPABILITY_AUTHORITY = 'supplier_network';
export const PHASE21_SUPPLY_CAPABILITY_STATUSES = Object.freeze(['ACTIVE', 'INACTIVE', 'UNKNOWN']);
export const PHASE21_SUPPLY_CAPABILITY_SOURCES = Object.freeze(['DECLARED', 'VERIFIED', 'UNKNOWN']);

function invalid(message) {
  const error = new TypeError(`Invalid Phase 21 supply capability: ${message}`);
  error.code = 'PHASE21_SUPPLY_CAPABILITY_INVALID';
  throw error;
}

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) invalid(`${field} must be a non-empty string`);
  return result;
}

function optionalText(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field);
}

function freezeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.freeze({ ...value });
}

/**
 * Project an existing Supplier Network capability into the Phase 21
 * coordination vocabulary. No source fields are persisted or re-owned here.
 */
export function projectSupplyCapability(capability = {}) {
  if (!capability || typeof capability !== 'object' || Array.isArray(capability)) {
    invalid('capability must be an object');
  }

  const id = text(capability.id ?? capability.capabilityId ?? capability.capability_id, 'capability.id');
  const authority = optionalText(capability.authority, 'capability.authority');
  if (authority && authority !== PHASE21_SUPPLY_CAPABILITY_AUTHORITY) {
    invalid('capability.authority must be supplier_network');
  }

  const supplierOrganizationId = text(
    capability.supplierOrganizationId ?? capability.supplier_organization_id ?? capability.organizationId ?? capability.organization_id,
    'capability.supplierOrganizationId',
  );

  const status = String(capability.status ?? 'UNKNOWN').trim().toUpperCase();
  if (!PHASE21_SUPPLY_CAPABILITY_STATUSES.includes(status)) {
    invalid(`capability.status must be one of ${PHASE21_SUPPLY_CAPABILITY_STATUSES.join(', ')}`);
  }

  const source = String(capability.source ?? 'UNKNOWN').trim().toUpperCase();
  if (!PHASE21_SUPPLY_CAPABILITY_SOURCES.includes(source)) {
    invalid(`capability.source must be one of ${PHASE21_SUPPLY_CAPABILITY_SOURCES.join(', ')}`);
  }

  return Object.freeze({
    capabilityReference: Object.freeze({
      authority: PHASE21_SUPPLY_CAPABILITY_AUTHORITY,
      resource: 'supplier_network_capability',
      id,
    }),
    supplierReference: Object.freeze({
      authority: 'organizations',
      entity: 'Organization',
      id: supplierOrganizationId,
    }),
    code: optionalText(capability.code, 'capability.code'),
    name: optionalText(capability.name, 'capability.name'),
    category: optionalText(capability.category, 'capability.category'),
    status,
    source,
    visibility: optionalText(capability.visibility, 'capability.visibility'),
    metadata: freezeObject(capability.metadata),
    productAuthority: 'existing product/catalog authority',
    persistence: 'none',
    mutation: false,
    transactionExecution: false,
    providerExecution: false,
  });
}

export function phase21SupplyCapabilityContract() {
  return Object.freeze({
    version: PHASE21_SUPPLY_CAPABILITY_CONTRACT_VERSION,
    authority: PHASE21_SUPPLY_CAPABILITY_AUTHORITY,
    sourceAuthority: 'supplier-network.capability',
    identityAuthority: 'organizations',
    productAuthority: 'existing product/catalog authority',
    inventoryAuthority: 'existing inventory authority',
    procurementAuthority: 'existing procurement authority',
    persistence: 'none',
    mutation: false,
    transactionExecution: false,
    providerExecution: false,
    principle: 'project existing Supplier Network capability; do not create duplicate capability authority',
  });
}

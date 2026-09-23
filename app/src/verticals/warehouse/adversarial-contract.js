// Phase 13.9.11 — Warehouse adversarial / idempotency / isolation contract.
// This contract is deliberately persistence-neutral. It defines the boundary
// checks required before a Warehouse operation may be handed to Core
// authorities; it does not implement a second mutation or persistence path.

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Warehouse ${field} must be a non-empty string`);
  return result;
}

function organizationOf(value, field = 'organization_id') {
  return text(value?.organization_id ?? value?.organizationId, field);
}

function assertSameOrganization(expected, ...records) {
  for (const record of records) {
    if (record && organizationOf(record) !== expected) {
      throw new TypeError('Warehouse cross-organization reference rejected');
    }
  }
  return expected;
}

export function assertWarehouseOrganizationIsolation({ organizationId, records = [] } = {}) {
  const expected = text(organizationId, 'organization_id');
  if (!Array.isArray(records)) throw new TypeError('Warehouse isolation records must be an array');
  assertSameOrganization(expected, ...records);
  return expected;
}

export function assertWarehouseEventIdentity(eventId, expectedEventId = eventId) {
  const actual = text(eventId, 'event_id');
  const expected = text(expectedEventId, 'expected_event_id');
  if (actual !== expected) throw new TypeError('Warehouse event identity mismatch');
  return actual;
}

export function warehouseAdversarialContract() {
  return Object.freeze({
    organization_isolation: 'required',
    cross_organization_reference: 'reject',
    missing_organization: 'reject',
    inactive_location: 'reject',
    missing_product: 'reject',
    event_identity: 'event_id',
    repeated_event_identity: 'same_event_id_required',
    duplicate_authority: false,
    stock_mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
    ledger_authority: 'app/src/warehouse/ledger.js#recordInventoryMovement',
    execution_idempotency: 'delegated_to_existing_core_authority',
    persistence: 'none',
  });
}

// Phase 13.9.2 — Warehouse Pack Authority Map.
//
// This map records ownership, direction, conflict policy, and reconciliation
// policy for the existing Warehouse boundary. It is declarative only: it does
// not create storage, mutation paths, or a second domain authority.

export const WAREHOUSE_AUTHORITY_MAP_VERSION = '1.0';

const entries = [
  {
    concept: 'product',
    owner: 'commerce',
    warehouse_role: 'consume',
    direction: 'Warehouse -> Commerce',
    conflict_policy: 'Commerce product identity and master data win; Warehouse does not create or mutate a parallel product authority.',
    reconciliation_policy: 'Resolve Warehouse references against the existing Commerce product id; missing products are treated as unresolved rather than recreated.',
  },
  {
    concept: 'inventory_stock',
    owner: 'inventory',
    warehouse_role: 'consume_and_request_mutation',
    direction: 'Warehouse -> Inventory',
    conflict_policy: 'Inventory is the sole stock authority; Warehouse must use the existing inventory mutation path.',
    reconciliation_policy: 'Reconcile stock from the canonical inventory movement stream and existing inventory balances; do not reconcile by creating a Warehouse stock ledger.',
  },
  {
    concept: 'inventory_movement',
    owner: 'inventory',
    warehouse_role: 'record_via_existing_ledger',
    direction: 'Warehouse -> Inventory',
    conflict_policy: 'The existing inventory ledger is authoritative for movement records; duplicate Warehouse movement records are forbidden.',
    reconciliation_policy: 'Use movement event identity for repeatable operations and derive local balances from the existing movement stream.',
  },
  {
    concept: 'organization_location',
    owner: 'locations',
    warehouse_role: 'consume',
    direction: 'Locations -> Warehouse',
    conflict_policy: 'Organization locations are canonical; Warehouse must not create a parallel organization-location authority.',
    reconciliation_policy: 'Refresh from the existing organization location registry and retain the configured active location when valid; otherwise use the existing active-location fallback.',
  },
  {
    concept: 'storage_bin',
    owner: 'warehouse',
    warehouse_role: 'own',
    direction: 'Warehouse internal',
    conflict_policy: 'Storage-bin metadata remains Warehouse-specific and is distinct from canonical organization locations.',
    reconciliation_policy: 'Persist through the existing warehouseLocations state/storage path; do not merge bins into organizationLocations.',
  },
  {
    concept: 'order',
    owner: 'commerce',
    warehouse_role: 'consume',
    direction: 'Commerce -> Warehouse',
    conflict_policy: 'Commerce order data wins; Warehouse does not create WarehouseOrder or another order authority.',
    reconciliation_policy: 'Resolve fulfillment and stock references against the existing Commerce order id and item ids.',
  },
  {
    concept: 'customer',
    owner: 'customers',
    warehouse_role: 'consume',
    direction: 'Customers -> Warehouse',
    conflict_policy: 'Customers remains the customer authority; Warehouse does not maintain a parallel customer record.',
    reconciliation_policy: 'Reference the canonical customer identity when present; do not synthesize a Warehouse customer entity.',
  },
  {
    concept: 'fulfillment',
    owner: 'fulfillment',
    warehouse_role: 'consume_and_integrate',
    direction: 'Fulfillment <-> Warehouse',
    conflict_policy: 'Fulfillment lifecycle remains authoritative; physical stock deduction continues through the existing inventory mutation path.',
    reconciliation_policy: 'Use existing fulfillment status and stock_deducted guard; repeat finalization must not double-deduct stock.',
  },
  {
    concept: 'audit',
    owner: 'audit',
    warehouse_role: 'consume',
    direction: 'Warehouse -> Audit',
    conflict_policy: 'Audit remains a Core authority; Warehouse must not create a second audit trail.',
    reconciliation_policy: 'Preserve the existing audit/event trail produced by authoritative operations; no Warehouse-specific duplicate audit authority is introduced.',
  },
];

export const WAREHOUSE_AUTHORITY_MAP = Object.freeze(
  entries.map((entry) => Object.freeze({ ...entry }))
);

export function getWarehouseAuthority(concept) {
  return WAREHOUSE_AUTHORITY_MAP.find((entry) => entry.concept === concept) || null;
}

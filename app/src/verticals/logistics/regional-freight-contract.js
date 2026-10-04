// L15 — Regional Freight Product Boundary.
// Productizes the shared Logistics load-board flow without creating a second
// order, shipment, inventory, fulfillment, payment, or provider authority.

export const REGIONAL_FREIGHT_CONTRACT_VERSION = '1.0';

const STAGES = Object.freeze([
  'DEMAND','CAPACITY','CORRIDOR','MATCHING','SELECTION','ASSIGNMENT',
  'LOADING','MOVEMENT','CHECKPOINT','ARRIVAL','PROOF',
]);

const TERMINAL = new Set(['PROOF']);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
}

export function normalizeRegionalFreightRequest(value) {
  if (!value || typeof value !== 'object') throw new TypeError('Regional Freight request is required');
  const organizationId = text(value.organization_id ?? value.organizationId, 'organization_id');
  const demandRef = text(value.demand_ref ?? value.demandRef, 'demand_ref');
  const originRef = text(value.origin_ref ?? value.originRef, 'origin_ref');
  const destinationRef = text(value.destination_ref ?? value.destinationRef, 'destination_ref');
  const cargoRef = text(value.cargo_ref ?? value.cargoRef, 'cargo_ref');
  return Object.freeze({
    organization_id: organizationId,
    demand_ref: demandRef,
    origin_ref: originRef,
    destination_ref: destinationRef,
    cargo_ref: cargoRef,
    service_profile: 'REGIONAL_FREIGHT',
    stage: 'DEMAND',
  });
}

export function validateRegionalFreightFlow({ request, capacity, corridor, matching, selection, assignment, loading, movement, checkpoint, arrival, proof } = {}) {
  const normalized = normalizeRegionalFreightRequest(request);
  const values = { capacity, corridor, matching, selection, assignment, loading, movement, checkpoint, arrival, proof };
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === null) {
      return Object.freeze({ valid: false, reason: `REGIONAL_FREIGHT_${name.toUpperCase()}_REQUIRED`, request: normalized });
    }
  }
  return Object.freeze({
    valid: true,
    reason: 'REGIONAL_FREIGHT_FLOW_COMPOSED',
    request: normalized,
    stages: STAGES,
    terminal_stage: 'PROOF',
  });
}

export function assertRegionalFreightBoundary({
  organizationScoped = true,
  createsOrderAuthority = false,
  createsShipmentAuthority = false,
  createsInventoryAuthority = false,
  createsFulfillmentAuthority = false,
  createsPaymentAuthority = false,
  createsProviderRegistry = false,
  createsRouteEngine = false,
  mutatesStockOutsideInventory = false,
  mutatesFulfillmentOutsideCore = false,
  mutatesPaymentOutsidePayments = false,
} = {}) {
  if (!organizationScoped) return Object.freeze({ valid: false, reason: 'REGIONAL_FREIGHT_ORGANIZATION_SCOPE_REQUIRED' });
  const forbidden = [
    ['createsOrderAuthority', 'DUPLICATE_ORDER_AUTHORITY_FORBIDDEN'],
    ['createsShipmentAuthority', 'DUPLICATE_SHIPMENT_AUTHORITY_FORBIDDEN'],
    ['createsInventoryAuthority', 'DUPLICATE_INVENTORY_AUTHORITY_FORBIDDEN'],
    ['createsFulfillmentAuthority', 'DUPLICATE_FULFILLMENT_AUTHORITY_FORBIDDEN'],
    ['createsPaymentAuthority', 'DUPLICATE_PAYMENT_AUTHORITY_FORBIDDEN'],
    ['createsProviderRegistry', 'DUPLICATE_PROVIDER_REGISTRY_FORBIDDEN'],
    ['createsRouteEngine', 'ROUTE_ENGINE_FORBIDDEN'],
    ['mutatesStockOutsideInventory', 'STOCK_MUTATION_OUTSIDE_INVENTORY_FORBIDDEN'],
    ['mutatesFulfillmentOutsideCore', 'FULFILLMENT_MUTATION_OUTSIDE_CORE_FORBIDDEN'],
    ['mutatesPaymentOutsidePayments', 'PAYMENT_MUTATION_OUTSIDE_PAYMENTS_FORBIDDEN'],
  ];
  for (const [key, reason] of forbidden) if (arguments[0]?.[key]) return Object.freeze({ valid: false, reason });
  return Object.freeze({ valid: true, reason: 'REGIONAL_FREIGHT_BOUNDARY_VALIDATED' });
}

export function regionalFreightContract() {
  return Object.freeze({
    version: REGIONAL_FREIGHT_CONTRACT_VERSION,
    stages: STAGES,
    service_profile: 'REGIONAL_FREIGHT',
    demand_authority: 'existing_commerce_or_logistics_demand_context',
    capacity_authority: 'existing_logistics_capacity',
    corridor_authority: 'logistics_coordination',
    matching_authority: 'logistics_coordination',
    selection_authority: 'logistics_coordination',
    assignment_authority: 'logistics-pack',
    loading_authority: 'existing_operational_evidence',
    movement_authority: 'existing_movement',
    checkpoint_authority: 'existing_tracking_evidence',
    arrival_authority: 'existing_movement_tracking',
    proof_authority: 'existing_delivery_proof',
    persistence: 'existing_domain_state_only',
    payment_authority: 'payments',
    inventory_authority: 'inventory',
    fulfillment_authority: 'existing_core_fulfillment',
    shipment_authority: 'existing_core_order',
  });
}

// L16 — B2B Distribution Product Boundary.
// Bridges repeat commercial demand into existing Commerce, Inventory,
// Fulfillment and Logistics authorities. No second order or stock authority.

export const B2B_DISTRIBUTION_CONTRACT_VERSION = '1.0';
const STAGES = Object.freeze([
  'RESTOCK_REQUEST','COMMERCE_CONTEXT','INVENTORY','FULFILLMENT',
  'CAPACITY_MATCHING','ASSIGNMENT','DELIVERY','RECEIVER_CONFIRMATION',
]);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
}

export function normalizeB2BDistributionRequest(value) {
  if (!value || typeof value !== 'object') throw new TypeError('B2B Distribution request is required');
  return Object.freeze({
    organization_id: text(value.organization_id ?? value.organizationId, 'organization_id'),
    restock_ref: text(value.restock_ref ?? value.restockRef, 'restock_ref'),
    commerce_ref: text(value.commerce_ref ?? value.commerceRef, 'commerce_ref'),
    inventory_ref: text(value.inventory_ref ?? value.inventoryRef, 'inventory_ref'),
    fulfillment_ref: text(value.fulfillment_ref ?? value.fulfillmentRef, 'fulfillment_ref'),
    destination_ref: text(value.destination_ref ?? value.destinationRef, 'destination_ref'),
    service_profile: 'B2B_DISTRIBUTION',
    stage: 'RESTOCK_REQUEST',
  });
}

export function validateB2BDistributionFlow({ request, commerceContext, inventory, fulfillment, capacityMatching, assignment, delivery, receiverConfirmation } = {}) {
  const normalized = normalizeB2BDistributionRequest(request);
  const parts = { commerceContext, inventory, fulfillment, capacityMatching, assignment, delivery, receiverConfirmation };
  for (const [name, value] of Object.entries(parts)) {
    if (value === undefined || value === null) {
      return Object.freeze({ valid: false, reason: `B2B_DISTRIBUTION_${name.replace(/[A-Z]/g, m => '_' + m).toUpperCase()}_REQUIRED`, request: normalized });
    }
  }
  return Object.freeze({ valid: true, reason: 'B2B_DISTRIBUTION_FLOW_COMPOSED', request: normalized, stages: STAGES, terminal_stage: 'RECEIVER_CONFIRMATION' });
}

export function assertB2BDistributionBoundary(options = {}) {
  const {
    organizationScoped = true,
    createsOrderAuthority = false,
    createsInventoryAuthority = false,
    createsFulfillmentAuthority = false,
    createsPaymentAuthority = false,
    createsCustomerAuthority = false,
    createsLocationAuthority = false,
    mutatesStockOutsideInventory = false,
    mutatesFulfillmentOutsideCore = false,
    mutatesPaymentOutsidePayments = false,
    createsDistributionLedger = false,
  } = options;
  if (!organizationScoped) return Object.freeze({ valid: false, reason: 'B2B_DISTRIBUTION_ORGANIZATION_SCOPE_REQUIRED' });
  const forbidden = [
    [createsOrderAuthority, 'DUPLICATE_ORDER_AUTHORITY_FORBIDDEN'],
    [createsInventoryAuthority, 'DUPLICATE_INVENTORY_AUTHORITY_FORBIDDEN'],
    [createsFulfillmentAuthority, 'DUPLICATE_FULFILLMENT_AUTHORITY_FORBIDDEN'],
    [createsPaymentAuthority, 'DUPLICATE_PAYMENT_AUTHORITY_FORBIDDEN'],
    [createsCustomerAuthority, 'DUPLICATE_CUSTOMER_AUTHORITY_FORBIDDEN'],
    [createsLocationAuthority, 'DUPLICATE_LOCATION_AUTHORITY_FORBIDDEN'],
    [mutatesStockOutsideInventory, 'STOCK_MUTATION_OUTSIDE_INVENTORY_FORBIDDEN'],
    [mutatesFulfillmentOutsideCore, 'FULFILLMENT_MUTATION_OUTSIDE_CORE_FORBIDDEN'],
    [mutatesPaymentOutsidePayments, 'PAYMENT_MUTATION_OUTSIDE_PAYMENTS_FORBIDDEN'],
    [createsDistributionLedger, 'DISTRIBUTION_LEDGER_FORBIDDEN'],
  ];
  for (const [blocked, reason] of forbidden) if (blocked) return Object.freeze({ valid: false, reason });
  return Object.freeze({ valid: true, reason: 'B2B_DISTRIBUTION_BOUNDARY_VALIDATED' });
}

export function b2bDistributionContract() {
  return Object.freeze({
    version: B2B_DISTRIBUTION_CONTRACT_VERSION,
    stages: STAGES,
    service_profile: 'B2B_DISTRIBUTION',
    restock_demand_authority: 'existing_commerce_context',
    commerce_authority: 'commerce',
    inventory_authority: 'inventory',
    fulfillment_authority: 'existing_core_fulfillment',
    capacity_matching_authority: 'logistics_coordination',
    assignment_authority: 'logistics-pack',
    delivery_authority: 'existing_core_fulfillment',
    receiver_confirmation_authority: 'existing_delivery_proof',
    customer_authority: 'customers',
    location_authority: 'locations',
    payment_authority: 'payments',
    persistence: 'existing_domain_state_only',
    repeat_demand_optimization: 'experience_only_no_second_order_authority',
  });
}

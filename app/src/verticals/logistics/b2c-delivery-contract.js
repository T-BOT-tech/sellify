// L17 — B2C Delivery Product Boundary.
// Composes Merchant Order, destination context, Logistics capacity/courier
// coordination, existing shipment/proof boundaries, and Core Fulfillment.

export const B2C_DELIVERY_CONTRACT_VERSION = '1.0';
const STAGES = Object.freeze([
  'MERCHANT_ORDER','DELIVERY_REQUEST','DESTINATION_CONTEXT','CAPACITY_MATCHING',
  'NEARBY_COURIER','ASSIGNMENT','TRACKING','OTP_PROOF','EXISTING_FULFILLMENT',
]);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
}

export function normalizeB2CDeliveryRequest(value) {
  if (!value || typeof value !== 'object') throw new TypeError('B2C Delivery request is required');
  return Object.freeze({
    organization_id: text(value.organization_id ?? value.organizationId, 'organization_id'),
    merchant_order_ref: text(value.merchant_order_ref ?? value.merchantOrderRef, 'merchant_order_ref'),
    delivery_request_ref: text(value.delivery_request_ref ?? value.deliveryRequestRef, 'delivery_request_ref'),
    destination_ref: text(value.destination_ref ?? value.destinationRef, 'destination_ref'),
    service_profile: 'B2C_DELIVERY',
    stage: 'MERCHANT_ORDER',
  });
}

export function validateB2CDeliveryFlow({ request, deliveryRequest, destinationContext, capacityMatching, nearbyCourier, assignment, tracking, otpProof, existingFulfillment } = {}) {
  const normalized = normalizeB2CDeliveryRequest(request);
  const parts = { deliveryRequest, destinationContext, capacityMatching, nearbyCourier, assignment, tracking, otpProof, existingFulfillment };
  for (const [name, value] of Object.entries(parts)) {
    if (value === undefined || value === null) {
      const label = name.replace(/[A-Z]/g, m => '_' + m).toUpperCase();
      return Object.freeze({ valid: false, reason: `B2C_DELIVERY_${label}_REQUIRED`, request: normalized });
    }
  }
  return Object.freeze({ valid: true, reason: 'B2C_DELIVERY_FLOW_COMPOSED', request: normalized, stages: STAGES, terminal_stage: 'EXISTING_FULFILLMENT' });
}

export function assertB2CDeliveryBoundary(options = {}) {
  const {
    organizationScoped = true,
    createsOrderAuthority = false,
    createsLocationAuthority = false,
    createsCourierRegistry = false,
    createsShipmentAuthority = false,
    createsProofAuthority = false,
    createsFulfillmentAuthority = false,
    createsInventoryAuthority = false,
    createsPaymentAuthority = false,
    mutatesStockOutsideInventory = false,
    mutatesFulfillmentOutsideCore = false,
    mutatesPaymentOutsidePayments = false,
  } = options;
  if (!organizationScoped) return Object.freeze({ valid: false, reason: 'B2C_DELIVERY_ORGANIZATION_SCOPE_REQUIRED' });
  const forbidden = [
    [createsOrderAuthority, 'DUPLICATE_ORDER_AUTHORITY_FORBIDDEN'],
    [createsLocationAuthority, 'DUPLICATE_LOCATION_AUTHORITY_FORBIDDEN'],
    [createsCourierRegistry, 'DUPLICATE_COURIER_REGISTRY_FORBIDDEN'],
    [createsShipmentAuthority, 'DUPLICATE_SHIPMENT_AUTHORITY_FORBIDDEN'],
    [createsProofAuthority, 'DUPLICATE_PROOF_AUTHORITY_FORBIDDEN'],
    [createsFulfillmentAuthority, 'DUPLICATE_FULFILLMENT_AUTHORITY_FORBIDDEN'],
    [createsInventoryAuthority, 'DUPLICATE_INVENTORY_AUTHORITY_FORBIDDEN'],
    [createsPaymentAuthority, 'DUPLICATE_PAYMENT_AUTHORITY_FORBIDDEN'],
    [mutatesStockOutsideInventory, 'STOCK_MUTATION_OUTSIDE_INVENTORY_FORBIDDEN'],
    [mutatesFulfillmentOutsideCore, 'FULFILLMENT_MUTATION_OUTSIDE_CORE_FORBIDDEN'],
    [mutatesPaymentOutsidePayments, 'PAYMENT_MUTATION_OUTSIDE_PAYMENTS_FORBIDDEN'],
  ];
  for (const [blocked, reason] of forbidden) if (blocked) return Object.freeze({ valid: false, reason });
  return Object.freeze({ valid: true, reason: 'B2C_DELIVERY_BOUNDARY_VALIDATED' });
}

export function b2cDeliveryContract() {
  return Object.freeze({
    version: B2C_DELIVERY_CONTRACT_VERSION,
    stages: STAGES,
    service_profile: 'B2C_DELIVERY',
    order_authority: 'commerce',
    delivery_request_authority: 'existing_commerce_fulfillment_context',
    destination_authority: 'locations',
    capacity_matching_authority: 'logistics_coordination',
    courier_authority: 'logistics-pack',
    assignment_authority: 'logistics-pack',
    tracking_authority: 'existing_core_order',
    proof_authority: 'existing_delivery_proof',
    fulfillment_authority: 'existing_core_fulfillment',
    inventory_authority: 'inventory',
    payment_authority: 'payments',
    persistence: 'existing_domain_state_only',
    operational_workspace: 'existing_logistics_workspace',
  });
}

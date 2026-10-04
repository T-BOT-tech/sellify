// L18 — P2P Delivery Product Boundary.
// Composes existing identity/compliance evidence, destination context,
// Logistics coordination, existing Movement, OTP/proof and Core boundaries.
// This contract is persistence-neutral and does not create a P2P authority.

export const P2P_DELIVERY_CONTRACT_VERSION = '1.0';

const STAGES = Object.freeze([
  'P2P_REQUEST',
  'SENDER_VERIFICATION',
  'RECIPIENT_CONTEXT',
  'ITEM_REQUIREMENTS',
  'COURIER_ELIGIBILITY',
  'CAPACITY_MATCHING',
  'ASSIGNMENT',
  'PICKUP_OTP',
  'MOVEMENT',
  'DELIVERY_OTP',
  'PROOF',
]);

function requiredText(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
}

export function normalizeP2PDeliveryRequest(value) {
  if (!value || typeof value !== 'object') throw new TypeError('P2P Delivery request is required');
  return Object.freeze({
    organization_id: requiredText(value.organization_id ?? value.organizationId, 'organization_id'),
    request_ref: requiredText(value.request_ref ?? value.requestRef, 'request_ref'),
    sender_ref: requiredText(value.sender_ref ?? value.senderRef, 'sender_ref'),
    recipient_ref: requiredText(value.recipient_ref ?? value.recipientRef, 'recipient_ref'),
    destination_ref: requiredText(value.destination_ref ?? value.destinationRef, 'destination_ref'),
    service_profile: 'P2P_DELIVERY',
    stage: 'P2P_REQUEST',
  });
}

export function validateP2PDeliveryFlow({
  request,
  senderVerification,
  recipientContext,
  itemRequirements,
  courierEligibility,
  capacityMatching,
  assignment,
  pickupOtp,
  movement,
  deliveryOtp,
  proof,
} = {}) {
  const normalized = normalizeP2PDeliveryRequest(request);
  const parts = {
    senderVerification, recipientContext, itemRequirements, courierEligibility,
    capacityMatching, assignment, pickupOtp, movement, deliveryOtp, proof,
  };
  for (const [name, value] of Object.entries(parts)) {
    if (value === undefined || value === null) {
      const label = name.replace(/[A-Z]/g, m => '_' + m).toUpperCase();
      return Object.freeze({
        valid: false,
        reason: `P2P_DELIVERY_${label}_REQUIRED`,
        request: normalized,
      });
    }
  }
  return Object.freeze({
    valid: true,
    reason: 'P2P_DELIVERY_FLOW_COMPOSED',
    request: normalized,
    stages: STAGES,
    terminal_stage: 'PROOF',
  });
}

export function assertP2PDeliveryBoundary({
  organizationScoped = true,
  senderVerificationAuthority = 'identity_compliance',
  createsP2POrderAuthority = false,
  createsIdentityAuthority = false,
  createsRecipientAuthority = false,
  createsItemRegistry = false,
  createsCourierRegistry = false,
  createsCapacityAuthority = false,
  createsShipmentAuthority = false,
  createsProofAuthority = false,
  createsFulfillmentAuthority = false,
  createsPaymentAuthority = false,
  createsP2PLedger = false,
  createsRouteAuthority = false,
  createsGpsAuthority = false,
} = {}) {
  if (!organizationScoped) {
    return Object.freeze({ valid: false, reason: 'P2P_DELIVERY_ORGANIZATION_SCOPE_REQUIRED' });
  }
  if (senderVerificationAuthority !== 'identity_compliance') {
    return Object.freeze({ valid: false, reason: 'SENDER_VERIFICATION_MUST_USE_IDENTITY_COMPLIANCE' });
  }

  const forbidden = [
    [createsP2POrderAuthority, 'DUPLICATE_P2P_ORDER_AUTHORITY_FORBIDDEN'],
    [createsIdentityAuthority, 'DUPLICATE_IDENTITY_AUTHORITY_FORBIDDEN'],
    [createsRecipientAuthority, 'DUPLICATE_RECIPIENT_AUTHORITY_FORBIDDEN'],
    [createsItemRegistry, 'DUPLICATE_ITEM_REGISTRY_FORBIDDEN'],
    [createsCourierRegistry, 'DUPLICATE_COURIER_REGISTRY_FORBIDDEN'],
    [createsCapacityAuthority, 'DUPLICATE_CAPACITY_AUTHORITY_FORBIDDEN'],
    [createsShipmentAuthority, 'DUPLICATE_SHIPMENT_AUTHORITY_FORBIDDEN'],
    [createsProofAuthority, 'DUPLICATE_PROOF_AUTHORITY_FORBIDDEN'],
    [createsFulfillmentAuthority, 'DUPLICATE_FULFILLMENT_AUTHORITY_FORBIDDEN'],
    [createsPaymentAuthority, 'DUPLICATE_PAYMENT_AUTHORITY_FORBIDDEN'],
    [createsP2PLedger, 'P2P_LEDGER_FORBIDDEN'],
    [createsRouteAuthority, 'ROUTE_AUTHORITY_FORBIDDEN'],
    [createsGpsAuthority, 'GPS_AUTHORITY_FORBIDDEN'],
  ];
  for (const [blocked, reason] of forbidden) {
    if (blocked) return Object.freeze({ valid: false, reason });
  }
  return Object.freeze({ valid: true, reason: 'P2P_DELIVERY_BOUNDARY_VALIDATED' });
}

export function p2pDeliveryContract() {
  return Object.freeze({
    version: P2P_DELIVERY_CONTRACT_VERSION,
    stages: STAGES,
    service_profile: 'P2P_DELIVERY',
    request_authority: 'existing_application_context',
    sender_verification_authority: 'identity_compliance',
    recipient_context_authority: 'locations_and_existing_customer_context',
    item_requirements_authority: 'existing_application_context',
    courier_eligibility_authority: 'logistics_coordination',
    capacity_matching_authority: 'logistics_coordination',
    assignment_authority: 'logistics-pack',
    pickup_otp_authority: 'existing_identity_or_authorization_evidence',
    movement_authority: 'existing_movement',
    delivery_otp_authority: 'existing_identity_or_authorization_evidence',
    proof_authority: 'existing_delivery_proof',
    persistence: 'existing_domain_state_only',
    operational_workspace: 'existing_logistics_workspace',
  });
}

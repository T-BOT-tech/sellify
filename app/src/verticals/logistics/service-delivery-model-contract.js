// Logistics service delivery-model contract.
// Customer intake semantics only: canonical Order, Payment Core, Fulfillment,
// scheduling, and courier assignment remain their existing authorities.
export const LOGISTICS_DELIVERY_MODELS = Object.freeze(['request', 'instant']);
export const LOGISTICS_SERVICE_DELIVERY_CONTRACT_VERSION = '1.0';

const FORBIDDEN_AUTHORITY_FIELDS = new Set([
  'order_id', 'orderId', 'payment_id', 'paymentId',
  'fulfillment_id', 'fulfillmentId', 'assignment_id', 'assignmentId',
  'courier_id', 'courierId', 'provider_id', 'providerId',
]);

function invalid(message, code = 'LOGISTICS_SERVICE_DELIVERY_INVALID') {
  const error = new TypeError(message);
  error.code = code;
  throw error;
}
function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}

/** Normalize customer-facing logistics service choice; this creates no business record. */
export function normalizeLogisticsServiceDelivery(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Logistics service delivery input must be an object');
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_AUTHORITY_FIELDS.has(key)) {
      invalid(`Service delivery input cannot set authority field: ${key}`, 'LOGISTICS_SERVICE_DELIVERY_AUTHORITY_FIELD_FORBIDDEN');
    }
  }
  const itemType = requiredText(input.item_type ?? input.itemType, 'item_type').toLowerCase();
  if (itemType !== 'service') invalid('Logistics delivery must reference a service catalog item', 'LOGISTICS_SERVICE_DELIVERY_REQUIRES_SERVICE');
  const serviceProfile = requiredText(input.service_profile ?? input.serviceProfile, 'service_profile').toUpperCase();
  if (!['B2C_DELIVERY', 'P2P_DELIVERY', 'B2B_DISTRIBUTION', 'REGIONAL_FREIGHT'].includes(serviceProfile)) {
    invalid(`Unsupported logistics service profile: ${serviceProfile}`);
  }
  const deliveryModel = requiredText(input.delivery_model ?? input.deliveryModel, 'delivery_model').toLowerCase();
  if (!LOGISTICS_DELIVERY_MODELS.includes(deliveryModel)) invalid(`delivery_model must be one of: ${LOGISTICS_DELIVERY_MODELS.join(', ')}`);
  return Object.freeze({
    contract_version: LOGISTICS_SERVICE_DELIVERY_CONTRACT_VERSION,
    item_type: 'service',
    service_profile: serviceProfile,
    delivery_model: deliveryModel,
    customer_commitment: deliveryModel === 'instant'
      ? 'check_eligibility_and_availability_before_acceptance'
      : 'request_details_and_assess_before_confirmation',
    assignment_guaranteed: false,
    order_authority: 'canonical_commerce_order',
    payment_authority: 'payment_core',
    fulfillment_authority: 'canonical_fulfillment_and_logistics',
    persistence: 'none',
    mutation_authority: 'none',
  });
}
export function logisticsServiceDeliveryContract() {
  return Object.freeze({
    version: LOGISTICS_SERVICE_DELIVERY_CONTRACT_VERSION,
    delivery_models: LOGISTICS_DELIVERY_MODELS,
    purpose: 'customer intake semantics for logistics service catalog items',
    order_authority: 'canonical_commerce_order',
    payment_authority: 'payment_core',
    fulfillment_authority: 'canonical_fulfillment_and_logistics',
    assignment_authority: 'existing logistics delivery assignment',
    quote_authority: 'existing commercial pricing/quote authority when applicable',
    persists: false,
    creates_order: false,
    creates_payment: false,
    assigns_courier: false,
  });
}

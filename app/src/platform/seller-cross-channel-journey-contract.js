// FUX-29 — Full seller cross-channel golden journey.
// This is a traceability contract, not a workflow/transaction engine.
export const SELLER_GOLDEN_JOURNEY_STEPS = Object.freeze([
  { id:'organization', authority:'identity', action:'seller_identity_ready' },
  { id:'catalog', authority:'commerce', action:'catalog_published' },
  { id:'channel_configuration', authority:'seller_channel_configuration', action:'channel_configured' },
  { id:'channel_publication', authority:'seller_channel_configuration', action:'channel_published' },
  { id:'buyer_discovery', authority:'commerce', action:'product_discovered' },
  { id:'cart', authority:'channel_experience_state', action:'cart_prepared' },
  { id:'checkout', authority:'commerce', action:'checkout_submitted' },
  { id:'order', authority:'commerce', action:'order_created' },
  { id:'payment', authority:'payments', action:'payment_processed' },
  { id:'fulfillment', authority:'fulfillment', action:'fulfillment_progressed' },
  { id:'delivery', authority:'logistics', action:'delivery_progressed' },
  { id:'seller_operations', authority:'existing_sellify_domains', action:'seller_operational_visibility' },
]);

export const SELLER_GOLDEN_JOURNEY_INVARIANTS = Object.freeze([
  'ONE_SELLER_ORGANIZATION',
  'ONE_CANONICAL_PRODUCT',
  'ONE_CANONICAL_ORDER',
  'ONE_CANONICAL_PAYMENT',
  'ONE_CANONICAL_FULFILLMENT',
  'ONE_CANONICAL_LOGISTICS',
  'CHANNEL_CONFIGURATION_IS_NOT_BUSINESS_AUTHORITY',
  'CHANNEL_CART_IS_NOT_ORDER_AUTHORITY',
  'CHANNEL_FAILURE_MUST_NOT_CORRUPT_CORE',
  'TENANT_ISOLATION',
  'IDEMPOTENT_CHECKOUT',
]);

export function buildSellerGoldenJourneyTrace(overrides = {}) {
  return SELLER_GOLDEN_JOURNEY_STEPS.map(step => ({
    ...step,
    status: overrides[step.id] || 'NOT_EXECUTED',
  }));
}

export function evaluateSellerGoldenJourney(trace = []) {
  const byId = new Map(trace.map(step => [step.id, step]));
  const checks = SELLER_GOLDEN_JOURNEY_STEPS.map(step => ({
    id: `STEP_${step.id.toUpperCase()}`,
    pass: byId.get(step.id)?.status === 'PASS',
  }));
  return { status: checks.every(x => x.pass) ? 'PASS' : 'INCOMPLETE', checks };
}

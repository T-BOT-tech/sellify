// Phase 21.9 — Sourcing → Procurement / Commerce handoff boundary.
// Phase 21 remains a derived intelligence/sourcing layer. Actual procurement
// demand, RFQ/award and B2B/Commerce order creation remain owned by their
// canonical authorities. This module only translates an eligible sourcing
// opportunity into a canonical capability request; it does not execute it.

const ALLOWED_OPPORTUNITY_STATES = Object.freeze([
  'ELIGIBLE',
  'CONDITIONAL',
]);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
}

function positiveInteger(value, field) {
  const result = Number(value);
  if (!Number.isInteger(result) || result <= 0) {
    throw new TypeError(`${field} must be a positive integer`);
  }
  return result;
}

function assertOpportunity(opportunity) {
  if (!opportunity || typeof opportunity !== 'object') {
    throw new TypeError('Sourcing Opportunity is required');
  }
  const state = String(opportunity.status ?? opportunity.state ?? '').trim().toUpperCase();
  if (!ALLOWED_OPPORTUNITY_STATES.includes(state)) {
    throw new TypeError('Only eligible or conditional sourcing opportunities may be handed off');
  }
  if (state === 'CONDITIONAL' && opportunity.authorizationStatus === 'AUTHORIZED') {
    throw new TypeError('Conditional sourcing opportunity cannot claim authorization');
  }
  return state;
}

function reference(value, field) {
  return text(value?.id ?? value?.reference ?? value, field);
}

export function buildProcurementDemandHandoff({ opportunity, demandRequirement, procurementCapability = 'procurement.demand' } = {}) {
  const state = assertOpportunity(opportunity);
  if (!demandRequirement || typeof demandRequirement !== 'object') {
    throw new TypeError('Demand Requirement is required');
  }
  const demandReference = reference(demandRequirement, 'Demand Requirement reference');
  const opportunityReference = reference(opportunity, 'Sourcing Opportunity reference');
  const commodityReference = reference(demandRequirement.commodity ?? demandRequirement.commodityReference, 'Commodity reference');
  const quantity = positiveInteger(demandRequirement.quantity, 'Demand quantity');
  const unit = text(demandRequirement.unit, 'Demand unit');

  return Object.freeze({
    handoff_type: 'PROCUREMENT_DEMAND_REQUEST',
    capability: text(procurementCapability, 'Procurement capability'),
    execution: 'DELEGATE_TO_EXISTING_PROCUREMENT_AUTHORITY',
    opportunity_reference: opportunityReference,
    demand_reference: demandReference,
    commodity_reference: commodityReference,
    quantity,
    unit,
    conditional: state === 'CONDITIONAL',
    source_authority: 'phase21_sourcing',
    target_authority: 'procurement',
    creates_procurement_demand: false,
    creates_rfq: false,
    creates_award: false,
    creates_purchase_order: false,
    mutates_inventory: false,
    mutates_payment: false,
    mutates_commerce_order: false,
  });
}

export function buildCommerceHandoff({ opportunity, commerceCapability = 'commerce.order' } = {}) {
  const state = assertOpportunity(opportunity);
  if (state !== 'ELIGIBLE') {
    throw new TypeError('Commerce order handoff requires an eligible sourcing opportunity');
  }
  const opportunityReference = reference(opportunity, 'Sourcing Opportunity reference');
  const productReference = reference(opportunity.productReference ?? opportunity.product, 'Product reference');
  const quantity = positiveInteger(opportunity.quantity, 'Opportunity quantity');

  return Object.freeze({
    handoff_type: 'COMMERCE_ORDER_REQUEST',
    capability: text(commerceCapability, 'Commerce capability'),
    execution: 'DELEGATE_TO_EXISTING_COMMERCE_AUTHORITY',
    opportunity_reference: opportunityReference,
    product_reference: productReference,
    quantity,
    source_authority: 'phase21_sourcing',
    target_authority: 'commerce',
    creates_order: false,
    mutates_inventory: false,
    mutates_payment: false,
    creates_procurement_award: false,
  });
}

export function phase21ProcurementCommerceHandoffContract() {
  return Object.freeze({
    version: '1.0',
    phase: '21.9',
    authority: 'phase21_coordination_boundary',
    procurementAuthority: 'existing_procurement',
    commerceAuthority: 'existing_commerce',
    procurementDemandCreation: 'existing_procurement_authority_only',
    rfqCreation: 'existing_procurement_authority_only',
    awardCreation: 'existing_procurement_authority_only',
    purchaseOrderCreation: 'existing_b2b_purchase_order_authority_only',
    commerceOrderCreation: 'existing_commerce_order_authority_only',
    inventoryAuthority: 'existing_inventory',
    paymentAuthority: 'existing_payment_core',
    execution: 'delegation_only',
    persistence: 'none',
    authorization: 'existing_target_authority',
    aiExecution: false,
    providerExecution: false,
  });
}

export const PHASE21_PROCUREMENT_COMMERCE_HANDOFF_CONTRACT = Object.freeze(
  phase21ProcurementCommerceHandoffContract(),
);

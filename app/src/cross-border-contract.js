import { getCountryPack } from './country-pack-contract.js';
import { resolveCrossRegionBoundary, regionsForCountry } from './cross-region-integration-contract.js';

// Phase 20.1 — Cross-Border Commerce Coordination Constitution.
//
// This module freezes the cross-border vocabulary and ownership boundary before
// any cross-border execution is introduced. It composes existing authorities;
// it does not create a second commerce, inventory, payment, settlement,
// logistics, document, tax, compliance, identity, event, or audit authority.
//
// Flow:
// Discovery → Cross-Border Coordination → Existing Domain Authority
//
// Phase 20.1 is persistence-free and mutation-free.

export const CROSS_BORDER_CONTRACT_VERSION = '1.0';

export const CROSS_BORDER_RESULTS = Object.freeze({
  FEASIBLE: 'feasible',
  CONDITIONALLY_FEASIBLE: 'conditionally_feasible',
  NOT_FEASIBLE: 'not_feasible',
  UNKNOWN: 'unknown',
});

export const CROSS_BORDER_REQUIREMENT_STATUS = Object.freeze({
  REQUIRED: 'required',
  SATISFIED: 'satisfied',
  MISSING: 'missing',
  UNKNOWN: 'unknown',
  EXPIRED: 'expired',
  NOT_APPLICABLE: 'not_applicable',
});

export const CROSS_BORDER_FAILURE_STATES = Object.freeze({
  SUCCESS: 'success',
  RETRYABLE_FAILURE: 'retryable_failure',
  PERMANENT_FAILURE: 'permanent_failure',
  REVIEW_REQUIRED: 'review_required',
  BLOCKED: 'blocked',
  UNKNOWN: 'unknown',
});

export const CROSS_BORDER_AUTHORITY_MAP = Object.freeze({
  organization: 'organization',
  product: 'commerce',
  marketplace: 'marketplace',
  supplier: 'supplier_network',
  discovery: 'discovery',
  inventory: 'inventory',
  commerce: 'commerce',
  procurement: 'procurement',
  payments: 'payments',
  settlement: 'existing_payment_settlement_authority',
  fulfillment: 'fulfillment',
  logistics: 'logistics',
  documents: 'documents',
  country: 'country',
  tax: 'country_or_existing_tax_authority',
  customs: 'applicable_external_customs_authority',
  compliance: 'country_or_existing_compliance_authority',
  fx: 'external_fx_provider_via_adapter',
  identity: 'existing_identity_authority',
  authorization: 'existing_authorization_authority',
  events: 'existing_event_outbox_authority',
  audit: 'existing_audit_authority',
});

export const CROSS_BORDER_CONSTITUTION = Object.freeze({
  version: CROSS_BORDER_CONTRACT_VERSION,
  identity: 'cross_border_commerce_coordination',
  purpose: 'coordinate cross-border commercial flows without creating duplicate domain authority',
  persistence: 'none',
  mutation: 'none',
  transactionAuthority: 'existing_domain_transaction',
  authorization: 'existing_authorization',
  eventStorage: 'existing_outbox_only',
  providerExecution: 'canonical_contract_to_adapter_to_provider',
  aiExecution: 'translation_only',
  discoveryExecution: 'read_only_derived',
  unknownIsSuccess: false,
  feasibilityIsAuthorization: false,
  authorizationIsExecution: false,
  executionIsCoordination: false,
  duplicateAuthority: false,
});

const text = (value, field) => {
  const result = String(value ?? '').trim();
  if (!result) throw Object.assign(new TypeError(`${field} must be a non-empty string`), {
    code: 'CROSS_BORDER_CONTRACT_INVALID',
  });
  return result;
};

const country = (value, field) => {
  const result = text(value, field).toUpperCase();
  if (!/^[A-Z]{2}$/.test(result)) {
    throw Object.assign(new TypeError(`${field} must use ISO-like alpha-2 country shape`), {
      code: 'CROSS_BORDER_COUNTRY_INVALID',
    });
  }
  return result;
};

const reference = (value, field) => {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new TypeError(`${field} must be an object or null`), {
      code: 'CROSS_BORDER_REFERENCE_INVALID',
    });
  }
  const result = { ...value };
  if (result.id != null) result.id = text(result.id, `${field}.id`);
  if (result.type != null) result.type = text(result.type, `${field}.type`);
  return Object.freeze(result);
};

function assertNoAuthorityClaims(input = {}) {
  const forbidden = [
    'ownsCommerce', 'ownsInventory', 'ownsPayments', 'ownsSettlement',
    'ownsFulfillment', 'ownsLogistics', 'ownsDocuments', 'ownsTax',
    'ownsCustoms', 'ownsCompliance', 'ownsIdentity', 'ownsAuthorization',
    'ownsEvents', 'ownsAudit', 'ownsLedger', 'ownsDatabase', 'ownsPersistence',
    'ownsTransactionEngine', 'database', 'store', 'ledger', 'eventStore',
    'broker', 'transactionEngine',
  ];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      throw Object.assign(new Error(`Cross-border coordination cannot declare ${key}`), {
        code: 'CROSS_BORDER_DUPLICATE_AUTHORITY',
      });
    }
  }
}

export function buildTradeLane({ origin, destination, scope = 'cross_border', capabilities = {}, requirements = [], provenance = null } = {}) {
  const from = country(origin, 'origin');
  const to = country(destination, 'destination');
  if (from === to) throw Object.assign(new Error('Trade lane must cross country boundaries'), { code: 'CROSS_BORDER_SAME_COUNTRY' });
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    throw new TypeError('capabilities must be an object');
  }
  if (!Array.isArray(requirements)) throw new TypeError('requirements must be an array');

  return Object.freeze({
    contractVersion: CROSS_BORDER_CONTRACT_VERSION,
    origin: from,
    destination: to,
    scope: text(scope, 'scope'),
    capabilities: Object.freeze({ ...capabilities }),
    requirements: Object.freeze(requirements.map((item) => Object.freeze({ ...item }))),
    provenance: reference(provenance, 'provenance'),
    persistent: false,
    authoritative: false,
  });
}


export function resolveTradeLane({ origin, destination, scope = 'cross_border', provenance = null } = {}) {
  const from = country(origin, 'origin');
  const to = country(destination, 'destination');
  if (from === to) {
    throw Object.assign(new Error('Trade lane must cross country boundaries'), {
      code: 'CROSS_BORDER_SAME_COUNTRY',
    });
  }

  // Country packs and the existing cross-region boundary remain the canonical
  // sources for country/region capability metadata. This function composes
  // them into a derived lane; it does not activate countries or create state.
  const boundary = resolveCrossRegionBoundary({ fromCountry: from, toCountry: to });
  const fromPack = getCountryPack(from);
  const toPack = getCountryPack(to);
  const fromRegions = regionsForCountry(from);
  const toRegions = regionsForCountry(to);
  const sharedRegions = fromRegions.filter((region) => toRegions.includes(region));

  return buildTradeLane({
    origin: from,
    destination: to,
    scope,
    capabilities: {
      countryOverlay: true,
      originCountryPack: fromPack.countryCode,
      destinationCountryPack: toPack.countryCode,
      originCurrency: fromPack.currency,
      destinationCurrency: toPack.currency,
      originPaymentProviders: [...(fromPack.paymentProviders?.providers || [])],
      destinationPaymentProviders: [...(toPack.paymentProviders?.providers || [])],
      sharedRegions: [...sharedRegions],
      crossRegionIntegration: boundary.integrationMode,
    },
    requirements: [
      { type: 'country_overlay', status: CROSS_BORDER_REQUIREMENT_STATUS.REQUIRED },
    ],
    provenance,
  });
}

export function buildCrossBorderOpportunity({ opportunityId, discoveryOpportunity, origin, destination, productReference = null, supplierReference = null, quantity = null, tradeLaneReference = null, provenance = null } = {}) {
  const id = text(opportunityId, 'opportunityId');
  if (!discoveryOpportunity || typeof discoveryOpportunity !== 'object' || Array.isArray(discoveryOpportunity)) {
    throw new TypeError('discoveryOpportunity must be an object');
  }
  const from = country(origin, 'origin');
  const to = country(destination, 'destination');
  if (from === to) throw Object.assign(new Error('Cross-border opportunity must cross country boundaries'), { code: 'CROSS_BORDER_SAME_COUNTRY' });

  return Object.freeze({
    contractVersion: CROSS_BORDER_CONTRACT_VERSION,
    opportunityId: id,
    derived: true,
    persistent: false,
    discoveryOpportunity: Object.freeze({ ...discoveryOpportunity }),
    origin: from,
    destination: to,
    productReference: reference(productReference, 'productReference'),
    supplierReference: reference(supplierReference, 'supplierReference'),
    quantity: quantity == null ? null : Number(quantity),
    tradeLaneReference: reference(tradeLaneReference, 'tradeLaneReference'),
    provenance: reference(provenance, 'provenance'),
    execution: 'owning_domain_required',
    createsOrder: false,
    mutatesInventory: false,
    mutatesPayment: false,
    mutatesProcurement: false,
  });
}

export function buildCrossBorderPlan({ opportunity, tradeLane, requirements = [], evidence = [], feasibility = null, references = {}, provenance = null } = {}) {
  if (!opportunity || typeof opportunity !== 'object') throw new TypeError('opportunity must be an object');
  if (!tradeLane || typeof tradeLane !== 'object') throw new TypeError('tradeLane must be an object');
  if (!Array.isArray(requirements) || !Array.isArray(evidence)) throw new TypeError('requirements and evidence must be arrays');
  if (feasibility !== null && (typeof feasibility !== 'object' || Array.isArray(feasibility))) throw new TypeError('feasibility must be an object or null');
  assertNoAuthorityClaims(references);

  return Object.freeze({
    contractVersion: CROSS_BORDER_CONTRACT_VERSION,
    derived: true,
    persistent: false,
    opportunityReference: reference({ id: opportunity.opportunityId, type: 'cross_border_opportunity' }, 'opportunityReference'),
    tradeLaneReference: reference({ origin: tradeLane.origin, destination: tradeLane.destination, type: 'trade_lane' }, 'tradeLaneReference'),
    requirements: Object.freeze(requirements.map((item) => Object.freeze({ ...item }))),
    evidence: Object.freeze(evidence.map((item) => Object.freeze({ ...item }))),
    feasibility: feasibility ? Object.freeze({ ...feasibility }) : null,
    references: Object.freeze({ ...references }),
    provenance: reference(provenance, 'provenance'),
    actionExecution: false,
    owningDomainExecutesActions: true,
  });
}

export function crossBorderContract() {
  return CROSS_BORDER_CONSTITUTION;
}

export function assertCrossBorderBoundary() {
  const contract = crossBorderContract();
  if (contract.persistence !== 'none' || contract.mutation !== 'none') {
    throw new Error('Cross-border coordination must remain persistence-free and mutation-free at 20.1');
  }
  if (contract.transactionAuthority !== 'existing_domain_transaction') {
    throw new Error('Cross-border coordination cannot own transaction authority');
  }
  if (contract.authorization !== 'existing_authorization') {
    throw new Error('Cross-border coordination must use existing authorization');
  }
  if (contract.eventStorage !== 'existing_outbox_only') {
    throw new Error('Cross-border coordination must use existing outbox only');
  }
  if (contract.duplicateAuthority) throw new Error('Cross-border coordination cannot create duplicate authority');
  if (contract.unknownIsSuccess) throw new Error('UNKNOWN cannot be treated as SUCCESS');
  return contract;
}

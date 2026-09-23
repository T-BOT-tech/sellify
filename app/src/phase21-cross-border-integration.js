// Phase 21.11 — Cross-Border Integration.
// Composition-only bridge from Phase 21 sourcing intelligence into the
// already-existing Phase 20 cross-border coordination contracts.
//
// Phase 21 remains the sourcing-intelligence authority; Phase 20 remains the
// cross-border coordination/evaluation authority. This module owns neither
// trade lanes nor country/currency/logistics/payment execution.

import {
  buildTradeLane,
  buildCrossBorderPlan,
} from './cross-border-contract.js';
import { buildCrossBorderMarketContext } from './cross-border-market-context.js';
import { resolveCrossBorderCurrencyContext } from './cross-border-currency-context.js';
import { buildCrossBorderCommercialContext } from './cross-border-commercial-context.js';
import { buildTradeRequirementAssessment } from './cross-border-trade-evidence.js';
import { evaluateCrossBorder } from './cross-border-evaluation.js';

export const PHASE21_CROSS_BORDER_INTEGRATION_VERSION = '1.0';

const VALID_SOURCING_STATUSES = new Set([
  'ELIGIBLE', 'CONDITIONAL', 'PARTIAL', 'NOT_ELIGIBLE', 'UNKNOWN',
]);

function invalid(message) {
  const error = new TypeError(`Invalid Phase 21 cross-border integration: ${message}`);
  error.code = 'PHASE21_CROSS_BORDER_INTEGRATION_INVALID';
  throw error;
}

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) invalid(`${field} must be a non-empty string`);
  return result;
}

function country(value, field) {
  const result = text(value, field).toUpperCase();
  if (!/^[A-Z]{2}$/.test(result)) invalid(`${field} must use ISO-like alpha-2 country shape`);
  return result;
}

function reference(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be an object`);
  const id = text(value.id, `${field}.id`);
  return Object.freeze({
    id,
    ...(value.authority ? { authority: text(value.authority, `${field}.authority`) } : {}),
    ...(value.entity ? { entity: text(value.entity, `${field}.entity`) } : {}),
  });
}

function countryFrom(value, field) {
  if (typeof value === 'string') return country(value, field);
  if (value && typeof value === 'object') return country(value.countryCode ?? value.country, field);
  invalid(`${field} is required`);
}

function clone(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(clone));
  if (typeof value !== 'object') return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)])));
}

function assertSourcingOpportunity(opportunity) {
  if (!opportunity || typeof opportunity !== 'object' || Array.isArray(opportunity)) {
    invalid('sourcingOpportunity is required');
  }
  if (opportunity.derived !== true) invalid('sourcingOpportunity must be a derived Phase 21 opportunity');
  if (opportunity.persistence !== 'none') invalid('sourcingOpportunity must be non-persistent');
  if (opportunity.authorization !== false || opportunity.orderCreation !== false || opportunity.procurementAward !== false) {
    invalid('sourcingOpportunity cannot carry execution authority');
  }
  if (!VALID_SOURCING_STATUSES.has(opportunity.status)) invalid(`unsupported sourcing opportunity status: ${opportunity.status}`);
  text(opportunity.opportunityId, 'sourcingOpportunity.opportunityId');
}

/**
 * Project an existing Phase 21 sourcing opportunity into the Phase 20
 * cross-border coordination boundary. No transaction is created.
 */
export function projectSourcingOpportunityToCrossBorder({
  sourcingOpportunity,
  origin,
  destination,
  marketContext = null,
  currencyContext = null,
  commercialContext = null,
  tradeLane = null,
  provenance = null,
} = {}) {
  assertSourcingOpportunity(sourcingOpportunity);
  const from = countryFrom(origin ?? sourcingOpportunity.origin, 'origin');
  const to = countryFrom(destination ?? sourcingOpportunity.destination, 'destination');
  if (from === to) invalid('origin and destination must be different countries');

  const lane = tradeLane ?? buildTradeLane({ origin: from, destination: to, provenance });
  if (lane.origin !== from || lane.destination !== to) invalid('tradeLane does not match origin/destination');

  return Object.freeze({
    version: PHASE21_CROSS_BORDER_INTEGRATION_VERSION,
    sourcingOpportunityReference: Object.freeze({
      authority: 'phase21',
      entity: 'SourcingOpportunity',
      id: sourcingOpportunity.opportunityId,
    }),
    origin: from,
    destination: to,
    tradeLaneReference: Object.freeze({ type: 'trade_lane', origin: lane.origin, destination: lane.destination }),
    marketContext: clone(marketContext),
    currencyContext: clone(currencyContext),
    commercialContext: clone(commercialContext),
    provenance: clone(provenance),
    sourcingStatus: sourcingOpportunity.status,
    crossBorderCoordination: true,
    persistent: false,
    mutation: false,
    authorization: false,
    execution: false,
    createsOrder: false,
    mutatesInventory: false,
    mutatesPayment: false,
    mutatesProcurement: false,
    phase20Authority: 'existing Phase 20 cross-border coordination',
    phase21Authority: 'derived sourcing opportunity',
  });
}

/**
 * Compose Phase 20 market/currency/commercial contexts without making any of
 * those contexts authoritative inside Phase 21.
 */
export function buildPhase21CrossBorderContext({
  sourcingOpportunity,
  origin,
  destination,
  originMarket = null,
  destinationMarket = null,
  transactionCurrency = null,
  settlementCurrency = null,
  displayCurrency = null,
  fxReference = null,
  fxState = undefined,
  commercialObservations = [],
  tradeLane = null,
  provenance = null,
} = {}) {
  const from = countryFrom(origin ?? sourcingOpportunity?.origin, 'origin');
  const to = countryFrom(destination ?? sourcingOpportunity?.destination, 'destination');
  if (from === to) invalid('origin and destination must be different countries');

  const lane = tradeLane ?? buildTradeLane({ origin: from, destination: to, provenance });
  const context = {};
  if (originMarket || destinationMarket) {
    if (!originMarket || !destinationMarket) invalid('originMarket and destinationMarket must be supplied together');
    context.marketContext = buildCrossBorderMarketContext({
      origin: { ...originMarket, countryCode: from },
      destination: { ...destinationMarket, countryCode: to },
      tradeLane: lane,
      provenance,
    });
  }
  if (transactionCurrency || settlementCurrency || displayCurrency || fxReference || fxState !== undefined) {
    context.currencyContext = resolveCrossBorderCurrencyContext({
      origin: from,
      destination: to,
      transactionCurrency,
      settlementCurrency,
      displayCurrency,
      fxReference,
      ...(fxState === undefined ? {} : { fxState }),
      provenance,
    });
  }
  if (commercialObservations.length || context.currencyContext) {
    context.commercialContext = buildCrossBorderCommercialContext({
      origin: from,
      destination: to,
      currencyContext: context.currencyContext,
      observations: commercialObservations,
      provenance,
    });
  }
  return projectSourcingOpportunityToCrossBorder({
    sourcingOpportunity,
    origin: from,
    destination: to,
    marketContext: context.marketContext ?? null,
    currencyContext: context.currencyContext ?? null,
    commercialContext: context.commercialContext ?? null,
    tradeLane: lane,
    provenance,
  });
}

/**
 * Evaluate a Phase 21 sourcing opportunity using the existing deterministic
 * Phase 20 evaluator. Phase 21 supplies sourcing context; Phase 20 owns the
 * cross-border feasibility decision.
 */
export function evaluateSourcingOpportunityCrossBorder({
  integrationContext,
  commercial = null,
  capacity = null,
  qualification = null,
  requirements = null,
  currency = null,
  logistics = null,
  payment = null,
  provenance = null,
  evaluatedAt = null,
} = {}) {
  if (!integrationContext || typeof integrationContext !== 'object') invalid('integrationContext is required');
  const evaluation = evaluateCrossBorder({
    opportunityReference: integrationContext.sourcingOpportunityReference,
    origin: integrationContext.origin,
    destination: integrationContext.destination,
    commercial,
    capacity,
    qualification,
    requirements,
    currency,
    logistics,
    payment,
    provenance,
    evaluatedAt,
  });
  return Object.freeze({
    version: PHASE21_CROSS_BORDER_INTEGRATION_VERSION,
    sourcingOpportunityReference: integrationContext.sourcingOpportunityReference,
    origin: integrationContext.origin,
    destination: integrationContext.destination,
    evaluation,
    persistent: false,
    mutation: false,
    authorization: false,
    execution: false,
    procurementAward: false,
    orderCreation: false,
    providerExecution: false,
    authority: 'Phase 20 derived cross-border evaluation',
  });
}

/**
 * Build the Phase 20 coordination plan around a Phase 21 sourcing opportunity.
 * The plan is still derived; actual actions remain with the owning domains.
 */
export function buildSourcingCrossBorderPlan({
  integrationContext,
  requirements = [],
  evidence = [],
  feasibility = null,
  references = {},
  provenance = null,
} = {}) {
  if (!integrationContext || typeof integrationContext !== 'object') invalid('integrationContext is required');
  const tradeLane = buildTradeLane({
    origin: integrationContext.origin,
    destination: integrationContext.destination,
    provenance,
  });
  const safeReferences = {
    sourcingOpportunity: integrationContext.sourcingOpportunityReference,
    ...references,
  };
  const plan = buildCrossBorderPlan({
    opportunity: { opportunityId: integrationContext.sourcingOpportunityReference.id },
    tradeLane,
    requirements,
    evidence,
    feasibility,
    references: safeReferences,
    provenance,
  });
  return Object.freeze({
    version: PHASE21_CROSS_BORDER_INTEGRATION_VERSION,
    sourcingOpportunityReference: integrationContext.sourcingOpportunityReference,
    plan,
    persistent: false,
    mutation: false,
    authorization: false,
    execution: false,
    owningDomainExecutesActions: true,
  });
}

/**
 * Project trade-requirement evidence using Phase 20's existing evidence
 * authority. This is deliberately exposed as an integration helper only.
 */
export function assessSourcingTradeRequirements({ requirements = [], evidence = [], now = new Date() } = {}) {
  return buildTradeRequirementAssessment({ requirements, evidence, now });
}

export function phase21CrossBorderIntegrationContract() {
  return Object.freeze({
    version: PHASE21_CROSS_BORDER_INTEGRATION_VERSION,
    source: 'Phase 21 Sourcing Opportunity',
    destination: 'Phase 20 Cross-Border Commerce Coordination',
    phase21Authority: 'derived sourcing intelligence',
    phase20Authority: 'cross-border coordination and deterministic evaluation',
    tradeLaneAuthority: 'Phase 20 cross-border contract',
    countryAuthority: 'existing country-pack authority',
    currencyAuthority: 'existing currency-money authority plus external FX adapter',
    logisticsAuthority: 'existing fulfillment/logistics plus Phase 20 feasibility composition',
    paymentAuthority: 'existing Payment Core',
    persistence: 'none',
    mutation: false,
    authorization: false,
    execution: false,
    createsOrder: false,
    mutatesInventory: false,
    mutatesPayment: false,
    mutatesProcurement: false,
    duplicateAuthority: false,
    unknownIsSuccess: false,
    feasibilityIsAuthorization: false,
    principle: 'connect sourcing opportunities to existing cross-border coordination without duplicating Phase 20 or transaction authority',
  });
}

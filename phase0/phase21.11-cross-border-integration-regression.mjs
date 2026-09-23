import assert from 'node:assert/strict';
import {
  projectSourcingOpportunityToCrossBorder,
  buildPhase21CrossBorderContext,
  evaluateSourcingOpportunityCrossBorder,
  buildSourcingCrossBorderPlan,
  assessSourcingTradeRequirements,
  phase21CrossBorderIntegrationContract,
} from '../app/src/phase21-cross-border-integration.js';

let pass = 0;
function ok(name, fn) { fn(); console.log(`PASS: ${name}`); pass += 1; }
function throws(name, fn) { assert.throws(fn); console.log(`PASS: ${name}`); pass += 1; }

const sourcingOpportunity = Object.freeze({
  opportunityId: 'sourcing-1',
  status: 'ELIGIBLE',
  derived: true,
  persistence: 'none',
  authorization: false,
  orderCreation: false,
  procurementAward: false,
  origin: { country: 'ET' },
  destination: { country: 'DJ' },
});

ok('projects a Phase 21 sourcing opportunity into Phase 20', () => {
  const result = projectSourcingOpportunityToCrossBorder({ sourcingOpportunity, origin: 'ET', destination: 'DJ' });
  assert.equal(result.sourcingOpportunityReference.id, 'sourcing-1');
  assert.equal(result.origin, 'ET');
  assert.equal(result.destination, 'DJ');
  assert.equal(result.persistent, false);
  assert.equal(result.execution, false);
});

ok('rejects same-country integration', () => throws('same country', () => projectSourcingOpportunityToCrossBorder({ sourcingOpportunity, origin: 'ET', destination: 'ET' })));

ok('composes existing market and currency context', () => {
  const result = buildPhase21CrossBorderContext({
    sourcingOpportunity,
    origin: 'ET',
    destination: 'KE',
    originMarket: { countryCode: 'ET', commercialMode: 'B2B', quantity: 500, unit: 'kg' },
    destinationMarket: { countryCode: 'KE', commercialMode: 'B2B', quantity: 500, unit: 'kg' },
    transactionCurrency: 'ETB',
  });
  assert.equal(result.marketContext.origin.countryCode, 'ET');
  assert.equal(result.marketContext.destination.countryCode, 'KE');
  assert.equal(result.currencyContext.transactionCurrency, 'ETB');
  assert.equal(result.commercialContext.origin, 'ET');
  assert.equal(result.persistent, false);
});

ok('uses Phase 20 deterministic evaluation', () => {
  const context = projectSourcingOpportunityToCrossBorder({ sourcingOpportunity, origin: 'ET', destination: 'KE' });
  const result = evaluateSourcingOpportunityCrossBorder({
    integrationContext: context,
    commercial: 'FEASIBLE',
    capacity: 'FEASIBLE',
    qualification: 'FEASIBLE',
    requirements: 'FEASIBLE',
    currency: 'FEASIBLE',
    logistics: 'CONDITIONALLY_FEASIBLE',
    payment: 'FEASIBLE',
  });
  assert.equal(result.evaluation.result, 'conditionally_feasible');
  assert.equal(result.evaluation.deterministic, true);
  assert.equal(result.execution, false);
});

ok('unknown cross-border evidence remains unknown', () => {
  const context = projectSourcingOpportunityToCrossBorder({ sourcingOpportunity, origin: 'ET', destination: 'KE' });
  const result = evaluateSourcingOpportunityCrossBorder({ integrationContext: context, commercial: 'FEASIBLE' });
  assert.equal(result.evaluation.result, 'unknown');
  assert.equal(result.evaluation.failureState, 'unknown');
});

ok('not-feasible evidence blocks without executing', () => {
  const context = projectSourcingOpportunityToCrossBorder({ sourcingOpportunity, origin: 'ET', destination: 'KE' });
  const result = evaluateSourcingOpportunityCrossBorder({
    integrationContext: context,
    commercial: 'FEASIBLE',
    capacity: 'NOT_FEASIBLE',
  });
  assert.equal(result.evaluation.result, 'not_feasible');
  assert.equal(result.evaluation.execution, false);
});

ok('builds a derived Phase 20 plan', () => {
  const context = projectSourcingOpportunityToCrossBorder({ sourcingOpportunity, origin: 'ET', destination: 'KE' });
  const result = buildSourcingCrossBorderPlan({
    integrationContext: context,
    requirements: [{ type: 'customs_review', status: 'required' }],
    evidence: [{ state: 'UNVERIFIED', source: 'test' }],
    feasibility: { result: 'conditionally_feasible' },
  });
  assert.equal(result.plan.persistent, false);
  assert.equal(result.plan.actionExecution, false);
  assert.equal(result.plan.owningDomainExecutesActions, true);
  assert.equal(result.sourcingOpportunityReference.id, 'sourcing-1');
});

ok('reuses Phase 20 trade requirement evidence assessment', () => {
  const result = assessSourcingTradeRequirements({
    requirements: [{ requirementId: 'r1', type: 'document', status: 'required' }],
    evidence: [],
  });
  assert.equal(Array.isArray(result.assessments), true);
  assert.equal(result.assessments[0].status, 'missing');
  assert.equal(result.overall, 'BLOCKED');
});

ok('preserves authority map', () => {
  const contract = phase21CrossBorderIntegrationContract();
  assert.equal(contract.phase21Authority, 'derived sourcing intelligence');
  assert.equal(contract.phase20Authority, 'cross-border coordination and deterministic evaluation');
  assert.equal(contract.paymentAuthority, 'existing Payment Core');
  assert.equal(contract.persistence, 'none');
  assert.equal(contract.mutation, false);
  assert.equal(contract.authorization, false);
  assert.equal(contract.execution, false);
  assert.equal(contract.duplicateAuthority, false);
});

throws('rejects non-derived sourcing input', () => projectSourcingOpportunityToCrossBorder({
  sourcingOpportunity: { ...sourcingOpportunity, derived: false }, origin: 'ET', destination: 'KE',
}));
throws('rejects opportunity carrying execution authority', () => projectSourcingOpportunityToCrossBorder({
  sourcingOpportunity: { ...sourcingOpportunity, orderCreation: true }, origin: 'ET', destination: 'KE',
}));
throws('rejects mismatched trade lane', () => projectSourcingOpportunityToCrossBorder({
  sourcingOpportunity,
  origin: 'ET',
  destination: 'KE',
  tradeLane: { origin: 'ET', destination: 'TZ' },
}));
throws('rejects invalid country', () => projectSourcingOpportunityToCrossBorder({ sourcingOpportunity, origin: 'ETH', destination: 'KE' }));
throws('rejects invalid market context pair', () => buildPhase21CrossBorderContext({
  sourcingOpportunity, origin: 'ET', destination: 'KE', originMarket: { countryCode: 'ET' },
}));

console.log(`PHASE 21.11 CROSS-BORDER INTEGRATION: ${pass} PASS / 0 FAIL`);

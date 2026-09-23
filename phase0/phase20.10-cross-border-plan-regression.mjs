import assert from 'node:assert/strict';
import { buildCrossBorderPlan, crossBorderPlanContract, routeCrossBorderAction } from '../app/src/cross-border-plan.js';

const baseEvaluation = {
  result: 'feasible',
  blockers: [],
  unknown: [],
  review: [],
};

const plan = buildCrossBorderPlan({
  opportunityReference: { id: 'opp-1' },
  evaluation: baseEvaluation,
  tradeLaneReference: { id: 'ET-KE' },
  actions: [{
    actionId: 'a-1',
    type: 'REQUEST_FX_QUOTE',
    targetAuthority: 'fx',
    targetReference: { provider: 'external-fx' },
    reason: 'Obtain an external FX observation',
  }],
});
assert.equal(plan.version, '1.0');
assert.equal(plan.evaluationResult, 'feasible');
assert.equal(plan.actionable, true);
assert.equal(plan.requiresAuthorization, true);
assert.equal(plan.authorization, 'existing_authorization');
assert.equal(plan.execution, 'owning_domain_only');
assert.equal(plan.persistence, 'none');
assert.equal(plan.mutation, false);
assert.equal(plan.transactionCreation, false);
assert.equal(plan.providerExecution, false);
assert.equal(plan.actions[0].requiredAuthorization, true);

const conditional = buildCrossBorderPlan({ evaluation: { result: 'conditionally_feasible', blockers: [], unknown: [], review: [{ dimension: 'requirements' }] }, actions: [] });
assert.equal(conditional.failureState, 'review_required');
assert.equal(conditional.actionable, false);

const blocked = buildCrossBorderPlan({ evaluation: { result: 'not_feasible', blockers: [{ dimension: 'logistics' }], unknown: [], review: [] }, actions: [] });
assert.equal(blocked.failureState, 'blocked');

const unknown = buildCrossBorderPlan({ evaluation: { result: 'unknown', blockers: [], unknown: [{ dimension: 'payment' }], review: [] }, actions: [] });
assert.equal(unknown.failureState, 'unknown');

assert.throws(() => buildCrossBorderPlan({ evaluation: baseEvaluation, actions: [{ type: 'EXECUTE_TRANSACTION', targetAuthority: 'commerce' }] }), /Unsupported action type/);
assert.throws(() => buildCrossBorderPlan({ evaluation: baseEvaluation, actions: [{ type: 'REQUEST_PAYMENT', targetAuthority: 'payments', execute: true }] }), /cannot contain execute/);
assert.throws(() => buildCrossBorderPlan({ evaluation: baseEvaluation, actions: [{ type: 'REQUEST_PAYMENT', targetAuthority: 'payments', persist: true }] }), /cannot contain persist/);
assert.throws(() => routeCrossBorderAction({ type: 'REQUEST_PAYMENT', targetAuthority: 'payments', status: 'recommended' }, { authorize: async () => true, handlers: { payments: () => {} } }), /pending_authorization/);
assert.throws(() => routeCrossBorderAction({ type: 'REQUEST_PAYMENT', targetAuthority: 'payments', status: 'pending_authorization' }, { handlers: { payments: () => {} } }), /authorization function is required/);
assert.throws(() => routeCrossBorderAction({ type: 'REQUEST_PAYMENT', targetAuthority: 'payments', status: 'pending_authorization' }, { authorize: async () => true, handlers: {} }), /no existing handler/);

const routed = routeCrossBorderAction({ type: 'REQUEST_PAYMENT', targetAuthority: 'payments', status: 'pending_authorization' }, { authorize: async () => true, handlers: { payments: () => 'existing-domain-result' } });
assert.equal(routed.authorization, 'existing_authorization');
assert.equal(routed.execution, 'owning_domain_only');
assert.equal(routed.persistence, 'none');
assert.equal(routed.delegated, true);

const contract = crossBorderPlanContract();
assert.equal(contract.persistence, 'none');
assert.equal(contract.mutation, false);
assert.equal(contract.transactionCreation, false);
assert.equal(contract.providerExecution, false);
assert.equal(contract.authorization, 'existing_authorization');
assert.equal(contract.execution, 'owning_domain_only');
assert.equal(contract.feasibilityIsAuthorization, false);
assert.equal(contract.authorizationIsExecution, false);
assert.equal(contract.unknownIsSuccess, false);

console.log('PHASE20.10 CROSS-BORDER PLAN: PASS');
console.log('Tests: 20 PASS / 0 FAIL');

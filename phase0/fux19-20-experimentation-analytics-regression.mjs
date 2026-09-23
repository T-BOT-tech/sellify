import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ANALYTICS_TAXONOMY,
  EXPERIMENT_GUARDRAILS,
  evaluateExperimentGuardrails,
  classifyProductAnalyticsEvent,
  buildProductAnalyticsMetric,
  experimentationAnalyticsContract,
} from '../app/src/experience/experimentation-analytics-contract.js';

assert.deepEqual(ANALYTICS_TAXONOMY, [
  'activation', 'pack_adoption', 'funnel', 'completion', 'efficiency', 'reliability'
]);
assert.equal(EXPERIMENT_GUARDRAILS.length, 7);

const blocked = evaluateExperimentGuardrails({
  authorization: true,
  security_policy: true,
  scope: true,
  canonical_assignment: false,
  canonical_rollout: false,
  audit_evidence: true,
  rollback: true,
});
assert.equal(blocked.state, 'BLOCKED');
assert.equal(blocked.canMutateProduction, false);

const unknown = evaluateExperimentGuardrails({ authorization: true });
assert.equal(unknown.state, 'UNKNOWN');
assert.equal(unknown.canMutateProduction, false);

const ready = evaluateExperimentGuardrails({
  authorization: true,
  security_policy: true,
  scope: true,
  canonical_assignment: true,
  canonical_rollout: true,
  audit_evidence: true,
  rollback: true,
});
assert.equal(ready.state, 'ELIGIBLE');
assert.equal(ready.canMutateProduction, false);

assert.equal(classifyProductAnalyticsEvent({ action: 'pack_activate' }).taxonomy, 'activation');
assert.equal(classifyProductAnalyticsEvent({ action: 'pack_entitlement_read' }).taxonomy, 'pack_adoption');
assert.equal(classifyProductAnalyticsEvent({ action: 'checkout_completed', result: 'success' }).taxonomy, 'completion');
assert.equal(classifyProductAnalyticsEvent({ action: 'request_latency', latencyMs: 42 }).taxonomy, 'efficiency');
assert.equal(classifyProductAnalyticsEvent({ action: 'sync_failed', result: 'failure' }).taxonomy, 'reliability');

const metric = buildProductAnalyticsMetric({
  action: 'checkout_completed',
  result: 'success',
  correlationId: 'corr-1',
  organizationId: 'org-1',
  latencyMs: 125,
});
assert.equal(metric.taxonomy, 'completion');
assert.equal(metric.requestCorrelationId, 'corr-1');
assert.equal(metric.writable, false);
assert.equal(metric.source, 'existing canonical event/audit evidence');

const contract = experimentationAnalyticsContract();
assert.equal(contract.experimentationAuthority, 'canonical experimentation service only');
assert.equal(contract.analyticsAuthority, 'existing canonical event/audit evidence only');
assert.equal(contract.productionMutationFromExperience, false);
assert.equal(contract.duplicateExperimentStore, false);
assert.equal(contract.duplicateAnalyticsStore, false);
assert.equal(contract.duplicateEventStore, false);
assert.equal(contract.duplicateAuditStore, false);

const source = fs.readFileSync(new URL('../app/src/experience/experimentation-analytics-contract.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /CREATE TABLE|INSERT INTO|UPDATE\s+|DELETE FROM|fetch\(/);
assert.match(source, /canonical experimentation service only/);
assert.match(source, /existing canonical event\/audit evidence only/);

console.log('FUX-19/FUX-20 Experimentation + Product Analytics Regression: PASS');
console.log('Experiment business-rule/security guardrails: PASS');
console.log('Experiment assignment/rollout fail-closed boundary: PASS');
console.log('Product analytics taxonomy: PASS');
console.log('Canonical evidence projection: PASS');
console.log('No duplicate analytics/event/audit authority: PASS');
console.log('No production mutation from experience layer: PASS');

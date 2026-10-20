// L11 external feasibility evidence provenance regression.
// FEASIBLE without an identifiable authority and evidence reference must fail closed.
import assert from 'node:assert/strict';
import { evaluateLogisticsSchedulingFeasibility } from '../app/src/verticals/logistics/scheduling-feasibility-contract.js';

const request = {
  organization_id: 'org-external-evidence-test',
  activity_type: 'DELIVERY',
  mode: 'SCHEDULED',
  requested_start: '2026-11-01T06:00:00.000Z',
  requested_end: '2026-11-01T07:00:00.000Z',
  scheduled_start: '2026-11-01T06:00:00.000Z',
  scheduled_end: '2026-11-01T07:00:00.000Z',
  related_order: { id: 'order-external-evidence-test', authority: 'canonical_commerce_order' },
};

for (const externalEvaluation of [
  { outcome: 'FEASIBLE' },
  { outcome: 'FEASIBLE', authority: 'existing-capacity-service' },
  { outcome: 'FEASIBLE', referenceId: 'capacity-check-without-authority' },
]) {
  const result = evaluateLogisticsSchedulingFeasibility({ request, externalEvaluation });
  assert.equal(result.evaluation, 'UNKNOWN', 'FEASIBLE without complete provenance must fail closed');
  assert.equal(result.reason, 'EXTERNAL_CAPACITY_UNKNOWN');
  assert.equal(result.feasible, false);
  assert.equal(result.authorized, false);
  assert.equal(result.execution, false);
  assert.equal(result.persistence, 'none');
  assert.equal(result.mutation, false);
}

const evidenced = evaluateLogisticsSchedulingFeasibility({
  request,
  externalEvaluation: {
    outcome: 'FEASIBLE',
    authority: 'existing-capacity-service',
    referenceId: 'capacity-check-with-provenance',
  },
});
assert.equal(evidenced.evaluation, 'FEASIBLE');
assert.equal(evidenced.feasible, true);
assert.equal(evidenced.authorized, false);
assert.equal(evidenced.execution, false);
assert.equal(evidenced.persistence, 'none');
assert.equal(evidenced.mutation, false);

console.log('Logistics Scheduling External Evidence Provenance: PASS');

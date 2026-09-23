import assert from 'node:assert/strict';
import {
  evaluateLogisticsProviderSelection,
  defineLogisticsProviderSelection,
  logisticsProviderSelectionContract,
} from '../app/src/verticals/logistics/provider-selection-contract.js';

let pass = 0;
const check = (condition, message) => { assert.equal(Boolean(condition), true, message); pass += 1; };
const throwsCode = (fn, code, message) => { assert.throws(fn, (e) => e?.code === code, message); pass += 1; };

const contract = logisticsProviderSelectionContract();
check(contract.version === '1.0', 'version');
check(contract.persistence === 'none', 'no persistence');
check(contract.provider_ranking === false, 'no provider ranking');
check(contract.credential_storage === false, 'no credential storage');
check(contract.execution === false, 'no execution');
check(contract.authorization_authority === 'backend/lib/authorization.js', 'authorization remains canonical');

const candidates = [
  { provider_id: 'network-a', evidence: {
    capabilities: ['delivery', 'tracking'], status: 'AVAILABLE', source: 'manual', evidence_mode: 'verified',
    evidence_reference: 'evidence-a', verified_by: 'verifier-1', verified_at: '2026-09-21T10:00:00Z', valid_until: '2027-09-21T10:00:00Z',
  }},
  { provider_id: 'network-b', evidence: {
    capabilities: ['delivery'], status: 'AVAILABLE', source: 'provider', evidence_mode: 'declared',
  }},
  { provider_id: 'network-c', evidence: {
    capabilities: ['delivery', 'tracking'], status: 'BLOCKED', source: 'manual', evidence_mode: 'verified',
    evidence_reference: 'evidence-c', verified_by: 'verifier-1', verified_at: '2026-09-21T10:00:00Z', valid_until: '2027-09-21T10:00:00Z',
  }},
];

const evaluated = evaluateLogisticsProviderSelection({
  requirements: { capabilities: ['delivery', 'tracking'] },
  candidates,
});
check(evaluated.feasible_provider_ids.length === 1, 'only one candidate is feasible');
check(evaluated.feasible_provider_ids[0] === 'network-a', 'verified capable candidate is feasible');
check(evaluated.selected_provider_id === null, 'feasibility does not silently select');
check(evaluated.selection === 'NOT_SELECTED', 'no implicit selection');
check(evaluated.authorization_required === true, 'authorization remains required');
check(evaluated.authorization_granted === false, 'selection does not grant authorization');
check(evaluated.execution === false, 'selection does not execute');
check(evaluated.persistence === 'none', 'selection is non-persistent');
check(evaluated.candidates.find((x) => x.provider_id === 'network-b').feasible === false, 'declared-only provider is not execution-feasible');
check(evaluated.candidates.find((x) => x.provider_id === 'network-c').feasible === false, 'blocked provider is not feasible');

const selected = defineLogisticsProviderSelection({
  requirements: { capabilities: ['delivery', 'tracking'] },
  candidates,
  selected_provider_id: 'network-a',
});
check(selected.selected_provider_id === 'network-a', 'explicit selection preserved');
check(selected.selection === 'EXPLICIT', 'selection is explicit');
check(selected.provider_ranking === false, 'no ranking');

throwsCode(() => defineLogisticsProviderSelection({
  requirements: { capabilities: ['delivery', 'tracking'] }, candidates, selected_provider_id: 'network-b',
}), 'LOGISTICS_PROVIDER_NOT_FEASIBLE', 'cannot select infeasible provider');
throwsCode(() => defineLogisticsProviderSelection({
  requirements: { capabilities: ['delivery'] }, candidates,
}), 'LOGISTICS_PROVIDER_SELECTION_REQUIRED', 'execution-ready selection requires explicit provider');
throwsCode(() => evaluateLogisticsProviderSelection({
  requirements: { capabilities: ['delivery'] }, candidates: [candidates[0], candidates[0]],
}), 'LOGISTICS_PROVIDER_SELECTION_INVALID', 'duplicate candidates rejected');
throwsCode(() => evaluateLogisticsProviderSelection({
  requirements: { capabilities: ['delivery'] }, candidates,
  selected_provider_id: 'network-a',
  authorization: { authorized: true },
}), 'LOGISTICS_PROVIDER_SELECTION_INVALID', 'authorization cannot be embedded in selection');
throwsCode(() => evaluateLogisticsProviderSelection({
  requirements: { capabilities: ['delivery'] }, candidates,
  selected_provider_id: 'network-a',
  credentials: { token: 'secret' },
}), 'LOGISTICS_PROVIDER_SELECTION_INVALID', 'credentials rejected');

console.log(`Phase 16.13.6 Logistics Provider Selection Regression: ${pass} PASS / 0 FAIL`);

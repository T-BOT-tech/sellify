// Phase 19.10 — Unified Discovery API composition regression.
import assert from 'node:assert/strict';
import {
  discoverUnified,
  unifiedDiscoveryContract,
  DEFAULT_DISCOVERY_PROVIDERS,
} from '../backend/lib/discovery/index.js';

const checks = [];
function pass(name) { checks.push(`PASS ${name}`); }

const contract = unifiedDiscoveryContract();
assert.equal(contract.authority, 'discovery_fabric'); pass('Discovery Fabric authority');
assert.deepEqual(contract.federatedProviders, DEFAULT_DISCOVERY_PROVIDERS); pass('federated provider set');
assert.equal(contract.persistence, 'none'); pass('no persistence');
assert.equal(contract.deterministicMatching, true); pass('deterministic matching');
assert.equal(contract.explainableRanking, true); pass('explainable ranking');
assert.equal(contract.derivedOpportunities, true); pass('derived opportunities');
assert.equal(contract.aiRanking, false); pass('AI ranking disabled');
assert.equal(contract.transactionExecution, false); pass('transaction execution disabled');
assert.equal(contract.inventoryMutation, false); pass('inventory mutation disabled');
assert.equal(contract.paymentMutation, false); pass('payment mutation disabled');
assert.equal(contract.procurementMutation, false); pass('procurement mutation disabled');
assert.equal(contract.trustScoreOwnedElsewhere, true); pass('trust score remains external');

const original = await discoverUnified({
  providerIds: ['commerce.organization'],
  intent: { search: 'unlikely-phase19.10-regression-no-match', limit: 10 },
});
assert.equal(original.deterministic, true); pass('result deterministic');
assert.equal(original.ai, false); pass('result AI false');
assert.equal(original.persisted, false); pass('result non-persistent');
assert.ok(Array.isArray(original.candidates)); pass('candidate array');
assert.ok(Array.isArray(original.opportunities)); pass('opportunity array');
assert.equal(original.returnedCount, original.candidates.length); pass('returned count consistent');

await assert.rejects(
  () => discoverUnified({ providerIds: ['does-not-exist'], intent: {} }),
  error => error?.code === 'DISCOVERY_PROVIDER_UNKNOWN',
); pass('unknown provider rejected');

console.log(checks.join('\n'));
console.log(`${checks.length} PASS / 0 FAIL`);

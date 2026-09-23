import assert from 'node:assert/strict';
import {
  normalizeLogisticsProviderExecutionResult,
  projectProviderExecutionResult,
  isLogisticsProviderExecutionResult,
  logisticsProviderExecutionResultContract,
} from '../app/src/verticals/logistics/provider-execution-result-contract.js';

let passed = 0;
function pass(name, fn) { fn(); passed += 1; console.log(`PASS ${name}`); }

pass('accepted result normalizes', () => {
  const r = normalizeLogisticsProviderExecutionResult({ provider_id: 'p1', operation: 'delivery', result_status: 'accepted', callback_id: 'cb:1' });
  assert.equal(r.result_status, 'accepted');
  assert.equal(r.terminal, false);
  assert.equal(isLogisticsProviderExecutionResult(r), true);
});

pass('in-progress result normalizes', () => {
  const r = normalizeLogisticsProviderExecutionResult({ provider_id: 'p1', operation: 'delivery', result_status: 'in_progress', callback_id: 'cb:2' });
  assert.equal(r.result_status, 'in_progress');
});

pass('tracking update requires tracking data', () => {
  assert.throws(() => normalizeLogisticsProviderExecutionResult({ provider_id: 'p1', operation: 'tracking', result_status: 'tracking_update', callback_id: 'cb:3' }), /tracking data/);
});

pass('tracking update is accepted with data', () => {
  const r = normalizeLogisticsProviderExecutionResult({ provider_id: 'p1', operation: 'tracking', result_status: 'tracking_update', callback_id: 'cb:4', tracking: { reference: 'TRK-1', status: 'out_for_delivery' } });
  assert.equal(r.tracking.reference, 'TRK-1');
});

pass('proof requires proof data', () => {
  assert.throws(() => normalizeLogisticsProviderExecutionResult({ provider_id: 'p1', operation: 'proof_of_delivery', result_status: 'proof', callback_id: 'cb:5' }), /proof data/);
});

pass('proof is accepted with data', () => {
  const r = normalizeLogisticsProviderExecutionResult({ provider_id: 'p1', operation: 'proof_of_delivery', result_status: 'proof', callback_id: 'cb:6', proof: { type: 'photo', ref: 'proof-1' } });
  assert.equal(r.proof.ref, 'proof-1');
});

pass('delivered is terminal', () => {
  const r = normalizeLogisticsProviderExecutionResult({ provider_id: 'p1', operation: 'delivery', result_status: 'delivered', callback_id: 'cb:7' });
  assert.equal(r.terminal, true);
});

pass('failed requires error data', () => {
  assert.throws(() => normalizeLogisticsProviderExecutionResult({ provider_id: 'p1', operation: 'delivery', result_status: 'failed', callback_id: 'cb:8' }), /error data/);
});

pass('failed is terminal', () => {
  const r = normalizeLogisticsProviderExecutionResult({ provider_id: 'p1', operation: 'delivery', result_status: 'failed', callback_id: 'cb:9', error: { code: 'NO_DRIVER' } });
  assert.equal(r.terminal, true);
});

pass('returned is terminal', () => {
  const r = normalizeLogisticsProviderExecutionResult({ provider_id: 'p1', operation: 'returns', result_status: 'returned', callback_id: 'cb:10' });
  assert.equal(r.terminal, true);
});

pass('unsupported operation rejected', () => {
  assert.throws(() => normalizeLogisticsProviderExecutionResult({ provider_id: 'p1', operation: 'shipment_create', result_status: 'accepted', callback_id: 'cb:11' }), /Unsupported provider operation/);
});

pass('unsupported result rejected', () => {
  assert.throws(() => normalizeLogisticsProviderExecutionResult({ provider_id: 'p1', operation: 'delivery', result_status: 'mystery', callback_id: 'cb:12' }), /Unsupported provider result status/);
});

pass('projected result maps delivered to fulfillment boundary', () => {
  const r = projectProviderExecutionResult({ provider_id: 'p1', operation: 'delivery', result_status: 'delivered', callback_id: 'cb:13' });
  assert.equal(r.canonical_result, 'fulfillment_delivered');
  assert.equal(r.fulfillment_authority, 'app/src/logistics/fulfillment.js');
  assert.equal(r.external_provider_authority, false);
});

pass('projected result maps tracking', () => {
  const r = projectProviderExecutionResult({ provider_id: 'p1', operation: 'tracking', result_status: 'tracking_update', callback_id: 'cb:14', tracking: { status: 'out_for_delivery' } });
  assert.equal(r.canonical_result, 'tracking_update');
});

pass('projected result maps proof', () => {
  const r = projectProviderExecutionResult({ provider_id: 'p1', operation: 'proof_of_delivery', result_status: 'proof', callback_id: 'cb:15', proof: { type: 'signature', ref: 'sig-1' } });
  assert.equal(r.canonical_result, 'proof_captured');
});

pass('projected result maps failure', () => {
  const r = projectProviderExecutionResult({ provider_id: 'p1', operation: 'delivery', result_status: 'failed', callback_id: 'cb:16', error: { code: 'FAILED' } });
  assert.equal(r.canonical_result, 'execution_failed');
});

pass('projected result maps return', () => {
  const r = projectProviderExecutionResult({ provider_id: 'p1', operation: 'returns', result_status: 'returned', callback_id: 'cb:17' });
  assert.equal(r.canonical_result, 'return_completed');
});

pass('contract preserves existing event boundary', () => {
  const c = logisticsProviderExecutionResultContract();
  assert.equal(c.event_boundary, 'app/src/events/event-boundary.js');
  assert.equal(c.callback_persistence, 'none');
  assert.equal(c.provider_mutation_authority, false);
});

pass('forbidden persistence authority is absent', () => {
  const r = projectProviderExecutionResult({ provider_id: 'p1', operation: 'delivery', result_status: 'accepted', callback_id: 'cb:18' });
  assert.equal(Object.hasOwn(r, 'database'), false);
  assert.equal(Object.hasOwn(r, 'event_store'), false);
  assert.equal(Object.hasOwn(r, 'credentials'), false);
});

console.log(`Phase 16.13.8: ${passed}/19 PASS`);

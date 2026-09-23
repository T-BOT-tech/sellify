import assert from 'node:assert/strict';
import {
  evaluateLogisticsProviderExecutionReliability,
  projectReliableProviderResult,
  logisticsProviderExecutionReliabilityContract,
} from '../app/src/verticals/logistics/provider-execution-reliability-contract.js';

let passed = 0;
function pass(name, fn) { fn(); passed += 1; console.log(`PASS ${name}`); }

const base = { providerId: 'p1', callbackId: 'cb:1', resultStatus: 'accepted' };

pass('new callback may apply', () => {
  const r = evaluateLogisticsProviderExecutionReliability(base);
  assert.equal(r.disposition, 'APPLY');
  assert.equal(r.apply, true);
});

pass('duplicate callback is idempotent', () => {
  const r = evaluateLogisticsProviderExecutionReliability({ ...base, processedCallbackIds: ['cb:1'] });
  assert.equal(r.disposition, 'DUPLICATE');
  assert.equal(r.idempotent, true);
  assert.equal(r.apply, false);
});

pass('duplicate callback list rejects duplicate IDs', () => {
  assert.throws(() => evaluateLogisticsProviderExecutionReliability({ ...base, processedCallbackIds: ['cb:1', 'cb:1'] }), /must not contain duplicates/);
});

pass('in-progress after accepted may apply', () => {
  const r = evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:2', resultStatus: 'in_progress', currentStatus: 'accepted' });
  assert.equal(r.disposition, 'APPLY');
});

pass('accepted after in-progress is stale', () => {
  const r = evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:3', resultStatus: 'accepted', currentStatus: 'in_progress' });
  assert.equal(r.disposition, 'STALE');
  assert.equal(r.apply, false);
});

pass('tracking after in-progress may apply', () => {
  const r = evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:4', resultStatus: 'tracking_update', currentStatus: 'in_progress' });
  assert.equal(r.disposition, 'APPLY');
});

pass('proof after tracking may apply', () => {
  const r = evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:5', resultStatus: 'proof', currentStatus: 'tracking_update' });
  assert.equal(r.disposition, 'APPLY');
});

pass('delivered after progress may apply', () => {
  const r = evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:6', resultStatus: 'delivered', currentStatus: 'in_progress' });
  assert.equal(r.disposition, 'APPLY');
});

pass('failed after progress may apply', () => {
  const r = evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:7', resultStatus: 'failed', currentStatus: 'tracking_update' });
  assert.equal(r.disposition, 'APPLY');
});

pass('returned after progress may apply', () => {
  const r = evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:8', resultStatus: 'returned', currentStatus: 'in_progress' });
  assert.equal(r.disposition, 'APPLY');
});

pass('tracking after delivered is terminal conflict', () => {
  const r = evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:9', resultStatus: 'tracking_update', currentStatus: 'delivered' });
  assert.equal(r.disposition, 'CONFLICT');
});

pass('delivered replay with new callback is stale', () => {
  const r = evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:10', resultStatus: 'delivered', currentStatus: 'delivered' });
  assert.equal(r.disposition, 'STALE');
  assert.equal(r.idempotent, true);
});

pass('failed after delivered is terminal conflict', () => {
  const r = evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:11', resultStatus: 'failed', currentStatus: 'delivered' });
  assert.equal(r.disposition, 'CONFLICT');
  assert.equal(r.conflict, true);
});

pass('returned after failed is terminal conflict', () => {
  const r = evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:12', resultStatus: 'returned', currentStatus: 'failed' });
  assert.equal(r.disposition, 'CONFLICT');
});

pass('unknown result rejected', () => {
  assert.throws(() => evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:13', resultStatus: 'mystery' }), /Unsupported provider result status/);
});

pass('unknown current state rejected', () => {
  assert.throws(() => evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: 'cb:14', currentStatus: 'mystery' }), /Unsupported provider result status/);
});

pass('missing callback ID rejected', () => {
  assert.throws(() => evaluateLogisticsProviderExecutionReliability({ ...base, callbackId: '' }), /callback_id/);
});

pass('projection preserves existing authorities', () => {
  const r = projectReliableProviderResult({
    result: { provider_id: 'p1', operation: 'delivery', result_status: 'delivered', callback_id: 'cb:15' },
    currentStatus: 'in_progress',
  });
  assert.equal(r.disposition, 'APPLY');
  assert.equal(r.fulfillment_authority, 'app/src/logistics/fulfillment.js');
  assert.equal(r.transaction_authority, 'existing_domain_transaction');
  assert.equal(r.provider_state_authority, false);
});

pass('projection blocks duplicate mutation', () => {
  const r = projectReliableProviderResult({
    result: { provider_id: 'p1', operation: 'delivery', result_status: 'delivered', callback_id: 'cb:16' },
    currentStatus: 'in_progress',
    processedCallbackIds: ['cb:16'],
  });
  assert.equal(r.disposition, 'DUPLICATE');
  assert.equal(r.apply, false);
});

pass('contract has no callback store', () => {
  const c = logisticsProviderExecutionReliabilityContract();
  assert.equal(c.duplicate_callback_store, false);
  assert.equal(c.provider_state_authority, false);
  assert.equal(c.new_retry_engine, false);
});

console.log(`Phase 16.13.9: ${passed}/20 PASS`);

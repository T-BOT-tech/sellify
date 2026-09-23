import assert from 'node:assert/strict';
import {
  normalizeLogisticsReturn,
  transitionLogisticsReturn,
  logisticsProofReturnContract,
} from '../app/src/verticals/logistics/proof-return-contract.js';

const base = normalizeLogisticsReturn({
  id: 'RET-13.10.11-1',
  order_id: 'ORDER-13.10.11-1',
  status: 'requested',
  reason: 'customer_request',
});

const approved = transitionLogisticsReturn({ current: base, nextStatus: 'approved' });
assert.equal(approved.status, 'approved');
assert.equal(approved.transition, 'requested->approved');
assert.equal(approved.replay, false);
assert.equal(approved.persistence, 'existing_core_state_only');

const transit = transitionLogisticsReturn({ current: approved, nextStatus: 'in_transit' });
assert.equal(transit.status, 'in_transit');

const received = transitionLogisticsReturn({ current: transit, nextStatus: 'received' });
assert.equal(received.status, 'received');
assert.equal(received.order_id, base.order_id);
assert.equal(received.id, base.id);

const replay = transitionLogisticsReturn({ current: received, nextStatus: 'received' });
assert.equal(replay.replay, true);
assert.equal(replay.transition, 'received->received');
assert.deepEqual(replay.proof, received.proof);

for (const terminal of ['rejected', 'cancelled']) {
  const transitioned = transitionLogisticsReturn({ current: base, nextStatus: terminal });
  assert.equal(transitioned.status, terminal);
  assert.throws(() => transitionLogisticsReturn({ current: transitioned, nextStatus: 'approved' }), /Invalid return transition/);
}

assert.throws(() => transitionLogisticsReturn({ current: base, nextStatus: 'received' }), /Invalid return transition/);
assert.throws(() => transitionLogisticsReturn({ current: received, nextStatus: 'cancelled' }), /Invalid return transition/);
assert.throws(() => transitionLogisticsReturn({ current: base, nextStatus: 'bogus' }), /Unsupported return status/);

const snapshot = JSON.stringify(base);
transitionLogisticsReturn({ current: base, nextStatus: 'approved' });
assert.equal(JSON.stringify(base), snapshot);

const contract = logisticsProofReturnContract();
assert.equal(contract.return_transition_authority, 'logistics-pack');
assert.equal(contract.return_persistence, 'existing_core_state_only');
assert.equal(contract.stock_authority, 'inventory');
assert.equal(contract.order_authority, 'commerce');
assert.equal(contract.duplicate_order_authority, false);
assert.equal(contract.duplicate_inventory_authority, false);

console.log('Phase 13.10.11 Logistics Returns Workflow Regression: PASS');

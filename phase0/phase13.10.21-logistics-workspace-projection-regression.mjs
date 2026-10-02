import assert from 'node:assert/strict';
import {
  buildLogisticsOperationalWorkspaceProjection,
  logisticsOperationalWorkspaceProjectionContract,
} from '../app/src/verticals/logistics/workspace-projection.js';

const projection = buildLogisticsOperationalWorkspaceProjection({
  orders: [
    {
      id: 'O1',
      server_order_id: 'SO1',
      fulfillment_type: 'delivery',
      fulfillment_status: 'out_for_delivery',
      shipment_id: 'SHIP1',
      tracking_reference: 'TRK1',
    },
    {
      id: 'O2',
      server_order_id: 'SO2',
      fulfillment_type: 'delivery',
      fulfillment_status: 'delivered',
      fulfillment_proof: { ref: 'PROOF1' },
    },
    {
      id: 'O3',
      server_order_id: 'SO3',
      fulfillment_type: 'delivery',
      fulfillment_status: 'failed',
    },
  ],
  assignments: [
    { id: 'A1', server_order_id: 'SO1', courier_user_id: 'C1', status: 'OUT_FOR_DELIVERY' },
    { id: 'A2', server_order_id: 'SO2', courier_user_id: 'C1', status: 'DELIVERED', proof: 'PROOF1' },
    { id: 'A3', server_order_id: 'SO3', courier_user_id: 'C2', status: 'FAILED' },
  ],
});

assert.equal(projection.dispatch.length, 2);
assert.equal(projection.tracking.length, 3);
assert.equal(projection.proof.length, 1);
assert.equal(projection.exceptions.length, 1);
assert.equal(projection.workload.active_count, 1);
assert.equal(projection.workload.out_for_delivery_count, 1);
assert.equal(projection.workload.by_courier.C1, 1);
assert.equal(projection.authority, 'existing_core_order_and_logistics_assignment_projection');
assert.equal(projection.persistence, 'none');
assert.equal(projection.mutation_authority, 'none');

const contract = logisticsOperationalWorkspaceProjectionContract();
assert.deepEqual(contract.views, ['dispatch', 'tracking', 'proof', 'exceptions', 'workload']);
assert.equal(contract.duplicate_tracking_store, false);
assert.equal(contract.duplicate_proof_store, false);
assert.equal(contract.duplicate_assignment_authority, false);

console.log('Phase 13.10.21 Logistics Operational Workspace Projection Regression: PASS');

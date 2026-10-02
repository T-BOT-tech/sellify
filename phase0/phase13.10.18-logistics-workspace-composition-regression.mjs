import assert from 'node:assert/strict';
import {
  getLogisticsWorkspaceComposition,
  logisticsWorkspaceContract,
  isLogisticsWorkspaceComposition,
} from '../app/src/verticals/logistics/workspace-contract.js';

const manager = getLogisticsWorkspaceComposition('logistics_manager');
assert.deepEqual(manager.views.map(view => view.id), [
  'dispatch', 'tracking', 'proof', 'exceptions', 'workload',
]);
assert.equal(manager.authority, 'logistics-pack');
assert.equal(manager.authorization, 'backend/lib/authorization.js');
assert.equal(manager.persistence, 'none');
assert.equal(isLogisticsWorkspaceComposition(manager), true);

const dispatcher = getLogisticsWorkspaceComposition('logistics_dispatcher');
assert.deepEqual(dispatcher.views.map(view => view.id), [
  'dispatch', 'tracking', 'exceptions', 'workload',
]);

const courier = getLogisticsWorkspaceComposition('logistics_courier');
assert.deepEqual(courier.views.map(view => view.id), [
  'my_assignments', 'tracking', 'proof', 'exceptions',
]);

const viewer = getLogisticsWorkspaceComposition('logistics_viewer');
assert.deepEqual(viewer.views.map(view => view.id), ['tracking', 'proof']);

const unknown = getLogisticsWorkspaceComposition('staff');
assert.deepEqual(unknown.views, []);
assert.equal(unknown.persistence, 'none');

const contract = logisticsWorkspaceContract();
assert.deepEqual(contract.roles, [
  'logistics_manager',
  'logistics_dispatcher',
  'logistics_courier',
  'logistics_viewer',
]);
assert.equal(contract.permission_evaluator, 'none');
assert.equal(contract.mutation_authority, 'none');

console.log('Phase 13.10.18 Logistics Workspace Composition Regression: PASS');

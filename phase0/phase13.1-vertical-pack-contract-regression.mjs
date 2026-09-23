import assert from 'node:assert/strict';
import {
  CORE_AUTHORITIES,
  VERTICAL_PACK_CONTRACT_VERSION,
  defineVerticalPack,
  isVerticalPack,
} from '../app/src/verticals/contract.js';

const agriculture = defineVerticalPack({
  pack_id: 'agriculture',
  name: 'Agriculture',
  version: '0.1.0',
  capabilities: ['farm-management', 'harvest-management'],
  configuration: { seasons: true },
  permissions: ['agriculture:manage'],
  domain_entities: ['Farmer', 'Farm', 'Plot', 'Season', 'Crop', 'Harvest'],
  core_dependencies: ['customers', 'locations', 'inventory', 'commerce', 'payments', 'fulfillment', 'audit'],
  routes: [],
  ui_entry_points: [],
  events: ['FARM_CREATED', 'PLOT_CREATED', 'HARVEST_RECORDED'],
});

assert.equal(agriculture.contract_version, VERTICAL_PACK_CONTRACT_VERSION);
assert.equal(agriculture.pack_id, 'agriculture');
assert.deepEqual(agriculture.domain_entities, ['Farmer', 'Farm', 'Plot', 'Season', 'Crop', 'Harvest']);
assert.equal(Object.isFrozen(agriculture), true);
assert.equal(Object.isFrozen(agriculture.domain_entities), true);
assert.deepEqual(CORE_AUTHORITIES, [
  'commerce', 'inventory', 'payments', 'customers', 'locations', 'fulfillment', 'documents', 'audit',
]);

// Contract must reject duplicate declarative values.
assert.throws(() => defineVerticalPack({
  pack_id: 'bad-pack', name: 'Bad', version: '1.0.0',
  capabilities: ['a', 'A'], domain_entities: [], core_dependencies: [],
}), /must not contain duplicates/);

// A vertical cannot claim a Core authority as its own domain entity.
assert.throws(() => defineVerticalPack({
  pack_id: 'bad-pack', name: 'Bad', version: '1.0.0',
  capabilities: [], domain_entities: ['AgricultureOrder', 'Order'], core_dependencies: ['commerce'],
}), /reserved by Core/);

// Unknown Core dependencies are rejected rather than silently accepted.
assert.throws(() => defineVerticalPack({
  pack_id: 'bad-pack', name: 'Bad', version: '1.0.0',
  capabilities: [], domain_entities: ['Farm'], core_dependencies: ['agriculture-inventory'],
}), /unknown core dependency/);

assert.equal(isVerticalPack(agriculture), true);
assert.equal(isVerticalPack(null), false);

console.log('Phase 13.1 Vertical Pack Contract Regression: PASS');

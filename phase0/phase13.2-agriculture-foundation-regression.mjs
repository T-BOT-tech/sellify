import assert from 'node:assert/strict';
import {
  AGRICULTURE_ENTITY_ORDER,
  AGRICULTURE_PACK,
  AGRICULTURE_STATUSES,
  defineAgricultureEntity,
} from '../app/src/verticals/agriculture/pack.js';

assert.equal(AGRICULTURE_PACK.pack_id, 'agriculture');
assert.equal(AGRICULTURE_PACK.version, '0.1.0');
assert.deepEqual(AGRICULTURE_ENTITY_ORDER, [
  'Farmer', 'Farm', 'Plot', 'Season', 'Crop', 'Harvest', 'Supply',
  'Commodity', 'CollectionCenter', 'Buyer',
]);
assert.deepEqual(AGRICULTURE_STATUSES, ['active', 'inactive']);
assert(Object.isFrozen(AGRICULTURE_PACK));
assert(Object.isFrozen(AGRICULTURE_ENTITY_ORDER));

const farm = defineAgricultureEntity('Farm', {
  id: 'farm-1',
  organization_id: 'org-1',
});
assert.deepEqual(farm, {
  entity_type: 'Farm',
  id: 'farm-1',
  organization_id: 'org-1',
  status: 'active',
});
assert(Object.isFrozen(farm));

const inactivePlot = defineAgricultureEntity('Plot', {
  id: 'plot-1',
  organizationId: 'org-1',
  status: 'inactive',
});
assert.equal(inactivePlot.status, 'inactive');

assert.throws(() => defineAgricultureEntity('Unknown', {
  id: 'x', organization_id: 'org-1',
}), /Unsupported Agriculture entity type/);
assert.throws(() => defineAgricultureEntity('Farm', {
  id: 'farm-1',
}), /organization_id must be a non-empty string/);
assert.throws(() => defineAgricultureEntity('Farm', {
  id: 'farm-1', organization_id: 'org-1', status: 'deleted',
}), /status must be active or inactive/);

// Foundation must not create Core transaction authorities.
for (const forbidden of ['AgricultureOrder', 'AgricultureInventory', 'AgriculturePayment', 'AgricultureFulfillment']) {
  assert(!AGRICULTURE_PACK.domain_entities.includes(forbidden));
}
assert(AGRICULTURE_PACK.core_dependencies.includes('commerce'));
assert(AGRICULTURE_PACK.core_dependencies.includes('inventory'));
assert(AGRICULTURE_PACK.core_dependencies.includes('payments'));
assert(AGRICULTURE_PACK.core_dependencies.includes('fulfillment'));

console.log('Phase 13.2 Agriculture Pack Foundation Regression: PASS');

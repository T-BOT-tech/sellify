import assert from 'node:assert/strict';
import { LOGISTICS_PACK, LOGISTICS_BOUNDARY, isLogisticsPack } from '../app/src/verticals/logistics/pack.js';

assert.equal(LOGISTICS_PACK.pack_id, 'logistics');
assert.equal(LOGISTICS_PACK.name, 'Logistics');
assert.ok(LOGISTICS_PACK.domain_entities.includes('Courier'));
assert.ok(LOGISTICS_PACK.domain_entities.includes('Shipment'));
assert.ok(LOGISTICS_PACK.domain_entities.includes('Return'));
assert.ok(LOGISTICS_PACK.core_dependencies.includes('fulfillment'));
assert.ok(LOGISTICS_PACK.core_dependencies.includes('inventory'));
assert.equal(isLogisticsPack(), true);
assert.equal(LOGISTICS_BOUNDARY.bridges_to_core.order, 'commerce');
assert.equal(LOGISTICS_BOUNDARY.bridges_to_core.fulfillment_lifecycle, 'fulfillment');
assert.ok(LOGISTICS_BOUNDARY.forbidden_parallel_authorities.includes('LogisticsOrder'));
assert.ok(LOGISTICS_BOUNDARY.forbidden_parallel_authorities.includes('LogisticsFulfillment'));
console.log('Phase 13.10.1 Logistics Pack Boundary Regression: PASS');

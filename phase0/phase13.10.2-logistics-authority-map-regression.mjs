import assert from 'node:assert/strict';
import { LOGISTICS_AUTHORITY_MAP, logisticsAuthorityContract } from '../app/src/verticals/logistics/authority-map.js';

assert.equal(LOGISTICS_AUTHORITY_MAP.core.order, 'commerce');
assert.equal(LOGISTICS_AUTHORITY_MAP.core.stock, 'inventory');
assert.equal(LOGISTICS_AUTHORITY_MAP.core.payment, 'payments');
assert.equal(LOGISTICS_AUTHORITY_MAP.core.fulfillment_lifecycle, 'app/src/logistics/fulfillment.js');
const contract = logisticsAuthorityContract();
assert.equal(contract.duplicate_authority, false);
assert.equal(contract.persistence, 'existing_order_and_core_state_only');
assert.deepEqual(contract.logistics_owned, ['Courier', 'Route', 'Shipment', 'Delivery', 'Proof', 'Return']);
console.log('Phase 13.10.2 Logistics Authority Map Regression: PASS');

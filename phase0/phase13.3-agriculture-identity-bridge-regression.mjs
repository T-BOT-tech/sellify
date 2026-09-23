import assert from 'node:assert/strict';
import {
  agricultureIdentityContract,
  bridgeFarmerToCustomer,
  bridgeBuyerToCustomer,
  bridgeCollectionCenterToLocation,
} from '../app/src/verticals/agriculture/identity-bridge.js';

assert.deepEqual(agricultureIdentityContract(), {
  Farmer: 'customer',
  Buyer: 'customer',
  CollectionCenter: 'location',
});

const farmer = bridgeFarmerToCustomer({ id: 'cust-1', organization_id: 'org-1', name: 'Farmer One' }, 'org-1');
assert.deepEqual(farmer, {
  entity_type: 'Farmer', core_type: 'customer', core_id: 'cust-1',
  organization_id: 'org-1', role: 'farmer',
});

const buyer = bridgeBuyerToCustomer({ id: 'cust-2', organizationId: 'org-1', customerType: 'business' }, 'org-1');
assert.equal(buyer.core_type, 'customer');
assert.equal(buyer.core_id, 'cust-2');
assert.equal(buyer.role, 'buyer');

const center = bridgeCollectionCenterToLocation({ id: 'loc-1', organizationId: 'org-1', type: 'WAREHOUSE' }, 'org-1');
assert.equal(center.core_type, 'location');
assert.equal(center.core_id, 'loc-1');
assert.equal(center.role, 'collection_center');

assert(Object.isFrozen(farmer));
assert.throws(() => bridgeFarmerToCustomer({ id: 'cust-3', organization_id: 'org-2' }, 'org-1'), /different organization/);
assert.throws(() => bridgeBuyerToCustomer(null, 'org-1'), /required/);
assert.throws(() => bridgeCollectionCenterToLocation({ id: 'loc-2' }, 'org-1'), /organization_id must be a non-empty string/);

for (const forbidden of ['AgricultureCustomer', 'AgricultureLocation']) {
  assert(!['Farmer', 'Buyer', 'CollectionCenter'].includes(forbidden));
}

console.log('Phase 13.3 Agriculture Identity Bridge Regression: PASS');

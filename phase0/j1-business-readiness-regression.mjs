import assert from 'node:assert/strict';
import { getBusinessReadiness } from '../app/src/experience/business-readiness.js';

const empty = getBusinessReadiness({ config: {}, catalogItems: [] });
assert.equal(empty.status, 'setup_needed');
assert.equal(empty.readyToTakeOrders, false);
assert.equal(empty.nextAction, 'settings');
assert.equal(empty.completedSteps, 0);

const profileOnly = getBusinessReadiness({
  config: { sellerName: 'Corner Shop', currencyCode: 'ETB', businessModel: 'retail' },
  catalogItems: [],
});
assert.equal(profileOnly.status, 'in_progress');
assert.equal(profileOnly.nextAction, 'catalog');
assert.equal(profileOnly.steps[0].complete, true);
assert.equal(profileOnly.steps[1].complete, false);

const catalogOnly = getBusinessReadiness({
  config: { sellerName: '', currencyCode: 'ETB' },
  catalogItems: [{ id: 'item-1', name: 'Coffee' }],
});
assert.equal(catalogOnly.readyToTakeOrders, false);
assert.equal(catalogOnly.nextAction, 'settings');

const ready = getBusinessReadiness({
  config: { sellerName: 'Corner Shop', currencyCode: 'ETB' },
  catalogItems: [{ id: 'item-1' }],
});
assert.equal(ready.status, 'ready');
assert.equal(ready.readyToTakeOrders, true);
assert.equal(ready.completedSteps, 2);
assert.equal(ready.nextAction, 'order');
assert.equal(ready.financialReadinessCertified, false);

console.log('J1 business readiness regression: PASS');

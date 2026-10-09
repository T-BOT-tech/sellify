import assert from 'node:assert/strict';
import { getBusinessReadiness } from '../app/src/experience/business-readiness.js';

const empty = getBusinessReadiness({ config: {}, catalogItems: [] });
assert.equal(empty.status, 'setup_needed');
assert.equal(empty.readyToTakeOrders, false);
assert.equal(empty.nextAction, 'settings');
assert.equal(empty.completedSteps, 0);

const defaultCurrencyOnly = getBusinessReadiness({
  config: { sellerName: 'Corner Shop', currencyCode: 'INR' },
  catalogItems: [{ id: 'item-1', name: 'Coffee', price: 250 }],
});
assert.equal(defaultCurrencyOnly.steps[0].complete, false);
assert.equal(defaultCurrencyOnly.readyToTakeOrders, false);
assert.equal(defaultCurrencyOnly.nextAction, 'settings');

const profileOnly = getBusinessReadiness({
  config: { sellerName: 'Corner Shop', currencyCode: 'ETB', currencyConfirmed: true, businessModel: 'retail' },
  catalogItems: [],
});
assert.equal(profileOnly.status, 'in_progress');
assert.equal(profileOnly.nextAction, 'catalog');
assert.equal(profileOnly.steps[0].complete, true);
assert.equal(profileOnly.steps[1].complete, false);

const catalogOnly = getBusinessReadiness({
  config: { sellerName: '', currencyCode: 'ETB', currencyConfirmed: true },
  catalogItems: [{ id: 'item-1', name: 'Coffee', price: 250 }],
});
assert.equal(catalogOnly.readyToTakeOrders, false);
assert.equal(catalogOnly.nextAction, 'settings');

const invalidCatalog = getBusinessReadiness({
  config: { sellerName: 'Corner Shop', currencyCode: 'ETB', currencyConfirmed: true },
  catalogItems: [
    { id: 'missing-name', name: ' ', price: 100 },
    { id: 'missing-price', name: 'Tea' },
    { id: 'blank-price', name: 'Juice', price: '' },
    { id: 'null-price', name: 'Bread', price: null },
    { id: 'bad-price', name: 'Cake', price: Number.NaN },
  ],
});
assert.equal(invalidCatalog.readyToTakeOrders, false);
assert.equal(invalidCatalog.steps[1].complete, false);

const customCurrencyWithoutSymbol = getBusinessReadiness({
  config: { sellerName: 'Corner Shop', currencyCode: 'CUSTOM', currencyConfirmed: true, currencySymbol: ' ' },
  catalogItems: [{ id: 'item-1', name: 'Coffee', price: 250 }],
});
assert.equal(customCurrencyWithoutSymbol.steps[0].complete, false);

const ready = getBusinessReadiness({
  config: { sellerName: 'Corner Shop', currencyCode: 'ETB', currencyConfirmed: true, staff: [], printerConfigured: false },
  catalogItems: [{ id: 'item-1', name: 'Coffee', price: 0 }],
});
assert.equal(ready.status, 'ready');
assert.equal(ready.readyToTakeOrders, true);
assert.equal(ready.completedSteps, 2);
assert.equal(ready.steps.length, 2);
assert.equal(ready.nextAction, 'order');
assert.equal(ready.financialReadinessCertified, false);

console.log('J1 business readiness regression: PASS');

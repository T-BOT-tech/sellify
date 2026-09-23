import assert from 'node:assert/strict';
import {
  normalizeRestaurantOrder,
  buildRestaurantPaymentIntent,
  assertRestaurantPaymentState,
  restaurantOrderPaymentContract,
} from '../app/src/verticals/restaurant/order-payment-compatibility.js';

const order = {
  id: 'restaurant-order-1',
  items: [
    { id: 'burger', qty: 2, price: 750 },
    { id: 'coffee', qty: 1, price: 500 },
  ],
  total: 2000,
  currency: 'ETB',
  customer_id: 'customer-1',
  table_id: 'table-4',
  table_number: 4,
  kitchen_status: 'preparing',
  priority: 'normal',
};

const normalized = normalizeRestaurantOrder(order, { organizationId: 'org-1', locationId: 'loc-1' });
assert.equal(normalized.order_authority, 'commerce');
assert.equal(normalized.payment_authority, 'payments');
assert.equal(normalized.total_minor, 2000);
assert.equal(normalized.location_id, 'loc-1');
assert.equal(normalized.table_id, 'table-4');

const cash = buildRestaurantPaymentIntent({
  ...order,
  cash_tendered: 2000,
  payment_method_id: 'cash',
  payment_method_name: 'Cash',
}, { organizationId: 'org-1', locationId: 'loc-1' });
assert.equal(cash.amount_minor, 2000);
assert.equal(cash.state, 'RECEIVED');
assert.equal(cash.payment_authority, 'payments');

const partial = buildRestaurantPaymentIntent({
  ...order,
  cash_tendered: 1000,
}, { organizationId: 'org-1', locationId: 'loc-1' });
assert.equal(partial.amount_minor, 1000);
assert.equal(partial.state, 'PARTIAL');

const proof = buildRestaurantPaymentIntent({
  ...order,
  payment_proof: { path: 'inline', fileName: 'proof.webp' },
  payment_method_id: 'telebirr',
  payment_method_name: 'Telebirr',
}, { organizationId: 'org-1', locationId: 'loc-1' });
assert.equal(proof.amount_minor, 2000);
assert.equal(proof.state, 'CLAIMED');
assert.equal(proof.metadata.payment_proof_attached, true);

assert.throws(() => normalizeRestaurantOrder({ ...order, total: 1999 }, { organizationId: 'org-1', locationId: 'loc-1' }), /total does not match/);
assert.throws(() => normalizeRestaurantOrder(order, { organizationId: 'org-1' }), /location_id/);
assert.throws(() => buildRestaurantPaymentIntent({ ...order, cash_tendered: -1 }, { organizationId: 'org-1', locationId: 'loc-1' }), /cash_tendered/);
assert.equal(assertRestaurantPaymentState('verified'), 'VERIFIED');
assert.throws(() => assertRestaurantPaymentState('PAID'), /Invalid Core Payment state/);

const contract = restaurantOrderPaymentContract();
assert.equal(contract.order_authority, 'commerce');
assert.equal(contract.payment_authority, 'payments');
assert.equal(contract.duplicate_order_authority, false);
assert.equal(contract.duplicate_payment_authority, false);

console.log('Phase 13.8.6 Restaurant Order/Payment Compatibility Regression: PASS');

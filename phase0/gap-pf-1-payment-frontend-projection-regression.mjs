import fs from 'node:fs';
import assert from 'node:assert/strict';

const projection = fs.readFileSync('app/src/payments/projection.js', 'utf8');
const state = fs.readFileSync('app/src/payments/state.js', 'utf8');
const queue = fs.readFileSync('app/src/orders/queue.js', 'utf8');
const sync = fs.readFileSync('app/src/sync/orders.js', 'utf8');

assert.match(projection, /listPayments/);
assert.match(projection, /setPayments/);
assert.match(projection, /getPaymentForOrder/);
assert.match(state, /In-memory frontend projection only/);
assert.match(queue, /getPaymentForOrder/);
assert.match(sync, /refreshPaymentProjection/);
assert.doesNotMatch(projection, /saveJSON|localStorage|STORAGE_KEYS/);

console.log('PASS PF-1 payment frontend projection boundary');

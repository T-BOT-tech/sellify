import fs from 'node:fs';
import assert from 'node:assert/strict';

const projection = fs.readFileSync('app/src/payments/projection.js', 'utf8');
const state = fs.readFileSync('app/src/payments/state.js', 'utf8');
const queue = fs.readFileSync('app/src/orders/queue.js', 'utf8');
const sync = fs.readFileSync('app/src/sync/orders.js', 'utf8');

assert.match(projection, /listPayments/);
assert.match(projection, /setPayments/);
assert.match(projection, /getPaymentForOrder/);
assert.match(projection, /ensurePaymentForSyncedOrder/);
assert.match(projection, /export function isCanonicalLinkageOnlyPayment/);
assert.match(projection, /!isCanonicalLinkageOnlyPayment\(payment\)/);
assert.match(projection, /status: linkageOnlyPayment \? 'LINKED_ONLY' : 'DEFERRED'/);
assert.match(projection, /statusQueried: false/);
assert.match(projection, /resolvePaymentRouting/);
assert.match(projection, /paymentCommandKey\('create-order'/);
assert.match(projection, /export function isCanonicalLinkageOnlyPayment\(payment\)/);
assert.match(projection, /listedPayments\.find\(candidate => !isCanonicalLinkageOnlyPayment\(candidate\)\)/);
assert.match(projection, /&& !isCanonicalLinkageOnlyPayment\(payment\)/);
assert.match(sync, /canonical_linkage_only/);
assert.match(sync, /Boolean\(order\.payment_linkage && order\.payment_linkage\.canonical_linkage_only\)/);
assert.match(sync, /ensurePaymentForSyncedOrder/);
assert.match(state, /In-memory frontend projection only/);
assert.match(queue, /getPaymentForOrder/);
assert.match(sync, /refreshPaymentProjection/);
assert.doesNotMatch(projection, /saveJSON|localStorage|STORAGE_KEYS/);

console.log('PASS PF-1 payment frontend projection boundary');

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
assert.match(projection, /setPayments\(payments\.filter\(payment => !isCanonicalLinkageOnlyPayment\(payment\)\)\)/,
  'linkage-only shells are excluded from the operational payment projection');
assert.match(projection, /const listedForOrder = cachedUsablePayment[\s\S]*?await listPayments\(\{ orderId: serverOrderId, limit: 10 \}\)/,
  'a cached linkage shell cannot suppress a fresh canonical payment lookup');

assert.match(projection, /!isCanonicalLinkageOnlyPayment\(payment\)/);
assert.match(projection, /status: linkageOnlyPayment \? 'LINKED_ONLY' : 'DEFERRED'/);
assert.match(projection, /statusQueried: false/);
assert.match(projection, /resolvePaymentRouting/);
assert.match(projection, /paymentCommandKey\('create-order'/);
assert.match(projection, /export function isCanonicalLinkageOnlyPayment\(payment\)/);
assert.match(projection, /listedForOrder\.find\(item => item\?\.id && !isCanonicalLinkageOnlyPayment\(item\)\)/);
assert.match(projection, /&& !isCanonicalLinkageOnlyPayment\(payment\)/);
assert.match(sync, /canonical_linkage_only/);
assert.match(sync, /Boolean\(order\.payment_linkage && order\.payment_linkage\.canonical_linkage_only\)/);
assert.match(sync, /ensurePaymentForSyncedOrder/);
assert.match(state, /In-memory frontend projection only/);
// The order queue must use the canonical order-level Payment Core summary;
// an individual payment's state is not a substitute for the order aggregate.
assert.doesNotMatch(queue, /getPaymentForOrder/);
assert.match(queue, /getCachedOrderPaymentSummary/);
assert.match(queue, /Order payment:/);
assert.match(queue, /Order payment: \$\{escapeHtml\(orderPaymentSummary\.status\)\}/,
  'the queue renders only a validated canonical status rather than inventing a fallback');
assert.doesNotMatch(queue, /orderPaymentSummary\.status \|\| ['\"]UNPAID['\"]/);
assert.match(queue, /function isUsableOrderPaymentSummary/);
assert.match(queue, /Number\.isSafeInteger\(summary\.verifiedMinor\)/);
assert.match(queue, /Number\.isSafeInteger\(summary\.outstandingMinor\)/);
assert.doesNotMatch(queue, /formatMoney\(orderPaymentSummary\.verifiedMinor \|\| 0\)/);
assert.doesNotMatch(queue, /formatMoney\(orderPaymentSummary\.outstandingMinor \|\| 0\)/);
assert.match(queue, /status or amounts unavailable/);
assert.match(queue, /outstanding/);
assert.doesNotMatch(queue, /paymentStateLine|Payment Core:.*payment\\.state/);
assert.match(sync, /refreshPaymentProjection/);
assert.doesNotMatch(projection, /saveJSON|localStorage|STORAGE_KEYS/);

console.log('PASS PF-1 payment frontend projection boundary');

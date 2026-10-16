import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
const checkout = await readFile(new URL('../app/src/orders/checkout.js', import.meta.url), 'utf8');
const modalStart = html.indexOf('<div class="modal-backdrop" id="paymentProofModal">');
assert.ok(modalStart >= 0, 'checkout payment method modal must exist');
const modalEnd = html.indexOf('</div>\n\n<div class="modal-backdrop" id="tableEditModal"', modalStart);
assert.ok(modalEnd > modalStart, 'checkout payment modal boundary must be identifiable');
const modal = html.slice(modalStart, modalEnd);

assert.match(modal, /<h3>Review payment method<\/h3>/);
assert.match(modal, /Saving creates an order in the queue/);
assert.match(modal, /Order total/);
assert.match(modal, /id="checkoutPaymentOrderTotal"/);

const paymentProof = await readFile(new URL('../app/src/orders/payment-proof.js', import.meta.url), 'utf8');
assert.match(paymentProof, /items\.reduce\(\(sum, item\) => sum \+ item\.qty \* item\.price, 0\)/);
assert.match(paymentProof, /formatMoney\(total, config\.currencyCode\)/);
assert.match(paymentProof, /CS\(\)/);
assert.match(modal, /does not confirm payment/);
assert.match(modal, /id="orderPayMethod"/);
assert.match(modal, /Save order to queue/);
assert.doesNotMatch(modal, /Confirm payment|Complete sale/);

// The order remains locally queued and explicitly unlinked; this UI copy must
// not accidentally imply that a selected method or uploaded proof is authority.
assert.match(checkout, /status: 'queued'/);
assert.match(checkout, /status: 'UNLINKED'/);
assert.match(checkout, /payment_id: null/);
console.log('Checkout payment-state clarity and order-total regression: PASS');

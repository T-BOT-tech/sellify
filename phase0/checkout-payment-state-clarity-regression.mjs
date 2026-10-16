import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
const checkout = await readFile(new URL('../app/src/orders/checkout.js', import.meta.url), 'utf8');

const modalStart = html.indexOf('id="paymentProofModal"');
assert.ok(modalStart >= 0, 'checkout payment method modal must exist');
const modalEnd = html.indexOf('</div>', modalStart);
const modal = html.slice(modalStart, modalEnd > modalStart ? modalEnd : modalStart + 3000);
assert.match(modal, /id="checkoutPaymentStateNotice"/);
assert.match(modal, /Saving this sale adds the order to the queue\./);
assert.match(modal, /receipt photo is not payment confirmation/);
assert.match(modal, /payment status is confirmed separately/);
assert.match(modal, /data-i18n="completeSale">Complete sale<\/button>/);

assert.match(checkout, /payment_linkage:\s*\{\s*status:\s*'UNLINKED'/, 'local checkout must leave canonical payment linkage unlinked');
assert.match(checkout, /status:\s*'queued'/, 'local checkout must queue the order instead of claiming payment success');
assert.doesNotMatch(checkout, /payment_status:\s*['"]PAID['"]/, 'checkout must not invent canonical paid state');
console.log('Checkout payment-state clarity regression: PASS');

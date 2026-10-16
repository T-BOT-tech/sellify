import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const start = html.indexOf('id="paymentProofModal"');
const end = html.indexOf('id="tableEditModal"', start);
assert.ok(start >= 0 && end > start, 'payment checkout modal should exist');
const checkout = html.slice(start, end);
assert.match(checkout, /<h3 data-i18n="saveOrderQueue">/, 'checkout heading should describe saving the order, not confirming payment');
assert.ok(checkout.includes('id="checkoutPaymentStateHint"'), 'checkout should expose a payment-state explanation');
assert.match(checkout, /data-i18n="checkoutPaymentStateHint"/, 'payment-state explanation should be localized');
assert.match(checkout, /Completing this step saves the order to your queue/i, 'checkout should explain the order-save outcome');
assert.match(checkout, /does not confirm that a payment was received/i, 'checkout must not imply receipt evidence confirms payment');
assert.match(checkout, /onclick="confirmOrderWithProof\(\)"/, 'checkout should retain the existing save action');
assert.match(checkout, /id="orderPayMethod"/, 'checkout should retain payment-method selection');

for (const locale of ['en', 'am', 'om', 'so', 'sw', 'es', 'hi']) {
  const source = readFileSync(new URL(`../app/src/i18n/locales/${locale}.js`, import.meta.url), 'utf8');
  assert.match(source, /checkoutPaymentStateHint\s*:/, `locale ${locale} should translate the payment-state explanation`);
}
console.log('Checkout payment-state clarity regression: PASS');

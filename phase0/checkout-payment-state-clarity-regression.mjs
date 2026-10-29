import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
const checkout = await readFile(new URL('../app/src/orders/checkout.js', import.meta.url), 'utf8');
const queue = await readFile(new URL('../app/src/orders/queue.js', import.meta.url), 'utf8');
const modalStart = html.indexOf('<div class="modal-backdrop" id="paymentProofModal">');
assert.ok(modalStart >= 0, 'checkout payment method modal must exist');
const modalEnd = html.indexOf('</div>\n\n<div class="modal-backdrop" id="tableEditModal"', modalStart);
assert.ok(modalEnd > modalStart, 'checkout payment modal boundary must be identifiable');
const modal = html.slice(modalStart, modalEnd);

assert.match(modal, /role="dialog" aria-modal="true" aria-labelledby="checkoutPaymentTitle" aria-describedby="checkoutPaymentStateHint"/);
assert.match(modal, /<h3 id="checkoutPaymentTitle" data-i18n="saveOrderQueue">Save order to queue<\/h3>/);
assert.match(modal, /data-i18n="checkoutPaymentStateHint"/);
assert.match(modal, /Order total/);
assert.match(modal, /id="checkoutPaymentOrderTotal"/);

const paymentProof = await readFile(new URL('../app/src/orders/payment-proof.js', import.meta.url), 'utf8');
assert.match(paymentProof, /items\.reduce\(\(sum, item\) => sum \+ item\.qty \* item\.price, 0\)/);
assert.match(paymentProof, /formatMoney\(total, config\.currencyCode\)/);
assert.match(paymentProof, /CS\(\)/);
assert.match(modal, /id="checkoutSaveOrderButton"/);
assert.match(paymentProof, /confirmButton\.disabled = enabledMethods\.length === 0/);
assert.match(paymentProof, /t\('checkoutNoPaymentMethods'\)/);
assert.match(modal, /id="checkoutSaveOrderButton"/);
assert.match(paymentProof, /confirmButton\.disabled = enabledMethods\.length === 0/);
assert.match(paymentProof, /t\('checkoutNoPaymentMethods'\)/);

// If a merchant selected a receipt and saving it fails, checkout must remain
// open for retry; it must not silently continue with an order lacking proof.
const confirmStart = paymentProof.indexOf('export async function confirmOrderWithProof()');
const confirmEnd = paymentProof.indexOf('\nexport function compressImage', confirmStart);
assert.ok(confirmStart >= 0 && confirmEnd > confirmStart, 'proof confirmation flow must be identifiable');
const confirmFlow = paymentProof.slice(confirmStart, confirmEnd);
assert.match(confirmFlow, /showToast\(t\('checkoutReceiptSaveFailed'\)\);\s*return;/);
assert.match(confirmFlow, /catch \(e\) \{[\s\S]*?return;\s*\}\s*\}\s*closePaymentProofModal\(\);/);

// A slow receipt compression/storage operation must not let rapid repeated
// taps create multiple local orders.
assert.match(paymentProof, /let isConfirmingOrderWithProof = false/);
assert.match(confirmFlow, /if \(isConfirmingOrderWithProof\) return/);
assert.match(confirmFlow, /const selectedMethod = \(config\.paymentMethods \|\| \[\]\)\.find\(pm => pm\.id === payMethodId && pm\.enabled\)/);
assert.match(confirmFlow, /if \(!selectedMethod\) \{[\s\S]*?return;/);
assert.match(confirmFlow, /const selectedMethod = \(config\.paymentMethods \|\| \[\]\)\.find\(pm => pm\.id === payMethodId && pm\.enabled\)/);
assert.match(confirmFlow, /if \(!selectedMethod\) \{[\s\S]*?return;/);
assert.match(confirmFlow, /isConfirmingOrderWithProof = true/);
assert.match(confirmFlow, /confirmButton\.disabled = true/);
assert.match(confirmFlow, /confirmButton\.setAttribute\('aria-busy', 'true'\)/);
assert.match(confirmFlow, /finally \{[\s\S]*?isConfirmingOrderWithProof = false/);
assert.match(confirmFlow, /confirmButton\.disabled = wasDisabled/);

assert.match(modal, /does not confirm that a payment was received/);
assert.match(modal, /id="orderPayMethod"/);
assert.match(modal, /Save order to queue/);
assert.doesNotMatch(modal, /Confirm payment|Complete sale/);

// The order remains locally queued and explicitly unlinked; this UI copy must
// not accidentally imply that a selected method or uploaded proof is authority.
assert.match(checkout, /status: 'queued'/);
assert.match(checkout, /status: 'UNLINKED'/);
assert.match(checkout, /payment_id: null/);
const saveOrderStart = checkout.indexOf('export function saveOrder(payMethodId, proofMeta)');
const saveOrderEnd = checkout.indexOf('\\nexport ', saveOrderStart + 1);
const saveOrderFlow = checkout.slice(saveOrderStart, saveOrderEnd > saveOrderStart ? saveOrderEnd : undefined);
assert.match(saveOrderFlow, /find\(pm => pm\.id === resolvedMethodId && pm\.enabled\)/);
assert.match(saveOrderFlow, /if \(!methodMeta\) \{[\s\S]*?showToast\([\s\S]*?return;/);
assert.doesNotMatch(saveOrderFlow, /payMethodId \|\| 'cash'/);

// The order queue must distinguish a selected method/receipt from canonical
// payment confirmation for locally queued orders.
assert.match(queue, /receipt attached \(evidence only\)/);
assert.match(queue, /Payment tracking: Not yet linked to Payment Core/);
assert.match(queue, /!o\.server_order_id && o\.payment_linkage\?\.status === 'UNLINKED'/);
assert.match(queue, /Payment status unavailable/);
assert.doesNotMatch(queue, /orderPaymentSummary\.status \|\| 'UNPAID'/);
assert.match(queue, /verifiedMinor \?\? orderPaymentSummary\.verified_minor \?\? 0/);

for (const locale of ['en', 'am', 'om', 'so', 'sw', 'es', 'hi']) {
  const source = await readFile(new URL(`../app/src/i18n/locales/${locale}.js`, import.meta.url), 'utf8');
  assert.match(source, /checkoutPaymentStateHint\s*:/, `locale ${locale} should localize the payment-state explanation`);
  assert.match(source, /checkoutNoPaymentMethods\s*:/, `locale ${locale} should localize missing payment-method guidance`);
  assert.match(source, /checkoutReceiptSaveFailed\s*:/, `locale ${locale} should localize receipt-save recovery guidance`);
}
console.log('Checkout payment-state clarity and order-total regression: PASS');

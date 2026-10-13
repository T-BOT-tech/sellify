import fs from 'node:fs';
import assert from 'node:assert/strict';

const queue = fs.readFileSync('app/src/orders/queue.js', 'utf8');

// Canonical summary refresh invalidates stale order-level financial data before
// requesting Payment Core. On failure, the UI must not keep a cached PAID/etc summary.
assert.match(queue, /invalidateOrderPaymentSummaryCache\(id\);[\s\S]*?refreshCanonicalOrderPaymentSummary\(id\)/);
assert.match(queue, /\.catch\(\(\)\s*=>\s*\{[\s\S]*?renderQueue\(\);[\s\S]*?return null;/);

// The per-payment projection may remain in memory after a refresh failure.
// Do not render that state unless a current canonical order summary is available.
assert.match(queue, /const paymentStateLine = orderPaymentSummary && payment\?\.state/);
assert.match(queue, /: \(o\.server_order_id \? '<div class="ticket-customer"><svg class="icon icon-sm"><use href="#i-card"\/><\/svg> Order payment: checking…<\/div>' : ''\)/);

// Proof is explicitly presented as evidence attached to an order, not as a payment decision.
assert.match(queue, /o\.payment_proof \? ' · <svg class="icon icon-sm"><use href="#i-paperclip"\/><\/svg> proof attached' : ''/);

console.log('PASS payment UI stale-state regression');

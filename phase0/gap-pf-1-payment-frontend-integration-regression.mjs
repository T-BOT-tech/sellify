import fs from 'node:fs';
import assert from 'node:assert/strict';

const client = fs.readFileSync('app/src/payments/client.js', 'utf8');
const proof = fs.readFileSync('app/src/orders/payment-proof.js', 'utf8');
const checkout = fs.readFileSync('app/src/orders/checkout.js', 'utf8');
const server = fs.readFileSync('backend/server.js', 'utf8');

assert.match(client, /requiredIdempotencyKey/);
assert.match(client, /Idempotency-Key/);
assert.match(client, /createPayment/);
assert.match(client, /resolvePaymentRouting/);
assert.match(client, /queryPaymentStatus\(paymentId, body = \{\}, \{ idempotencyKey \}/);
assert.match(client, /transitionPaymentLifecycle/);
assert.match(server, /paymentCore\.transitionLifecycle/);
assert.match(server, /Idempotency-Key is required/);
assert.match(server, /paymentCore\.queryStatus/);
assert.match(server, /paymentCore\.resolveRouting/);
assert.match(server, /idempotencyKey,\n    chatId/);
assert.ok(server.includes('\\/payments\\/routing\\/resolve'), 'payment routing resolve endpoint must exist');
assert.match(client, /requiredIdempotencyKey\(idempotencyKey\)/g);
assert.match(proof, /payment_proof/);
assert.match(checkout, /payment_method_id/);
assert.doesNotMatch(checkout, /payments\/ledger|payment_ledger_entries/);
assert.doesNotMatch(checkout, /createPayment\(/);

console.log('PASS PF-1 payment frontend mutation/idempotency integration boundary');

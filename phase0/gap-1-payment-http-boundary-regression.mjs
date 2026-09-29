import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../backend/server.js', import.meta.url), 'utf8');

assert.match(source, /import \{ PaymentCore \} from '\.\/lib\/payments\/payment-core\.js';/);
assert.match(source, /const paymentCore = new PaymentCore\(\{/);

const postPayments = source.match(/if \(req\.method === 'POST'\) \{[\s\S]*?paymentCore\.createPayment\([\s\S]*?return sendJSON\(res, 201, \{ payment: paymentResult\.payment, payment_intent: paymentResult\.intent \}/);
assert.ok(postPayments, 'POST /payments must use PaymentCore.createPayment');

const patchBlock = source.match(/if \(req\.method === 'PATCH' && paymentId\) \{[\s\S]*?\n  \}/);
assert.ok(patchBlock, 'payment PATCH handler must exist');
assert.match(patchBlock[0], /PAYMENT_COMMAND_REQUIRED/);
assert.doesNotMatch(patchBlock[0], /transitionPayment\(/);

assert.match(
  source,
  /payments\/\(\[\^\/\]\+\)\/evidence.*handlePaymentEvidence/
);
assert.match(source, /async function handlePaymentEvidence\(/);
assert.match(source, /paymentCore\.submitEvidence\(/);

console.log('GAP-1 payment HTTP boundary regression: PASS');

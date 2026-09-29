import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const core = await readFile(new URL('../backend/lib/payments/payment-core.js', import.meta.url), 'utf8');
const server = await readFile(new URL('../backend/server.js', import.meta.url), 'utf8');

for (const method of ['verifyPayment', 'retryVerification', 'reconcilePayment']) {
  assert.match(core, new RegExp('async ' + method + '\\('));
  assert.match(core, /commitPaymentDecision\(/);
}
assert.match(core, /invariantGate\.evaluate\(/);
assert.match(core, /decisionEngine\.decide\(/);
assert.match(server, /\/verify\$\/);
assert.match(server, /\/retry-verification\$\//);
assert.match(server, /\/reconcile\$\//);
assert.match(server, /paymentCore\.verifyPayment\(/);
assert.match(server, /paymentCore\.retryVerification\(/);
assert.match(server, /paymentCore\.reconcilePayment\(/);
assert.doesNotMatch(server, /transitionPayment\(/);

console.log('GAP-1 payment command pipeline regression: PASS');

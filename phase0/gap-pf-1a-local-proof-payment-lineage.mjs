import fs from 'node:fs';
import assert from 'node:assert/strict';

const checkout = fs.readFileSync('app/src/orders/checkout.js', 'utf8');
const proof = fs.readFileSync('app/src/orders/payment-proof.js', 'utf8');

assert.match(checkout, /payment_proof: proofMeta \|\| null/);
assert.match(checkout, /payment_linkage:/);
assert.match(checkout, /status: 'UNLINKED'/);
assert.match(checkout, /payment_id: null/);
assert.match(checkout, /payment_intent_id: null/);

// Local proof capture remains evidence-only: it may save/display proof and
// hand it to the local order record, but it must not create/commit payment
// state or write a ledger entry.
assert.doesNotMatch(proof, /createPayment\(/);
assert.doesNotMatch(proof, /commitPaymentDecision\(/);
assert.doesNotMatch(proof, /payments\/ledger/);
assert.match(proof, /saveOrder\(payMethodId, pendingProofMeta\)/);

console.log('PASS PF-1A local proof remains operational evidence with explicit canonical-payment linkage boundary');

import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const core = read('backend/lib/payments/payment-core.js');
const store = read('backend/lib/store-sqlite.js');
const gate = read('backend/lib/payments/invariant-gate.js');
const decision = read('backend/lib/payments/decision-engine.js');
const client = read('app/src/payments/client.js');
const projection = read('app/src/payments/projection.js');
const proof = read('app/src/orders/payment-proof.js');
const checkout = read('app/src/orders/checkout.js');

const query = core.slice(core.indexOf('async queryStatus'), core.indexOf('async recordOperationalAction'));
const commit = store.slice(store.indexOf('export async function commitPaymentDecision'), store.indexOf('export async function getPaymentIdempotency'));

for (const token of [
  'normalizeStatusVerification',
  'insertPaymentEvidence',
  'invariantGate.evaluate',
  'insertPaymentVerification',
  'insertPaymentDecision',
  'commitPaymentDecision',
]) assert.ok(query.includes(token), 'missing queryStatus stage: ' + token);

const stages = [
  'normalizeStatusVerification',
  'insertPaymentEvidence',
  'invariantGate.evaluate',
  'insertPaymentVerification',
  'insertPaymentDecision',
  'commitPaymentDecision',
].map(token => query.indexOf(token));
assert.ok(stages.every((v, i) => v >= 0 && (i === 0 || v > stages[i - 1])));

assert.match(client, /POST/);
assert.match(client, /payments\/.*\/status|status/);
assert.match(client, /Idempotency-Key/);
assert.match(client, /requiredIdempotencyKey/);
assert.match(projection, /queryPaymentStatus/);
assert.match(projection, /paymentCommandKey\('status',/);
assert.match(projection, /upsertPayment\(payment\)/);

assert.doesNotMatch(proof, /createPayment\(/);
assert.doesNotMatch(proof, /queryPaymentStatus\(/);
assert.doesNotMatch(proof, /VERIFIED|RECONCILED/);
assert.match(proof, /payment_proof/);

assert.match(gate, /EVIDENCE_PAYMENT_MATCH/);
assert.match(gate, /EVIDENCE_INTENT_MATCH/);
assert.match(gate, /VERIFICATION_EVIDENCE_MATCH/);
assert.match(gate, /VERIFICATION_RESULT_MATCH/);
assert.match(gate, /verification\?\.result.*MATCH/);

assert.match(decision, /ACCEPT/);
assert.match(decision, /VERIFIED/);
assert.match(commit, /UNTRUSTED_PAYMENT_DECISION_SOURCE/);
assert.match(commit, /INVALID_FINANCIAL_DECISION/);
assert.match(commit, /INVARIANT_GATE_REQUIRED/);
assert.match(commit, /VERIFICATION_MATCH_REQUIRED/);
assert.match(commit, /IDEMPOTENCY_KEY_REQUIRED/);
assert.match(commit, /payments WHERE id = \\? AND organization_id = \\?/);
assert.match(commit, /BEGIN IMMEDIATE/);
assert.match(commit, /INSERT INTO payment_ledger_entries/);
assert.ok(commit.indexOf('INVARIANT_GATE_REQUIRED') < commit.indexOf('UPDATE payments'));
assert.ok(commit.indexOf('UPDATE payments') < commit.indexOf('INSERT INTO payment_ledger_entries'));

assert.match(store, /EVIDENCE_INTENT_PAYMENT_MISMATCH/);
assert.match(store, /EVIDENCE_PROVIDER_PAYMENT_MISMATCH/);
assert.match(store, /PROVIDER_TRANSACTION_DUPLICATE/);
assert.match(store, /uq_payment_verifications_provider_transaction/);
assert.match(store, /payment_ledger_entries WHERE payment_id = \\? AND organization_id = \\?/);
assert.match(store, /payment_reconciliations WHERE payment_id = \\? AND organization_id = \\?/);

assert.match(checkout, /payment_proof/);
assert.match(checkout, /payment_linkage/);

console.log('PASS PF-1J final static certification: payment authority, lineage, idempotency, tenant isolation, financial commit, and frontend canonical projection');

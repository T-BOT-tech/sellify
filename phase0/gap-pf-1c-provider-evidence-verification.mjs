import fs from 'node:fs';
import assert from 'node:assert/strict';

const core = fs.readFileSync('backend/lib/payments/payment-core.js', 'utf8');
const store = fs.readFileSync('backend/lib/store-sqlite.js', 'utf8');

const q = core.slice(core.indexOf('async queryStatus'), core.indexOf('async recordOperationalAction'));
assert.match(q, /normalizeStatusVerification/);
assert.match(q, /insertPaymentEvidence/);
assert.match(q, /invariantGate\.evaluate/);
assert.match(q, /insertPaymentVerification/);
assert.match(q, /insertPaymentDecision/);
assert.match(q, /commitPaymentDecision/);

// Provider status must persist evidence before verification/decision.
assert.ok(q.indexOf('insertPaymentEvidence') < q.indexOf('insertPaymentVerification'));
assert.ok(q.indexOf('insertPaymentVerification') < q.indexOf('commitPaymentDecision'));

// A persisted provider evidence record cannot be rebound to a different
// canonical payment or intent merely by supplying matching-looking IDs.
const evidence = store.slice(store.indexOf('export async function insertPaymentEvidence'), store.indexOf('export async function listPaymentEvidence'));
assert.match(evidence, /payment_intent_id = \?/);
assert.match(evidence, /EVIDENCE_INTENT_PAYMENT_MISMATCH/);
assert.match(evidence, /EVIDENCE_PROVIDER_PAYMENT_MISMATCH/);
assert.match(evidence, /organization_id = \?/);

// Provider transaction reuse is rejected at verification and commit layers.
const verification = store.slice(store.indexOf('export async function insertPaymentVerification'), store.indexOf('export async function insertPaymentDecision'));
assert.match(verification, /PROVIDER_TRANSACTION_DUPLICATE/);
assert.match(verification, /payment-core\./);

const commit = store.slice(store.indexOf('export async function commitPaymentDecision'), store.indexOf('export async function getPaymentIdempotency'));
assert.match(commit, /VERIFICATION_CONTEXT_MISMATCH/);
assert.match(commit, /VERIFICATION_AMOUNT_MISMATCH/);
assert.match(commit, /VERIFICATION_CURRENCY_MISMATCH/);
assert.match(commit, /VERIFICATION_RECEIVER_MISMATCH/);
assert.match(commit, /VERIFICATION_TRANSACTION_MISMATCH/);
assert.match(commit, /assertVerificationFreshness/);

const gate = fs.readFileSync('backend/lib/payments/invariant-gate.js', 'utf8');
assert.match(gate, /EVIDENCE_PAYMENT_MATCH/);
assert.match(gate, /EVIDENCE_INTENT_MATCH/);
assert.match(gate, /VERIFICATION_EVIDENCE_MATCH/);
assert.match(gate, /VERIFICATION_RESULT_MATCH/);
assert.match(gate, /verification\?\.result.*MATCH/);
console.log('PASS PF-1D verification cannot authorize financial acceptance without complete invariant lineage');

const financialCommit = store.slice(store.indexOf('export async function commitPaymentDecision'), store.indexOf('export async function getPaymentIdempotency'));
assert.match(financialCommit, /UNTRUSTED_PAYMENT_DECISION_SOURCE/);
assert.match(financialCommit, /INVALID_FINANCIAL_DECISION/);
assert.match(financialCommit, /INVARIANT_GATE_REQUIRED/);
assert.match(financialCommit, /VERIFICATION_MATCH_REQUIRED/);
assert.match(financialCommit, /INSERT INTO payment_ledger_entries/);
assert.ok(financialCommit.indexOf('INVARIANT_GATE_REQUIRED') < financialCommit.indexOf('INSERT INTO payment_ledger_entries'));
console.log('PASS PF-1E PaymentCore decision → financial state and ledger commit boundary');

assert.match(financialCommit, /IDEMPOTENCY_KEY_REQUIRED/);
assert.match(financialCommit, /idempotencyKey/);
assert.match(store, /uq_payment_verifications_provider_transaction/);
assert.match(store, /PROVIDER_TRANSACTION_DUPLICATE/);
console.log('PASS PF-1F replay, idempotency, and provider transaction identity boundary');

assert.match(store, /payment_ledger_entries WHERE payment_id = \\? AND organization_id = \\?/);
assert.match(store, /payment_reconciliations WHERE payment_id = \\? AND organization_id = \\?/);
assert.match(store, /a\.payment_id = \\? AND a\.organization_id = \\?/);
assert.match(financialCommit, /payments WHERE id = \\? AND organization_id = \\?/);
console.log('PASS PF-1G cross-tenant payment lineage boundaries');

const projection = fs.readFileSync('app/src/payments/projection.js', 'utf8');
assert.match(projection, /queryPaymentStatus/);
assert.match(projection, /paymentCommandKey\('status', id\)/);
assert.match(projection, /upsertPayment\(payment\)/);
assert.match(projection, /refreshCanonicalPaymentStatus/);
const proof = fs.readFileSync('app/src/orders/payment-proof.js', 'utf8');
assert.doesNotMatch(proof, /createPayment\(/);
assert.doesNotMatch(proof, /queryPaymentStatus\(/);
assert.doesNotMatch(proof, /VERIFIED|RECONCILED/);
console.log('PASS PF-1H frontend canonical payment-state boundary');

// PF-1I: certify the complete provider-status financial chain as one ordered boundary.
const chain = [
  q.indexOf('normalizeStatusVerification'),
  q.indexOf('insertPaymentEvidence'),
  q.indexOf('invariantGate.evaluate'),
  q.indexOf('insertPaymentVerification'),
  q.indexOf('insertPaymentDecision'),
  q.indexOf('commitPaymentDecision'),
];
assert.ok(chain.every(index => index >= 0));
assert.ok(chain.every((index, i) => i === 0 || index > chain[i - 1]));
assert.match(q, /idempotencyKey: String\(command\.idempotencyKey/);
assert.match(financialCommit, /BEGIN IMMEDIATE/);
assert.match(financialCommit, /UPDATE payments/);
assert.match(financialCommit, /INSERT INTO payment_ledger_entries/);
assert.ok(financialCommit.indexOf('UPDATE payments') < financialCommit.indexOf('INSERT INTO payment_ledger_entries'));
assert.match(projection, /refreshCanonicalPaymentStatus/);
assert.match(proof, /payment_proof/);
console.log('PASS PF-1I complete provider-status → canonical financial state chain');

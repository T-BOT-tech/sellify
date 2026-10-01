import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const core = readFileSync(new URL('../backend/lib/payments/payment-core.js', import.meta.url), 'utf8');

assert.match(store, /VERIFICATION_PAYMENT_MISMATCH/);
assert.match(store, /VERIFICATION_INTENT_MISMATCH/);
assert.match(store, /VERIFICATION_PROVIDER_MISMATCH/);
assert.match(store, /VERIFICATION_CONTEXT_MISMATCH/);
assert.match(store, /DECISION_VERIFICATION_CONTEXT_MISMATCH/);
assert.match(store, /payment_evidence WHERE id = \? AND organization_id = \?/);
assert.match(store, /payment_verifications WHERE id = \? AND organization_id = \?/);

const commitStart = store.indexOf('export async function commitPaymentDecision');
const commitEnd = store.indexOf('const PAYMENT_STATES', commitStart);
assert.ok(commitStart >= 0 && commitEnd > commitStart);
const commitSection = store.slice(commitStart, commitEnd);
assert.ok(commitSection.indexOf('evidenceRow') < commitSection.indexOf('payment_verifications'));
assert.ok(commitSection.includes('existingVerification'));

const queryStart = core.indexOf('const persistedVerificationResult = await this.store.insertPaymentVerification');
assert.ok(queryStart >= 0);
assert.ok(core.slice(queryStart, queryStart + 1200).includes('persistedVerificationResult.verification'));

console.log('GAP-1.18J verification decision binding regression passed');

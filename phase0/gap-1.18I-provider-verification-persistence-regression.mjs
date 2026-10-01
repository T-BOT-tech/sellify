import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');

const verificationTable = source.indexOf('CREATE TABLE IF NOT EXISTS payment_verifications');
const migration54 = source.indexOf('if (!applied.includes(54))');
const uniqueIndex = source.indexOf('idx_payment_verifications_evidence_verifier');
const insertFn = source.indexOf('export async function insertPaymentVerification');
const duplicateLookup = source.indexOf('SELECT * FROM payment_verifications WHERE evidence_id = ? AND verifier = ?', insertFn);
const duplicateReturn = source.indexOf('duplicate: true', duplicateLookup);
const trustedVerifier = source.indexOf("verifier.startsWith('payment-core.')", insertFn);
const invalidResult = source.indexOf('INVALID_PAYMENT_VERIFICATION_RESULT', insertFn);

assert.ok(verificationTable >= 0, 'payment_verifications table must exist');
assert.ok(migration54 > verificationTable, 'GAP-1.18I migration must run after payment_verifications is created');
assert.ok(uniqueIndex > migration54, 'GAP-1.18I must create a durable verification uniqueness index');
assert.ok(insertFn > verificationTable, 'verification persistence function must remain after schema foundation');
assert.ok(duplicateLookup > insertFn, 'verification persistence must check an existing evidence/verifier/version tuple');
assert.ok(duplicateReturn > duplicateLookup, 'duplicate verification must return the existing record');
assert.ok(trustedVerifier > insertFn, 'only Payment Core verifiers may persist verification');
assert.ok(invalidResult > insertFn, 'verification result must be constrained to the canonical result set');

console.log('GAP-1.18I provider verification persistence regression passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const migration55 = source.indexOf('if (!applied.includes(55))');
const uniqueIndex = source.indexOf('uq_payment_verifications_provider_transaction');
const insertFn = source.indexOf('export async function insertPaymentVerification');
const preflight = source.indexOf('PROVIDER_TRANSACTION_DUPLICATE', insertFn);
const conflictQuery = source.indexOf('observed_transaction_id = ?', insertFn);

assert.ok(migration55 > 0, 'GAP-1.18M migration 55 must exist');
assert.ok(uniqueIndex > migration55, 'durable provider transaction unique index must be created');
assert.ok(insertFn > uniqueIndex, 'verification persistence must follow schema migration');
assert.ok(preflight > insertFn, 'verification persistence must reject an already-bound provider transaction');
assert.ok(conflictQuery > preflight, 'transaction identity conflict lookup must be provider/org scoped');
assert.match(source, /CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_verifications_provider_transaction/);
assert.match(source, /WHERE observed_transaction_id IS NOT NULL AND trim\(observed_transaction_id\) <> ''/);
assert.match(source, /code: 'PROVIDER_TRANSACTION_DUPLICATE'/);
assert.match(source, /GAP-1\.18M — durable provider transaction identity binding/);

console.log('GAP-1.18M provider transaction uniqueness regression passed');

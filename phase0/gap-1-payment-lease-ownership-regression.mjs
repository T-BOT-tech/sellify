import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const store = await readFile(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const core = await readFile(new URL('../backend/lib/payments/payment-core.js', import.meta.url), 'utf8');

assert.match(store, /EVIDENCE_PROCESSING_LEASE_LOST/);
assert.match(store, /processing_attempt/);
assert.match(store, /processingAttempt/);
assert.match(core, /let processingAttempt = null/);
assert.match(core, /processingAttempt = claim\.evidence\?\.processingAttempt/);
assert.match(core, /processingAttempt,\s*\n\s*\}, command\.actor/);

console.log('GAP-1 payment lease ownership regression: PASS');

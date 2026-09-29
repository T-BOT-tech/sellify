import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const store = await readFile(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const core = await readFile(new URL('../backend/lib/payments/payment-core.js', import.meta.url), 'utf8');

assert.match(store, /GAP-1\.3/);
assert.match(store, /UPDATE payment_idempotency_keys SET response_status = \?, response_json = \?, resource_type = \?, resource_id = \?, completed_at = \?/);
assert.match(store, /idempotencyRow/);
assert.match(store, /db\.exec\('COMMIT'\)/);
assert.match(core, /idempotencyCommandType/);
assert.match(core, /idempotencyRequestHash/);
assert.match(core, /commitPaymentDecision\(/);

console.log('GAP-1 payment idempotency atomicity regression: PASS');

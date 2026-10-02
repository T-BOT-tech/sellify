import fs from 'node:fs';
import assert from 'node:assert/strict';

const store = fs.readFileSync('backend/lib/store-sqlite.js', 'utf8');
const fnStart = store.indexOf('function ensureCanonicalPaymentForOrder');
const fnEnd = store.indexOf('const CORE_FULFILLMENT_TRANSITIONS', fnStart);
assert.ok(fnStart >= 0 && fnEnd > fnStart, 'canonical payment sync function must exist');
const fn = store.slice(fnStart, fnEnd);

assert.match(fn, /state,\s*\n\s*external_reference/);
assert.match(fn, /'UNPAID'/);
assert.match(fn, /financialStateAuthority: 'PAYMENT_CORE'/);
assert.match(fn, /canonicalLinkageOnly: true/);

// Proof/cash/legacy state must never select the canonical financial state.
assert.doesNotMatch(fn, /deriveLegacyPaymentState\(order\)/);
assert.doesNotMatch(fn, /state === 'CLAIMED'/);
assert.doesNotMatch(fn, /state === 'RECEIVED'/);

// The synchronization projection must not mutate the payment ledger.
assert.doesNotMatch(fn, /INSERT INTO payment_ledger_entries/);

// The sync response exposes the canonical linkage without claiming verification.
assert.match(store, /payment_id: canonicalPaymentId/);
assert.match(store, /payment_state: 'UNPAID'/);

console.log('PASS PF-1B order sync creates canonical payment identity only; financial state remains PaymentCore-owned');

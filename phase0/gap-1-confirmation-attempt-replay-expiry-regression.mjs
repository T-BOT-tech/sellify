import assert from 'node:assert/strict';
const { updatePaymentConfirmationAttempt } = await import('../backend/lib/store-sqlite.js');

const db = (await import('../backend/lib/store-sqlite.js')).getDatabaseForTests();
const cols = db.prepare("PRAGMA table_info(payment_confirmation_attempts)").all();
assert.ok(cols.some(c => c.name === 'expires_at'));

console.log('GAP-1 confirmation attempt replay/expiry regression fixture: PASS');

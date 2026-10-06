import fs from 'node:fs';
import assert from 'node:assert/strict';

const contract = fs.readFileSync('app/src/payments/contract.js', 'utf8');
const client = fs.readFileSync('app/src/payments/client.js', 'utf8');
const state = fs.readFileSync('app/src/payments/state.js', 'utf8');
const ui = fs.readFileSync('app/src/payments/ui.js', 'utf8');
const server = fs.readFileSync('backend/server.js', 'utf8');

for (const file of ['app/src/payments/contract.js','app/src/payments/client.js','app/src/payments/state.js','app/src/payments/ui.js']) {
  assert.ok(fs.existsSync(file), file + ' missing');
}
assert.match(contract, /PAYMENT_STATES/);
assert.match(contract, /buildPaymentPath/);
assert.match(contract, /buildPaymentIdempotencyKey/);
assert.match(client, /authHeaders/);
assert.match(client, /Idempotency-Key/);
assert.match(client, /\/providers/);
assert.match(client, /\/accounts/);
assert.match(client, /\/ledger/);
assert.match(client, /\/reconciliation/);
assert.match(client, /\/status/);
assert.match(state, /In-memory frontend projection only/);
assert.doesNotMatch(state, /localStorage|saveJSON|STORAGE_KEYS/);
assert.match(ui, /never decides financial outcomes/);
assert.ok(server.includes('pattern: /^\\/tenants\\/([^/]+)\\/payments'), 'canonical tenant payment route must exist');
assert.match(server, /payments:view/);
assert.match(server, /payments:accept/);
assert.match(server, /payments:reconcile/);
assert.match(server, /payments:manage/);

console.log('PASS GAP PF-1 payment frontend contract boundary regression');


const paymentServer = fs.readFileSync('backend/server.js', 'utf8');
assert.match(paymentServer, /paymentCore\.transitionLifecycle/);
assert.match(paymentServer, /IDEMPOTENCY_KEY_REQUIRED/);
const paymentCore = fs.readFileSync('backend/lib/payments/payment-core.js', 'utf8');
assert.match(paymentCore, /idempotencyKey: String\(command\.idempotencyKey/);
const paymentStore = fs.readFileSync('backend/lib/store-sqlite.js', 'utf8');
assert.match(paymentStore, /TRANSITION_LIFECYCLE/);
assert.match(paymentStore, /requestHash/);
assert.match(paymentStore, /IDEMPOTENCY key was already used with a different request|Idempotency key was already used with a different request/);
assert.doesNotMatch(paymentServer, /const payment = await transitionPayment\(chatId, paymentId, target, session, body\)/);
assert.match(client, /transitionPaymentLifecycle/);
assert.doesNotMatch(client, /export async function transitionPayment\(/);

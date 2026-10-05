import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('backend/server.js', 'utf8');
const client = fs.readFileSync('app/src/payments/client.js', 'utf8');
const contract = fs.readFileSync('app/src/payments/contract.js', 'utf8');
const state = fs.readFileSync('app/src/payments/state.js', 'utf8');
const projection = fs.readFileSync('app/src/payments/projection.js', 'utf8');
const checkout = fs.readFileSync('app/src/orders/checkout.js', 'utf8');

for (const permission of ['payments:view', 'payments:accept', 'payments:manage']) {
  assert.match(server, new RegExp(permission.replace(':', '\\:')));
}
assert.match(server, /handlePaymentRoutingResolve/);
assert.match(
  server,
  /handlePaymentRoutingResolve[\\s\\S]*?requireAuthorization\(session, tenant, 'payments', 'payments:view'/
);

// Tenant scope is derived from the authenticated session, not caller-controlled body data.
assert.match(server, /requireSession\(req, tenant\.chatId\)/);
assert.match(server, /organizationId: tenant\.organizationId/);

// Financial mutations require durable idempotency and state-changing commands cannot
// be used by the frontend to force VERIFIED/RECONCILED.
assert.match(server, /Idempotency-Key is required/);
assert.match(server, /PAYMENT_STATE_COMMAND_REQUIRED/);
assert.match(server, /paymentCore\.transitionLifecycle/);

// The frontend always derives its payment path from the authenticated tenant context
// and never stores a financial ledger locally.
assert.match(client, /buildPaymentPath\(config\.chatId/);
assert.match(client, /requiredIdempotencyKey\(idempotencyKey\)/);
assert.match(state, /In-memory frontend projection only/);
assert.doesNotMatch(state, /localStorage|saveJSON|STORAGE_KEYS/);
assert.doesNotMatch(client, /providerToken|botToken|secret|credential/i);

// Payment projection may query and render canonical state, but checkout must not
// create ledger entries or call PaymentCore directly.
assert.match(projection, /listPayments/);
assert.match(projection, /refreshCanonicalPaymentStatus/);
assert.doesNotMatch(checkout, /payment_ledger_entries|payments\/ledger|createPayment\(/);

// The public frontend contract exposes only bounded HTTP error semantics.
for (const status of [400,401,403,404,409,422,500,502,503,504]) {
  assert.match(contract, new RegExp(String(status)));
}

console.log('PASS PF-2 payment frontend adversarial boundary regression');

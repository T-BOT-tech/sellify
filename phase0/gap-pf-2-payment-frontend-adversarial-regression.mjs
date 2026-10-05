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


// Every payment lifecycle mutation is authenticated and permission-bound.
// The route must not allow a session from tenant A to operate on tenant B
// merely by changing the path chatId/paymentId.
const lifecycleStart = server.indexOf('async function handlePaymentLifecycle');
assert.notEqual(lifecycleStart, -1);
const lifecycleBlock = server.slice(lifecycleStart, lifecycleStart + 2200);
assert.match(lifecycleBlock, /requireSession\(req, tenant\.chatId\)/);
assert.match(lifecycleBlock, /paymentCore\.transitionLifecycle/);
assert.match(lifecycleBlock, /organizationId: tenant\.organizationId/);

// Status and routing reads are both authenticated; status additionally requires
// the permission needed to invoke provider-side verification.
const statusStart = server.indexOf('async function handlePaymentStatusQuery');
assert.notEqual(statusStart, -1);
const statusBlock = server.slice(statusStart, statusStart + 2200);
assert.match(statusBlock, /requireSession\(req, tenant\.chatId\)/);
assert.match(statusBlock, /requireAuthorization\(session, tenant, 'payments', 'payments:accept'/);

// Frontend-controlled payment IDs are path-bound and tenant-scoped by the server;
// there must be no alternate organization/tenant selector accepted for these calls.
assert.doesNotMatch(statusBlock, /organizationId:\s*body\.organizationId/);
assert.doesNotMatch(lifecycleBlock, /organizationId:\s*body\.organizationId/);

// Provider/account routing remains server-selected; a client may request a preferred
// account, but it cannot turn routing into a financial state mutation.
const routingStart = server.indexOf('async function handlePaymentRoutingResolve');
assert.notEqual(routingStart, -1);
const routingBlock = server.slice(routingStart, routingStart + 1800);
assert.match(routingBlock, /organizationId: tenant\.organizationId/);
assert.match(routingBlock, /requireAuthorization\(session, tenant, 'payments', 'payments:view'/);
assert.match(routingBlock, /paymentCore\.resolveRouting/);


// Replay semantics: frontend payment mutations must require an idempotency key,
// and the core must use it for refund/settlement/lifecycle mutations rather than
// treating retries as independent financial commands.
const refundStart = server.indexOf('async function handlePaymentRefund');
assert.notEqual(refundStart, -1);
const refundBlock = server.slice(refundStart, refundStart + 1500);
assert.match(refundBlock, /paymentCore\.refund/);
assert.match(refundBlock, /organizationId: tenant\.organizationId/);

const settlementStart = server.indexOf('async function handlePaymentSettlement');
assert.notEqual(settlementStart, -1);
const settlementBlock = server.slice(settlementStart, settlementStart + 1700);
assert.match(settlementBlock, /paymentCore\.createSettlement/);
assert.match(settlementBlock, /organizationId: tenant\.organizationId/);


const paymentStates = contract.match(/PAYMENT_STATES[^;]+/s)?.[0] || '';
assert.match(paymentStates, /FAILED/);
assert.match(paymentStates, /CANCELLED/);
assert.match(paymentStates, /REVERSED/);
assert.match(paymentStates, /EXPIRED/);
assert.match(paymentStates, /RECONCILED/);
assert.match(projection, /refreshCanonicalPaymentStatus/);
assert.match(projection, /upsertPayment\(payment\)/);

// Provider UNKNOWN is a status result, not permission to locally mutate financial state.
assert.doesNotMatch(projection, /state\s*=\s*['"]UNKNOWN['"]/);
assert.doesNotMatch(projection, /state\s*=\s*['"]VERIFIED['"]/);

const core = fs.readFileSync('backend/lib/payments/payment-core.js', 'utf8');
const refundCoreStart = core.indexOf('async refund(command = {})');
assert.notEqual(refundCoreStart, -1);
const refundCoreBlock = core.slice(refundCoreStart, refundCoreStart + 1500);
assert.match(refundCoreBlock, /idempotencyKey/);
assert.match(refundCoreBlock, /getPaymentRefundByIdempotencyKey/);
assert.match(refundCoreBlock, /createPaymentRefundRequest/);

const settlementCoreStart = core.indexOf('async createSettlement(command = {})');
assert.notEqual(settlementCoreStart, -1);
const settlementCoreBlock = core.slice(settlementCoreStart, settlementCoreStart + 1200);
assert.match(settlementCoreBlock, /idempotencyKey/);
assert.match(settlementCoreBlock, /getPaymentSettlementByIdempotencyKey/);

const lifecycleCoreStart = core.indexOf('async transitionLifecycle(command = {})');
assert.notEqual(lifecycleCoreStart, -1);
const lifecycleCoreBlock = core.slice(lifecycleCoreStart, lifecycleCoreStart + 2800);
assert.match(lifecycleCoreBlock, /idempotencyKey/);
assert.match(lifecycleCoreBlock, /commitPaymentDecision/);

// A frontend retry cannot ask the API to directly set a financial state.
assert.doesNotMatch(client, /targetState:\s*['"]VERIFIED['"]/);
assert.doesNotMatch(client, /state:\s*['"]VERIFIED['"]/);
assert.doesNotMatch(client, /ledgerEntry|ledger_entry|payment_ledger_entries/);

console.log('PASS PF-2 payment frontend adversarial boundary regression');

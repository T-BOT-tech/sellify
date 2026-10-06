import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('backend/server.js', 'utf8');
const client = fs.readFileSync('app/src/payments/client.js', 'utf8');
const contract = fs.readFileSync('app/src/payments/contract.js', 'utf8');
const state = fs.readFileSync('app/src/payments/state.js', 'utf8');
const projection = fs.readFileSync('app/src/payments/projection.js', 'utf8');
const checkout = fs.readFileSync('app/src/orders/checkout.js', 'utf8');
const orderQueue = fs.readFileSync('app/src/orders/queue.js', 'utf8');
const core = fs.readFileSync('backend/lib/payments/payment-core.js', 'utf8');
const storeSource = fs.readFileSync('backend/lib/store-sqlite.js', 'utf8');

const paymentCoreSource = core;
const refundSource = storeSource;
const createPaymentStart = storeSource.indexOf('export async function createPaymentWithIntent');
const createPaymentBlock = storeSource.slice(createPaymentStart, createPaymentStart + 12000);


for (const permission of ['payments:view', 'payments:accept', 'payments:manage']) {
  assert.match(server, new RegExp(permission.replace(':', '\\:')));
}
assert.match(server, /handlePaymentRoutingResolve/);
assert.match(
  server,
  /handlePaymentRoutingResolve[\s\S]*?requireAuthorization\(session, tenant, 'payments', 'payments:view'/
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


const retryStatuses = contract.match(/retryable:\s*\[[^\]]+\]/)?.[0] || '';
assert.doesNotMatch(retryStatuses, /409/);
assert.match(retryStatuses, /500/);
assert.match(retryStatuses, /502/);
assert.match(retryStatuses, /503/);
assert.match(retryStatuses, /504/);
assert.doesNotMatch(retryStatuses, /400/);
assert.doesNotMatch(retryStatuses, /401/);
assert.doesNotMatch(retryStatuses, /403/);
assert.doesNotMatch(retryStatuses, /404/);
assert.doesNotMatch(retryStatuses, /422/);

assert.match(client, /requiredIdempotencyKey/);
assert.match(client, /createPayment[\s\S]*Idempotency-Key/);
assert.match(client, /transitionPaymentLifecycle[\s\S]*Idempotency-Key/);
assert.match(client, /queryPaymentStatus[\s\S]*Idempotency-Key/);

// Retrying a financial mutation must preserve the caller-supplied key; the
// client must not silently generate a fresh key inside the mutation wrapper.
const mutationKeyBlock = client.slice(client.indexOf('export async function createPayment'), client.indexOf('export async function transitionPaymentLifecycle'));
assert.doesNotMatch(mutationKeyBlock, /Date\.now\(\)/);
assert.doesNotMatch(mutationKeyBlock, /crypto\.randomUUID/);


const refundCoreStart = core.indexOf('async refund(command = {})');
assert.notEqual(refundCoreStart, -1);
const refundCoreBlock = core.slice(refundCoreStart, refundCoreStart + 3000);
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


// Provider timeout/retry certification: a transport failure must not fabricate
// evidence or a financial state transition; retrying the same successful
// provider observation must address the same evidence fingerprint.
const queryStatusStart = core.indexOf('async queryStatus(command = {})');
assert.notEqual(queryStatusStart, -1);
const queryStatusBlock = core.slice(queryStatusStart, queryStatusStart + 8500);
assert.match(queryStatusBlock, /try\s*\{[\s\S]*provider\.getStatus/);
assert.match(queryStatusBlock, /catch \(error\)/);
assert.match(queryStatusBlock, /throw error/);
assert.match(queryStatusBlock, /fingerprintStatusQuery\(paymentId, payment\.providerId, verification\)/);
const fingerprintStart = core.indexOf('function fingerprintStatusQuery');
assert.notEqual(fingerprintStart, -1);
const fingerprintBlock = core.slice(fingerprintStart, fingerprintStart + 1000);
for (const stableField of ['providerId', 'paymentId', 'observedTransactionId', 'result', 'observedAmountMinor', 'observedReference']) {
  assert.match(fingerprintBlock, new RegExp(stableField));
}
assert.doesNotMatch(fingerprintBlock, /Date\.now|randomUUID|receivedAt/);

// Evidence persistence is organization-scoped and duplicate-safe. A replay
// returns the existing evidence rather than inserting a second record.
const evidenceStart = core.indexOf('async function insertPaymentEvidence');
assert.equal(evidenceStart, -1, 'PaymentCore must delegate evidence persistence to the store');
const storeEvidenceStart = server.indexOf('insertPaymentEvidence');
assert.notEqual(storeEvidenceStart, -1);
assert.match(fs.readFileSync('backend/lib/store-sqlite.js', 'utf8'), /organization_id = \? AND provider_id = \? AND fingerprint = \?/);
assert.match(fs.readFileSync('backend/lib/store-sqlite.js', 'utf8'), /duplicate: true/);


// Concurrency certification: an older canonical response must never overwrite a
// newer payment projection, and an older full-list response must not erase a
// newer locally observed payment.
const { clearPaymentState, getPayments, setPayments, upsertPayment } = await import('../app/src/payments/state.js');
clearPaymentState();
upsertPayment({ id: 'race-1', state: 'VERIFIED', updatedAt: '2026-10-05T12:00:00.000Z' });
upsertPayment({ id: 'race-1', state: 'RECEIVED', updatedAt: '2026-10-05T11:59:00.000Z' });
assert.equal(getPayments().find(payment => payment.id === 'race-1').state, 'VERIFIED');
setPayments([{ id: 'race-1', state: 'RECEIVED', updatedAt: '2026-10-05T11:58:00.000Z' }]);
assert.equal(getPayments().find(payment => payment.id === 'race-1').state, 'VERIFIED');
setPayments([{ id: 'race-1', state: 'RECONCILED', updatedAt: '2026-10-05T12:01:00.000Z' }]);
assert.equal(getPayments().find(payment => payment.id === 'race-1').state, 'RECONCILED');
assert.match(projection, /projectionRefreshSequence/);
assert.match(projection, /paymentStatusSequences/);
assert.match(projection, /sequence === paymentStatusSequences\.get\(id\)/);




// Partial lifecycle certification: a PARTIAL payment may recover to RECEIVED
// for the same payment flow, but cannot be revived from terminal states and
// cannot be promoted directly to VERIFIED.
const paymentTransitions = storeSource.slice(storeSource.indexOf('const PAYMENT_TRANSITIONS'), storeSource.indexOf('function paymentStateTimestampColumn'));
assert.match(paymentTransitions, /EXPIRED: new Set\(\['RECEIVED'\]\)/);
assert.match(paymentTransitions, /CANCELLED: new Set\(\['RECEIVED'\]\)/);
assert.match(paymentTransitions, /PARTIAL: new Set\(\['RECEIVED','FAILED','REJECTED'\]\)/);
assert.doesNotMatch(paymentTransitions, /PARTIAL: new Set\(\['RECEIVED','VERIFIED'/);
assert.match(paymentCoreSource, /Late-success recovery is only valid from EXPIRED or CANCELLED/);
assert.match(paymentCoreSource, /LATE_SUCCESS_CONFIRMATION_REQUIRED/);

// Partial refund must reduce accepted/order capacity without requiring
// the original payment to become REFUNDED.
const summaryBlock = refundSource.slice(
  refundSource.indexOf('export async function getOrderPaymentSummary'),
  refundSource.indexOf('export async function getPayment(', refundSource.indexOf('export async function getOrderPaymentSummary'))
);
assert.match(summaryBlock, /payment_refunds/);
assert.match(summaryBlock, /status = 'SUCCEEDED'/);
assert.match(summaryBlock, /MAX\(0, p\.amount_minor/);

const reservationBlock = refundSource.slice(
  refundSource.indexOf('export async function createPaymentWithIntent'),
  refundSource.indexOf('export async function getOrderPaymentSummary')
);
assert.match(reservationBlock, /payment_refunds/);
assert.match(reservationBlock, /status = 'SUCCEEDED'/);
assert.match(reservationBlock, /MAX\(0, amount_minor/);

// Refund/reversal certification: accepted payment value must be removed
// from order-level acceptance when fully refunded or reversed.
const finalizeRefundStart = refundSource.indexOf('export async function finalizePaymentRefund');
const finalRefundBlock = refundSource.slice(finalizeRefundStart, finalizeRefundStart + 7000);
assert.match(finalRefundBlock, /fullRefund/);
assert.match(finalRefundBlock, /state = \?, updated_at = \?/);
assert.match(finalRefundBlock, /'REFUNDED'/);
assert.match(refundSource, /REFUND_AMOUNT_EXCEEDS_PAYMENT/);
assert.match(finalRefundBlock, /entry_type,amount_minor/);

const transitionText = refundSource.slice(
  refundSource.indexOf('const PAYMENT_TRANSITIONS'),
  refundSource.indexOf('function paymentStateTimestampColumn')
);
assert.match(transitionText, /VERIFIED: new Set\(\['RECONCILED','REVERSED','REFUNDED','MISMATCH'\]\)/);
assert.match(transitionText, /RECONCILED: new Set\(\['REVERSED','REFUNDED'\]\)/);

// Reversal certification: a reversed payment must stop contributing to
// accepted order value and must reverse marketplace allocation/settlement.
assert.match(refundSource, /target === 'REVERSED'/);
assert.match(refundSource, /status = 'REVERSED'/);
assert.match(refundSource, /marketplace_payment_allocations/);
assert.match(refundSource, /marketplace_settlements/);
assert.match(refundSource, /status IN \('PENDING','READY','HELD'\)/);

// Reservation-release certification: terminal/released states must not
// continue consuming an order's outstanding payment capacity.
const reservationStates = createPaymentBlock.match(/state IN \('UNPAID','CLAIMED','RECEIVED','VERIFIED','RECONCILED','PARTIAL'\)/)?.[0] || '';
assert.match(reservationStates, /UNPAID/);
assert.match(reservationStates, /PARTIAL/);
assert.doesNotMatch(reservationStates, /FAILED/);
assert.doesNotMatch(reservationStates, /EXPIRED/);
assert.doesNotMatch(reservationStates, /CANCELLED/);
assert.doesNotMatch(reservationStates, /REJECTED/);
assert.doesNotMatch(reservationStates, /REFUNDED/);

const refundFinalBlock = storeSource.slice(storeSource.indexOf('export async function finalizePaymentRefund'), storeSource.indexOf('export async function getPayment(chatId'));
assert.match(refundFinalBlock, /state = \?, updated_at = \?/);
assert.match(refundFinalBlock, /'REFUNDED'/);
assert.match(refundFinalBlock, /fullRefund/);

// Order UI financial-status certification: the queue must consume the
// canonical order-level Payment Core summary rather than infer PAID/PARTIAL/
// UNPAID from whichever individual payment happens to be in the local projection.
assert.match(orderQueue, /refreshCanonicalOrderPaymentSummary/);
assert.match(orderQueue, /getCachedOrderPaymentSummary/);
assert.match(orderQueue, /Order payment:/);
assert.match(orderQueue, /orderPaymentSummary\.status/);
assert.match(orderQueue, /orderPaymentSummary\.verifiedMinor/);
assert.match(orderQueue, /orderPaymentSummary\.outstandingMinor/);
assert.match(orderQueue, /ORDER_PAYMENT_SUMMARY_TTL_MS/);
assert.match(orderQueue, /orderPaymentSummaryInFlight/);

// Frontend canonical snapshot certification:
// a successful tenant-scoped payment list replaces the projection snapshot;
// records absent from the canonical response must not survive locally.
const stateSource = fs.readFileSync('app/src/payments/state.js', 'utf8');
assert.match(stateSource, /A successful canonical list response is a tenant-scoped snapshot/);
assert.doesNotMatch(stateSource, /for \(const existing of existingById\.values\(\)\)/);

// Order payment lookup must remain backed by the current canonical projection
// rather than a persisted local financial ledger.
assert.match(projection, /getPayments\(\)\.find/);
assert.match(projection, /listPayments\(\{ orderId: serverOrderId, limit: 10 \}\)/);
assert.match(stateSource, /In-memory frontend projection only/);
assert.doesNotMatch(stateSource, /localStorage|saveJSON|STORAGE_KEYS/);

// Concurrent status projection certification:
// once a newer status query wins, an older response must not be returned to
// callers where it could render a stale financial state.
assert.match(projection, /const isLatest = sequence === paymentStatusSequences\.get\(id\)/);
assert.match(projection, /if \(isLatest[\s\S]*return upsertPayment\(payment\)/);
assert.match(projection, /A superseded status response must never escape to its caller/);
assert.match(projection, /getPayments\(\)\.find\(item => String\(item\?\.id\) === id\)/);

// Overpayment matrix certification:
// 10,000 order: a single 10,000 payment is valid; 7,000 + 3,000 is valid;
// a second 7,000 request after 7,000 reserved must be rejected, and the
// BEGIN IMMEDIATE transaction boundary prevents concurrent capacity races.
assert.match(createPaymentBlock, /reservedMinor \+ amountMinor > orderTotalMinor/);
assert.match(createPaymentBlock, /outstandingMinor: Math\.max\(0, orderTotalMinor - reservedMinor\)/);
assert.match(createPaymentBlock, /BEGIN IMMEDIATE/);
assert.match(createPaymentBlock, /COMMIT/);
assert.match(createPaymentBlock, /ROLLBACK/);

// Payment/order currency is canonicalized before reservation so capacity is
// never calculated across mixed currencies.
assert.match(createPaymentBlock, /normaliseCurrency\(order\.currency, currency\) !== currency/);
assert.match(createPaymentBlock, /CURRENCY_MISMATCH/);

// Order payment reservation certification: payment creation must reserve
// the outstanding order balance atomically, preventing concurrent overpayment
// while allowing legitimate split payments.


assert.match(createPaymentBlock, /BEGIN IMMEDIATE/);
assert.match(createPaymentBlock, /state IN \('UNPAID','CLAIMED','RECEIVED','VERIFIED','RECONCILED','PARTIAL'\)/);
assert.match(createPaymentBlock, /reservedMinor \+ amountMinor > orderTotalMinor/);
assert.match(createPaymentBlock, /PAYMENT_AMOUNT_EXCEEDS_ORDER_OUTSTANDING/);

// Order-level aggregation certification: multiple independent verified
// payments can satisfy one order, while unverified/partial movements do not.
assert.match(storeSource, /getOrderPaymentSummary/);
assert.match(storeSource, /verifiedMinor/);
assert.match(storeSource, /pendingMinor/);
assert.match(storeSource, /outstandingMinor/);
assert.ok(storeSource.includes('WHERE p.organization_id = ? AND p.order_id = ?'), 'order payment query must be tenant and order scoped');
assert.match(storeSource, /'UNPAID','CLAIMED','RECEIVED','PARTIAL'/);
assert.match(storeSource, /\['VERIFIED','RECONCILED'\]\.includes/);
assert.match(paymentCoreSource, /getOrderPaymentSummary/);
assert.ok(server.includes('orders\\/([^/]+)\\/payments\\/summary'), 'tenant-scoped order payment summary route must exist');
assert.match(server, /payments', 'payments:view'/);

// Cross-tenant / cross-order isolation certification:
// payment summaries and payment/refund reads are always constrained by the
// authenticated tenant organization and the requested canonical order.
assert.match(storeSource, /FROM payments p[\s\n]+WHERE p\.organization_id = \? AND p\.order_id = \?/);
assert.match(storeSource, /FROM payment_refunds WHERE payment_id = \? AND status = 'SUCCEEDED'/);
assert.match(storeSource, /SELECT \* FROM payments WHERE id = \? AND organization_id = \?/);
assert.match(storeSource, /SELECT \* FROM payment_refunds WHERE id = \? AND organization_id = \?/);

// An order ID from another tenant must not be accepted merely because its
// server_order_id is known; the canonical order lookup is tenant/chat scoped.
assert.match(storeSource, /FROM orders WHERE chat_id = \? AND server_order_id = \?/);

// Partial payment must not be upgraded to VERIFIED using a separate
// provider transaction. Provider transaction identity is immutable/unique;
// a later top-up must be represented by a new payment.
const transitionBlock = storeSource.slice(
  storeSource.indexOf("PARTIAL: new Set"),
  storeSource.indexOf("PARTIAL: new Set") + 90,
);
assert.match(transitionBlock, /PARTIAL: new Set\(\['RECEIVED','FAILED','REJECTED'\]\)/);
assert.match(storeSource, /idx_payment_evidence_org_provider_transaction/);
assert.match(storeSource, /PROVIDER_TRANSACTION_DUPLICATE/);


// Partial ledger certification: PARTIAL must record the actually observed
// received amount, while VERIFIED/RECONCILED continue to use the obligation.

const ledgerInsertStart = storeSource.indexOf("INSERT INTO payment_ledger_entries");
assert.notEqual(ledgerInsertStart, -1);
const ledgerInsertBlock = storeSource.slice(ledgerInsertStart - 600, ledgerInsertStart + 1800);
assert.match(ledgerInsertBlock, /target === 'PARTIAL'/);
assert.match(ledgerInsertBlock, /observedAmountMinor/);
assert.match(ledgerInsertBlock, /row\.amount_minor/);

// Partial-payment certification: a provider amount below the obligation must
// produce PARTIAL, while an exact amount can reach VERIFIED only with all invariants.
const { PaymentDecisionEngine } = await import('../backend/lib/payments/decision-engine.js');
const decisionEngine = new PaymentDecisionEngine();
const partialDecision = decisionEngine.decide({
  payment: { id: 'partial-1', amountMinor: 10000 },
  verification: {
    result: 'MATCH',
    observedAmountMinor: 5000,
    reasonCodes: [],
  },
  invariants: {
    passed: false,
    reasonCodes: ['AMOUNT_MISMATCH'],
  },
});
assert.equal(partialDecision.targetState, 'PARTIAL');
assert.equal(partialDecision.decision, 'MARK_PARTIAL');
assert.match(partialDecision.reasonCodes.join(','), /PARTIAL_PAYMENT/);

const exactMismatch = decisionEngine.decide({
  payment: { id: 'partial-2', amountMinor: 10000 },
  verification: {
    result: 'MATCH',
    observedAmountMinor: 12000,
    reasonCodes: [],
  },
  invariants: {
    passed: false,
    reasonCodes: ['AMOUNT_MISMATCH'],
  },
});
assert.equal(exactMismatch.targetState, 'MISMATCH');
assert.equal(exactMismatch.decision, 'MARK_MISMATCH');

const exactVerified = decisionEngine.decide({
  payment: { id: 'partial-3', amountMinor: 10000 },
  verification: {
    result: 'MATCH',
    observedAmountMinor: 10000,
    reasonCodes: [],
  },
  invariants: { passed: true, reasonCodes: [] },
});
assert.equal(exactVerified.targetState, 'VERIFIED');
assert.equal(exactVerified.decision, 'ACCEPT');

// Terminal replay certification: once the canonical payment has advanced,
// an old provider observation must not resurrect or regress it.
const storeText = fs.readFileSync('backend/lib/store-sqlite.js', 'utf8');
const commitStart = storeText.indexOf('export async function commitPaymentDecision');
assert.notEqual(commitStart, -1);
const commitBlock = storeText.slice(commitStart, commitStart + 15000);
assert.match(commitBlock, /BEGIN IMMEDIATE/);
assert.match(commitBlock, /expectedState/);
assert.match(commitBlock, /PAYMENT_STATE_CONFLICT/);
assert.match(commitBlock, /INVALID_PAYMENT_TRANSITION/);
assert.match(commitBlock, /PAYMENT_TRANSITIONS\[row\.state\]/);
assert.match(commitBlock, /provider_transaction_id/);
assert.match(commitBlock, /PROVIDER_TRANSACTION_DUPLICATE/);
assert.match(commitBlock, /assertVerificationFreshness/);
assert.match(commitBlock, /VERIFICATION_CONTEXT_MISMATCH/);

console.log('PASS PF-2 payment frontend adversarial boundary regression');

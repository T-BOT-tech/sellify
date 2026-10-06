import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-gap1-19-adv-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');
const { registerPaymentProvider, getPaymentProvider } = await import('../backend/lib/payments/provider-registry.js');

let statusCalls = 0;
let reconcileCalls = 0;

registerPaymentProvider({
  id: 'gap1-19-adversarial',
  name: 'GAP-1.19 adversarial provider',
  capabilities: { getStatus: true, reconcile: true, refund: true },
  getStatus: async ({ payment }) => {
    statusCalls += 1;
    const mode = payment.metadata?.providerMode || 'SUCCESS';
    if (mode === 'UNKNOWN') return { status: 'PENDING', observedAt: new Date().toISOString() };
    if (mode === 'FAILED') return { status: 'FAILED', reason: 'provider rejected transaction', observedAt: new Date().toISOString() };
    return {
      status: 'COMPLETED',
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      reference: payment.externalReference,
      transactionId: 'ADV-TX-' + payment.id,
      observedAt: new Date().toISOString(),
    };
  },
  reconcile: async ({ payment }) => {
    reconcileCalls += 1;
    return {
      status: payment.metadata?.reconcileMode || 'MATCHED',
      matched: payment.metadata?.reconcileMode !== 'MISMATCHED',
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      externalReference: payment.externalReference,
      providerTransactionId: 'ADV-REC-' + payment.id,
      observedAt: new Date().toISOString(),
    };
  },
  refund: async ({ refund }) => ({
    status: 'SUCCEEDED',
    refundId: 'ADV-REFUND-' + refund.id,
    transactionId: 'ADV-REFUND-TX-' + refund.id,
  }),
}, { replace: true });

function core() {
  return new PaymentCore({
    store: {
      getPayment: store.getPayment,
      getPaymentIntent: store.getPaymentIntent,
      listPaymentAccounts: store.listPaymentAccounts,
      insertPaymentEvidence: store.insertPaymentEvidence,
      insertPaymentVerification: store.insertPaymentVerification,
      insertPaymentDecision: store.insertPaymentDecision,
      commitPaymentDecision: store.commitPaymentDecision,
      recordPaymentReconciliation: store.recordPaymentReconciliation,
      listPaymentReconciliations: store.listPaymentReconciliations,
      getPaymentRefundByIdempotencyKey: store.getPaymentRefundByIdempotencyKey,
      createPaymentRefundRequest: store.createPaymentRefundRequest,
      finalizePaymentRefund: store.finalizePaymentRefund,
      getPaymentRefunds: store.getPaymentRefunds,
    },
    providerRegistry: { getPaymentProvider },
  });
}

async function setup(metadata = {}) {
  const user = await store.getOrCreateUserByTelegram(
    'gap1-19-adv-' + crypto.randomUUID(), 'GAP-1.19 adversarial test',
  );
  const tenant = await store.createTenantForUser({
    userId: user.id, sellerName: 'GAP-1.19 adversarial store',
    businessType: 'retail', country: 'ET', currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const account = await store.createPaymentAccount(tenant.chatId, {
    providerId: 'gap1-19-adversarial',
    accountIdentifier: 'ADV-ACCOUNT',
  });
  const created = await store.createPaymentWithIntent(tenant.chatId, {
    paymentAccountId: account.id, providerId: 'gap1-19-adversarial',
    channel: 'api', amountMinor: 10000, currency: 'ETB',
    externalReference: 'ADV-REF-' + crypto.randomUUID(),
    metadata, idempotencyKey: 'ADV-CREATE-' + crypto.randomUUID(),
  });
  return { chatId: tenant.chatId, paymentId: created.payment.id, payment: created.payment };
}

async function verify(base) {
  const intent = await store.getPaymentIntent(base.chatId, base.payment.paymentIntentId);
  const evidence = await store.insertPaymentEvidence(base.chatId, {
    paymentId: base.payment.id, paymentIntentId: intent.id,
    providerId: base.payment.providerId, channel: 'api',
    evidenceType: 'PROVIDER_STATUS',
    externalReference: base.payment.externalReference,
    providerTransactionId: 'ADV-TX-' + base.payment.id,
    rawPayload: { status: 'COMPLETED', amountMinor: 10000, currency: 'ETB' },
    normalizedPayload: { result: 'MATCH', observedAmountMinor: 10000, observedCurrency: 'ETB' },
    source: 'gap1-19-adversarial',
  });
  const verification = await store.insertPaymentVerification(base.chatId, {
    paymentId: base.payment.id, paymentIntentId: intent.id,
    evidenceId: evidence.evidence.id, providerId: base.payment.providerId,
    result: 'MATCH', observedAmountMinor: 10000, observedCurrency: 'ETB',
    observedAt: new Date().toISOString(), reasonCodes: [],
    rawResult: { status: 'COMPLETED' }, verifier: 'payment-core.gap1-19-adversarial',
    verifierVersion: '1',
  });
  return store.commitPaymentDecision(base.chatId, {
    paymentId: base.payment.id, expectedState: 'UNPAID',
    targetState: 'VERIFIED', idempotencyKey: 'ADV-VERIFY-' + base.payment.id,
    verification: verification.verification,
    decision: {
      decision: 'ACCEPT', targetState: 'VERIFIED', reasonCodes: [],
      invariantResults: { passed: true }, decisionSource: 'PAYMENT_CORE',
      entryType: 'VERIFIED',
    },
  });
}

const pc = core();

{
  const base = await setup({ providerMode: 'UNKNOWN' });
  const result = await pc.queryStatus({ chatId: base.chatId, paymentId: base.paymentId });
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.payment.state, 'UNPAID');
  assert.equal((await store.listPaymentLedger(base.chatId, base.paymentId)).length, 1);
}

{
  const base = await setup();
  const first = await pc.queryStatus({ chatId: base.chatId, paymentId: base.paymentId });
  const second = await pc.queryStatus({ chatId: base.chatId, paymentId: base.paymentId });
  assert.equal(first.status, 'MATCH');
  assert.equal(second.status, 'MATCH');
  assert.equal((await store.listPaymentLedger(base.chatId, base.paymentId)).length, 1);
  assert.equal(statusCalls >= 2, true);
}

{
  const base = await setup({ reconcileMode: 'MISMATCHED' });
  const first = await pc.reconcile({ chatId: base.chatId, paymentId: base.paymentId });
  const second = await pc.reconcile({ chatId: base.chatId, paymentId: base.paymentId });
  assert.equal(first.status, 'mismatched');
  assert.equal(second.duplicate, true);
  assert.equal((await store.listPaymentLedger(base.chatId, base.paymentId)).length, 1);
  assert.equal(reconcileCalls >= 2, true);
}

{
  const base = await setup();
  await verify(base);
  const [a, b] = await Promise.all([
    pc.refund({ chatId: base.chatId, paymentId: base.paymentId, amountMinor: 6000, currency: 'ETB', idempotencyKey: 'ADV-R-1', reason: 'concurrent refund A' }),
    pc.refund({ chatId: base.chatId, paymentId: base.paymentId, amountMinor: 6000, currency: 'ETB', idempotencyKey: 'ADV-R-2', reason: 'concurrent refund B' }),
  ]);
  const refunds = await store.getPaymentRefunds(base.chatId, base.paymentId);
  const succeeded = refunds.filter(item => item.status === 'SUCCEEDED');
  assert.equal(succeeded.reduce((sum, item) => sum + item.amountMinor, 0) <= 10000, true);
  assert.equal((await store.getPayment(base.chatId, base.paymentId)).state === 'REFUNDED', succeeded.reduce((sum, item) => sum + item.amountMinor, 0) === 10000);
  assert.equal([a.status, b.status].every(status => ['SUCCEEDED', 'UNKNOWN'].includes(status)), true);
}

{
  const base = await setup();
  const failed = await pc.transitionLifecycle({
    chatId: base.chatId, paymentId: base.paymentId,
    targetState: 'FAILED', reason: 'adversarial provider failure',
  });
  assert.equal(failed.payment.state, 'FAILED');
  const ledger = await store.listPaymentLedger(base.chatId, base.paymentId);
  assert.deepEqual(ledger.map(item => item.entryType), ['CREATED', 'FAILED']);
}

console.log('GAP-1.19 adversarial payment certification regression passed');

await rm(tempDir, { recursive: true, force: true });

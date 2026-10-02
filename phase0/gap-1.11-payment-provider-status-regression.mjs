import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-gap1-11-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const { registerPaymentProvider, getPaymentProvider } = await import('../backend/lib/payments/provider-registry.js');
const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');
const { InvariantGate } = await import('../backend/lib/payments/invariant-gate.js');
const { PaymentDecisionEngine } = await import('../backend/lib/payments/decision-engine.js');

let calls = 0;
registerPaymentProvider({
  id: 'telebirr',
  name: 'GAP-1.11 test Telebirr',
  capabilities: { getStatus: true },
  getStatus: async ({ payment }) => {
    calls += 1;
    return {
      status: payment.metadata?.status || 'COMPLETED',
      transactionId: payment.metadata?.transactionId || `TX-${payment.id}`,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      receiverAccount: '251900123456',
      reference: payment.externalReference || `REF-${payment.id}`,
      observedAt: new Date().toISOString(),
    };
  },
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
    },
    providerRegistry: { getPaymentProvider },
    invariantGate: new InvariantGate(),
    decisionEngine: new PaymentDecisionEngine(),
  });
}

async function setup(status = 'COMPLETED') {
  const user = await store.getOrCreateUserByTelegram(
    `gap1-11-user-${crypto.randomUUID()}`,
    'GAP1.11 Test User',
  );
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'GAP1.11 Test Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const account = await store.createPaymentAccount(tenant.chatId, {
    providerId: 'telebirr',
    accountIdentifier: '251900123456',
    phone: '251900123456',
  });
  const result = await store.createPaymentWithIntent(tenant.chatId, {
    paymentAccountId: account.id,
    providerId: 'telebirr',
    channel: 'api',
    amountMinor: 150000,
    currency: 'ETB',
    externalReference: `REF-${crypto.randomUUID()}`,
    metadata: { status },
    idempotencyKey: `gap1-11-${crypto.randomUUID()}`,
  });
  return { chatId: tenant.chatId, payment: result.payment };
}

test('GAP-1.11 provider getStatus MATCH flows through evidence, invariants, decision and canonical ledger', async () => {
  const base = await setup('COMPLETED');
  const result = await core().queryStatus({
    chatId: base.chatId,
    paymentId: base.payment.id,
    actor: null,
    idempotencyKey: 'gap1-11-status-match-1',
  });

  console.log('GAP-1.11 lineage diagnostic', JSON.stringify({ evidence: result.evidence, verification: result.verification, invariantReasons: result.invariants.reasonCodes }, null, 2));

  assert.equal(result.supported, true);
  assert.equal(result.status, 'MATCH');
  assert.equal(result.payment.state, 'VERIFIED');
  assert.equal((await store.getPayment(base.chatId, base.payment.id)).state, 'VERIFIED');
  assert.equal(result.invariants.passed, true);
  assert.equal(result.decision.targetState, 'VERIFIED');
  assert.equal(result.evidence.evidenceType, 'PROVIDER_STATUS');

  const ledger = await store.listPaymentLedger(base.chatId, base.payment.id);
  assert.equal(ledger.length, 2);
  assert.deepEqual(ledger.map(entry => entry.entryType), ['CREATED', 'VERIFIED']);
  assert.equal(calls, 1);
});

test('GAP-1.11 unknown/pending provider status never becomes payment success', async () => {
  const base = await setup('PENDING');
  const result = await core().queryStatus({
    chatId: base.chatId,
    paymentId: base.payment.id,
    actor: null,
    idempotencyKey: 'gap1-11-status-pending-1',
  });

  assert.equal(result.supported, true);
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.decision.decision, 'RETRY_VERIFICATION');
  assert.equal(result.decision.targetState, null);
  assert.equal(result.payment.state, 'UNPAID');

  const ledger = await store.listPaymentLedger(base.chatId, base.payment.id);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].entryType, 'CREATED');

  const verifications = await store.listPaymentVerifications(base.chatId, base.payment.id);
  assert.equal(verifications.length, 1);
  assert.equal(verifications[0].result, 'PENDING');
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

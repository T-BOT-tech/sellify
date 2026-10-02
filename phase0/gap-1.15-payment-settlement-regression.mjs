import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-gap1-15-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

function core() {
  return new PaymentCore({
    store: {
      getPayment: store.getPayment,
      getPaymentSettlementByIdempotencyKey: store.getPaymentSettlementByIdempotencyKey,
      createPaymentSettlement: store.createPaymentSettlement,
      finalizePaymentSettlement: store.finalizePaymentSettlement,
      listPaymentSettlements: store.listPaymentSettlements,
    },
  });
}

async function setup() {
  const user = await store.getOrCreateUserByTelegram(`gap1-15-user-${crypto.randomUUID()}`, 'GAP1.15 Test User');
  const tenant = await store.createTenantForUser({
    userId: user.id, sellerName: 'GAP1.15 Test Store', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const account = await store.createPaymentAccount(tenant.chatId, {
    providerId: 'manual', accountIdentifier: `GAP1.15-${crypto.randomUUID()}`,
  });
  const result = await store.createPaymentWithIntent(tenant.chatId, {
    paymentAccountId: account.id, providerId: 'manual', channel: 'api',
    amountMinor: 10000, currency: 'ETB',
    externalReference: `GAP1.15-${crypto.randomUUID()}`,
    idempotencyKey: `gap1-15-create-${crypto.randomUUID()}`,
  });
  const intent = await store.getPaymentIntent(tenant.chatId, result.payment.paymentIntentId);
  const reference = `GAP1.15-REF-${result.payment.id}`;
  const transactionId = `GAP1.15-TX-${result.payment.id}`;
  const evidenceResult = await store.insertPaymentEvidence(tenant.chatId, {
    paymentId: result.payment.id,
    paymentIntentId: intent.id,
    providerId: 'manual',
    channel: 'api',
    evidenceType: 'PROVIDER_STATUS',
    externalReference: reference,
    providerTransactionId: transactionId,
    rawPayload: { status: 'COMPLETED', amountMinor: result.payment.amountMinor, currency: result.payment.currency, receiverAccount: account.accountIdentifier, reference, transactionId },
    normalizedPayload: { result: 'MATCH', observedAmountMinor: result.payment.amountMinor, observedCurrency: result.payment.currency, observedReceiverAccount: account.accountIdentifier, observedReference: reference, observedTransactionId: transactionId },
    source: 'gap1-15-test',
  });
  const evidence = evidenceResult.evidence;
  const verificationResult = await store.insertPaymentVerification(tenant.chatId, {
    paymentId: result.payment.id,
    paymentIntentId: intent.id,
    evidenceId: evidence.id,
    providerId: 'manual',
    result: 'MATCH',
    observedAmountMinor: result.payment.amountMinor,
    observedCurrency: result.payment.currency,
    observedReceiverAccount: account.accountIdentifier,
    observedReference: reference,
    observedTransactionId: transactionId,
    observedAt: new Date().toISOString(),
    reasonCodes: [],
    rawResult: { status: 'COMPLETED' },
    verifier: 'payment-core.gap-1.15-test',
    verifierVersion: '1',
  });
  await store.commitPaymentDecision(tenant.chatId, {
    paymentId: result.payment.id,
    expectedState: 'UNPAID',
    targetState: 'VERIFIED',
    idempotencyKey: `gap1-15-verify-${crypto.randomUUID()}`,
    verification: {
      ...verificationResult.verification,
      evidenceId: evidence.id,
      paymentIntentId: intent.id,
      providerId: 'manual',
      result: 'MATCH',
    },
    decision: { decision: 'ACCEPT', targetState: 'VERIFIED', reasonCodes: [], invariantResults: { passed: true },
      decisionSource: 'PAYMENT_CORE', entryType: 'VERIFIED' },
  });
  return { chatId: tenant.chatId, paymentId: result.payment.id };
}

test('GAP-1.15 settlement captures gross, provider fee, Sellify fee and net without changing payment confirmation', async () => {
  const base = await setup();
  const pc = core();

  const created = await pc.createSettlement({
    ...base,
    idempotencyKey: 'settlement-1',
    grossAmountMinor: 10000,
    providerFeeMinor: 250,
    sellifyFeeMinor: 350,
    currency: 'ETB',
    reason: 'Provider settlement batch',
  });
  assert.equal(created.settlement.status, 'PENDING');
  assert.equal(created.settlement.grossAmountMinor, 10000);
  assert.equal(created.settlement.providerFeeMinor, 250);
  assert.equal(created.settlement.sellifyFeeMinor, 350);
  assert.equal(created.settlement.netAmountMinor, 9400);
  assert.equal((await store.getPayment(base.chatId, base.paymentId)).state, 'VERIFIED');

  const duplicate = await pc.createSettlement({
    ...base, idempotencyKey: 'settlement-1',
    grossAmountMinor: 10000, providerFeeMinor: 250, sellifyFeeMinor: 350, currency: 'ETB',
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.settlement.id, created.settlement.id);

  const settled = await pc.finalizeSettlement({
    ...base,
    settlementId: created.settlement.id,
    status: 'SETTLED',
    settlementReference: 'SETTLEMENT-BATCH-001',
    providerSettlementReference: 'PROVIDER-BATCH-001',
    reason: 'Settlement confirmed',
  });
  assert.equal(settled.settlement.status, 'SETTLED');
  assert.equal(settled.financialEffect, false);
  assert.equal(settled.paymentStateMutated, false);

  const history = await pc.listSettlements({ ...base });
  assert.equal(history.settlements.length, 1);

  const ledger = await store.listPaymentLedger(base.chatId, base.paymentId);
  assert.deepEqual(ledger.map(x => x.entryType), ['CREATED', 'VERIFIED']);
});

test('GAP-1.15 prevents invalid fees and settlement gross above payment', async () => {
  const base = await setup();
  const pc = core();

  await assert.rejects(() => pc.createSettlement({
    ...base, idempotencyKey: 'bad-fee', grossAmountMinor: 10000,
    providerFeeMinor: 6000, sellifyFeeMinor: 5000, currency: 'ETB',
  }), /Invalid settlement amount or fee model/);

  await assert.rejects(() => pc.createSettlement({
    ...base, idempotencyKey: 'bad-gross', grossAmountMinor: 10001,
    providerFeeMinor: 0, sellifyFeeMinor: 0, currency: 'ETB',
  }), /Settlement gross cannot exceed payment amount/);
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

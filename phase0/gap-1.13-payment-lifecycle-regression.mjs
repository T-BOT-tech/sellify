import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-gap1-13-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

function core() {
  return new PaymentCore({
    store: {
      getPayment: store.getPayment,
      commitPaymentDecision: store.commitPaymentDecision,
    },
  });
}

async function setup() {
  const user = await store.getOrCreateUserByTelegram(
    `gap1-13-user-${crypto.randomUUID()}`,
    'GAP1.13 Test User',
  );
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'GAP1.13 Test Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const account = await store.createPaymentAccount(tenant.chatId, {
    providerId: 'manual',
    accountIdentifier: 'GAP1.13-ACCOUNT',
  });
  const result = await store.createPaymentWithIntent(tenant.chatId, {
    paymentAccountId: account.id,
    providerId: 'manual',
    channel: 'manual',
    amountMinor: 150000,
    currency: 'ETB',
    externalReference: `GAP1.13-${crypto.randomUUID()}`,
    idempotencyKey: `gap1-13-${crypto.randomUUID()}`,
  });
  return { chatId: tenant.chatId, payment: result.payment };
}

async function verifyPayment(base) {
  return store.commitPaymentDecision(base.chatId, {
    paymentId: base.payment.id,
    expectedState: 'UNPAID',
    targetState: 'VERIFIED',
    decision: {
      decision: 'ACCEPT',
      targetState: 'VERIFIED',
      reasonCodes: [],
      decisionSource: 'GAP1.13_TEST',
      entryType: 'VERIFIED',
    },
  });
}

test('GAP-1.13 pending payment can fail and creates an immutable FAILED ledger effect', async () => {
  const base = await setup();
  const result = await core().transitionLifecycle({
    chatId: base.chatId,
    paymentId: base.payment.id,
    targetState: 'FAILED',
    reason: 'Provider explicitly reported failure',
  });
  assert.equal(result.payment.state, 'FAILED');

  const ledger = await store.listPaymentLedger(base.chatId, base.payment.id);
  assert.deepEqual(ledger.map(x => x.entryType), ['CREATED', 'FAILED']);

  await assert.rejects(
    () => core().transitionLifecycle({
      chatId: base.chatId,
      paymentId: base.payment.id,
      targetState: 'VERIFIED',
      reason: 'Illegal direct success',
    }),
    /Unsupported lifecycle target/,
  );
});

test('GAP-1.13 expiration and cancellation are explicit and cancellation can receive a late-success recovery', async () => {
  const expired = await setup();
  const exp = await core().transitionLifecycle({
    chatId: expired.chatId,
    paymentId: expired.payment.id,
    targetState: 'EXPIRED',
    reason: 'Payment intent expired before confirmation',
  });
  assert.equal(exp.payment.state, 'EXPIRED');

  const late = await core().transitionLifecycle({
    chatId: expired.chatId,
    paymentId: expired.payment.id,
    targetState: 'RECEIVED',
    lateSuccess: true,
    reason: 'Late provider success received after expiration',
  });
  assert.equal(late.payment.state, 'RECEIVED');

  const cancelled = await setup();
  const cancel = await core().transitionLifecycle({
    chatId: cancelled.chatId,
    paymentId: cancelled.payment.id,
    targetState: 'CANCELLED',
    reason: 'Payment cancelled before provider confirmation',
  });
  assert.equal(cancel.payment.state, 'CANCELLED');

  const lateCancel = await core().transitionLifecycle({
    chatId: cancelled.chatId,
    paymentId: cancelled.payment.id,
    targetState: 'RECEIVED',
    lateSuccess: true,
    reason: 'Late provider success received after cancellation',
  });
  assert.equal(lateCancel.payment.state, 'RECEIVED');
});

test('GAP-1.13 VERIFIED payment can be reversed exactly once without rewriting historical ledger entries', async () => {
  const base = await setup();
  await verifyPayment(base);

  const reversed = await core().transitionLifecycle({
    chatId: base.chatId,
    paymentId: base.payment.id,
    targetState: 'REVERSED',
    source: 'provider.reversal',
    idempotencyKey: 'gap1-13-reversal-1',
    reason: 'Provider reversal notification',
  });
  assert.equal(reversed.payment.state, 'REVERSED');

  const ledger = await store.listPaymentLedger(base.chatId, base.payment.id);
  assert.deepEqual(ledger.map(x => x.entryType), ['CREATED', 'VERIFIED', 'REVERSED']);
  assert.equal(ledger[1].to_state, 'VERIFIED');
  assert.equal(ledger[2].from_state, 'VERIFIED');
  assert.equal(ledger[2].to_state, 'REVERSED');

  await assert.rejects(
    () => core().transitionLifecycle({
      chatId: base.chatId,
      paymentId: base.payment.id,
      targetState: 'REVERSED',
      source: 'provider.reversal',
      reason: 'Duplicate reversal',
    }),
    /Only VERIFIED or RECONCILED payments can be reversed/,
  );

  await assert.rejects(
    () => core().transitionLifecycle({
      chatId: base.chatId,
      paymentId: base.payment.id,
      targetState: 'REVERSED',
      source: 'provider.reversal',
      reason: 'Out-of-order reversal',
    }),
    /Only VERIFIED or RECONCILED payments can be reversed/,
  );
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-gap1-14-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');
const { registerPaymentProvider } = await import('../backend/lib/payments/provider-registry.js');

registerPaymentProvider({
  id: 'gap1-14-test',
  name: 'GAP-1.14 Refund Test Provider',
  capabilities: { refund: true },
  refund: async ({ refund }) => ({
    status: 'SUCCEEDED',
    refundId: `provider-refund-${refund.id}`,
    transactionId: `provider-tx-${refund.id}`,
  }),
}, { replace: true });

registerPaymentProvider({
  id: 'gap1-14-unsupported',
  name: 'GAP-1.14 Unsupported Provider',
  capabilities: {},
}, { replace: true });

function core() {
  return new PaymentCore({
    store: {
      getPayment: store.getPayment,
      getPaymentIntent: store.getPaymentIntent,
      listPaymentAccounts: store.listPaymentAccounts,
      getPaymentRefundByIdempotencyKey: store.getPaymentRefundByIdempotencyKey,
      createPaymentRefundRequest: store.createPaymentRefundRequest,
      finalizePaymentRefund: store.finalizePaymentRefund,
      getPaymentRefunds: store.getPaymentRefunds,
    },
    providerRegistry: { getPaymentProvider: (id) => {
      if (id === 'gap1-14-test') return {
        id,
        refund: async (...args) => ({
          status: 'SUCCEEDED',
          refundId: `provider-refund-${args[0].refund.id}`,
          transactionId: `provider-tx-${args[0].refund.id}`,
        }),
      };
      if (id === 'gap1-14-unsupported') return {
        id,
        refund: async () => {
          const e = new Error('unsupported');
          e.code = 'PAYMENT_PROVIDER_OPERATION_UNSUPPORTED';
          throw e;
        },
      };
      return null;
    }},
  });
}

async function setup(providerId = 'gap1-14-test') {
  const user = await store.getOrCreateUserByTelegram(`gap1-14-user-${crypto.randomUUID()}`, 'GAP1.14 Test User');
  const tenant = await store.createTenantForUser({
    userId: user.id, sellerName: 'GAP1.14 Test Store', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const account = await store.createPaymentAccount(tenant.chatId, {
    providerId, accountIdentifier: `GAP1.14-${crypto.randomUUID()}`,
  });
  const result = await store.createPaymentWithIntent(tenant.chatId, {
    paymentAccountId: account.id, providerId, channel: 'api',
    amountMinor: 10000, currency: 'ETB',
    externalReference: `GAP1.14-${crypto.randomUUID()}`,
    idempotencyKey: `gap1-14-create-${crypto.randomUUID()}`,
  });
  await store.commitPaymentDecision(tenant.chatId, {
    paymentId: result.payment.id, expectedState: 'UNPAID', targetState: 'VERIFIED',
    decision: { decision: 'ACCEPT', targetState: 'VERIFIED', reasonCodes: [],
      decisionSource: 'GAP1.14_TEST', entryType: 'VERIFIED' },
  });
  return { chatId: tenant.chatId, paymentId: result.payment.id };
}

test('GAP-1.14 partial refunds are durable and full refund is only reached at the cumulative payment amount', async () => {
  const base = await setup();
  const pc = core();

  const first = await pc.refund({
    ...base, amountMinor: 3000, currency: 'ETB',
    idempotencyKey: 'refund-1', reason: 'Partial customer refund',
  });
  assert.equal(first.status, 'SUCCEEDED');
  assert.equal(first.refund.amountMinor, 3000);
  assert.equal((await store.getPayment(base.chatId, base.paymentId)).state, 'VERIFIED');

  const duplicate = await pc.refund({
    ...base, amountMinor: 3000, currency: 'ETB',
    idempotencyKey: 'refund-1', reason: 'Duplicate retry',
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.refund.id, first.refund.id);

  const second = await pc.refund({
    ...base, amountMinor: 7000, currency: 'ETB',
    idempotencyKey: 'refund-2', reason: 'Final refund',
  });
  assert.equal(second.status, 'SUCCEEDED');
  assert.equal((await store.getPayment(base.chatId, base.paymentId)).state, 'REFUNDED');

  const refunds = await pc.listRefunds({ ...base });
  assert.equal(refunds.refunds.length, 2);
  assert.equal(refunds.refunds.reduce((sum, r) => sum + r.amountMinor, 0), 10000);

  const ledger = await store.listPaymentLedger(base.chatId, base.paymentId);
  assert.deepEqual(ledger.map(x => x.entryType), ['CREATED', 'VERIFIED', 'REFUNDED', 'REFUNDED']);
  assert.equal(ledger[2].amountMinor, 3000);
  assert.equal(ledger[3].amountMinor, 7000);

  await assert.rejects(() => pc.refund({
    ...base, amountMinor: 1, currency: 'ETB',
    idempotencyKey: 'refund-over', reason: 'Over refund',
  }), /Only VERIFIED or RECONCILED payments can be refunded/);
});

test('GAP-1.14 provider unsupported remains UNKNOWN and does not create a financial effect', async () => {
  const base = await setup('gap1-14-unsupported');
  const result = await core().refund({
    ...base, amountMinor: 1000, currency: 'ETB',
    idempotencyKey: 'refund-unsupported', reason: 'Unsupported provider',
  });
  assert.equal(result.supported, false);
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.refund.status, 'UNKNOWN');

  const payment = await store.getPayment(base.chatId, base.paymentId);
  assert.equal(payment.state, 'VERIFIED');
  const ledger = await store.listPaymentLedger(base.chatId, base.paymentId);
  assert.deepEqual(ledger.map(x => x.entryType), ['CREATED', 'VERIFIED']);
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

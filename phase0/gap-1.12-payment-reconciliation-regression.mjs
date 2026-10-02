import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-gap1-12-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const { registerPaymentProvider, getPaymentProvider } = await import('../backend/lib/payments/provider-registry.js');
const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

registerPaymentProvider({
  id: 'telebirr',
  name: 'GAP-1.12 reconciliation provider',
  capabilities: { reconcile: true },
  reconcile: async ({ payment }) => ({
    status: payment.metadata?.reconciliationStatus || 'MATCHED',
    matched: payment.metadata?.reconciliationStatus !== 'MISMATCHED',
    amountMinor: payment.metadata?.reconciliationAmount ?? payment.amountMinor,
    currency: payment.currency,
    externalReference: payment.externalReference,
    providerTransactionId: payment.metadata?.providerTransactionId || `TX-${payment.id}`,
    observedAt: new Date().toISOString(),
  }),
}, { replace: true });

registerPaymentProvider({
  id: 'mpesa',
  name: 'GAP-1.12 unsupported provider',
  capabilities: {},
}, { replace: true });

function core() {
  return new PaymentCore({
    store: {
      getPayment: store.getPayment,
      getPaymentIntent: store.getPaymentIntent,
      listPaymentAccounts: store.listPaymentAccounts,
      recordPaymentReconciliation: store.recordPaymentReconciliation,
      listPaymentReconciliations: store.listPaymentReconciliations,
    },
    providerRegistry: { getPaymentProvider },
  });
}

async function setup(providerId = 'telebirr', metadata = {}) {
  const user = await store.getOrCreateUserByTelegram(
    `gap1-12-user-${crypto.randomUUID()}`,
    'GAP1.12 Test User',
  );
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'GAP1.12 Test Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const account = await store.createPaymentAccount(tenant.chatId, {
    providerId,
    accountIdentifier: '251900123456',
    phone: '251900123456',
  });
  const result = await store.createPaymentWithIntent(tenant.chatId, {
    paymentAccountId: account.id,
    providerId,
    channel: 'api',
    amountMinor: 150000,
    currency: 'ETB',
    externalReference: `REF-${crypto.randomUUID()}`,
    metadata,
    idempotencyKey: `gap1-12-${crypto.randomUUID()}`,
  });
  return { chatId: tenant.chatId, payment: result.payment };
}

test('GAP-1.12 reconciliation records normalized match without mutating Payment or ledger', async () => {
  const base = await setup();
  const result = await core().reconcile({
    chatId: base.chatId,
    paymentId: base.payment.id,
  });

  assert.equal(result.supported, true);
  assert.equal(result.status, 'matched');
  assert.equal(result.ledgerMutated, false);
  assert.equal(result.payment.state, 'UNPAID');

  const ledger = await store.listPaymentLedger(base.chatId, base.payment.id);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].entryType, 'CREATED');

  const history = await store.listPaymentReconciliations(base.chatId, base.payment.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].status, 'matched');
  assert.equal(history[0].provider_id, 'telebirr');
});

test('GAP-1.12 mismatch remains reconciliation evidence and does not become a ledger decision', async () => {
  const base = await setup('telebirr', {
    reconciliationStatus: 'MISMATCHED',
    reconciliationAmount: 149999,
  });
  const result = await core().reconcile({
    chatId: base.chatId,
    paymentId: base.payment.id,
  });

  assert.equal(result.supported, true);
  assert.equal(result.status, 'mismatched');
  assert.equal(result.payment.state, 'UNPAID');
  assert.equal(result.ledgerMutated, false);

  const ledger = await store.listPaymentLedger(base.chatId, base.payment.id);
  assert.equal(ledger.length, 1);
});

test('GAP-1.12 duplicate reconciliation evidence is idempotently recorded once', async () => {
  const base = await setup();
  const first = await core().reconcile({ chatId: base.chatId, paymentId: base.payment.id });
  const second = await core().reconcile({ chatId: base.chatId, paymentId: base.payment.id });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);

  const history = await store.listPaymentReconciliations(base.chatId, base.payment.id);
  assert.equal(history.length, 1);
});

test('GAP-1.12 unsupported provider reconciliation remains UNKNOWN/pending', async () => {
  const base = await setup('mpesa');
  const result = await core().reconcile({
    chatId: base.chatId,
    paymentId: base.payment.id,
  });

  assert.equal(result.supported, false);
  assert.equal(result.status, 'pending');
  assert.equal(result.ledgerMutated, undefined);

  const history = await store.listPaymentReconciliations(base.chatId, base.payment.id);
  assert.deepEqual(history, []);
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

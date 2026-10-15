import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-gap1-10-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const store = await import('../backend/lib/store-sqlite.js');

async function setup() {
  const user = await store.getOrCreateUserByTelegram(
    `gap1-10-user-${crypto.randomUUID()}`,
    'GAP1.10 Test User',
  );
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'GAP1.10 Test Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const account = await store.createPaymentAccount(tenant.chatId, {
    providerId: 'telebirr',
    accountIdentifier: `251900${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
    phone: '251900000000',
  });
  const organization = await store.getTenant(tenant.chatId);
  return {
    chatId: tenant.chatId,
    organizationId: organization.organizationId,
    accountId: account.id,
  };
}

function runWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./gap-1.10-payment-concurrency-worker.mjs', import.meta.url),
      { workerData },
    );
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', code => {
      if (code !== 0) reject(new Error(`worker exited with code ${code}`));
    });
  });
}

async function concurrentCreate(count, base) {
  return Promise.all(
    Array.from({ length: count }, () =>
      runWorker({
        operation: 'create-payment',
        chatId: base.chatId,
        input: {
          organizationId: base.organizationId,
          paymentAccountId: base.accountId,
          providerId: 'telebirr',
          channel: 'manual',
          amountMinor: 150000,
          currency: 'ETB',
          idempotencyKey: base.idempotencyKey,
        },
      }),
    ),
  );
}

test('GAP-1.10 canonical linkage shell does not reserve payment capacity or inflate summaries', async () => {
  const base = await setup();
  const localOrderId = `gap1-10-shell-${crypto.randomUUID()}`;
  const [synced] = await store.saveQueuedOrders(base.chatId, [{
    id: localOrderId,
    currency: 'ETB',
    items: [{ id: 'partial-item', name: 'Partial payment test item', qty: 1, price: 1000 }],
  }]);

  assert.equal(synced.status, 'synced');
  assert.ok(synced.order_id);
  assert.ok(synced.payment_id);

  const shell = await store.getPayment(base.chatId, synced.payment_id);
  assert.equal(shell.state, 'UNPAID');
  assert.equal(shell.paymentAccountId, null);
  assert.equal(shell.paymentIntentId, null);
  assert.equal(shell.metadata?.canonicalLinkageOnly, true);

  const first = await store.createPaymentWithIntent(base.chatId, {
    organizationId: base.organizationId,
    paymentAccountId: base.accountId,
    providerId: 'telebirr',
    channel: 'manual',
    amountMinor: 400,
    currency: 'ETB',
    orderId: synced.order_id,
    idempotencyKey: `gap1-10-shell-partial-a-${crypto.randomUUID()}`,
  });
  assert.equal(first.payment.amountMinor, 400);

  const second = await store.createPaymentWithIntent(base.chatId, {
    organizationId: base.organizationId,
    paymentAccountId: base.accountId,
    providerId: 'telebirr',
    channel: 'manual',
    amountMinor: 600,
    currency: 'ETB',
    orderId: synced.order_id,
    idempotencyKey: `gap1-10-shell-partial-b-${crypto.randomUUID()}`,
  });
  assert.equal(second.payment.amountMinor, 600);

  await assert.rejects(
    () => store.createPaymentWithIntent(base.chatId, {
      organizationId: base.organizationId,
      paymentAccountId: base.accountId,
      providerId: 'telebirr',
      channel: 'manual',
      amountMinor: 1,
      currency: 'ETB',
      orderId: synced.order_id,
      idempotencyKey: `gap1-10-shell-overflow-${crypto.randomUUID()}`,
    }),
    error => error.code === 'PAYMENT_AMOUNT_EXCEEDS_ORDER_OUTSTANDING',
  );

  const summary = await store.getOrderPaymentSummary(base.chatId, synced.order_id);
  assert.equal(summary.totalMinor, 1000);
  assert.equal(summary.pendingMinor, 1000);
  assert.equal(summary.verifiedMinor, 0);
  assert.equal(summary.outstandingMinor, 1000);
  assert.equal(summary.status, 'UNPAID');
  assert.equal(summary.byState.UNPAID, 1000);
});

test('GAP-1.10 durable idempotency: concurrent duplicate CREATE_PAYMENT requests produce one payment', async () => {
  const createdPayments = [];

  for (const count of [1, 10, 100]) {
    const base = await setup();
    base.idempotencyKey = `gap1-10-create-${count}`;

    const results = await concurrentCreate(count, base);
    const failures = results.filter(result => !result.ok);
    assert.deepEqual(failures, [], `concurrency=${count} produced failures`);

    const paymentIds = new Set(results.map(result => result.paymentId));
    const intentIds = new Set(results.map(result => result.intentId));
    assert.equal(paymentIds.size, 1, `concurrency=${count} created multiple payments`);
    assert.equal(intentIds.size, 1, `concurrency=${count} created multiple intents`);
    assert.equal(
      results.filter(result => result.idempotent === false).length,
      1,
    );
    assert.equal(
      results.filter(result => result.idempotent === true).length,
      count - 1,
    );

    createdPayments.push({ base, paymentId: [...paymentIds][0] });
  }

  for (const { base, paymentId } of createdPayments) {
    const payments = await store.listPayments(base.chatId, { limit: 500 });
    const ledger = await store.listPaymentLedger(base.chatId, paymentId);
    assert.equal(payments.length, 1);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].entryType, 'CREATED');
  }
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

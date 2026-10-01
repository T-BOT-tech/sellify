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
  const user = await store.getOrCreateUserByTelegram('gap1-10-user', 'GAP1.10 Test User');
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
    accountIdentifier: '251900000000',
    phone: '251900000000',
  });
  const organization = await store.getTenant(tenant.chatId);\n  return { chatId: tenant.chatId, organizationId: organization.organizationId, accountId: account.id };
}

function runWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./gap-1.10-payment-concurrency-worker.mjs', import.meta.url), { workerData });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', code => {
      if (code !== 0) reject(new Error(`worker exited with code ${code}`));
    });
  });
}

async function concurrentCreate(count, base) {
  return Promise.all(Array.from({ length: count }, () => runWorker({
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
  })));
}

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
    assert.equal(results.filter(result => result.idempotent === false).length, count === 1 ? 1 : 0);
    assert.equal(results.filter(result => result.idempotent === true).length, count === 1 ? 0 : count);
  }

  const payments = await store.listPayments(base.chatId, { limit: 500 });
  const ledger = await store.listPaymentLedger(base.chatId, payments[0].id);
  assert.equal(payments.length, 1);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].entryType, 'CREATED');
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

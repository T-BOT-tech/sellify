import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-gap1-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const store = await import('../backend/lib/store-sqlite.js');

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test('GAP-1 store creates PaymentIntent + Payment atomically at safe initial states', async () => {
  const user = await store.getOrCreateUserByTelegram('gap1-user', 'GAP1 Test User');
  const created = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'GAP1 Test Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });

  const tenant = await store.getTenant(created.chatId);
  const account = await store.createPaymentAccount(created.chatId, {
    providerId: 'telebirr',
    accountIdentifier: '251900000000',
    phone: '251900000000',
  });

  const result = await store.createPaymentWithIntent(created.chatId, {
    organizationId: tenant.organizationId,
    paymentAccountId: account.id,
    providerId: 'telebirr',
    channel: 'manual',
    amountMinor: 150000,
    currency: 'ETB',
    idempotencyKey: 'gap1-create-1',
  });

  assert.equal(result.payment.state, 'UNPAID');
  assert.equal(result.intent.status, 'OPEN');
  assert.equal(result.payment.paymentIntentId, result.intent.id);
  assert.equal(result.intent.paymentAccountId, account.id);
});

test('GAP-1 evidence starts RECEIVED and duplicate fingerprint is harmless', async () => {
  const tenants = await store.listTenants();
  const tenant = tenants.at(-1);
  const accounts = await store.listPaymentAccounts(tenant.chatId, { status: 'all' });
  const created = await store.createPaymentWithIntent(tenant.chatId, {
    organizationId: tenant.organizationId,
    paymentAccountId: accounts[0].id,
    providerId: 'telebirr',
    channel: 'manual',
    amountMinor: 50000,
    currency: 'ETB',
    idempotencyKey: 'gap1-create-2',
  });

  const first = await store.insertPaymentEvidence(tenant.chatId, {
    paymentId: created.payment.id,
    paymentIntentId: created.intent.id,
    providerId: 'telebirr',
    channel: 'manual',
    evidenceType: 'REFERENCE',
    fingerprint: 'gap1-evidence-fingerprint',
    payload: { reference: 'TX-123' },
  });
  const second = await store.insertPaymentEvidence(tenant.chatId, {
    paymentId: created.payment.id,
    paymentIntentId: created.intent.id,
    providerId: 'telebirr',
    channel: 'manual',
    evidenceType: 'REFERENCE',
    fingerprint: 'gap1-evidence-fingerprint',
    payload: { reference: 'TX-123' },
  });

  assert.equal(first.evidence.status, 'RECEIVED');
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.evidence.id, first.evidence.id);

  const payment = await store.getPayment(tenant.chatId, created.payment.id);
  assert.equal(payment.state, 'UNPAID');
});

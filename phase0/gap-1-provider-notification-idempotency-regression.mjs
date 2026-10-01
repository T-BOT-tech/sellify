import assert from 'node:assert/strict';

const { mkdtemp, rm } = await import('node:fs/promises');
const { join } = await import('node:path');
const { tmpdir } = await import('node:os');

const dir = await mkdtemp(join(tmpdir(), 'sellify-gap1-notification-idempotency-'));
process.env.SELLIFY_DATA_DIR = dir;

try {
  const store = await import('../backend/lib/store-sqlite.js');

  const user = await store.getOrCreateUserByTelegram('gap1-notification-user', 'GAP1 Notification Idempotency');
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'GAP1 Notification Idempotency',
    country: 'KE',
    currency: 'KES',
  });
  const chatId = tenant.chatId;
  const session = await store.createSession({ userId: user.id, chatId });

  const account = await store.createPaymentAccount(chatId, {
    providerId: 'fixture-notification',
    accountIdentifier: 'NOTIFY-001',
    metadata: { currency: 'KES' },
  }, session);

  const setup = await store.createPaymentWithIntent(chatId, {
    paymentAccountId: account.id,
    providerId: 'fixture-notification',
    channel: 'api',
    amountMinor: 1000,
    currency: 'KES',
  }, session);

  const first = await store.insertPaymentEvidence(chatId, {
    paymentIntentId: setup.intent.id,
    paymentAccountId: account.id,
    providerId: 'fixture-notification',
    channel: 'api',
    evidenceType: 'PROVIDER_NOTIFICATION',
    providerNotificationId: 'NOTIFY-EVENT-001',
    fingerprint: 'notify-fingerprint-001',
    normalizedPayload: { status: 'SUCCESS', event: 'NOTIFY-EVENT-001' },
    source: 'provider-notification',
  }, null);

  const retry = await store.insertPaymentEvidence(chatId, {
    paymentIntentId: setup.intent.id,
    paymentAccountId: account.id,
    providerId: 'fixture-notification',
    channel: 'api',
    evidenceType: 'PROVIDER_NOTIFICATION',
    providerNotificationId: 'NOTIFY-EVENT-001',
    fingerprint: 'notify-fingerprint-001',
    normalizedPayload: { status: 'SUCCESS', event: 'NOTIFY-EVENT-001' },
    source: 'provider-notification',
  }, null);

  assert.equal(retry.duplicate, true);
  assert.equal(retry.evidence.id, first.evidence.id);

  await assert.rejects(
    store.insertPaymentEvidence(chatId, {
      paymentIntentId: setup.intent.id,
      paymentAccountId: account.id,
      providerId: 'fixture-notification',
      channel: 'api',
      evidenceType: 'PROVIDER_NOTIFICATION',
      providerNotificationId: 'NOTIFY-EVENT-001',
      fingerprint: 'notify-fingerprint-CONFLICT',
      normalizedPayload: { status: 'FAILED', event: 'NOTIFY-EVENT-001' },
      source: 'provider-notification',
    }, null),
    error => error?.code === 'PROVIDER_NOTIFICATION_EVIDENCE_CONFLICT' && error?.statusCode === 409,
  );

  await assert.rejects(
    store.insertPaymentEvidence(chatId, {
      providerId: 'fixture-notification',
      channel: 'api',
      evidenceType: 'PROVIDER_NOTIFICATION',
      providerNotificationId: 'NOTIFY-EVENT-NO-ACCOUNT',
      fingerprint: 'notify-no-account',
      normalizedPayload: { status: 'SUCCESS' },
      source: 'provider-notification',
    }, null),
    error => error?.code === 'PAYMENT_ACCOUNT_REQUIRED' && error?.statusCode === 409,
  );

  console.log('GAP-1 provider notification idempotency regression: PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}

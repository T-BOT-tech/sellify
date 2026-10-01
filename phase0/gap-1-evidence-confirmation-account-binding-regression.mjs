import assert from 'node:assert/strict';

const { mkdtemp, rm } = await import('node:fs/promises');
const { join } = await import('node:path');
const { tmpdir } = await import('node:os');

const dir = await mkdtemp(join(tmpdir(), 'sellify-gap1-evidence-binding-'));
process.env.SELLIFY_DATA_DIR = dir;

try {
  const store = await import('../backend/lib/store-sqlite.js');

  const user = await store.getOrCreateUserByTelegram('gap1-evidence-binding-user', 'GAP1 Evidence Binding');
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'GAP1 Evidence Binding',
    country: 'KE',
    currency: 'KES',
  });
  const chatId = tenant.chatId;
  const session = await store.createSession({ userId: user.id, chatId });

  const accountA = await store.createPaymentAccount(chatId, {
    providerId: 'fixture-binding',
    accountIdentifier: 'BIND-A',
    metadata: { currency: 'KES' },
  }, session);
  const accountB = await store.createPaymentAccount(chatId, {
    providerId: 'fixture-binding',
    accountIdentifier: 'BIND-B',
    metadata: { currency: 'KES' },
  }, session);

  const setup = await store.createPaymentWithIntent(chatId, {
    paymentAccountId: accountA.id,
    providerId: 'fixture-binding',
    channel: 'api',
    amountMinor: 1000,
    currency: 'KES',
    metadata: { merchantReference: 'BIND-REF' },
  }, session);

  const evidenceA = await store.insertPaymentEvidence(chatId, {
    paymentIntentId: setup.intent.id,
    paymentAccountId: accountA.id,
    providerId: 'fixture-binding',
    channel: 'api',
    evidenceType: 'PROVIDER_NOTIFICATION',
    providerTransactionId: 'BIND-TX-A',
    fingerprint: 'gap1-binding-a',
    normalizedPayload: { providerTransactionId: 'BIND-TX-A' },
    source: 'provider-notification',
  }, null);

  const attempt = await store.createPaymentConfirmationAttempt(chatId, {
    evidenceId: evidenceA.evidence.id,
    paymentIntentId: setup.intent.id,
  });
  assert.equal(attempt.paymentAccountId, accountA.id);

  const mismatchedEvidence = await store.insertPaymentEvidence(chatId, {
    paymentIntentId: setup.intent.id,
    paymentAccountId: accountB.id,
    providerId: 'fixture-binding',
    channel: 'api',
    evidenceType: 'PROVIDER_NOTIFICATION',
    providerTransactionId: 'BIND-TX-B',
    fingerprint: 'gap1-binding-b',
    normalizedPayload: { providerTransactionId: 'BIND-TX-B' },
    source: 'provider-notification',
  }, null);

  await assert.rejects(
    store.createPaymentConfirmationAttempt(chatId, {
      evidenceId: mismatchedEvidence.evidence.id,
      paymentIntentId: setup.intent.id,
    }),
    error => error?.code === 'PAYMENT_ACCOUNT_BINDING_MISMATCH' && error?.statusCode === 409,
  );

  console.log('GAP-1 evidence-to-confirmation account binding regression: PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}

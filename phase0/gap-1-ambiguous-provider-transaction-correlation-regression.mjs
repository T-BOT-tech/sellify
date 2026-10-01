import assert from 'node:assert/strict';

const { mkdtemp, rm } = await import('node:fs/promises');
const { join } = await import('node:path');
const { tmpdir } = await import('node:os');

const dir = await mkdtemp(join(tmpdir(), 'sellify-gap1-ambiguous-correlation-'));
process.env.SELLIFY_DATA_DIR = dir;

try {
  const store = await import('../backend/lib/store-sqlite.js');

  const user = await store.getOrCreateUserByTelegram('gap1-ambiguous-user', 'GAP1 Ambiguous Correlation');
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'GAP1 Ambiguous Correlation',
    country: 'KE',
    currency: 'KES',
  });
  const chatId = tenant.chatId;
  const session = await store.createSession({ userId: user.id, chatId });

  const account = await store.createPaymentAccount(chatId, {
    providerId: 'fixture-ambiguous',
    accountIdentifier: 'AMB-001',
    metadata: { currency: 'KES' },
  }, session);

  const first = await store.createPaymentWithIntent(chatId, {
    paymentAccountId: account.id,
    providerId: 'fixture-ambiguous',
    channel: 'api',
    amountMinor: 1000,
    currency: 'KES',
  }, session);

  const second = await store.createPaymentWithIntent(chatId, {
    paymentAccountId: account.id,
    providerId: 'fixture-ambiguous',
    channel: 'api',
    amountMinor: 2000,
    currency: 'KES',
  }, session);

  const evidence1 = await store.insertPaymentEvidence(chatId, {
    paymentIntentId: first.intent.id,
    paymentAccountId: account.id,
    providerId: 'fixture-ambiguous',
    channel: 'api',
    evidenceType: 'PROVIDER_NOTIFICATION',
    providerTransactionId: 'AMB-TX-001',
    fingerprint: 'ambiguous-evidence-1',
    normalizedPayload: { providerTransactionId: 'AMB-TX-001' },
    source: 'provider-notification',
  }, null);

  const evidence2 = await store.insertPaymentEvidence(chatId, {
    paymentIntentId: second.intent.id,
    paymentAccountId: account.id,
    providerId: 'fixture-ambiguous',
    channel: 'api',
    evidenceType: 'PROVIDER_NOTIFICATION',
    providerTransactionId: 'AMB-TX-002',
    fingerprint: 'ambiguous-evidence-2',
    normalizedPayload: { providerTransactionId: 'AMB-TX-002' },
    source: 'provider-notification',
  }, null);

  const attempt1 = await store.createPaymentConfirmationAttempt(chatId, {
    evidenceId: evidence1.evidence.id,
    paymentIntentId: first.intent.id,
  });

  const attempt2 = await store.createPaymentConfirmationAttempt(chatId, {
    evidenceId: evidence2.evidence.id,
    paymentIntentId: second.intent.id,
  });

  // Deliberately create an inconsistent database state that cannot be produced
  // through the guarded application path, then verify correlation fails closed.
  const db = store.getDatabaseForTests?.();
  if (!db) {
    console.log('GAP-1 ambiguous correlation regression: SKIPPED (test DB handle unavailable)');
    process.exit(0);
  }

  db.prepare(
    'UPDATE payment_confirmation_attempts SET provider_transaction_id=? WHERE id=?'
  ).run('AMB-COLLIDE-001', attempt1.id);

  db.prepare(
    'UPDATE payment_confirmation_attempts SET provider_transaction_id=? WHERE id=?'
  ).run('AMB-COLLIDE-001', attempt2.id);

  await assert.rejects(
    store.getPaymentConfirmationAttemptByProviderTransaction(chatId, {
      providerId: 'fixture-ambiguous',
      providerTransactionId: 'AMB-COLLIDE-001',
      paymentAccountId: account.id,
    }),
    error =>
      error?.code === 'AMBIGUOUS_PROVIDER_TRANSACTION_CORRELATION' &&
      error?.statusCode === 409,
  );

  console.log('GAP-1 ambiguous provider transaction correlation regression: PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}

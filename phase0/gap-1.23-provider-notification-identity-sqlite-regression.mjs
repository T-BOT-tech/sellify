import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-gap123-'));
const dbPath = path.join(dataDir, 'sellify.sqlite');
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_DB_PATH = dbPath;
process.env.SELLIFY_BACKUP_DIR = path.join(dataDir, 'backups');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const chatId = `gap123-${process.pid}`;
  await store.getOrCreateTenant(chatId);
  await store.createPaymentAccount(chatId, {
    providerId: 'mpesa',
    accountIdentifier: '600001',
  });

  const authenticatedContext = (notificationId, receivedAt) => ({
    authenticated: true,
    providerId: 'mpesa',
    accountIdentifier: '600001',
    notificationId,
    signatureVersion: 'v1',
    receivedAt,
  });
  const evidence = overrides => ({
    evidenceType: 'PROVIDER_NOTIFICATION',
    channel: 'notification',
    externalReference: 'ORDER-100',
    providerTransactionId: 'TX-100',
    normalizedPayload: {
      externalReference: 'ORDER-100',
      providerTransactionId: 'TX-100',
      result: 'received',
    },
    ...overrides,
  });
  const ingest = (notificationId, payload, receivedAt = '2026-10-12T00:00:00.000Z', rawPayload = { delivery: 1 }) =>
    store.insertProviderNotificationEvidence({
      authenticatedContext: authenticatedContext(notificationId, receivedAt),
      evidence: payload,
      rawPayload,
    });

  // First authenticated delivery persists one evidence row.
  const first = await ingest('notif-fallback', evidence({}), '2026-10-12T00:00:00.000Z');
  assert.equal(first.duplicate, false);

  // Same semantic evidence remains idempotent even when transport timestamp
  // and raw delivery wrapper change.
  const replay = await ingest(
    'notif-fallback',
    evidence({}),
    '2026-10-12T00:05:00.000Z',
    { delivery: 2, retry: true },
  );
  assert.equal(replay.duplicate, true);
  assert.equal(replay.evidence.id, first.evidence.id);

  // Same notification identity with changed evidence must conflict before the
  // fallback fingerprint lookup can incorrectly return the original row.
  await assert.rejects(
    ingest('notif-fallback', evidence({
      externalReference: 'ORDER-CHANGED',
      normalizedPayload: {
        externalReference: 'ORDER-CHANGED',
        providerTransactionId: 'TX-100',
        result: 'received',
      },
    })),
    error => error?.statusCode === 409 && error?.code === 'PAYMENT_NOTIFICATION_IDENTITY_CONFLICT',
  );

  // A provider-supplied fingerprint must not bypass the same identity check.
  const providerFingerprint = evidence({ fingerprint: 'provider-fingerprint-1' });
  const providerFirst = await ingest('notif-provider-fingerprint', providerFingerprint);
  assert.equal(providerFirst.duplicate, false);
  const providerReplay = await ingest(
    'notif-provider-fingerprint',
    evidence({ fingerprint: 'provider-fingerprint-1' }),
    '2026-10-12T00:10:00.000Z',
    { delivery: 3 },
  );
  assert.equal(providerReplay.duplicate, true);
  assert.equal(providerReplay.evidence.id, providerFirst.evidence.id);

  await assert.rejects(
    ingest('notif-provider-fingerprint', evidence({
      fingerprint: 'provider-fingerprint-1',
      externalReference: 'ORDER-CHANGED',
      normalizedPayload: {
        externalReference: 'ORDER-CHANGED',
        providerTransactionId: 'TX-100',
        result: 'received',
      },
    })),
    error => error?.statusCode === 409 && error?.code === 'PAYMENT_NOTIFICATION_IDENTITY_CONFLICT',
  );

  const inspect = new DatabaseSync(dbPath);
  try {
    const evidenceCount = Number(inspect.prepare('SELECT COUNT(*) AS n FROM payment_evidence').get().n);
    const paymentCount = Number(inspect.prepare('SELECT COUNT(*) AS n FROM payments').get().n);
    const attemptCount = Number(inspect.prepare('SELECT COUNT(*) AS n FROM payment_confirmation_attempts').get().n);
    const ledgerCount = Number(inspect.prepare('SELECT COUNT(*) AS n FROM payment_ledger_entries').get().n);
    assert.equal(evidenceCount, 2, 'replays/conflicts must not add evidence rows');
    assert.equal(paymentCount, 0, 'notification conflicts must not create payments');
    assert.equal(attemptCount, 0, 'notification conflicts must not create confirmation attempts');
    assert.equal(ledgerCount, 0, 'notification conflicts must not create ledger entries');
  } finally {
    inspect.close();
  }

  // Payment Core must stop at the store conflict boundary before any
  // confirmation attempt or financial decision is attempted.
  const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');
  let confirmationAttemptCalls = 0;
  let financialDecisionCalls = 0;
  const conflict = Object.assign(new Error('Provider notification identity conflict'), {
    statusCode: 409,
    code: 'PAYMENT_NOTIFICATION_IDENTITY_CONFLICT',
  });
  const core = new PaymentCore({
    store: {
      insertProviderNotificationEvidence: async () => { throw conflict; },
      createPaymentConfirmationAttempt: async () => { confirmationAttemptCalls += 1; },
      commitPaymentDecision: async () => { financialDecisionCalls += 1; },
    },
    providerRegistry: {
      requirePaymentProvider: () => ({
        id: 'mpesa',
        capabilities: { authenticateNotification: true },
        authenticateNotification: async raw => ({
          authenticated: true,
          providerId: 'mpesa',
          accountIdentifier: '600001',
          notificationId: raw.body.notificationId,
          signatureVersion: 'v1',
          receivedAt: '2026-10-12T00:00:00.000Z',
        }),
        parseEvidence: async () => ({
          evidenceType: 'PROVIDER_NOTIFICATION',
          providerTransactionId: 'TX-200',
        }),
      }),
    },
  });
  await assert.rejects(
    core.ingestProviderNotification({
      providerId: 'mpesa',
      rawRequest: { body: { notificationId: 'notif-conflict' } },
    }),
    error => error?.code === 'PAYMENT_NOTIFICATION_IDENTITY_CONFLICT',
  );
  assert.equal(confirmationAttemptCalls, 0, 'identity conflict must stop before confirmation attempt creation');
  assert.equal(financialDecisionCalls, 0, 'identity conflict must stop before financial decision');

  console.log('GAP-1.23 provider notification identity SQLite regression: PASS');
} finally {
  await rm(dataDir, { recursive: true, force: true });
}

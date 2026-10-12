import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = mkdtempSync(path.join(os.tmpdir(), 'sellify-gap123-'));
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_DB_PATH = path.join(dataDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const tenant = await store.getOrCreateTenant('gap123-regression-tenant');
  await store.createPaymentAccount(tenant.chatId, {
    providerId: 'mpesa',
    accountIdentifier: 'GAP123-ACCOUNT',
  });

  const authenticatedContext = {
    authenticated: true,
    providerId: 'mpesa',
    accountIdentifier: 'GAP123-ACCOUNT',
    notificationId: 'NOTIF-IDENTITY-1',
    signatureVersion: 'v1',
    receivedAt: '2026-10-12T10:00:00.000Z',
  };
  const evidence = {
    evidenceType: 'PROVIDER_NOTIFICATION',
    channel: 'notification',
    providerTransactionId: 'TX-GAP123-1',
    externalReference: 'ORDER-GAP123-1',
    normalizedPayload: { amountMinor: 12500, currency: 'ETB', status: 'SUCCESS' },
    rawPayload: { deliveryAttempt: 1 },
  };

  const first = await store.insertProviderNotificationEvidence({ authenticatedContext, evidence });
  assert.equal(first.duplicate, false, 'first authenticated notification must persist');

  const db = new DatabaseSync(process.env.SELLIFY_DB_PATH);
  const count = () => Number(db.prepare(
    'SELECT COUNT(*) AS n FROM payment_evidence WHERE organization_id = ? AND provider_notification_id = ?'
  ).get(first.evidence.organizationId, authenticatedContext.notificationId).n);
  const attemptsBefore = Number(db.prepare('SELECT COUNT(*) AS n FROM payment_confirmation_attempts').get().n);
  const ledgerBefore = Number(db.prepare('SELECT COUNT(*) AS n FROM payment_ledger_entries').get().n);
  assert.equal(count(), 1);

  const exactReplay = await store.insertProviderNotificationEvidence({
    authenticatedContext: { ...authenticatedContext, receivedAt: '2026-10-12T10:00:05.000Z' },
    evidence: { ...evidence, rawPayload: { deliveryAttempt: 2 } },
  });
  assert.equal(exactReplay.duplicate, true, 'transport-only replay differences must remain idempotent');
  assert.equal(exactReplay.evidence.id, first.evidence.id);

  await assert.rejects(
    store.insertProviderNotificationEvidence({
      authenticatedContext,
      evidence: {
        ...evidence,
        normalizedPayload: { amountMinor: 99999, currency: 'ETB', status: 'SUCCESS' },
      },
    }),
    error => error?.statusCode === 409 && error?.code === 'PAYMENT_NOTIFICATION_IDENTITY_CONFLICT',
    'changed evidence with fallback fingerprint must conflict before fingerprint dedupe',
  );

  await assert.rejects(
    store.insertProviderNotificationEvidence({
      authenticatedContext,
      evidence: {
        ...evidence,
        fingerprint: 'provider-supplied-stable-fingerprint',
        normalizedPayload: { amountMinor: 77777, currency: 'ETB', status: 'SUCCESS' },
      },
    }),
    error => error?.statusCode === 409 && error?.code === 'PAYMENT_NOTIFICATION_IDENTITY_CONFLICT',
    'changed evidence with a provider-supplied fingerprint must conflict',
  );

  assert.equal(count(), 1, 'conflicts must not append notification evidence');
  assert.equal(Number(db.prepare('SELECT COUNT(*) AS n FROM payment_confirmation_attempts').get().n), attemptsBefore,
    'store-level identity conflicts must not create confirmation attempts');
  assert.equal(Number(db.prepare('SELECT COUNT(*) AS n FROM payment_ledger_entries').get().n), ledgerBefore,
    'store-level identity conflicts must not mutate the payment ledger');
  db.close();
  console.log('GAP-1.23 provider notification identity persistence regression: PASS');
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

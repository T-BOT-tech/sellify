import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-payment-decision-idempotency-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js?decision-idempotency-regression');
  const user = await store.getOrCreateUserByTelegram('decision-idempotency-user', 'Decision Idempotency Regression');
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'Decision Idempotency Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const session = await store.createSession({ userId: user.id, chatId: tenant.chatId });
  assert.ok(session.organizationId, 'test payment must have a canonical organization');

  const db = new DatabaseSync(process.env.SELLIFY_DB_PATH);
  try {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO payments (
      id, organization_id, provider_id, channel, amount_minor, currency, state, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'decision-idempotency-payment', session.organizationId, 'manual', 'manual', 1000, 'ETB', 'UNPAID', now, now,
    );

    const command = {
      paymentId: 'decision-idempotency-payment',
      targetState: 'REJECTED',
      expectedState: 'UNPAID',
      idempotencyKey: 'decision-idempotency-key',
      decision: {
        decision: 'REJECT',
        decisionSource: 'PAYMENT_CORE',
        reason: 'provider observation did not establish payment',
        reasonCodes: ['PAYMENT_NOT_CONFIRMED'],
        invariantResults: { passed: false },
      },
    };

    const first = await store.commitPaymentDecision(tenant.chatId, command);
    assert.equal(first.state, 'REJECTED');

    const replay = await store.commitPaymentDecision(tenant.chatId, structuredClone(command));
    assert.equal(replay.state, 'REJECTED', 'same-key replay must return the committed payment');

    await assert.rejects(
      () => store.commitPaymentDecision(tenant.chatId, {
        ...command,
        decision: { ...command.decision, reason: 'different request under the same key' },
      }),
      error => error?.statusCode === 409 && error?.code === 'IDEMPOTENCY_KEY_REUSE',
      'reusing the key with a different decision payload must conflict',
    );

    assert.equal(
      db.prepare('SELECT COUNT(*) AS n FROM payment_decisions WHERE payment_id = ?').get('decision-idempotency-payment').n,
      1,
      'same-key replay and conflicting reuse must not append another decision',
    );
    assert.equal(
      db.prepare('SELECT COUNT(*) AS n FROM payment_ledger_entries WHERE payment_id = ?').get('decision-idempotency-payment').n,
      1,
      'same-key replay and conflicting reuse must not append another ledger entry',
    );
    assert.equal(
      db.prepare('SELECT state FROM payments WHERE id = ?').get('decision-idempotency-payment').state,
      'REJECTED',
    );

    console.log('GAP-1.18Q payment decision idempotency regression passed.');
  } finally {
    db.close();
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

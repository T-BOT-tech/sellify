import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-payment-transition-idempotency-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js?transition-idempotency-regression');
  const user = await store.getOrCreateUserByTelegram('transition-idempotency-user', 'Transition Idempotency Regression');
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'Transition Idempotency Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const session = await store.createSession({ userId: user.id, chatId: tenant.chatId });
  assert.ok(session.organizationId);

  const db = new DatabaseSync(process.env.SELLIFY_DB_PATH);
  try {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO payments (
      id, organization_id, provider_id, channel, amount_minor, currency, state, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'transition-idempotency-payment', session.organizationId, 'manual', 'manual', 1500, 'ETB', 'UNPAID', now, now,
    );

    const decision = {
      decision: 'REJECT',
      decisionSource: 'PAYMENT_CORE',
      reason: 'provider observation did not establish payment',
      reasonCodes: ['PAYMENT_NOT_CONFIRMED'],
      invariantResults: { passed: false },
    };
    const first = await store.commitPaymentDecision(tenant.chatId, {
      paymentId: 'transition-idempotency-payment',
      targetState: 'REJECTED',
      expectedState: 'UNPAID',
      idempotencyKey: 'transition-idempotency-first',
      decision,
    });
    assert.equal(first.state, 'REJECTED');

    const ledgerBefore = db.prepare(
      'SELECT id, from_state, to_state, amount_minor FROM payment_ledger_entries WHERE payment_id = ?',
    ).all('transition-idempotency-payment');
    assert.equal(ledgerBefore.length, 1);
    assert.equal(ledgerBefore[0].from_state, 'UNPAID');
    assert.equal(ledgerBefore[0].to_state, 'REJECTED');

    // A new command key may reaffirm the current state. It must not be
    // mistaken for a second financial state transition.
    const reaffirmed = await store.commitPaymentDecision(tenant.chatId, {
      paymentId: 'transition-idempotency-payment',
      targetState: 'REJECTED',
      expectedState: 'REJECTED',
      idempotencyKey: 'transition-idempotency-reaffirm',
      decision: { ...decision, reason: 'same rejected state reaffirmed' },
    });
    assert.equal(reaffirmed.state, 'REJECTED');

    const ledgerAfter = db.prepare(
      'SELECT id, from_state, to_state, amount_minor FROM payment_ledger_entries WHERE payment_id = ?',
    ).all('transition-idempotency-payment');
    assert.deepEqual(ledgerAfter, ledgerBefore,
      'reaffirming the current state must not append or alter a financial ledger transition');
    assert.equal(
      db.prepare('SELECT state FROM payments WHERE id = ?').get('transition-idempotency-payment').state,
      'REJECTED',
    );

    console.log('GAP-1.18U financial transition idempotency regression passed.');
  } finally {
    db.close();
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

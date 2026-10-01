import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(tmpdir(), 'sellify-gap1-store-'));
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_BACKUP_DIR = path.join(tempDir, 'backups');

const {
  createTenantForUser,
  getDatabaseForTests,
  commitPaymentDecision,
  insertPaymentEvidence,
} = await import('../backend/lib/store-sqlite.js');

const db = getDatabaseForTests();
const userId = 'gap1-store-user';
const now = new Date().toISOString();

db.prepare(
  'INSERT INTO users (id, telegram_user_id, display_name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)'
).run(userId, 'gap1-store-telegram', 'GAP-1 Store Test', now, now);

const tenant = await createTenantForUser({
  userId,
  sellerName: 'GAP-1 Store Test',
  businessType: 'retail',
  country: 'ET',
  currency: 'ETB',
  timezone: 'Africa/Addis_Ababa',
});
const organizationId = String(
  db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(tenant.chatId).organization_id
);

const accountA = 'gap1-account-a';
const accountB = 'gap1-account-b';
const intentId = 'gap1-intent-001';
const paymentId = 'gap1-payment-001';

for (const [id, providerId] of [[accountA, 'mpesa'], [accountB, 'mpesa']]) {
  db.prepare(
    'INSERT INTO payment_accounts (id, organization_id, provider_id, account_identifier, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, organizationId, providerId, id, 'active', '{}', now, now);
}

db.prepare(
  'INSERT INTO payment_intents (id, organization_id, provider_id, payment_account_id, amount_minor, currency, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
).run(intentId, organizationId, 'mpesa', accountB, 1000, 'ETB', 'PAYMENT_ATTEMPTED', '{}', now, now);

db.prepare(
  'INSERT INTO payments (id, organization_id, payment_intent_id, payment_account_id, provider_id, channel, amount_minor, currency, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
).run(paymentId, organizationId, intentId, accountA, 'mpesa', 'api', 1000, 'ETB', 'RECEIVED', now, now);

const before = db.prepare('SELECT state FROM payments WHERE id = ?').get(paymentId);
assert.equal(before.state, 'RECEIVED');

await assert.rejects(
  (async () => {
    db.prepare(
      'INSERT INTO payment_ledger_entries (id, payment_id, organization_id, entry_type, amount_minor, currency, from_state, to_state, actor_id, reason, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      'gap1-ledger-invalid-amount',
      paymentId,
      organizationId,
      'VERIFIED',
      9999,
      'ETB',
      'RECEIVED',
      'VERIFIED',
      null,
      'tamper',
      '{}',
      now,
    );
  })(),
  /payment ledger amount mismatch/,
);

assert.equal(
  db.prepare('SELECT COUNT(*) AS count FROM payment_ledger_entries WHERE payment_id = ?').get(paymentId).count,
  0,
  'rejected ledger insert must not leave a ledger row',
);

await assert.rejects(
  commitPaymentDecision(
    tenant.chatId,
    {
      paymentId,
      expectedState: 'RECEIVED',
      targetState: 'VERIFIED',
      decision: {
        decision: 'ACCEPT',
        targetState: 'VERIFIED',
        paymentIntentId: intentId,
      },
      verification: {
        id: 'gap1-verification-001',
        paymentIntentId: intentId,
        evidenceId: 'gap1-evidence-missing',
        providerId: 'mpesa',
        result: 'VERIFIED',
      },
    },
  ),
  error => error?.code === 'PAYMENT_DECISION_BINDING_CONFLICT' && error?.statusCode === 409,
);

assert.equal(
  db.prepare('SELECT state FROM payments WHERE id = ?').get(paymentId).state,
  'RECEIVED',
  'account binding failure must not mutate payment state',
);
assert.equal(
  db.prepare('SELECT COUNT(*) AS count FROM payment_decisions WHERE payment_id = ?').get(paymentId).count,
  0,
  'account binding failure must roll back decision insertion',
);
assert.equal(
  db.prepare('SELECT COUNT(*) AS count FROM payment_ledger_entries WHERE payment_id = ?').get(paymentId).count,
  0,
  'account binding failure must roll back ledger insertion',
);

db.prepare('UPDATE payment_intents SET payment_account_id = ? WHERE id = ?').run(accountA, intentId);

await assert.rejects(
  commitPaymentDecision(
    tenant.chatId,
    {
      paymentId,
      expectedState: 'RECEIVED',
      targetState: 'VERIFIED',
      decision: {
        decision: 'ACCEPT',
        targetState: 'VERIFIED',
        paymentIntentId: intentId,
      },
    },
  ),
  error => error?.code === 'PAYMENT_VERIFICATION_REQUIRED' && error?.statusCode === 409,
);

assert.equal(
  db.prepare('SELECT state FROM payments WHERE id = ?').get(paymentId).state,
  'RECEIVED',
  'verified commit without verification must not mutate payment state',
);

await commitPaymentDecision(
  tenant.chatId,
  {
    paymentId,
    expectedState: 'RECEIVED',
    targetState: 'REJECTED',
    decision: {
      decision: 'REJECT',
      targetState: 'REJECTED',
      paymentIntentId: intentId,
    },
  },
);

assert.equal(
  db.prepare('SELECT state FROM payments WHERE id = ?').get(paymentId).state,
  'REJECTED',
  'valid financial transition must update the canonical payment state',
);

const ledger = db.prepare(
  'SELECT entry_type, amount_minor, currency, from_state, to_state FROM payment_ledger_entries WHERE payment_id = ? ORDER BY created_at DESC LIMIT 1'
).get(paymentId);

assert.deepEqual(ledger, {
  entry_type: 'REJECTED',
  amount_minor: 1000,
  currency: 'ETB',
  from_state: 'RECEIVED',
  to_state: 'REJECTED',
}, 'ledger entry must describe the exact canonical payment transition');

const replayIntentId = 'gap1-intent-replay';
const replayPaymentId = 'gap1-payment-replay';
const replayEvidenceId = 'gap1-evidence-replay';

db.prepare(
  'INSERT INTO payment_intents (id, organization_id, provider_id, payment_account_id, amount_minor, currency, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
).run(replayIntentId, organizationId, 'mpesa', accountA, 1000, 'ETB', 'PAYMENT_ATTEMPTED', '{}', now, now);

db.prepare(
  'INSERT INTO payments (id, organization_id, payment_intent_id, payment_account_id, provider_id, channel, amount_minor, currency, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
).run(replayPaymentId, organizationId, replayIntentId, accountA, 'mpesa', 'api', 1000, 'ETB', 'RECEIVED', now, now);

const replayEvidence = await insertPaymentEvidence(tenant.chatId, {
  id: replayEvidenceId,
  paymentId: replayPaymentId,
  paymentIntentId: replayIntentId,
  paymentAccountId: accountA,
  providerId: 'mpesa',
  channel: 'manual',
  evidenceType: 'PROVIDER_TRANSACTION',
  providerTransactionId: 'gap1-replay-tx',
  externalReference: 'gap1-replay-ref',
  fingerprint: 'gap1-replay-fingerprint',
  normalizedPayload: {
    amountMinor: 1000,
    currency: 'ETB',
    providerTransactionId: 'gap1-replay-tx',
    merchantReference: 'gap1-replay-ref',
  },
  rawPayload: {},
  source: 'test',
});

assert.equal(replayEvidence.duplicate, false);

const firstReplayCommit = await commitPaymentDecision(tenant.chatId, {
  paymentId: replayPaymentId,
  expectedState: 'RECEIVED',
  targetState: 'VERIFIED',
  verification: {
    id: 'gap1-replay-verification-a',
    paymentId: replayPaymentId,
    paymentIntentId: replayIntentId,
    evidenceId: replayEvidenceId,
    providerId: 'mpesa',
    result: 'MATCH',
    observedAmountMinor: 1000,
    observedCurrency: 'ETB',
    observedReference: 'gap1-replay-ref',
    observedTransactionId: 'gap1-replay-tx',
    verifier: 'gap1-test',
  },
  decision: {
    id: 'gap1-replay-decision-a',
    paymentId: replayPaymentId,
    paymentIntentId: replayIntentId,
    evidenceId: replayEvidenceId,
    verificationId: 'gap1-replay-verification-a',
    decision: 'ACCEPT',
    targetState: 'VERIFIED',
    entryType: 'VERIFIED',
  },
});

assert.equal(firstReplayCommit.state, 'VERIFIED');
assert.equal(
  db.prepare('SELECT COUNT(*) AS count FROM payment_verifications WHERE evidence_id = ?').get(replayEvidenceId).count,
  1,
);
assert.equal(
  db.prepare('SELECT COUNT(*) AS count FROM payment_decisions WHERE verification_id = ?').get('gap1-replay-verification-a').count,
  1,
);

const replayCommit = await commitPaymentDecision(tenant.chatId, {
  paymentId: replayPaymentId,
  expectedState: 'VERIFIED',
  targetState: 'VERIFIED',
  verification: {
    id: 'gap1-replay-verification-b',
    paymentId: replayPaymentId,
    paymentIntentId: replayIntentId,
    evidenceId: replayEvidenceId,
    providerId: 'mpesa',
    result: 'MATCH',
    observedAmountMinor: 1000,
    observedCurrency: 'ETB',
    observedReference: 'gap1-replay-ref',
    observedTransactionId: 'gap1-replay-tx',
    verifier: 'gap1-test-replay',
  },
  decision: {
    id: 'gap1-replay-decision-b',
    paymentId: replayPaymentId,
    paymentIntentId: replayIntentId,
    evidenceId: replayEvidenceId,
    verificationId: 'gap1-replay-verification-b',
    decision: 'ACCEPT',
    targetState: 'VERIFIED',
    entryType: 'VERIFIED',
  },
});

assert.equal(replayCommit.state, 'VERIFIED');
assert.equal(
  db.prepare('SELECT COUNT(*) AS count FROM payment_verifications WHERE evidence_id = ?').get(replayEvidenceId).count,
  1,
  'replaying the same evidence must not create a second verification',
);
assert.equal(
  db.prepare('SELECT COUNT(*) AS count FROM payment_decisions WHERE payment_id = ?').get(replayPaymentId).count,
  1,
  'replaying the same evidence must not create a second financial decision',
);
assert.equal(
  db.prepare('SELECT COUNT(*) AS count FROM payment_ledger_entries WHERE payment_id = ?').get(replayPaymentId).count,
  1,
  'replaying the same evidence must not create a second ledger effect',
);

await assert.rejects(
  () => commitPaymentDecision(tenant.chatId, {
    paymentId: replayPaymentId,
    expectedState: 'VERIFIED',
    targetState: 'MISMATCH',
    decision: {
      paymentId: replayPaymentId,
      paymentIntentId: replayIntentId,
      decision: 'MARK_MISMATCH',
      targetState: 'MISMATCH',
      entryType: 'MISMATCH',
    },
  }),
  error => error?.code === 'PAYMENT_VERIFICATION_REQUIRED' && error?.statusCode === 409,
  'verified payment reversal must require verification provenance',
);

await assert.rejects(
  () => commitPaymentDecision(tenant.chatId, {
    paymentId: replayPaymentId,
    expectedState: 'VERIFIED',
    targetState: 'REFUNDED',
    decision: {
      paymentId: replayPaymentId,
      paymentIntentId: replayIntentId,
      decision: 'REFUND',
      targetState: 'REFUNDED',
      entryType: 'REFUNDED',
    },
  }),
  error => error?.code === 'PAYMENT_REFUND_REQUIRED' && error?.statusCode === 409,
  'refunds must not bypass the canonical refund workflow',
);

assert.equal(
  db.prepare('SELECT state FROM payments WHERE id = ?').get(replayPaymentId).state,
  'VERIFIED',
  'rejected reversal/refund attempts must not mutate canonical payment state',
);
assert.equal(
  db.prepare('SELECT COUNT(*) AS count FROM payment_ledger_entries WHERE payment_id = ?').get(replayPaymentId).count,
  1,
  'rejected reversal/refund attempts must not create ledger effects',
);

await rm(tempDir, { recursive: true, force: true });

console.log('GAP-1 direct store financial commit boundary regression: PASS');

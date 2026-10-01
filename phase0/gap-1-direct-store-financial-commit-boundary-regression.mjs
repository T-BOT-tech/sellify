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

await rm(tempDir, { recursive: true, force: true });

console.log('GAP-1 direct store financial commit boundary regression: PASS');

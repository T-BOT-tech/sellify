import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(join(tmpdir(), 'sellify-gap1-confirmation-attempt-'));
process.env.SELLIFY_DATA_DIR = dir;

const store = await import('../backend/lib/store-sqlite.js');

const user = await store.getOrCreateUserByTelegram('gap1-attempt-user', 'GAP1 Attempt');
const tenant = await store.createTenantForUser({
  userId: user.id,
  sellerName: 'GAP1 Attempt',
  country: 'KE',
  currency: 'KES',
});
const chatId = tenant.chatId;
const session = await store.createSession({ userId: user.id, chatId });

const account = await store.createPaymentAccount(chatId, {
  providerId: 'fixture-attempt',
  accountIdentifier: 'ATTEMPT-1',
  metadata: { currency: 'KES' },
}, session);

const setup = await store.createPaymentWithIntent(chatId, {
  paymentAccountId: account.id,
  providerId: 'fixture-attempt',
  channel: 'api',
  amountMinor: 1000,
  currency: 'KES',
  metadata: { merchantReference: 'ATTEMPT-REF' },
}, session);

const evidence = await store.insertPaymentEvidence(chatId, {
  paymentIntentId: setup.intent.id,
  paymentAccountId: account.id,
  providerId: 'fixture-attempt',
  channel: 'api',
  evidenceType: 'PROVIDER_NOTIFICATION',
  providerTransactionId: 'ATTEMPT-TX-1',
  externalReference: 'ATTEMPT-REF',
  fingerprint: 'gap1-attempt-fingerprint',
  normalizedPayload: { providerTransactionId: 'ATTEMPT-TX-1' },
  source: 'provider-notification',
}, null);

const first = await store.createPaymentConfirmationAttempt(chatId, {
  evidenceId: evidence.evidence.id,
  paymentIntentId: setup.intent.id,
});
assert.equal(first.status, 'REQUESTED');
assert.equal(first.attemptNumber, 1);
assert.equal(first.paymentId, setup.payment.id);

const replay = await store.createPaymentConfirmationAttempt(chatId, {
  evidenceId: evidence.evidence.id,
  paymentIntentId: setup.intent.id,
  attemptNumber: 1,
});
assert.equal(replay.id, first.id);

const pending = await store.updatePaymentConfirmationAttempt(chatId, first.id, {
  status: 'PENDING',
  reasonCodes: ['PROVIDER_ASYNC'],
  observation: { source: 'fixture' },
});
assert.equal(pending.status, 'PENDING');

const confirmed = await store.updatePaymentConfirmationAttempt(chatId, first.id, {
  status: 'CONFIRMED',
  providerTransactionId: 'ATTEMPT-TX-1',
  observedAt: new Date().toISOString(),
  observation: { status: 'CONFIRMED' },
});
assert.equal(confirmed.status, 'CONFIRMED');
assert.equal(confirmed.providerTransactionId, 'ATTEMPT-TX-1');

await assert.rejects(
  store.updatePaymentConfirmationAttempt(chatId, first.id, { status: 'FAILED' }),
  error => error?.code === 'CONFIRMATION_ATTEMPT_TERMINAL',
);

const attempts = await store.listPaymentConfirmationAttempts(chatId, {
  paymentIntentId: setup.intent.id,
  evidenceId: evidence.evidence.id,
});
assert.equal(attempts.length, 1);
assert.equal((await store.getPayment(chatId, setup.payment.id)).state, 'UNPAID');

console.log('GAP-1 confirmation attempt contract regression: PASS');
await rm(dir, { recursive: true, force: true });

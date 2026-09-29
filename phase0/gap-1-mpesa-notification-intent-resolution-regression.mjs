import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(join(tmpdir(), 'sellify-gap1-resolution-'));
process.env.SELLIFY_DATA_DIR = dir;

const store = await import('../backend/lib/store-sqlite.js');

const user = await store.getOrCreateUserByTelegram('gap1-resolution-user', 'GAP1 Resolution');
const tenantResult = await store.createTenantForUser({
  userId: user.id,
  sellerName: 'GAP1 Resolution',
  country: 'KE',
  currency: 'KES',
});
const chatId = tenantResult.chatId;
const session = await store.createSession({ userId: user.id, chatId });

const account = await store.createPaymentAccount(chatId, {
  providerId: 'mpesa',
  accountIdentifier: '600001',
  metadata: {
    currency: 'KES',
    notificationAuthentication: { mode: 'shared-secret', secret: 'test-secret' },
  },
}, session);

const first = await store.createPaymentWithIntent(chatId, {
  paymentAccountId: account.id,
  providerId: 'mpesa',
  channel: 'api',
  amountMinor: 12550,
  currency: 'KES',
  metadata: { merchantReference: 'ORDER-RESOLVE-1' },
}, session);

const resolved = await store.resolvePaymentIntentForProviderEvidence({
  providerId: 'mpesa',
  accountIdentifier: '600001',
  externalReference: 'ORDER-RESOLVE-1',
});
assert.equal(resolved.organizationId, first.intent.organizationId);
assert.equal(resolved.chatId, chatId);
assert.equal(resolved.paymentIntent.id, first.intent.id);
assert.equal(resolved.paymentAccount.id, account.id);

const attackerInput = await store.resolvePaymentIntentForProviderEvidence({
  providerId: 'mpesa',
  accountIdentifier: '600001',
  externalReference: 'ORDER-RESOLVE-1',
  paymentId: 'attacker-payment-id',
  paymentIntentId: 'attacker-intent-id',
  organizationId: 'attacker-org',
  locationId: 'attacker-location',
});
assert.equal(attackerInput.paymentIntent.id, first.intent.id);

const second = await store.createPaymentWithIntent(chatId, {
  paymentAccountId: account.id,
  providerId: 'mpesa',
  channel: 'api',
  amountMinor: 12550,
  currency: 'KES',
}, session);

await assert.rejects(
  () => store.resolvePaymentIntentForProviderEvidence({
    providerId: 'mpesa',
    accountIdentifier: '600001',
  }),
  error => error?.code === 'AMBIGUOUS_PAYMENT_INTENT' && error?.statusCode === 409
);

const evidence = await store.insertPaymentEvidence(chatId, {
  paymentIntentId: first.intent.id,
  providerId: 'mpesa',
  channel: 'api',
  evidenceType: 'PROVIDER_NOTIFICATION',
  providerTransactionId: 'RCP-RESOLVE-1',
  fingerprint: 'gap1-resolution-fingerprint',
  normalizedPayload: { providerTransactionId: 'RCP-RESOLVE-1' },
  source: 'provider-notification',
}, null);
assert.equal(evidence.duplicate, false);

const replay = await store.resolvePaymentIntentForProviderEvidence({
  providerId: 'mpesa',
  accountIdentifier: '600001',
  providerTransactionId: 'RCP-RESOLVE-1',
});
assert.equal(replay.duplicateEvidence.id, evidence.evidence.id);
assert.equal(replay.paymentIntent.id, first.intent.id);
assert.notEqual(replay.paymentIntent.id, second.intent.id);

await assert.rejects(
  () => store.resolvePaymentIntentForProviderEvidence({
    providerId: 'mpesa',
    accountIdentifier: '999999',
  }),
  error => error?.code === 'UNMATCHED_PROVIDER_NOTIFICATION' && error?.statusCode === 404
);
const unmatchedAccount = await store.createPaymentAccount(chatId, {
  providerId: 'mpesa',
  accountIdentifier: '600002',
  metadata: { currency: 'KES', notificationAuthentication: { mode: 'shared-secret', secret: 'test-secret' } },
}, session);
const unmatched = await store.resolvePaymentIntentForProviderEvidence({
  providerId: 'mpesa',
  accountIdentifier: unmatchedAccount.accountIdentifier,
  providerTransactionId: 'RCP-UNMATCHED-1',
  externalReference: 'UNKNOWN-ORDER',
});
assert.equal(unmatched.paymentIntent, null);
assert.equal(unmatched.paymentAccount.id, unmatchedAccount.id);
const retained = await store.insertPaymentEvidence(chatId, {
  providerId: 'mpesa',
  channel: 'api',
  evidenceType: 'PROVIDER_NOTIFICATION',
  providerTransactionId: 'RCP-UNMATCHED-1',
  externalReference: 'UNKNOWN-ORDER',
  fingerprint: 'gap1-unmatched-retention',
  normalizedPayload: { providerTransactionId: 'RCP-UNMATCHED-1', merchantReference: 'UNKNOWN-ORDER' },
  source: 'provider-notification',
}, null);
assert.equal(retained.duplicate, false);
assert.equal(retained.evidence.paymentIntentId, null);
assert.equal(retained.evidence.status, 'RECEIVED');

console.log('GAP-1 M-Pesa Notification Intent Resolution Regression: PASS');
await rm(dir, { recursive: true, force: true });

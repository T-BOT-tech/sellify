import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(join(tmpdir(), 'sellify-gap1-resolution-'));
process.env.SELLIFY_DATA_DIR = dir;

const store = await import('../backend/lib/store-sqlite.js');
const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

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

// Caller-controlled routing fields must never override server-side provider/account resolution.
const attackerAccount = await store.createPaymentAccount(chatId, {
  providerId: 'mpesa',
  accountIdentifier: '600003',
  metadata: { currency: 'KES', notificationAuthentication: { mode: 'shared-secret', secret: 'test-secret' } },
}, session);
const attackerIntent = await store.createPaymentWithIntent(chatId, {
  paymentAccountId: attackerAccount.id,
  providerId: 'mpesa',
  channel: 'api',
  amountMinor: 12550,
  currency: 'KES',
  metadata: { merchantReference: 'ATTACKER-ORDER' },
}, session);
const authoritativeResolution = await store.resolvePaymentIntentForProviderEvidence({
  providerId: 'mpesa',
  accountIdentifier: '600001',
  externalReference: 'ORDER-RESOLVE-1',
  paymentIntentId: attackerIntent.intent.id,
  paymentAccountId: attackerAccount.id,
});
assert.equal(authoritativeResolution.paymentIntent.id, first.intent.id);
assert.equal(authoritativeResolution.paymentAccount.id, account.id);

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
  paymentAccountId: account.id,
  fingerprint: 'gap1-resolution-fingerprint',
  normalizedPayload: { providerTransactionId: 'RCP-RESOLVE-1' },
  source: 'provider-notification',
}, null);
assert.equal(evidence.duplicate, false);

const exactReplay = await store.insertPaymentEvidence(chatId, {
  paymentIntentId: first.intent.id,
  paymentAccountId: account.id,
  providerId: 'mpesa',
  channel: 'api',
  evidenceType: 'PROVIDER_NOTIFICATION',
  providerTransactionId: 'RCP-RESOLVE-1',
  fingerprint: 'gap1-resolution-fingerprint',
  normalizedPayload: { providerTransactionId: 'RCP-RESOLVE-1' },
  source: 'provider-notification',
}, null);
assert.equal(exactReplay.duplicate, true);
assert.equal(exactReplay.evidence.id, evidence.evidence.id);

// A second insert racing on the provider transaction must converge on the
// already committed row rather than creating a second evidence record.
const concurrentReplay = await Promise.all([
  store.insertPaymentEvidence(chatId, {
    paymentIntentId: first.intent.id,
    paymentAccountId: account.id,
    providerId: 'mpesa',
    channel: 'api',
    evidenceType: 'PROVIDER_NOTIFICATION',
    providerTransactionId: 'RCP-RESOLVE-1',
    fingerprint: 'gap1-resolution-fingerprint',
    normalizedPayload: { providerTransactionId: 'RCP-RESOLVE-1' },
    source: 'provider-notification',
  }, null),
  store.insertPaymentEvidence(chatId, {
    paymentIntentId: first.intent.id,
    paymentAccountId: account.id,
    providerId: 'mpesa',
    channel: 'api',
    evidenceType: 'PROVIDER_NOTIFICATION',
    providerTransactionId: 'RCP-RESOLVE-1',
    fingerprint: 'gap1-resolution-fingerprint',
    normalizedPayload: { providerTransactionId: 'RCP-RESOLVE-1' },
    source: 'provider-notification',
  }, null),
]);
assert.equal(concurrentReplay.length, 2);
assert.equal(concurrentReplay[0].evidence.id, concurrentReplay[1].evidence.id);

const verificationEvidence = await store.insertPaymentEvidence(chatId, {
  paymentIntentId: first.intent.id,
  paymentAccountId: account.id,
  providerId: 'mpesa',
  channel: 'api',
  evidenceType: 'PROVIDER_NOTIFICATION',
  providerTransactionId: 'RCP-VERIFY-1',
  externalReference: 'ORDER-RESOLVE-1',
  fingerprint: 'gap1-verification-fingerprint',
  normalizedPayload: {
    providerId: 'mpesa',
    providerTransactionId: 'RCP-VERIFY-1',
    amountMinor: 12550,
    currency: 'KES',
    receiver: '600001',
    merchantReference: 'ORDER-RESOLVE-1',
  },
  source: 'provider-notification',
}, null);
const paymentCore = new PaymentCore({ store });
const verified = await paymentCore.verifyEvidence({
  chatId,
  evidenceId: verificationEvidence.evidence.id,
});
assert.equal(verified.verification.result, 'MATCH');
assert.equal(verified.decision.decision, 'ACCEPT');
assert.equal(verified.decision.targetState, 'VERIFIED');
const verifiedPayment = await store.getPayment(chatId, first.payment.id);
assert.equal(verifiedPayment.state, 'VERIFIED');
const paymentLedger = await store.listPaymentLedger(chatId, first.payment.id);
assert.equal(paymentLedger.at(-1).entryType, 'VERIFIED');
assert.equal(paymentLedger.at(-1).fromState, 'UNPAID');
assert.equal(paymentLedger.at(-1).toState, 'VERIFIED');

const verifiedReplay = await paymentCore.verifyEvidence({
  chatId,
  evidenceId: verificationEvidence.evidence.id,
});
assert.equal(verifiedReplay.idempotent, true);
assert.equal(verifiedReplay.verification.id, verified.verification.id);


const mismatchEvidence = await store.insertPaymentEvidence(chatId, {
  paymentIntentId: second.intent.id,
  paymentAccountId: account.id,
  providerId: 'mpesa',
  channel: 'api',
  evidenceType: 'PROVIDER_NOTIFICATION',
  providerTransactionId: 'RCP-MISMATCH-1',
  externalReference: 'ORDER-MISMATCH',
  fingerprint: 'gap1-mismatch-fingerprint',
  normalizedPayload: {
    providerTransactionId: 'RCP-MISMATCH-1',
    amountMinor: 1,
    currency: 'KES',
    receiver: '600001',
    merchantReference: 'ORDER-MISMATCH',
  },
  source: 'provider-notification',
}, null);
const mismatchResult = await paymentCore.verifyEvidence({
  chatId,
  evidenceId: mismatchEvidence.evidence.id,
});
assert.equal(mismatchResult.verification.result, 'MISMATCH');
assert.notEqual(mismatchResult.decision.targetState, 'VERIFIED');
const mismatchPayment = await store.getPayment(chatId, second.payment.id);
assert.notEqual(mismatchPayment.state, 'VERIFIED');

const replay = await store.resolvePaymentIntentForProviderEvidence({
  providerId: 'mpesa',
  accountIdentifier: '600001',
  providerTransactionId: 'RCP-RESOLVE-1',
});
assert.equal(replay.duplicateEvidence.id, evidence.evidence.id);
assert.equal(replay.paymentIntent.id, first.intent.id);
assert.notEqual(replay.paymentIntent.id, second.intent.id);

await assert.rejects(
  () => store.insertPaymentEvidence(chatId, {
    paymentIntentId: first.intent.id,
    paymentAccountId: account.id,
    providerId: 'mpesa',
    channel: 'api',
    evidenceType: 'PROVIDER_NOTIFICATION',
    providerTransactionId: 'RCP-RESOLVE-1',
    fingerprint: 'gap1-conflicting-fingerprint',
    normalizedPayload: { providerTransactionId: 'RCP-RESOLVE-1', amountMinor: 99999 },
    source: 'provider-notification',
  }, null),
  error => error?.code === 'PROVIDER_TRANSACTION_EVIDENCE_CONFLICT' && error?.statusCode === 409
);

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
  paymentAccountId: unmatchedAccount.id,
  externalReference: 'UNKNOWN-ORDER',
});
assert.equal(unmatched.paymentIntent, null);
assert.equal(unmatched.paymentAccount.id, unmatchedAccount.id);
assert.equal(unmatched.resolutionStatus, 'UNMATCHED');
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

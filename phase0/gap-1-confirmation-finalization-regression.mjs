import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(join(tmpdir(), 'sellify-gap1-finalize-confirmation-'));
process.env.SELLIFY_DATA_DIR = dir;

const store = await import('../backend/lib/store-sqlite.js');
const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

const user = await store.getOrCreateUserByTelegram('gap1-finalize-user', 'GAP1 Finalize');
const tenant = await store.createTenantForUser({ userId: user.id, sellerName: 'GAP1 Finalize', country: 'KE', currency: 'KES' });
const chatId = tenant.chatId;
const session = await store.createSession({ userId: user.id, chatId });

const account = await store.createPaymentAccount(chatId, {
  providerId: 'fixture-finalize',
  accountIdentifier: 'FINALIZE-1',
  metadata: { currency: 'KES', verificationPolicy: { mode: 'combined' } },
}, session);

const setup = await store.createPaymentWithIntent(chatId, {
  paymentAccountId: account.id,
  providerId: 'fixture-finalize',
  channel: 'api',
  amountMinor: 2500,
  currency: 'KES',
  metadata: { merchantReference: 'FINALIZE-REF' },
}, session);

const evidence = await store.insertPaymentEvidence(chatId, {
  paymentIntentId: setup.intent.id,
  paymentAccountId: account.id,
  providerId: 'fixture-finalize',
  channel: 'api',
  evidenceType: 'PROVIDER_NOTIFICATION',
  providerTransactionId: 'FINALIZE-TX-1',
  externalReference: 'FINALIZE-REF',
  fingerprint: 'gap1-finalize-fingerprint',
  normalizedPayload: {
    providerTransactionId: 'FINALIZE-TX-1',
    amountMinor: 2500,
    currency: 'KES',
    receiver: 'FINALIZE-1',
    merchantReference: 'FINALIZE-REF',
  },
  source: 'provider-notification',
}, null);

const attempt = await store.createPaymentConfirmationAttempt(chatId, {
  paymentIntentId: setup.intent.id,
  evidenceId: evidence.evidence.id,
});
await store.updatePaymentConfirmationAttempt(chatId, attempt.id, {
  status: 'CONFIRMED',
  providerTransactionId: 'FINALIZE-TX-1',
  observedAt: new Date().toISOString(),
  observation: {
    status: 'CONFIRMED',
    providerId: 'fixture-finalize',
    providerTransactionId: 'FINALIZE-TX-1',
    observedAmountMinor: 2500,
    observedCurrency: 'KES',
    observedReceiver: 'FINALIZE-1',
    observedReceiverAccount: 'FINALIZE-1',
    observedReference: 'FINALIZE-REF',
  },
});

let statusCalls = 0;
const core = new PaymentCore({
  store,
  providerRegistry: {
    requirePaymentProvider: () => ({
      getStatus: async () => { statusCalls += 1; throw new Error('Finalization must not query provider status'); },
    }),
  },
});

const result = await core.finalizeProviderConfirmation({
  chatId,
  confirmationAttemptId: attempt.id,
});

assert.equal(statusCalls, 0);
assert.equal(result.decision.decision, 'ACCEPT');
assert.equal(result.decision.targetState, 'VERIFIED');
assert.equal(result.confirmationAttempt.status, 'CONFIRMED');
assert.equal((await store.getPayment(chatId, setup.payment.id)).state, 'VERIFIED');
assert.equal((await store.listPaymentVerifications(chatId, setup.payment.id)).length, 1);
assert.equal((await store.listPaymentLedger(chatId, setup.payment.id)).length, 2);

const replay = await core.finalizeProviderConfirmation({
  chatId,
  confirmationAttemptId: attempt.id,
});
assert.equal(replay.idempotent, true);
assert.equal((await store.listPaymentVerifications(chatId, setup.payment.id)).length, 1);

console.log('GAP-1 confirmation finalization regression: PASS');
await rm(dir, { recursive: true, force: true });

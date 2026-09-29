import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(join(tmpdir(), 'sellify-gap1-policy-lifecycle-'));
process.env.SELLIFY_DATA_DIR = dir;

const store = await import('../backend/lib/store-sqlite.js');
const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

const user = await store.getOrCreateUserByTelegram('gap1-policy-user', 'GAP1 Policy');
const tenant = await store.createTenantForUser({
  userId: user.id,
  sellerName: 'GAP1 Policy',
  country: 'KE',
  currency: 'KES',
});
const chatId = tenant.chatId;
const session = await store.createSession({ userId: user.id, chatId });

const account = await store.createPaymentAccount(chatId, {
  providerId: 'fixture-policy',
  accountIdentifier: 'POLICY-1',
  metadata: {
    currency: 'KES',
    verificationPolicy: { mode: 'combined' },
  },
}, session);

const paymentSetup = await store.createPaymentWithIntent(chatId, {
  paymentAccountId: account.id,
  providerId: 'fixture-policy',
  channel: 'api',
  amountMinor: 12550,
  currency: 'KES',
  metadata: { merchantReference: 'POLICY-1' },
}, session);

const evidence = await store.insertPaymentEvidence(chatId, {
  paymentIntentId: paymentSetup.intent.id,
  paymentAccountId: account.id,
  providerId: 'fixture-policy',
  channel: 'api',
  evidenceType: 'PROVIDER_NOTIFICATION',
  providerTransactionId: 'POLICY-TX-1',
  externalReference: 'POLICY-1',
  fingerprint: 'gap1-policy-lifecycle-1',
  normalizedPayload: {
    providerId: 'fixture-policy',
    providerTransactionId: 'POLICY-TX-1',
    amountMinor: 12550,
    currency: 'KES',
    receiver: 'POLICY-1',
    merchantReference: 'POLICY-1',
  },
  source: 'provider-notification',
}, null);

const baseProvider = {
  id: 'fixture-policy',
  getMetadata: () => ({ id: 'fixture-policy' }),
  verify: async () => ({
    providerId: 'fixture-policy',
    result: 'MATCH',
    confidence: 1,
    observedAmountMinor: 12550,
    observedCurrency: 'KES',
    observedReceiver: 'POLICY-1',
    observedReceiverAccount: 'POLICY-1',
    observedReference: 'POLICY-1',
    observedTransactionId: 'POLICY-TX-1',
    observedAt: new Date().toISOString(),
    reasonCodes: [],
    rawResult: { source: 'fixture-notification' },
    verifier: 'fixture-provider',
    verifierVersion: '1',
  }),
};

const unavailableCore = new PaymentCore({
  store,
  providerRegistry: {
    requirePaymentProvider: () => ({
      ...baseProvider,
      getStatus: async () => ({
        providerId: 'fixture-policy',
        status: 'UNKNOWN',
        reasonCodes: ['PROVIDER_STATUS_UNAVAILABLE'],
      }),
    }),
  },
});

const pending = await unavailableCore.verifyEvidence({
  chatId,
  evidenceId: evidence.evidence.id,
});
assert.equal(pending.pending, true);
assert.equal(pending.outcome, 'PENDING_CONFIRMATION');
assert.equal(pending.verification.result, 'UNVERIFIABLE');
assert.ok(pending.verification.reasonCodes.includes('INDEPENDENT_CONFIRMATION_UNAVAILABLE'));
assert.equal((await store.getPayment(chatId, paymentSetup.payment.id)).state, 'UNPAID');
assert.equal((await store.listPaymentVerifications(chatId, paymentSetup.payment.id)).length, 0);
assert.equal((await store.listPaymentLedger(chatId, paymentSetup.payment.id)).length, 0);

const confirmedCore = new PaymentCore({
  store,
  providerRegistry: {
    requirePaymentProvider: () => ({
      ...baseProvider,
      getStatus: async () => ({
        providerId: 'fixture-policy',
        status: 'CONFIRMED',
        providerTransactionId: 'POLICY-TX-1',
        reasonCodes: [],
        rawResult: { source: 'fixture-status' },
      }),
    }),
  },
});

const confirmed = await confirmedCore.verifyEvidence({
  chatId,
  evidenceId: evidence.evidence.id,
});
assert.equal(confirmed.verification.result, 'MATCH');
assert.equal(confirmed.decision.decision, 'ACCEPT');
assert.equal(confirmed.decision.targetState, 'VERIFIED');
assert.equal(confirmed.verification.rawResult.verificationPolicy, 'combined');
assert.equal(confirmed.verification.rawResult.independentConfirmation.status, 'CONFIRMED');
assert.equal((await store.getPayment(chatId, paymentSetup.payment.id)).state, 'VERIFIED');

console.log('GAP-1 verification policy lifecycle regression: PASS');
await rm(dir, { recursive: true, force: true });

import assert from 'node:assert/strict';
import test from 'node:test';
import { queryPaymentStatus } from '../backend/lib/payments/provider-status.js';

function provider(overrides = {}) {
  return { id: 'telebirr', version: '1', capabilities: { getStatus: true }, getStatus: async () => ({ status: 'SUCCESS', providerTransactionId: 'TX-1', amountMinor: 150000, currency: 'ETB', receiverAccount: 'ACC-1', externalReference: 'REF-1', ...overrides }) };
}
function makeStore() {
  const payment = { id: 'pay-1', organizationId: 'org-1', paymentIntentId: 'intent-1', paymentAccountId: 'acct-1', providerId: 'telebirr', amountMinor: 150000, currency: 'ETB', state: 'RECEIVED', externalReference: null };
  const intent = { id: 'intent-1', organizationId: 'org-1', providerId: 'telebirr', paymentAccountId: 'acct-1', amountMinor: 150000, currency: 'ETB', expiresAt: '2099-01-01T00:00:00.000Z' };
  const account = { id: 'acct-1', organizationId: 'org-1', providerId: 'telebirr', accountIdentifier: 'ACC-1', status: 'active' };
  const evidence = { id: 'ev-1', organizationId: 'org-1', paymentId: 'pay-1', paymentIntentId: 'intent-1', providerId: 'telebirr', status: 'RECEIVED', externalReference: 'REF-1' };
  const calls = { committed: 0, verification: 0 };
  return { calls, getPayment: async () => payment, getPaymentIntent: async () => intent, listPaymentAccounts: async () => [account], insertPaymentEvidence: async () => ({ evidence, duplicate: false }), insertPaymentVerification: async () => { calls.verification++; return { id: 'ver-1', result: 'PENDING' }; }, commitPaymentDecision: async (_chatId, input) => { calls.committed++; return { ...payment, state: input.decision.targetState }; } };
}
test('provider status success reaches Payment Core and commits once', async () => {
  const registry = await import('../backend/lib/payments/provider-registry.js');
  registry.registerPaymentProvider(provider(), { replace: true });
  const store = makeStore();
  const result = await queryPaymentStatus({ chatId: 'chat-1', paymentId: 'pay-1', store });
  assert.equal(result.providerStatus.status, 'SUCCESS');
  assert.equal(result.verification.result, 'MATCH');
  assert.equal(result.payment.state, 'VERIFIED');
  assert.equal(store.calls.committed, 1);
});
test('pending status is evidence and verification only', async () => {
  const registry = await import('../backend/lib/payments/provider-registry.js');
  registry.registerPaymentProvider(provider({ status: 'PENDING', providerTransactionId: null }), { replace: true });
  const store = makeStore();
  const result = await queryPaymentStatus({ chatId: 'chat-1', paymentId: 'pay-1', store });
  assert.equal(result.providerStatus.status, 'PENDING');
  assert.equal(result.verification.result, 'PENDING');
  assert.equal(result.payment.state, 'UNPAID');
  assert.equal(store.calls.committed, 0);
});
test('wrong receiver becomes a mismatch through invariant evaluation', async () => {
  const registry = await import('../backend/lib/payments/provider-registry.js');
  registry.registerPaymentProvider(provider({ receiverAccount: 'WRONG' }), { replace: true });
  const store = makeStore();
  const result = await queryPaymentStatus({ chatId: 'chat-1', paymentId: 'pay-1', store });
  assert.equal(result.decision.targetState, 'MISMATCH');
  assert.equal(result.payment.state, 'MISMATCH');
});

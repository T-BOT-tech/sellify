import assert from 'node:assert/strict';

const { registerPaymentProvider, requirePaymentProvider } =
  await import('../backend/lib/payments/provider-registry.js');

const providerId = 'gap1-status-contract-regression';
const calls = [];

registerPaymentProvider({
  id: providerId,
  name: 'GAP-1 Status Contract Regression',
  version: '1',
  capabilities: { getStatus: true },
  getStatus: async input => {
    calls.push(input);
    return {
      providerId,
      status: 'CONFIRMED',
      providerTransactionId: input?.evidence?.providerTransactionId || null,
      amountMinor: 12550,
      currency: 'KES',
      receiver: '600001',
      reference: 'ORDER-STATUS-1',
      observedAt: '2026-09-30T00:00:00.000Z',
      rawResult: { source: 'regression-fixture' },
      verifier: 'gap1-status-provider',
      verifierVersion: 'status-v1',
    };
  },
});

const provider = requirePaymentProvider(providerId);
assert.equal(provider.capabilities.getStatus, true);

const payment = { id: 'payment-1', state: 'UNPAID' };
const paymentIntent = {
  id: 'intent-1',
  providerId,
  paymentAccountId: 'account-1',
  amountMinor: 12550,
  currency: 'KES',
};
const paymentAccount = {
  id: 'account-1',
  providerId,
  accountIdentifier: '600001',
  currency: 'KES',
  metadata: { environment: 'test' },
};
const evidence = {
  id: 'evidence-1',
  providerId,
  providerTransactionId: 'TX-STATUS-1',
};

const observation = await provider.getStatus({
  evidence,
  payment,
  paymentIntent,
  paymentAccount,
  config: {
    ...paymentAccount.metadata,
    accountIdentifier: paymentAccount.accountIdentifier,
  },
  now: new Date('2026-09-30T00:00:00.000Z'),
});

assert.equal(observation.status, 'CONFIRMED');
assert.equal(observation.providerId, providerId);
assert.equal(observation.providerTransactionId, 'TX-STATUS-1');
assert.equal(calls.length, 1);

// Provider status operations are observations only. The provider receives
// domain context but has no store/payment mutation authority.
assert.equal(payment.state, 'UNPAID');
assert.equal(paymentIntent.amountMinor, 12550);
assert.equal(paymentAccount.accountIdentifier, '600001');

await assert.rejects(
  () => requirePaymentProvider('missing-gap1-status-provider').getStatus({}),
  error => error?.code === 'UNKNOWN_PAYMENT_PROVIDER' && error?.statusCode === 400
);

console.log('GAP-1 provider getStatus contract regression passed');

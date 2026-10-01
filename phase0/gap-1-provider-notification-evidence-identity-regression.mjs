import assert from 'node:assert/strict';

const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

const captured = [];

const store = {
  getPaymentAccountForProviderNotification: async (providerId, accountIdentifier) => {
    assert.equal(providerId, 'mpesa');
    assert.equal(accountIdentifier, '600001');
    return {
      id: 'account-canonical',
      organizationId: 'org-canonical',
      chatId: 'chat-canonical',
      providerId: 'mpesa',
      accountIdentifier: '600001',
    };
  },

  resolvePaymentIntentForProviderEvidence: async input => {
    assert.equal(input.providerId, 'mpesa');
    assert.equal(input.accountIdentifier, '600001');
    assert.equal(input.providerTransactionId, 'TX-001');
    return {
      chatId: 'chat-canonical',
      organizationId: 'org-canonical',
      locationId: 'location-canonical',
      paymentAccount: { id: 'account-canonical' },
      paymentIntent: { id: 'intent-canonical' },
    };
  },

  insertPaymentEvidence: async (chatId, input) => {
    captured.push({ chatId, input });
    return { evidence: { id: 'evidence-canonical' }, duplicate: false };
  },
};

const core = new PaymentCore({ store });

const result = await core.submitEvidence({
  chatId: 'attacker-chat',
  organizationId: 'attacker-org',
  locationId: 'attacker-location',
  paymentId: 'attacker-payment',
  payment_id: 'attacker-payment-2',
  paymentIntentId: 'attacker-intent',
  payment_intent_id: 'attacker-intent-2',
  providerId: 'mpesa',
  providerAccountReference: '600001',
  notificationAuthentication: {
    authenticated: true,
    providerId: 'mpesa',
    providerAccountReference: '600001',
    authenticationReference: 'auth-001',
  },
  providerTransactionId: 'TX-001',
  source: 'provider-notification',
  amount: 1000,
  currency: 'KES',
});

assert.equal(result.evidence.id, 'evidence-canonical');
assert.equal(captured.length, 1);

const call = captured[0];
assert.equal(call.chatId, 'chat-canonical');
assert.equal(call.input.chatId, 'chat-canonical');
assert.equal(call.input.organizationId, 'org-canonical');
assert.equal(call.input.paymentAccountId, 'account-canonical');
assert.equal(call.input.paymentIntentId, 'intent-canonical');
assert.equal(call.input.paymentId, null);
assert.equal(call.input.providerId, 'mpesa');
assert.equal(call.input.providerAccountReference, '600001');
assert.equal(call.input.locationId, 'location-canonical');
assert.equal(call.input.payment_intent_id, undefined);
assert.equal(call.input.payment_id, undefined);
assert.equal(call.input.organization_id, undefined);
assert.equal(call.input.location_id, undefined);

console.log('GAP-1 provider notification evidence identity regression: PASS');

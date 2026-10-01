import assert from 'node:assert/strict';
import test from 'node:test';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

test('GAP-1.16 selects the highest-priority eligible provider route', async () => {
  const store = {
    listPaymentRoutingPolicies: async () => [
      { id: 'p2', providerId: 'cbe', providerName: 'CBE', priority: 20, currencies: ['ETB'], requiredCapabilities: ['initiate'] },
      { id: 'p1', providerId: 'manual', providerName: 'Manual', priority: 10, currencies: ['ETB'], requiredCapabilities: [] },
    ],
    listPaymentAccounts: async () => [{ id: 'acct-manual', providerId: 'manual' }],
    createPaymentWithIntent: async (chatId, input) => ({ payment: { providerId: input.providerId, paymentAccountId: input.paymentAccountId } }),
  };
  const providers = {
    getPaymentProvider(id) {
      if (id === 'manual') return { id: 'manual', name: 'Manual', capabilities: {} };
      if (id === 'cbe') return { id: 'cbe', name: 'CBE', capabilities: { initiate: true } };
      return null;
    },
  };
  const core = new PaymentCore({ store, providerRegistry: providers });

  const route = await core.resolveRouting({ chatId: 'chat', channel: 'api', currency: 'ETB' });
  assert.equal(route.status, 'ROUTED');
  assert.equal(route.providerId, 'manual');
  assert.equal(route.paymentAccountId, 'acct-manual');

  const created = await core.createPayment({
    chatId: 'chat', organizationId: 'org', channel: 'api', currency: 'ETB',
    amountMinor: 1000, idempotencyKey: 'create-route-1',
  });
  assert.equal(created.payment.providerId, 'manual');
});

test('GAP-1.16 returns UNKNOWN when no policy/provider/account is eligible', async () => {
  const core = new PaymentCore({
    store: {
      listPaymentRoutingPolicies: async () => [{ id: 'p', providerId: 'cbe', priority: 1, currencies: ['USD'], requiredCapabilities: ['initiate'] }],
      listPaymentAccounts: async () => [],
    },
    providerRegistry: { getPaymentProvider: () => ({ id: 'cbe', name: 'CBE', capabilities: { initiate: true } }) },
  });
  const route = await core.resolveRouting({ chatId: 'chat', channel: 'api', currency: 'ETB' });
  assert.equal(route.status, 'UNKNOWN');
  assert.deepEqual(route.reasonCodes, ['NO_ELIGIBLE_PAYMENT_ROUTE']);
});

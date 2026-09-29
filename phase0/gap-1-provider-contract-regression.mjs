import assert from 'node:assert/strict';
import { getPaymentProvider, listPaymentProviders, normalizeVerificationResult } from '../backend/lib/payments/provider-registry.js';

const expected = ['manual', 'telebirr', 'cbe', 'mpesa', 'boa'];
const providers = listPaymentProviders();

for (const id of expected) {
  const provider = getPaymentProvider(id);
  assert.ok(provider, 'provider ' + id + ' is registered');
  assert.equal(provider.id, id);
  assert.equal(typeof provider.getMetadata, 'function');
  assert.equal(typeof provider.validateAccount, 'function');
  assert.equal(typeof provider.parseEvidence, 'function');
  assert.equal(typeof provider.verify, 'function');
  assert.equal(typeof provider.getStatus, 'function');
  assert.equal(typeof provider.reconcile, 'function');
}

for (const id of ['telebirr', 'cbe', 'mpesa', 'boa']) {
  const provider = getPaymentProvider(id);
  assert.equal(provider.capabilities.parseEvidence, true);
  assert.equal(provider.capabilities.verify, false);
  assert.equal(provider.capabilities.getStatus, false);
  assert.equal(provider.capabilities.reconcile, false);
}

const observed = normalizeVerificationResult({
  providerId: 'M-PESA',
  transactionId: 'TX-1',
  amountMinor: 12500,
  currency: 'KES',
  receiverAccount: '174379',
  result: 'MATCH',
});
assert.equal(observed.providerId, 'mpesa');
assert.equal(observed.observedTransactionId, 'TX-1');
assert.equal(observed.observedAmountMinor, 12500);
assert.equal(observed.observedCurrency, 'KES');
assert.equal(observed.observedReceiverAccount, '174379');

assert.equal(providers.length >= expected.length, true);
console.log('Payment provider contract regression passed');

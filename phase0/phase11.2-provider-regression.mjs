import assert from 'node:assert/strict';
import { listPaymentChannels, requirePaymentChannel } from '../backend/lib/payments/channel-registry.js';
import { getPaymentProvider, listPaymentProviders, requirePaymentProvider } from '../backend/lib/payments/provider-registry.js';

const providers = listPaymentProviders();
assert.deepEqual(providers.map(p => p.id), ['manual', 'telebirr', 'cbe', 'mpesa']);
assert.equal(getPaymentProvider('telebirr').name, 'Telebirr');
assert.equal(getPaymentProvider('telebirr').capabilities.initiate, false);
assert.equal(getPaymentProvider('manual').capabilities.verify, true);
assert.equal(requirePaymentProvider('MANUAL').id, 'manual');
assert.deepEqual(listPaymentChannels().map(c => c.id), ['manual', 'sms', 'api']);
assert.equal(requirePaymentChannel('API').id, 'api');

await assert.rejects(
  () => getPaymentProvider('telebirr').initiate({ amountMinor: 100 }),
  error => error?.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED' && error?.statusCode === 503
);
assert.throws(
  () => requirePaymentProvider('unknown'),
  error => error?.code === 'UNKNOWN_PAYMENT_PROVIDER' && error?.statusCode === 400
);
assert.throws(
  () => requirePaymentChannel('unknown'),
  error => error?.code === 'UNKNOWN_PAYMENT_CHANNEL' && error?.statusCode === 400
);

console.log('Phase 11.2 Provider/Channel Regression: PASS');

import assert from 'node:assert/strict';
import { PROVIDER_ADAPTERS } from '../backend/lib/payments/provider-adapters.js';
import { getPaymentProvider, registerPaymentProvider } from '../backend/lib/payments/provider-registry.js';

for (const adapter of Object.values(PROVIDER_ADAPTERS)) {
  registerPaymentProvider(adapter, { replace: true });
}

for (const providerId of ['telebirr', 'cbe', 'mpesa', 'boa']) {
  const provider = getPaymentProvider(providerId);
  const adapter = PROVIDER_ADAPTERS[providerId];
  assert.ok(provider);
  assert.equal(provider.id, adapter.id);
  assert.equal(provider.name, adapter.name);
  assert.equal(provider.getMetadata, adapter.getMetadata);
  assert.equal(provider.verify, adapter.verify);
  assert.equal(provider.getStatus, adapter.getStatus);
  assert.equal(provider.probeCapability, adapter.probeCapability);
}

console.log('GAP-1 canonical provider adapter binding regression passed');
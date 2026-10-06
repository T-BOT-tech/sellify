import assert from 'node:assert/strict';
import { getPaymentProvider, certifyPaymentProviderCapabilities, certifyAllPaymentProviders } from '../backend/lib/payments/provider-registry.js';

const manual = certifyPaymentProviderCapabilities('manual');
assert.equal(manual.status, 'ADAPTER_CONTRACT_CERTIFIED');
assert.equal(manual.liveExternalCertification, false);
assert.ok(manual.declaredExecutableCapabilities.includes('verify'));
assert.ok(manual.declaredExecutableCapabilities.includes('reconcile'));

for (const id of ['telebirr','cbe','mpesa','boa']) {
  const provider = getPaymentProvider(id);
  const certification = certifyPaymentProviderCapabilities(id);
  assert.equal(provider.configured, false);
  assert.equal(certification.status, 'UNCONFIGURED');
  assert.equal(certification.liveExternalCertification, false);
  assert.deepEqual(certification.declaredExecutableCapabilities, ['getMetadata', 'parseEvidence']);
}

const all = certifyAllPaymentProviders();
assert.equal(all.length, 5);
assert.equal(all.filter(item => item.status === 'ADAPTER_CONTRACT_CERTIFIED').length, 1);
assert.equal(all.filter(item => item.status === 'UNCONFIGURED').length, 4);
console.log('GAP-1.18 provider capability certification regression passed');

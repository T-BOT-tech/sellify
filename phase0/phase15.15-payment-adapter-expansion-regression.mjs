import assert from 'node:assert/strict';
import { resolveCountryPaymentAdapterMapping, requireCountryPaymentAdapter, listCountryPaymentAdapterMappings, countryPaymentAdapterContract } from '../app/src/country-payment-adapter-mapping.js';
import { getCountryPack, assertCountryPack } from '../app/src/country-pack-contract.js';

const et = resolveCountryPaymentAdapterMapping('ET');
assert.deepEqual(et.providers, ['telebirr', 'cbe']);
assert.deepEqual(et.channels, ['api', 'sms', 'manual']);
assert.equal(et.providerMetadata.every(x => x.registered), true);
assert.equal(requireCountryPaymentAdapter('ET', 'telebirr', 'api').executable, false);

const ke = resolveCountryPaymentAdapterMapping('KE');
assert.deepEqual(ke.providers, ['mpesa']);
assert.equal(ke.providerMetadata[0].registered, true);
assert.equal(requireCountryPaymentAdapter('KE', 'mpesa', 'api').integrationStatus, 'deferred');

const tz = resolveCountryPaymentAdapterMapping('TZ');
assert.deepEqual(tz.providers, ['mpesa']);
assert.equal(tz.providerMetadata[0].registered, true);
assert.deepEqual(getCountryPack('TZ').paymentProviders.providers, ['mpesa']);

for (const code of ['NG', 'GH', 'ZM']) {
  const mapping = resolveCountryPaymentAdapterMapping(code);
  assert.deepEqual(mapping.providers, []);
  assert.equal(mapping.channels.includes('api'), true);
  assert.throws(() => requireCountryPaymentAdapter(code, 'mpesa', 'api'), /not mapped/);
}

assert.deepEqual(listCountryPaymentAdapterMappings(), ['ET', 'KE', 'TZ', 'NG', 'GH', 'ZM']);
assert.equal(countryPaymentAdapterContract.persistence, 'none');
assert.equal(countryPaymentAdapterContract.ownsPaymentState, false);
assert.equal(countryPaymentAdapterContract.ownsPaymentLedger, false);
assert.equal(countryPaymentAdapterContract.ownsProviderCredentials, false);
assert.equal(countryPaymentAdapterContract.executesProviderCalls, false);
assert.equal(countryPaymentAdapterContract.countryOverlayRequired, true);

for (const code of ['ET', 'KE', 'TZ', 'NG']) assertCountryPack(getCountryPack(code));
assert.throws(() => resolveCountryPaymentAdapterMapping('RW'), /Unsupported country/);
assert.throws(() => requireCountryPaymentAdapter('ET', 'mpesa', 'api'), /not mapped/);
assert.throws(() => requireCountryPaymentAdapter('KE', 'mpesa', 'unknown'), /not mapped/);

console.log('Phase 15.15 Payment Adapter Expansion Regression: PASS');
console.log('Existing Ethiopia payment mapping preserved: PASS');
console.log('Kenya/Tanzania M-Pesa mapping uses existing registered provider only: PASS');
console.log('Nigeria/Ghana/Zambia remain provider-deferred: PASS');
console.log('Country overlay / no payment ownership boundary preserved: PASS');

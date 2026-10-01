import assert from 'node:assert/strict';
import { getProviderAdapterConfig, providerConfigNames } from '../backend/lib/payments/provider-adapter-config.js';

const env = {
  SELLIFY_TELEBIRR_BASE_URL: 'https://example.invalid/telebirr',
  SELLIFY_TELEBIRR_API_KEY: 'secret-value',
};

const configured = getProviderAdapterConfig('telebirr', env);
assert.equal(configured.configured, true);
assert.equal(configured.baseUrl, 'https://example.invalid/telebirr');
assert.equal(configured.hasCredential, true);
assert.equal(configured.apiKey, undefined);

const unconfigured = getProviderAdapterConfig('cbe', env);
assert.equal(unconfigured.configured, false);
assert.equal(unconfigured.baseUrl, null);
assert.equal(unconfigured.hasCredential, false);

assert.deepEqual(providerConfigNames('mpesa'), {
  baseUrl: 'SELLIFY_MPESA_BASE_URL',
  apiKey: 'SELLIFY_MPESA_API_KEY',
});

console.log('GAP-1.18 provider adapter config regression passed');

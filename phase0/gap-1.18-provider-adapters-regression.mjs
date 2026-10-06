import assert from 'node:assert/strict';
import { PROVIDER_ADAPTERS } from '../backend/lib/payments/provider-adapters.js';
import { requestProviderProbe } from '../backend/lib/payments/provider-probe-transport.js';

for (const id of ['telebirr', 'cbe', 'mpesa', 'boa']) {
  const provider = PROVIDER_ADAPTERS[id];
  assert.ok(provider);
  assert.equal(provider.capabilities.probeCapability, true);
  const result = await provider.probeCapability({ capability: 'refund', context: { env: {} } });
  assert.equal(result.status, 'UNKNOWN');
  assert.ok(result.reasonCodes.includes('PROVIDER_PROBE_PATH_NOT_CONFIGURED') || result.reasonCodes.includes('PAYMENT_PROVIDER_NOT_CONFIGURED'));
}

const calls = [];
const fetchImpl = async (_url, options) => {
  calls.push(options);
  return new Response(JSON.stringify({ status: 'SUCCESS', reference: 'adapter-auth-118b' }), { status: 200 });
};
const authResult = await PROVIDER_ADAPTERS.telebirr.probeCapability({
  capability: 'getStatus',
  context: {
    env: {
      SELLIFY_TELEBIRR_BASE_URL: 'https://telebirr.example',
      SELLIFY_TELEBIRR_API_KEY: 'secret',
    },
    probePath: '/health',
    fetchImpl,
  },
});
assert.equal(authResult.status, 'VERIFIED');
assert.equal(calls[0].headers.authorization, 'Bearer secret');

// Shared transport must not manufacture authentication.
const transportCalls = [];
await requestProviderProbe({
  baseUrl: 'https://provider.example',
  path: '/health',
  headers: {},
  fetchImpl: async (_url, options) => {
    transportCalls.push(options);
    return new Response('{}', { status: 200 });
  },
});
assert.equal(transportCalls[0].headers.authorization, undefined);

console.log('GAP-1.18 provider adapter skeleton regression passed');


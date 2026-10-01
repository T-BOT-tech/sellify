import assert from 'node:assert/strict';
import { requestProviderProbe } from '../backend/lib/payments/provider-probe-transport.js';

const calls = [];
const fetchImpl = async (url, options) => {
  calls.push({ url, options });
  return new Response(JSON.stringify({ reference: 'probe-118', ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

const result = await requestProviderProbe({
  baseUrl: 'https://provider.example',
  apiKey: 'secret',
  path: '/health',
  timeoutMs: 1000,
  fetchImpl,
});

assert.equal(result.ok, true);
assert.equal(result.statusCode, 200);
assert.equal(result.payload.reference, 'probe-118');
assert.equal(calls[0].options.headers.authorization, 'Bearer secret');

let timedOut = false;
try {
  await requestProviderProbe({
    baseUrl: 'https://provider.example',
    apiKey: 'secret',
    timeoutMs: 250,
    fetchImpl: async (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }),
  });
} catch (error) {
  timedOut = error.code === 'PAYMENT_PROVIDER_PROBE_TIMEOUT';
}
assert.equal(timedOut, true);

console.log('GAP-1.18 provider probe transport regression passed');

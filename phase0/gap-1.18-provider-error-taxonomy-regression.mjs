import assert from 'node:assert/strict';
import {
  PaymentProviderError,
  UnsupportedProviderOperationError,
  ProviderNotConfiguredError,
  ProviderTimeoutError,
  ProviderNetworkError,
  PROVIDER_ERROR_CODES,
} from '../backend/lib/payments/provider-errors.js';
import { requestProviderProbe } from '../backend/lib/payments/provider-probe-transport.js';
import { createUnconfiguredPaymentProvider } from '../backend/lib/payments/provider-registry.js';

assert.equal(new UnsupportedProviderOperationError('cbe', 'refund').code, PROVIDER_ERROR_CODES.UNSUPPORTED_OPERATION);
assert.equal(new UnsupportedProviderOperationError('cbe', 'refund').statusCode, 501);
assert.equal(new ProviderNotConfiguredError('cbe', 'verify').code, PROVIDER_ERROR_CODES.NOT_CONFIGURED);

const timeout = new ProviderTimeoutError('telebirr', 'status');
assert.equal(timeout.code, PROVIDER_ERROR_CODES.TIMEOUT);
assert.equal(timeout.retryable, true);
assert.equal(timeout.statusCode, 504);

const network = new ProviderNetworkError('boa', 'verify');
assert.equal(network.code, PROVIDER_ERROR_CODES.NETWORK);
assert.equal(network.retryable, true);
assert.equal(network.statusCode, 502);
assert.ok(network instanceof PaymentProviderError);

// Transport timeout is classified, not leaked as a generic Error.
{
  let calls = 0;
  await assert.rejects(
    requestProviderProbe({
      baseUrl: 'https://provider.example',
      path: '/status',
      timeoutMs: 250,
      maxRetries: 0,
      fetchImpl: async (_url, { signal }) => {
        calls += 1;
        await new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      },
    }),
    error => error.code === PROVIDER_ERROR_CODES.TIMEOUT && error.retryable === true,
  );
  assert.equal(calls, 1);
}

// Unconfigured providers retain the existing public error code, now with a typed class.
{
  const provider = createUnconfiguredPaymentProvider({ id: 'test', name: 'Test Provider' });
  await assert.rejects(
    provider.verify(),
    error => error instanceof ProviderNotConfiguredError &&
      error.code === PROVIDER_ERROR_CODES.NOT_CONFIGURED &&
      error.providerId === 'test',
  );
}

console.log('GAP-1.18G provider error taxonomy regression passed');

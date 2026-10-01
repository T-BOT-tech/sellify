import assert from 'node:assert/strict';
import { PROVIDER_ADAPTERS } from '../backend/lib/payments/provider-adapters.js';

function fakeContext(providerId, operation, payload, status = 200) {
  const calls = [];
  const envKey = {
    telebirr: 'SELLIFY_TELEBIRR_API_KEY',
    cbe: 'SELLIFY_CBE_API_KEY',
    mpesa: 'SELLIFY_MPESA_API_KEY',
    boa: 'SELLIFY_BOA_API_KEY',
  }[providerId];

  return {
    calls,
    context: {
      env: {
        [`SELLIFY_${providerId.toUpperCase()}_BASE_URL`]: 'https://provider.example',
        [envKey]: 'secret',
      },
      [operation + 'Path']: '/' + operation,
      [operation + 'Method']: 'POST',
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  };
}

// GAP-1.18F: an absent lifecycle path fails closed without making a network call.
for (const id of ['telebirr', 'cbe', 'mpesa', 'boa']) {
  const envKey = {
    telebirr: 'SELLIFY_TELEBIRR_API_KEY',
    cbe: 'SELLIFY_CBE_API_KEY',
    mpesa: 'SELLIFY_MPESA_API_KEY',
    boa: 'SELLIFY_BOA_API_KEY',
  }[id];
  let calls = 0;
  const result = await PROVIDER_ADAPTERS[id].getStatus({
    context: {
      env: {
        [`SELLIFY_${id.toUpperCase()}_BASE_URL`]: 'https://provider.example',
        [envKey]: 'secret',
      },
      fetchImpl: async () => { calls += 1; },
    },
  });
  assert.equal(result.status, 'UNSUPPORTED');
  assert.equal(result.reasonCodes[0], 'PROVIDER_STATUS_PATH_NOT_CONFIGURED');
  assert.equal(calls, 0);
}

// GAP-1.18F: explicit status path uses the provider-local parser and adapter auth.
{
  const { calls, context } = fakeContext('telebirr', 'status', {
    status: 'SUCCESS',
    reference: 'status-ref',
    transactionId: 'status-tx',
    decision: 'MARK_PAID',
    authorization: 'secret',
  });
  const result = await PROVIDER_ADAPTERS.telebirr.getStatus({ context });
  assert.equal(result.status, 'VERIFIED');
  assert.equal(result.providerReference, 'status-ref');
  assert.equal(result.providerTransactionId, 'status-tx');
  assert.equal(result.evidence.decision, undefined);
  assert.equal(result.evidence.authorization, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.authorization, 'Bearer secret');
}

// GAP-1.18F: verify follows the same evidence-only parser contract.
{
  const { calls, context } = fakeContext('boa', 'verify', {
    status: 'MATCHED',
    reference: 'verify-ref',
    transactionId: 'verify-tx',
    targetState: 'VERIFIED',
    ledgerMutated: true,
  });
  const result = await PROVIDER_ADAPTERS.boa.verify({ context });
  assert.equal(result.status, 'VERIFIED');
  assert.equal(result.providerReference, 'verify-ref');
  assert.equal(result.evidence.targetState, undefined);
  assert.equal(result.evidence.ledgerMutated, undefined);
  assert.equal(calls[0].options.headers.authorization, 'Bearer secret');
}

// GAP-1.18F: provider HTTP failure remains evidence failure, not a Payment decision.
{
  const { calls, context } = fakeContext('cbe', 'status', { status: 'SUCCESS' }, 503);
  const result = await PROVIDER_ADAPTERS.cbe.getStatus({ context });
  assert.equal(result.status, 'FAILED');
  assert.ok(result.reasonCodes.includes('PROVIDER_HTTP_RESPONSE_NOT_OK'));
  assert.equal(calls.length, 3);
}

// GAP-1.18F: the adapter never emits Payment state or ledger authority.
{
  const { context } = fakeContext('mpesa', 'verify', {
    status: 'SUCCESS',
    paymentState: 'VERIFIED',
    decision: 'MARK_PAID',
    financialEffect: true,
  });
  const result = await PROVIDER_ADAPTERS.mpesa.verify({ context });
  assert.equal(result.paymentState, undefined);
  assert.equal(result.decision, undefined);
  assert.equal(result.financialEffect, undefined);
}

console.log('GAP-1.18F provider verification lifecycle regression passed');

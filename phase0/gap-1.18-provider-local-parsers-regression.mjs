import assert from 'node:assert/strict';
import { PROVIDER_VERIFICATION_PARSERS } from '../backend/lib/payments/provider-verification-parsers.js';
import { PROVIDER_ADAPTERS } from '../backend/lib/payments/provider-adapters.js';

for (const id of ['telebirr', 'cbe', 'mpesa', 'boa']) {
  const parser = PROVIDER_VERIFICATION_PARSERS[id];
  assert.equal(typeof parser, 'function');

  const verified = parser({
    status: 'SUCCESS',
    reference: id + '-ref',
    transactionId: id + '-tx',
    decision: 'MARK_PAID',
    targetState: 'VERIFIED',
    authorization: 'Bearer secret',
  });
  assert.equal(verified.status, 'VERIFIED');
  assert.equal(verified.providerId, id);
  assert.equal(verified.providerReference, id + '-ref');
  assert.equal(verified.providerTransactionId, id + '-tx');
  assert.equal(verified.evidence.decision, undefined);
  assert.equal(verified.evidence.targetState, undefined);
  assert.equal(verified.evidence.authorization, undefined);

  const missing = parser({ status: 'NOT_FOUND' });
  assert.equal(missing.status, 'NOT_FOUND');

  const failed = parser({ status: 'DECLINED' });
  assert.equal(failed.status, 'FAILED');

  const unknown = parser({ status: 'SOME_NEW_PROVIDER_STATUS' });
  assert.equal(unknown.status, 'FAILED');
  assert.ok(unknown.reasonCodes.includes('PROVIDER_RESPONSE_UNRECOGNIZED'));
}

const calls = [];
const result = await PROVIDER_ADAPTERS.telebirr.probeCapability({
  capability: 'getStatus',
  context: {
    env: {
      SELLIFY_TELEBIRR_BASE_URL: 'https://telebirr.example',
      SELLIFY_TELEBIRR_API_KEY: 'secret',
    },
    probePath: '/health',
    fetchImpl: async (_url, options) => {
      calls.push(options);
      return new Response(JSON.stringify({
        status: 'SUCCESS',
        reference: 'provider-local-ref',
        authorization: 'should-not-survive',
      }), { status: 200 });
    },
  },
});
assert.equal(result.status, 'VERIFIED');
assert.equal(result.providerReference, 'provider-local-ref');
assert.equal(result.evidence.authorization, undefined);
assert.equal(calls[0].headers.authorization, 'Bearer secret');

console.log('GAP-1.18E provider-local parser regression passed');

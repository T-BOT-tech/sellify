import assert from 'node:assert/strict';
import { batchVerifyProviderPayments } from '../backend/lib/payments/provider-batch-verification.js';

let active = 0;
let maxActive = 0;
const calls = [];

const providers = {
  telebirr: {
    getStatus: async ({ query }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, query.delay || 5));
      active -= 1;
      calls.push(query.id);
      return {
        status: 'VERIFIED',
        providerId: 'telebirr',
        providerReference: query.id,
        evidence: {
          id: query.id,
          decision: 'MARK_PAID',
          authorization: 'secret',
        },
      };
    },
  },
  cbe: {
    getStatus: async ({ query }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, query.delay || 5));
      active -= 1;
      calls.push(query.id);
      if (query.fail) {
        const error = new Error('upstream unavailable');
        error.code = 'PAYMENT_PROVIDER_TRANSPORT_UNAVAILABLE';
        error.retryable = true;
        throw error;
      }
      return { status: 'VERIFIED', providerReference: query.id };
    },
  },
};

const result = await batchVerifyProviderPayments({
  providerResolver: async providerId => providers[providerId] || null,
  concurrency: 2,
  items: [
    { providerId: 'telebirr', operation: 'status', query: { id: 'a', delay: 15 } },
    { providerId: 'cbe', operation: 'status', query: { id: 'b', fail: true, delay: 5 } },
    { providerId: 'telebirr', operation: 'status', query: { id: 'c', delay: 5 } },
    { providerId: 'missing', operation: 'status', query: { id: 'd' } },
    { providerId: 'telebirr', operation: 'status', query: { id: 'e', delay: 5 } },
  ],
});

assert.equal(result.results.length, 5);
assert.deepEqual(result.results.map(item => item.index), [0, 1, 2, 3, 4]);
assert.equal(result.results[0].status, 'VERIFIED');
assert.equal(result.results[1].status, 'UNAVAILABLE');
assert.equal(result.results[3].status, 'UNSUPPORTED');
assert.equal(result.results[4].status, 'VERIFIED');
assert.equal(result.summary.total, 5);
assert.equal(result.summary.VERIFIED, 3);
assert.equal(result.summary.UNAVAILABLE, 1);
assert.equal(result.summary.UNSUPPORTED, 1);
assert.ok(maxActive <= 2);
assert.deepEqual(calls.sort(), ['a', 'c', 'e']);

assert.equal(result.results[0].result.evidence.decision, undefined);
assert.equal(result.results[0].result.evidence.authorization, undefined);
assert.equal(result.paymentStateMutated, false);
assert.equal(result.ledgerMutated, false);
assert.equal(result.financialEffect, false);

// A single bad item must not abort the batch.
const isolated = await batchVerifyProviderPayments({
  providerResolver: async () => ({
    verify: async () => {
      const error = new Error('boom');
      error.code = 'PAYMENT_PROVIDER_UPSTREAM_ERROR';
      throw error;
    },
  }),
  items: [
    { providerId: 'cbe', operation: 'verify' },
    { providerId: 'cbe', operation: 'verify' },
  ],
  concurrency: 8,
});
assert.deepEqual(isolated.results.map(item => item.status), ['UNAVAILABLE', 'UNAVAILABLE']);
assert.equal(isolated.concurrency, 8);

console.log('GAP-1.18H provider batch verification regression passed');

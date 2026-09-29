import assert from 'node:assert/strict';
import {
  normalizeVerificationPolicy,
  resolveVerificationPolicy,
  requiresIndependentConfirmation,
} from '../backend/lib/payments/verification-policy.js';

assert.deepEqual(normalizeVerificationPolicy(), {
  mode: 'notification-only',
  requireIndependentConfirmation: false,
});

assert.equal(
  requiresIndependentConfirmation({ mode: 'provider-status' }),
  true,
);
assert.equal(
  requiresIndependentConfirmation({ mode: 'combined' }),
  true,
);
assert.equal(
  requiresIndependentConfirmation({ mode: 'reconciliation-required' }),
  true,
);

const accountPolicy = resolveVerificationPolicy({
  paymentAccount: {
    metadata: {
      verificationPolicy: {
        mode: 'combined',
      },
    },
  },
  paymentIntent: {
    metadata: {
      verificationPolicy: {
        mode: 'notification-only',
      },
    },
  },
});
assert.equal(accountPolicy.mode, 'combined');
assert.equal(accountPolicy.requireIndependentConfirmation, true);

const intentPolicy = resolveVerificationPolicy({
  paymentAccount: { metadata: {} },
  paymentIntent: {
    metadata: {
      verificationPolicy: {
        mode: 'provider-status',
      },
    },
  },
});
assert.equal(intentPolicy.mode, 'provider-status');

assert.throws(
  () => normalizeVerificationPolicy({ mode: 'invented-mode' }),
  error => error?.code === 'PAYMENT_VERIFICATION_POLICY_INVALID',
);

console.log('GAP-1 verification policy regression passed');

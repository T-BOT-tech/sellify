import assert from 'node:assert/strict';
import { evaluateMultiChannelAdversarialGate, MULTI_CHANNEL_ADVERSARIAL_CASES } from '../app/src/platform/multi-channel-adversarial-contract.js';

const passing = Object.fromEntries(MULTI_CHANNEL_ADVERSARIAL_CASES.map(id => [id, true]));
const result = evaluateMultiChannelAdversarialGate(passing);
assert.equal(result.status, 'PASS');
assert.equal(result.failedCases.length, 0);
assert.equal(result.ownsTransactionEngine, false);
assert.equal(result.ownsSynchronizationEngine, false);

const unsafe = evaluateMultiChannelAdversarialGate({ ...passing, DUPLICATE_CHECKOUT: false });
assert.equal(unsafe.status, 'FAIL');
assert.ok(unsafe.failedCases.includes('DUPLICATE_CHECKOUT'));

const authority = evaluateMultiChannelAdversarialGate({ ...passing, declaredAuthorities: ['orders', 'inventory', 'payment_ledger'] });
assert.equal(authority.status, 'FAIL');
assert.deepEqual(authority.forbiddenAuthorities, ['orders', 'inventory', 'payment_ledger']);
console.log('FUX-30 multi-channel adversarial regression: PASS');

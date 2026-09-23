import assert from 'node:assert/strict';
import { buildCrossChannelConsistencyContract, evaluateCrossChannelConsistency, CROSS_CHANNEL_CANONICAL_AUTHORITIES } from '../app/src/platform/cross-channel-consistency-contract.js';

const channels = [
  { channelType: 'telegram', status: 'PUBLISHED', enabled: true, configurationVersion: 2 },
  { channelType: 'web', status: 'PUBLISHED', enabled: true, configurationVersion: 1 },
];
const contract = buildCrossChannelConsistencyContract(channels);
assert.equal(contract.model, 'one_business_truth_many_experiences');
assert.equal(contract.canonicalAuthorities.order, 'commerce');
assert.equal(contract.canonicalAuthorities.inventory, 'inventory');
assert.equal(contract.ownsTransactionEngine, false);
assert.equal(contract.ownsPaymentLedger, false);
assert.equal(contract.channels.length, 2);

const pass = evaluateCrossChannelConsistency(channels);
assert.equal(pass.status, 'PASS');
assert.equal(pass.activeChannelCount, 2);
assert.deepEqual(pass.duplicateChannelTypes, []);

const duplicate = evaluateCrossChannelConsistency([...channels, { channelType: 'telegram', status: 'PUBLISHED' }]);
assert.equal(duplicate.status, 'FAIL');
assert.deepEqual(duplicate.duplicateChannelTypes, ['telegram']);
assert.equal(CROSS_CHANNEL_CANONICAL_AUTHORITIES.payment, 'payments');
assert.equal(CROSS_CHANNEL_CANONICAL_AUTHORITIES.fulfillment, 'fulfillment');

console.log('FUX-28 cross-channel consistency regression: PASS');

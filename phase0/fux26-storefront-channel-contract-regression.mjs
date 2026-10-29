import assert from 'node:assert/strict';
import {
  normalizeSellerStorefrontChannel,
  buildSellerStorefrontChannelSummary,
  SELLER_STOREFRONT_CHANNEL_STATUSES,
} from '../app/src/platform/seller-channel-storefront-contract.js';

for (const status of SELLER_STOREFRONT_CHANNEL_STATUSES) {
  assert.equal(normalizeSellerStorefrontChannel({ channelType: 'telegram', status }).status, status);
}
assert.equal(normalizeSellerStorefrontChannel({ channelType: ' WEB ' }).channelType, 'web');
assert.equal(normalizeSellerStorefrontChannel({ channelType: 'telegram' }).configurationVersion, 1);
assert.equal(normalizeSellerStorefrontChannel({ channelType: 'telegram', configurationVersion: '2' }).configurationVersion, 2);
assert.equal(normalizeSellerStorefrontChannel({ channelType: 'telegram', status: '' }).status, 'DRAFT');

for (const status of ['INVALID', 'ACTIVE', '   ']) {
  assert.throws(
    () => normalizeSellerStorefrontChannel({ channelType: 'telegram', status }),
    /Invalid seller storefront channel status/,
  );
}
for (const configurationVersion of [0, -1, 1.5, NaN, Infinity, 'not-a-number']) {
  assert.throws(
    () => normalizeSellerStorefrontChannel({ channelType: 'telegram', configurationVersion }),
    /Invalid seller storefront configuration version/,
  );
}
assert.equal(
  buildSellerStorefrontChannelSummary({ channelType: 'telegram', status: 'VERIFIED', version: 3 }).configurationVersion,
  3,
);
assert.equal(
  buildSellerStorefrontChannelSummary({ channelType: 'telegram', status: 'verified' }).enabled,
  true,
  'summary enabled state should normalize status consistently',
);
assert.throws(
  () => buildSellerStorefrontChannelSummary({ channelType: 'telegram', status: 'VERIFIED', version: 0 }),
  /Invalid seller storefront configuration version/,
  'summary projection must not convert an invalid zero version into the default',
);

console.log('Seller storefront channel contract validation regression: PASS');

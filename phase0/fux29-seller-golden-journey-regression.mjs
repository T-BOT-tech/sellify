import assert from 'node:assert/strict';
import { buildSellerGoldenJourneyTrace, evaluateSellerGoldenJourney, SELLER_GOLDEN_JOURNEY_INVARIANTS } from '../app/src/platform/seller-cross-channel-journey-contract.js';

const trace = buildSellerGoldenJourneyTrace(Object.fromEntries([
  'organization','catalog','channel_configuration','channel_publication','buyer_discovery','cart','checkout','order','payment','fulfillment','delivery','seller_operations'
].map(id => [id, 'PASS'])));
assert.equal(trace.length, 12);
assert.equal(evaluateSellerGoldenJourney(trace).status, 'PASS');
assert.ok(SELLER_GOLDEN_JOURNEY_INVARIANTS.includes('ONE_CANONICAL_ORDER'));
assert.ok(SELLER_GOLDEN_JOURNEY_INVARIANTS.includes('CHANNEL_CART_IS_NOT_ORDER_AUTHORITY'));
const incomplete = buildSellerGoldenJourneyTrace({ organization:'PASS', catalog:'PASS' });
assert.equal(evaluateSellerGoldenJourney(incomplete).status, 'INCOMPLETE');
console.log('FUX-29 seller golden journey regression: PASS');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AGRICULTURE_PACK } from '../app/src/verticals/agriculture/pack.js';
import { RESTAURANT_PACK } from '../app/src/verticals/restaurant/pack.js';
import { WAREHOUSE_PACK } from '../app/src/verticals/warehouse/pack.js';
import { LOGISTICS_PACK } from '../app/src/verticals/logistics/pack.js';
import { getVerticalPackConfiguration } from '../app/src/verticals/configuration.js';

const packs = [AGRICULTURE_PACK, RESTAURANT_PACK, WAREHOUSE_PACK, LOGISTICS_PACK];
assert.equal(packs.length, 4);
for (const pack of packs) {
  assert.ok(pack.pack_id && pack.version);
  assert.ok(Array.isArray(pack.capabilities));
}
assert.equal(getVerticalPackConfiguration({ packId:'restaurant', config:{businessModel:'restaurant'} }).enabled, true);
assert.equal(getVerticalPackConfiguration({ packId:'warehouse', config:{warehouseEnabled:true} }).enabled, true);
assert.equal(getVerticalPackConfiguration({ packId:'logistics', config:{logisticsEnabled:true} }).enabled, true);
assert.equal(getVerticalPackConfiguration({ packId:'agriculture', config:{} }).enabled, null);
const ui = fs.readFileSync(new URL('../app/src/authorization/pack-entitlement.js', import.meta.url), 'utf8');
assert.match(ui, /Pack lifecycle state ≠ organization entitlement ≠ user authorization/);
assert.match(ui, /second authorization authority/);
assert.doesNotMatch(ui, /installPack\(|activatePack\(|deactivatePack\(|upgradePack\(/);
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
assert.match(html, /id="packEntitlementPanel"/);
console.log('P1-10 pack activation & entitlement regression: PASS');

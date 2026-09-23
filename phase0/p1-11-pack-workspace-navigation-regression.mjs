import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AGRICULTURE_PACK } from '../app/src/verticals/agriculture/pack.js';
import { RESTAURANT_PACK } from '../app/src/verticals/restaurant/pack.js';
import { WAREHOUSE_PACK } from '../app/src/verticals/warehouse/pack.js';
import { LOGISTICS_PACK } from '../app/src/verticals/logistics/pack.js';
import { getVerticalPackConfiguration } from '../app/src/verticals/configuration.js';

const packs = [AGRICULTURE_PACK, RESTAURANT_PACK, WAREHOUSE_PACK, LOGISTICS_PACK];
assert.deepEqual(packs.map(p => p.pack_id), ['agriculture', 'restaurant', 'warehouse', 'logistics']);
assert.deepEqual(AGRICULTURE_PACK.ui_entry_points, []);
assert.ok(RESTAURANT_PACK.ui_entry_points.includes('tables'));
assert.ok(RESTAURANT_PACK.ui_entry_points.includes('kitchen'));
assert.ok(WAREHOUSE_PACK.ui_entry_points.includes('inventory'));
assert.ok(WAREHOUSE_PACK.ui_entry_points.includes('receiving'));
assert.ok(LOGISTICS_PACK.ui_entry_points.includes('logistics'));

const config = { businessModel: 'retail', warehouseEnabled: false, logisticsEnabled: false };
assert.equal(getVerticalPackConfiguration({ packId: 'agriculture', config }).enabled, null);
assert.equal(getVerticalPackConfiguration({ packId: 'restaurant', config }).enabled, false);
assert.equal(getVerticalPackConfiguration({ packId: 'warehouse', config }).enabled, false);
assert.equal(getVerticalPackConfiguration({ packId: 'logistics', config }).enabled, false);

const workspace = await readFile(new URL('../app/src/experience/pack-workspace.js', import.meta.url), 'utf8');
const workspaceShell = await readFile(new URL('../app/src/experience/workspace.js', import.meta.url), 'utf8');
assert.match(workspaceShell, /fux-supply-intelligence-summary/);
assert.match(workspaceShell, /supplier-network:discovery:discover/);
assert.match(workspaceShell, /derived opportunities/);
assert.match(workspaceShell, /read-only projections/);
assert.match(workspaceShell, /loadSupplyIntelligenceSummary/);
assert.match(workspace, /Pack manifests/);
assert.match(workspace, /does not grant permissions/);
assert.match(workspace, /Navigation visibility is not authorization/);
assert.match(workspace, /data-pack-tab/);
assert.match(workspace, /switchTab/);
console.log('P1-11 PASS');

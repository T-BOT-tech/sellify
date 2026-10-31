import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/src/experience/pack-journey-composition.js', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../app/src/experience/pack-workspace.js', import.meta.url), 'utf8');
const manifests = await readFile(new URL('../shared/vertical-pack-manifests.js', import.meta.url), 'utf8');
const tabs = await readFile(new URL('../app/src/ui/tabs.js', import.meta.url), 'utf8');

for (const packId of ['agriculture', 'restaurant', 'warehouse', 'logistics']) {
  assert.match(source, new RegExp(`${packId}: Object\\.freeze`));
}
assert.match(source, /'table-management': 'restaurant-floor'/);
assert.match(source, /'kitchen-management': 'restaurant-kitchen'/);
assert.match(source, /'warehouse-receiving': 'warehouse-operations'/);
assert.match(source, /'logistics-proof': 'logistics-fulfillment'/);
assert.match(source, /status: 'DECLARATIVE_ONLY'/);
assert.match(source, /status: 'COMPOSED'/);
assert.match(source, /PACK_JOURNEY_ENTRY_TO_TAB/);
assert.match(source, /inventory: 'warehouse'/);
assert.match(source, /entryDeclaredByPack/);
assert.match(source, /resolvedTab/);
assert.match(source, /journey\.executable/);
assert.match(source, /data-journey-tab=/);
assert.match(source, /esc\(journey\.resolvedTab\)/);
assert.match(source, /does not create transactions/);
assert.match(source, /grant authorization/);
assert.match(source, /Server authorization remains authoritative/);
assert.match(manifests, /ui_entry_points: Object\.freeze\(\['inventory','receiving','transactions','locations'\]\)/);
const allTabsMatch = tabs.match(/const allTabs = \[([\s\S]*?)\];/);
assert.ok(allTabsMatch, 'existing switchTab() tab registry must be discoverable');
for (const tab of ['tables', 'kitchen', 'warehouse', 'logistics']) {
  assert.match(allTabsMatch[1], new RegExp(`['"]${tab}['"]`), `resolved journey tab ${tab} must exist in switchTab()`);
}
assert.match(workspace, /renderPackJourneyComposition/);
assert.match(workspace, /fux-pack-journey-composition/);
console.log('P1-12 PASS');

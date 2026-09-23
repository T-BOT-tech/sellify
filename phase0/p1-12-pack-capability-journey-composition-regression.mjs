import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/src/experience/pack-journey-composition.js', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../app/src/experience/pack-workspace.js', import.meta.url), 'utf8');

for (const packId of ['agriculture', 'restaurant', 'warehouse', 'logistics']) {
  assert.match(source, new RegExp(`${packId}: Object\\.freeze`));
}
assert.match(source, /'table-management': 'restaurant-floor'/);
assert.match(source, /'kitchen-management': 'restaurant-kitchen'/);
assert.match(source, /'warehouse-receiving': 'warehouse-operations'/);
assert.match(source, /'logistics-proof': 'logistics-fulfillment'/);
assert.match(source, /status: 'DECLARATIVE_ONLY'/);
assert.match(source, /status: 'COMPOSED'/);
assert.match(source, /entryDeclaredByPack/);
assert.match(source, /does not create transactions/);
assert.match(source, /grant authorization/);
assert.match(source, /Server authorization remains authoritative/);
assert.match(workspace, /renderPackJourneyComposition/);
assert.match(workspace, /fux-pack-journey-composition/);
console.log('P1-12 PASS');

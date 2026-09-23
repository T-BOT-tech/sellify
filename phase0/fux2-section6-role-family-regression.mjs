import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url).pathname;
const ui = fs.readFileSync(`${root}app/src/authorization/role-catalog.js`, 'utf8');
const recon = fs.readFileSync(`${root}app/src/authorization/role-reconciliation.js`, 'utf8');

const packs = [
  'Core organization', 'Restaurant', 'Retail / POS', 'Warehouse', 'Logistics',
  'Agriculture', 'Procurement', 'Supplier Network', 'Marketplace',
];
for (const pack of packs) {
  assert.match(ui, new RegExp(`pack: '${pack.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}'`));
}
assert.match(ui, /typicalScope: 'organization or assigned scope'/);
assert.match(ui, /typicalScope: 'FOH, kitchen, tables\/orders, operations'/);
assert.match(ui, /typicalScope: 'receiving, fulfillment tasks, stock'/);
assert.match(ui, /typicalScope: 'assignment, tracking, proof, coordination'/);
assert.match(ui, /typicalScope: 'farm, plot, season, supply context'/);
assert.match(ui, /typicalScope: 'demand, RFQ, comparison, award, PO'/);
assert.match(ui, /typicalScope: 'profile, qualification, capacity, evidence'/);
assert.match(ui, /typicalScope: 'listings and buyer\/seller workflows'/);
assert.match(ui, /ONLY_CANONICAL_ROLE_OR_EXPLICITLY_RECONCILED_ROLE/);
assert.match(recon, /typicalScope: family\.typicalScope/);
assert.match(recon, /authority: 'backend\/lib\/authorization\.js'/);
assert.match(recon, /persistence: 'none'/);
assert.match(recon, /evaluator: 'none'/);

for (const role of ['owner','manager','cashier','staff','buyer','viewer']) {
  assert.match(ui, new RegExp(`id: ['"]${role}['"]`));
}

console.log('FUX-2 Section 6 role-family regression: PASS');

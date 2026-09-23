import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const ui=fs.readFileSync(root+'app/src/authorization/role-catalog.js','utf8');
const recon=fs.readFileSync(root+'app/src/authorization/role-reconciliation.js','utf8');
assert.match(ui,/Pack-role reconciliation/);
assert.match(ui,/does not authorize or persist role assignments/);
assert.match(ui,/EXTEND\/NEW rows remain non-assignable/);
assert.match(recon,/export const PACK_ROLE_RECONCILIATION/);
assert.match(recon,/EXISTING', 'MAP', 'EXTEND', 'NEW', 'DEFERRED/);
assert.match(recon,/backend\/lib\/authorization\.js/);
assert.match(recon,/policyMutation: 'none'/);
// Section 6 contains 39 target role entries: 5+5+5+5+4+4+4+4+3.
const familyBlocks=[...ui.matchAll(/\{ pack: '[^']+', roles: \[([^\]]+)\](?:, typicalScope: '[^']+')? \}/g)];
assert.equal(familyBlocks.reduce((n,m)=>n+(m[1].match(/'[^']+'/g)||[]).length,0),39);
// Current canonical roles are still only the six server roles.
for (const role of ['owner','manager','cashier','staff','buyer','viewer']) assert.match(ui,new RegExp(`id: ['"]${role}['"]`));
console.log('P1-04 Pack-role reconciliation regression: PASS');

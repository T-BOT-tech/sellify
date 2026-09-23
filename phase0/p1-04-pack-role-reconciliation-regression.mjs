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
// FUX-2 Section 6 contains 39 target role entries; contextual executable IDs are separate product metadata.
const familyBlocks=[...ui.matchAll(/\{ pack: '([^']+)', roles: \[([^\]]+)\](?:, typicalScope: '[^']+')? \}/g)];
const section6Blocks=familyBlocks.filter(([,pack])=>!pack.endsWith(' contextual'));
const contextualBlocks=familyBlocks.filter(([,pack])=>pack.endsWith(' contextual'));
assert.equal(section6Blocks.reduce((n,m)=>n+(m[2].match(/'[^']+'/g)||[]).length,0),39);
assert.equal(contextualBlocks.reduce((n,m)=>n+(m[2].match(/'[^']+'/g)||[]).length,0),13);
// Current canonical roles are still only the six server roles.
for (const role of ['owner','manager','cashier','staff','buyer','viewer']) assert.match(ui,new RegExp(`id: ['"]${role}['"]`));
console.log('P1-04 Pack-role reconciliation regression: PASS');

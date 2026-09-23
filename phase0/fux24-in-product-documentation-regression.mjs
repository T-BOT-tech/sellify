import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  documentationContract,
  assertFux24Boundary,
  validateHelpEntry,
  selectDocumentation,
} from '../app/src/experience/documentation-contract.js';

const contract = documentationContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.executionAuthority, 'none');
assert.equal(contract.duplicateAuthority, false);
assert.equal(contract.duplicatePersistence, false);
assert.ok(contract.types.includes('ONBOARDING'));
assert.ok(contract.types.includes('CONTEXTUAL_HELP'));
assert.ok(contract.types.includes('OPERATIONAL_GUIDANCE'));
assert.ok(contract.audiences.includes('ROLE'));
assert.ok(contract.audiences.includes('PACK'));
assert.ok(contract.audiences.includes('STATE'));
assert.match(contract.canonicalDestinationRule, /cannot execute mutations/);

assert.equal(assertFux24Boundary({}), true);
assert.throws(() => assertFux24Boundary({ ownsAuthorization: true }), /cannot own authorization/);
assert.throws(() => assertFux24Boundary({ ownsTransaction: true }), /cannot own transaction/);
assert.throws(() => assertFux24Boundary({ ownsPackLifecycle: true }), /cannot own packLifecycle/);

const entries = [
  { id: 'global-start', type: 'ONBOARDING', titleKey: 'help.start.title', bodyKey: 'help.start.body', roles: [], actions: ['READ'] },
  { id: 'manager-procurement', type: 'CONTEXTUAL_HELP', titleKey: 'help.procurement.title', bodyKey: 'help.procurement.body', roles: ['Manager'], packs: ['procurement'], actions: ['OPEN_CANONICAL_DESTINATION'] },
  { id: 'offline-recovery', type: 'OPERATIONAL_GUIDANCE', titleKey: 'help.offline.title', bodyKey: 'help.offline.body', states: ['offline', 'queued'], actions: ['READ'] },
];

for (const entry of entries) assert.equal(validateHelpEntry(entry), true);
assert.equal(selectDocumentation(entries, { roles: ['Manager'], packs: ['procurement'], states: ['online'] }).length, 2);
assert.equal(selectDocumentation(entries, { roles: ['Viewer'], packs: ['procurement'], states: ['offline'] }).length, 2);
assert.equal(selectDocumentation(entries, { roles: ['Viewer'], packs: ['retail'], states: ['online'] }).length, 1);
assert.throws(() => validateHelpEntry({ id: 'bad', type: 'CONTEXTUAL_HELP', titleKey: 'x', bodyKey: 'y', actions: ['EXECUTE'] }), /invalid documentation action/);
assert.throws(() => validateHelpEntry({ id: 'bad', type: 'CONTEXTUAL_HELP', titleKey: 'x', bodyKey: 'y', authority: 'transaction' }), /must not declare canonical authority/);

const source = fs.readFileSync(new URL('../app/src/experience/documentation-contract.js', import.meta.url), 'utf8');
assert.match(source, /FUX-24/);
assert.match(source, /role-aware onboarding/);
assert.match(source, /cannot execute mutations/);
assert.match(source, /forbiddenAuthorities/);

console.log('FUX-24 In-product Documentation Regression: PASS');
console.log('Role-aware onboarding/contextual help/operational guidance selection: PASS');
console.log('Documentation remains read-only and links to canonical destinations only: PASS');
console.log('No duplicate authority or persistence introduced: PASS');

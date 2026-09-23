import assert from 'node:assert/strict';
import { getPackActivationExperienceModel, packActivationActionModel } from '../app/src/experience/pack-activation-contract.js';

const active = getPackActivationExperienceModel({
  pack: { pack_id: 'warehouse', version: '1.0.0' },
  readiness: { readiness: 'READY' },
  lifecycle: { state: 'ACTIVE' },
});
assert.equal(active.lifecycleState, 'ACTIVE');
assert.equal(active.installation.status, 'INSTALLED');
assert.match(active.installation.reason, /canonical server lifecycle/i);

const installed = getPackActivationExperienceModel({
  pack: { pack_id: 'warehouse', version: '1.0.0' },
  readiness: { readiness: 'READY' },
  lifecycle: { state: 'INSTALLED' },
});
assert.equal(installed.lifecycleState, 'INSTALLED');
assert.equal(installed.installation.status, 'INSTALLED');
assert.notEqual(installed.lifecycleState, 'ACTIVE');

const notInstalled = getPackActivationExperienceModel({
  pack: { pack_id: 'warehouse', version: '1.0.0' },
  readiness: { readiness: 'READY' },
  lifecycle: { state: 'NOT_INSTALLED' },
});
assert.equal(notInstalled.lifecycleState, 'NOT_INSTALLED');
assert.equal(notInstalled.installation.status, 'NOT_INSTALLED');

assert.equal(packActivationActionModel('INSTALL').allowedByFux13, true);
assert.equal(packActivationActionModel('ACTIVATE').outcome, 'SERVER_AUTHORIZED_MUTATION');
assert.equal(packActivationActionModel('VIEW').outcome, 'READ_ONLY_EXPERIENCE');

console.log('FUX-13 Pack Lifecycle Experience / Canonical Read regression: PASS');
console.log('Persisted lifecycle state wins over readiness-derived display state: PASS');
console.log('Installation status uses canonical lifecycle record: PASS');
console.log('Mutation actions route through server authorization: PASS');

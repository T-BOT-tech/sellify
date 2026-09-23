import assert from 'node:assert/strict';
import {
  defineAiCapabilityIntent,
  resolveAiCapabilityIntent,
  assertAiCapabilityBoundary,
  platformAiCapabilityBoundaryContract,
} from '../app/src/platform/ai-capability-boundary.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };
const rejects = (name, fn) => { assert.throws(fn); passed++; console.log(`PASS ${name}`); };

check('contract declares structured intent only', () => {
  const c = platformAiCapabilityBoundaryContract();
  assert.equal(c.input, 'structured_intent_only');
  assert.equal(c.execution, 'none');
  assert.equal(c.persistence, 'none');
  assert.equal(c.directDatabaseAccess, false);
  assert.equal(c.directCredentialsAccess, false);
});
check('read intent normalizes', () => {
  const i = defineAiCapabilityIntent({ capability: 'commerce.products', action: 'view', reason: 'find product' });
  assert.equal(i.capability, 'commerce.products'); assert.equal(i.action, 'view'); assert.equal(i.execution, 'none');
});
check('mutation intent is marked for existing approval boundary', () => {
  const i = resolveAiCapabilityIntent({ capability: 'inventory.stock', action: 'edit', scope: { countryCode: 'ET' } });
  assert.equal(i.risk, 'mutation'); assert.equal(i.approvalBoundary, 'existing_approval_policy'); assert.equal(i.executable, false);
});
check('read intent has no approval requirement', () => {
  const i = resolveAiCapabilityIntent({ capability: 'customers.identity', action: 'view' });
  assert.equal(i.risk, 'read'); assert.equal(i.approvalBoundary, 'none');
});
check('existing authority is resolved', () => {
  const i = resolveAiCapabilityIntent({ capability: 'payments.core', action: 'view' });
  assert.equal(i.authority, 'payments'); assert.equal(i.requiresExistingAuthorization, true);
});
check('scope is bounded', () => {
  const i = defineAiCapabilityIntent({ capability: 'country.configuration', action: 'view', scope: { countryCode: 'ET' } });
  assert.equal(i.scope.countryCode, 'ET');
});
check('boundary assertion passes', () => assert.equal(assertAiCapabilityBoundary({ capability: 'audit.history', action: 'view' }), true));
rejects('unknown capability rejected', () => defineAiCapabilityIntent({ capability: 'database.raw', action: 'view' }));
rejects('unknown action rejected', () => defineAiCapabilityIntent({ capability: 'commerce.products', action: 'delete' }));
rejects('sql rejected', () => defineAiCapabilityIntent({ capability: 'commerce.products', action: 'view', sql: 'select *' }));
rejects('database rejected', () => defineAiCapabilityIntent({ capability: 'commerce.products', action: 'view', database: true }));
rejects('credentials rejected', () => defineAiCapabilityIntent({ capability: 'payments.core', action: 'view', credentials: 'secret' }));
rejects('direct execution rejected', () => defineAiCapabilityIntent({ capability: 'commerce.products', action: 'view', directExecution: true }));
rejects('unsupported scope rejected', () => defineAiCapabilityIntent({ capability: 'commerce.products', action: 'view', scope: { tenantDatabase: 'x' } }));

console.log(`PHASE16.10_ASSERTIONS=${passed}`);

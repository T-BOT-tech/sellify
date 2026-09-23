import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const registrySource = read('backend/lib/resource-action-registry.js');
const authSource = read('backend/lib/authorization.js');
const handoffSource = read('SELLIFY_AI_HANDOFF.md');

assert.ok(exists('backend/lib/security-context.js'));
assert.ok(exists('phase0/phase13.12.2-security-context-contract-regression.mjs'));
assert.match(registrySource, /RESOURCE_ACTION_REGISTRY/);
assert.match(registrySource, /resourceActionRegistryContract/);
assert.match(registrySource, /backend\/lib\/authorization\.js/);
assert.doesNotMatch(registrySource, /ROLE_PERMISSIONS/);
assert.doesNotMatch(registrySource, /export function authorize\s*\(/);
assert.doesNotMatch(registrySource, /CREATE TABLE|INSERT INTO|UPDATE\s+.*permission|permission_store\s*=\s*['"](?!none)/is);

const { RESOURCE_ACTION_REGISTRY, getResourceAction, listResourceActions, resourceActionRegistryContract } =
  await import('../backend/lib/resource-action-registry.js');

assert.equal(RESOURCE_ACTION_REGISTRY.length, 42);
assert.equal(new Set(RESOURCE_ACTION_REGISTRY.map((entry) => entry.key)).size, 42);

for (const packId of ['agriculture', 'restaurant', 'warehouse', 'logistics']) {
  assert.ok(listResourceActions({ packId }).length > 0, `${packId} registry missing`);
}

assert.deepEqual(getResourceAction('warehouse', 'stock_adjustment', 'manage'), {
  key: 'warehouse:stock_adjustment:manage',
  packId: 'warehouse',
  resource: 'stock_adjustment',
  action: 'manage',
  permission: 'inventory:edit',
  authorizationAuthority: 'backend/lib/authorization.js',
  policyDefined: true,
});
assert.equal(getResourceAction('restaurant', 'table', 'manage').permission, 'tables:manage');
assert.equal(getResourceAction('agriculture', 'farm', 'manage').permission, 'agriculture:manage');

// These are deliberately vocabulary-only. No new central policy is invented
// merely to make an entry look authorized.
for (const key of [
  'restaurant:recipe:manage',
  'restaurant:preparation:manage',
  'logistics:shipment:manage',
  'logistics:route:manage',
  'logistics:delivery:manage',
  'logistics:return:manage',
]) {
  const entry = RESOURCE_ACTION_REGISTRY.find((item) => item.key === key);
  assert.ok(entry);
  assert.equal(entry.permission, null);
  assert.equal(entry.policyDefined, false);
}

const contract = resourceActionRegistryContract();
assert.equal(contract.authority.includes('authorize(actor, organization, location, resource, action)'), true);
assert.equal(contract.persistence, 'none');
assert.equal(contract.evaluator, 'none');
assert.equal(contract.permission_store, 'none');
assert.equal(contract.registry_entries, 42);
assert.equal(contract.packs.length, 4);

// Phase 10.3 remains the only policy implementation.
assert.match(authSource, /export function authorize\(actor, organization, location, resource, action\)/);
assert.match(handoffSource, /Phase 13\.12\.2/);

console.log('Phase 13.12.3 Resource / Action Registry Regression: PASS');
console.log('Canonical Phase 10.3 authorization authority preserved: PASS');
console.log('Agriculture / Restaurant / Warehouse / Logistics vocabulary registered: PASS');
console.log('Central permission mappings preserved without new evaluator/store: PASS');
console.log('Vocabulary-only actions remain policy-neutral: PASS');
console.log('No duplicate authorization authority introduced: BLOCKED');

import assert from 'node:assert/strict';
import { AUTHZ, ROLES, authorize, getRolePermissions } from '../backend/lib/authorization.js';
import { RESOURCE_ACTION_REGISTRY } from '../backend/lib/resource-action-registry.js';
import {
  CROSS_PACK_ROLE_MATRIX,
  crossPackRoleMatrixContract,
  listCrossPackRoleMatrix,
} from '../backend/lib/cross-pack-role-matrix.js';

const failures = [];
const check = (name, fn) => {
  try { fn(); console.log(`PASS: ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL: ${name} — ${error.message}`); }
};

const actor = (role, organizationId = 'org-a') => ({ userId: `u-${role}`, role, organizationId });
const organization = { id: 'org-a' };
const foreignOrganization = { id: 'org-b' };

check('Phase 10.3 canonical authority remains the evaluator', () => {
  assert.equal(typeof authorize, 'function');
  assert.equal(typeof getRolePermissions, 'function');
  assert.equal(crossPackRoleMatrixContract().authorization_authority, 'backend/lib/authorization.js');
});

check('All existing roles are represented exactly once per registry entry', () => {
  assert.deepEqual([...new Set(CROSS_PACK_ROLE_MATRIX.map((row) => row.role))], [...ROLES]);
  assert.equal(CROSS_PACK_ROLE_MATRIX.length, ROLES.length * RESOURCE_ACTION_REGISTRY.length);
});

check('All registry entries are represented for every role', () => {
  for (const role of ROLES) {
    const rows = listCrossPackRoleMatrix({ role });
    assert.equal(rows.length, RESOURCE_ACTION_REGISTRY.length);
    assert.deepEqual(rows.map((row) => row.packId + ':' + row.resource + ':' + row.action).sort(),
      RESOURCE_ACTION_REGISTRY.map((entry) => entry.key).sort());
  }
});

check('Matrix preserves current central permission grants without broadening them', () => {
  for (const row of CROSS_PACK_ROLE_MATRIX) {
    const permissions = getRolePermissions(row.role);
    const expected = (!row.policyDefined || !row.permission)
      ? (permissions.includes('*') ? AUTHZ.ALLOW : AUTHZ.DENY)
      : (permissions.includes('*') || permissions.includes(row.permission) ? AUTHZ.ALLOW : AUTHZ.DENY);
    assert.equal(row.decision, expected, `${row.role} ${row.key ?? row.packId + ':' + row.resource + ':' + row.action}`);
  }
});

check('Vocabulary-only capabilities preserve the existing wildcard boundary', () => {
  for (const row of CROSS_PACK_ROLE_MATRIX.filter((row) => !row.policyDefined)) {
    assert.equal(row.decision, row.role === 'owner' ? AUTHZ.ALLOW : AUTHZ.DENY);
  }
});

check('Agriculture remains owner-only under current policy metadata', () => {
  for (const row of CROSS_PACK_ROLE_MATRIX.filter((row) => row.packId === 'agriculture')) {
    assert.equal(row.decision, row.role === 'owner' ? AUTHZ.ALLOW : AUTHZ.DENY);
  }
});

check('Logistics preserves existing central wildcard behavior', () => {
  for (const row of CROSS_PACK_ROLE_MATRIX.filter((row) => row.packId === 'logistics')) {
    assert.equal(row.decision, row.role === 'owner' ? AUTHZ.ALLOW : AUTHZ.DENY);
  }
});

check('Organization mismatch remains DENY at the canonical authority', () => {
  assert.equal(authorize(actor('owner'), foreignOrganization, null, 'farm', 'agriculture:manage'), AUTHZ.DENY);
});

check('Valid organization is accepted by the canonical authority for existing policy', () => {
  assert.equal(authorize(actor('manager'), organization, null, 'table', 'tables:manage'), AUTHZ.ALLOW);
  assert.equal(authorize(actor('cashier'), organization, null, 'kitchen', 'kitchen:manage'), AUTHZ.ALLOW);
  assert.equal(authorize(actor('staff'), organization, null, 'storage', 'inventory:view'), AUTHZ.ALLOW);
});

check('Named unsupported policy remains DENY for non-owner roles', () => {
  assert.equal(authorize(actor('owner'), organization, null, 'shipment', 'logistics:manage'), AUTHZ.ALLOW);
  assert.equal(authorize(actor('owner'), organization, null, 'recipe', 'recipe:manage'), AUTHZ.ALLOW);
  assert.equal(authorize(actor('manager'), organization, null, 'shipment', 'logistics:manage'), AUTHZ.DENY);
});

check('No second authorization persistence/evaluator is introduced', () => {
  assert.equal(crossPackRoleMatrixContract().persistence, 'none');
  assert.equal(crossPackRoleMatrixContract().evaluator, 'none');
  assert.equal(crossPackRoleMatrixContract().policy_mutation, 'none');
});

if (failures.length) {
  console.error(`\nPhase 13.12.4 Cross-Pack Role Matrix Regression: FAIL (${failures.length})`);
  process.exit(1);
}

console.log('\nPhase 13.12.4 Cross-Pack Role Matrix Regression: PASS');
console.log(`Roles checked: ${ROLES.length}`);
console.log(`Registry entries checked: ${RESOURCE_ACTION_REGISTRY.length}`);
console.log(`Matrix rows checked: ${CROSS_PACK_ROLE_MATRIX.length}`);
console.log('Current central permission policy preserved: PASS');
console.log('Vocabulary-only actions preserve owner wildcard / non-owner DENY: PASS');
console.log('Organization boundary preserved: PASS');
console.log('No duplicate authorization authority: BLOCKED');

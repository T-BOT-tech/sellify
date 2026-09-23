// Phase 13.12.4 — cross-pack role matrix.
// Declarative/derived security evidence only. The Phase 10.3 authorization
// module remains the sole evaluator and permission authority.

import { AUTHZ, ROLES, getRolePermissions } from './authorization.js';
import { RESOURCE_ACTION_REGISTRY } from './resource-action-registry.js';

const freeze = (value) => Object.freeze(value);

function decisionFor(role, entry) {
  const permissions = getRolePermissions(role);
  // Preserve the actual Phase 10.3 wildcard semantics: owner is explicitly
  // allowed by the existing central policy even where the registry has no
  // named vertical permission. Non-owner roles cannot receive access from a
  // vocabulary-only entry.
  if (!entry.policyDefined || !entry.permission) {
    return permissions.includes('*') ? AUTHZ.ALLOW : AUTHZ.DENY;
  }
  return permissions.includes('*') || permissions.includes(entry.permission)
    ? AUTHZ.ALLOW
    : AUTHZ.DENY;
}

export const CROSS_PACK_ROLE_MATRIX = freeze(
  ROLES.flatMap((role) => RESOURCE_ACTION_REGISTRY.map((entry) => freeze({
    role,
    packId: entry.packId,
    resource: entry.resource,
    action: entry.action,
    permission: entry.permission,
    policyDefined: entry.policyDefined,
    decision: decisionFor(role, entry),
    organizationScope: 'required',
    locationScope: 'validated-when-supplied',
    authority: 'backend/lib/authorization.js',
  }))),
);

export function listCrossPackRoleMatrix({ role = null, packId = null } = {}) {
  const normalizedRole = role == null ? null : String(role).trim().toLowerCase();
  const normalizedPack = packId == null ? null : String(packId).trim().toLowerCase();
  return CROSS_PACK_ROLE_MATRIX.filter((row) =>
    (!normalizedRole || row.role === normalizedRole) &&
    (!normalizedPack || row.packId === normalizedPack)
  );
}

export function crossPackRoleMatrixContract() {
  return freeze({
    roles: freeze([...ROLES]),
    registry_entries: RESOURCE_ACTION_REGISTRY.length,
    matrix_entries: CROSS_PACK_ROLE_MATRIX.length,
    authorization_authority: 'backend/lib/authorization.js',
    persistence: 'none',
    evaluator: 'none',
    policy_mutation: 'none',
    organization_scope: 'required',
    location_scope: 'validated-when-supplied',
    vocabulary_only_rule: 'DENY until deliberate Phase 10.3 policy exists',
  });
}

// Phase 13.12.7 — Vertical capability authorization boundary.
//
// This module is an enforcement adapter, not a new authorization authority.
// It resolves a Phase 13 vertical capability from the canonical registry,
// rejects vocabulary-only capabilities until central policy exists, enforces
// the existing tenant/location boundaries, and delegates the final decision
// to Phase 10.3 authorize(). It does not persist permissions, roles, or scope.

import { AUTHZ, authorize } from './authorization.js';
import { assertTenantScope, assertLocationScope } from './tenant-isolation.js';
import { getResourceAction } from './resource-action-registry.js';

export function authorizeVerticalCapability(
  session,
  tenant,
  packId,
  resource,
  action,
  { location = null } = {},
) {
  // Tenant and location isolation remain canonical prerequisites.
  assertTenantScope(session, tenant);
  if (location) assertLocationScope(session, tenant, location);

  const entry = getResourceAction(packId, resource, action);
  if (!entry) return AUTHZ.DENY;

  // A registry entry without a central permission is vocabulary only. Do not
  // allow the owner wildcard to accidentally turn an ungoverned capability
  // into an authorization grant.
  if (!entry.policyDefined || !entry.permission) return AUTHZ.DENY;

  const organization = tenant?.organizationId || session?.organizationId;
  return authorize(session, organization, location, resource, entry.permission);
}

export function hasVerticalCapabilityAuthorization(
  session,
  tenant,
  packId,
  resource,
  action,
  options = {},
) {
  return authorizeVerticalCapability(session, tenant, packId, resource, action, options) === AUTHZ.ALLOW;
}

export function verticalCapabilityAuthorizationContract() {
  return Object.freeze({
    authority: 'backend/lib/authorization.js authorize(actor, organization, location, resource, action)',
    isolation: 'backend/lib/tenant-isolation.js',
    registry: 'backend/lib/resource-action-registry.js',
    persistence: 'none',
    role_store: 'none',
    permission_store: 'none',
    undefined_policy: 'DENY',
  });
}

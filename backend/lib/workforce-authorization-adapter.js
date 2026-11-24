import { AUTHZ, authorize } from './authorization.js';
import { tenantScopeDecision } from './tenant-isolation.js';

const PERMISSION_BY_ENTITY = Object.freeze({
  member: { view: 'workforce:member:view', manage: 'workforce:member:manage' },
  profile: { view: 'workforce:profile:view', manage: 'workforce:profile:manage' },
  engagement: { view: 'workforce:engagement:view', manage: 'workforce:engagement:manage' },
  calendar: { view: 'workforce:calendar:view', manage: 'workforce:calendar:manage' },
  calendar_exception: { view: 'workforce:calendar:view', manage: 'workforce:calendar:manage' },
  availability: { view: 'workforce:availability:view', manage: 'workforce:availability:manage' },
  assignment: { view: 'workforce:assignment:view', manage: 'workforce:assignment:manage' },
  shift: { view: 'workforce:assignment:view', manage: 'workforce:assignment:manage' },
  allocation: { view: 'workforce:allocation:view', manage: 'workforce:allocation:manage', release: 'workforce:allocation:release' },
  utilization: { view: 'workforce:utilization:view', manage: 'workforce:utilization:manage' },
});

const READ_OPERATIONS = new Set(['get','list']);

function permissionFor(entity, operation) {
  const mapping = PERMISSION_BY_ENTITY[entity];
  if (!mapping) return null;
  if (READ_OPERATIONS.has(operation)) return mapping.view;
  if (entity === 'member' && operation === 'activate') return 'workforce:member:activate';
  if (entity === 'member' && operation === 'suspend') return 'workforce:member:suspend';
  if (entity === 'allocation' && operation === 'release') return mapping.release;
  return mapping.manage;
}

/**
 * Adapter from the Workforce repository boundary to Sellify's existing
 * authorization and tenant-isolation authorities. No parallel role system.
 */
export function authorizeWorkforceRepositoryAccess(request = {}) {
  const { actor, organization_id, chat_id, entity, operation, record = null } = request;
  if (!actor?.userId || !organization_id || !chat_id) return false;

  const tenantDecision = tenantScopeDecision(actor, {
    chatId: String(chat_id),
    organizationId: String(organization_id),
  });
  if (tenantDecision !== 'ALLOW') return false;

  const permission = permissionFor(entity, operation);
  if (!permission) return false;

  const contextualRoles = Array.isArray(actor.contextualRoles) ? actor.contextualRoles : [];
  const providerScoped = contextualRoles.some((entry) => String(entry?.role || '').trim().toLowerCase() === 'service_provider');
  const scopedResourceId = request.resource_id == null ? null : String(request.resource_id);
  if (providerScoped && !scopedResourceId) return false;

  const resourceId = providerScoped
    ? scopedResourceId
    : (scopedResourceId || record?.resource_id || null);
  const locationId = record?.location_id || request.location_id || null;
  const resource = resourceId ? 'service_resource' : 'workforce';
  const resourceContext = resourceId ? {
    resourceType: 'service_resource',
    resourceId,
    organizationId: String(organization_id),
    locationId,
  } : null;

  return authorize(
    actor,
    String(organization_id),
    locationId,
    resource,
    permission,
    resourceContext,
  ) === AUTHZ.ALLOW;
}

export function workforceAuthorizationAdapterContract() {
  return Object.freeze({
    authority: 'backend/lib/authorization.js',
    tenant_scope_authority: 'backend/lib/tenant-isolation.js',
    workforce_permissions_are_central: true,
    provider_access_is_resource_scoped: true,
    provider_access_is_read_only: true,
    no_parallel_role_matrix: true,
  });
}

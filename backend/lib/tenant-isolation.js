// Phase 13.11.14 — canonical tenant / organization / location isolation.
// Policy-only helpers. Authentication remains in store-sqlite/server; this
// module does not persist data or replace the existing session model.

export const TENANT_SCOPE = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
});

function id(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value.id ?? value.organizationId ?? value.organization_id ?? null;
  return String(value);
}

export function tenantScopeDecision(session, tenant, location = null) {
  if (!session?.userId || !tenant) return TENANT_SCOPE.DENY;
  const tenantChatId = tenant.chatId ?? tenant.chat_id;
  const tenantOrganizationId = tenant.organizationId ?? tenant.organization_id;
  if (!tenantChatId || !tenantOrganizationId) return TENANT_SCOPE.DENY;
  if (String(session.chatId) !== String(tenantChatId)) return TENANT_SCOPE.DENY;
  if (!session.organizationId || String(session.organizationId) !== String(tenantOrganizationId)) return TENANT_SCOPE.DENY;

  if (location) {
    const locationOrganizationId = location.organizationId ?? location.organization_id;
    if (!locationOrganizationId || String(locationOrganizationId) !== String(tenantOrganizationId)) return TENANT_SCOPE.DENY;
  }
  return TENANT_SCOPE.ALLOW;
}

export function assertTenantScope(session, tenant) {
  if (tenantScopeDecision(session, tenant) !== TENANT_SCOPE.ALLOW) {
    throw Object.assign(new Error('Session is not authorized for this tenant organization'), {
      statusCode: 403,
      code: 'TENANT_SCOPE_DENIED',
    });
  }
  return session;
}

export function assertLocationScope(session, tenant, location) {
  if (tenantScopeDecision(session, tenant, location) !== TENANT_SCOPE.ALLOW) {
    throw Object.assign(new Error('Location is not authorized for this tenant organization'), {
      statusCode: 403,
      code: 'LOCATION_SCOPE_DENIED',
    });
  }
  return location;
}

export function sameTenantOrganization(a, b) {
  const left = id(a);
  const right = id(b);
  return Boolean(left && right && String(left) === String(right));
}

export function tenantIsolationContract() {
  return Object.freeze({
    session_authority: 'existing sessions + memberships + devices',
    tenant_authority: 'existing tenants.chat_id -> tenants.organization_id',
    organization_authority: 'existing organizations',
    location_authority: 'existing locations.organization_id',
    policy_module: 'backend/lib/tenant-isolation.js',
    persistence: 'none',
    duplicate_tenant_authority: false,
    duplicate_organization_authority: false,
    duplicate_location_authority: false,
  });
}

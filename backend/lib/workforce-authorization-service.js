/**
 * Canonical Workforce authorization and tenant-isolation service.
 *
 * This service enforces organization-scoped authorization, tenant isolation,
 * resource-scoped assignment isolation, and provider appointment isolation.
 *
 * It does not create a second user, organization, tenant, booking,
 * supplier-network, logistics, inventory, payment, fulfillment, or catalog
 * authority.
 */

export const WORKFORCE_AUTHORIZATION_SERVICE_VERSION = '1.1';

export const WORKFORCE_AUTHORIZATION_PERMISSIONS = Object.freeze({
  departmentView: 'workforce:department:view',
  departmentManage: 'workforce:department:manage',
  positionView: 'workforce:position:view',
  positionManage: 'workforce:position:manage',
  memberView: 'workforce:member:view',
  memberManage: 'workforce:member:manage',
  memberActivate: 'workforce:member:activate',
  memberSuspend: 'workforce:member:suspend',
  profileView: 'workforce:profile:view',
  profileManage: 'workforce:profile:manage',
  engagementView: 'workforce:engagement:view',
  engagementManage: 'workforce:engagement:manage',
  calendarView: 'workforce:calendar:view',
  calendarManage: 'workforce:calendar:manage',
  availabilityView: 'workforce:availability:view',
  availabilityManage: 'workforce:availability:manage',
  assignmentView: 'workforce:assignment:view',
  assignmentManage: 'workforce:assignment:manage',
  allocationView: 'workforce:allocation:view',
  allocationManage: 'workforce:allocation:manage',
  allocationRelease: 'workforce:allocation:release',
  utilizationView: 'workforce:utilization:view',
  utilizationManage: 'workforce:utilization:manage',
});

export function workforceAuthorizationServiceContract() {
  return Object.freeze({
    contract_version: WORKFORCE_AUTHORIZATION_SERVICE_VERSION,
    capability: 'workforce.membership',
    organization_scoped: true,
    tenant_scoped: true,
    resource_scoped: true,
    provider_appointment_isolation: true,
    reuses_existing_user_identity: true,
    reuses_existing_organization_authority: true,
    creates_duplicate_user_identity: false,
    permissions: WORKFORCE_AUTHORIZATION_PERMISSIONS,
  });
}

export function hasWorkforcePermission(context, permission) {
  if (!context || !context.permissions) return false;
  if (!Array.isArray(context.permissions)) return false;
  return context.permissions.includes(permission);
}

export function isSameOrganization(context, resource) {
  if (!context || !resource) return false;
  return context.organization_id === resource.organization_id;
}

export function isSameTenant(context, resource) {
  if (!context || !resource) return false;
  return context.tenant_id === resource.tenant_id;
}

export function canAccessWorkforceResource(context, resource, permission) {
  if (!context || !resource) return false;
  if (!isSameOrganization(context, resource)) return false;
  if (!isSameTenant(context, resource)) return false;
  if (!hasWorkforcePermission(context, permission)) return false;
  return true;
}

export function canAccessWorkforceAssignment(context, assignment, permission) {
  if (!canAccessWorkforceResource(context, assignment, permission)) return false;
  if (context.resource_id && assignment.resource_id && context.resource_id !== assignment.resource_id) return false;
  return true;
}

export function canAccessProviderAppointment(context, appointment, permission) {
  if (!canAccessWorkforceResource(context, appointment, permission)) return false;
  if (context.provider_id && appointment.provider_id && context.provider_id !== appointment.provider_id) return false;
  return true;
}

export function workforceAuthorizationDecision(context, resource, permission) {
  const organizationMatch = isSameOrganization(context, resource);
  const tenantMatch = isSameTenant(context, resource);
  const permissionGranted = hasWorkforcePermission(context, permission);

  return Object.freeze({
    allowed: organizationMatch && tenantMatch && permissionGranted,
    organization_match: organizationMatch,
    tenant_match: tenantMatch,
    permission_granted: permissionGranted,
  });
}

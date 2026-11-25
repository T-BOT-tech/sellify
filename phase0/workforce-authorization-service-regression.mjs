import assert from 'node:assert/strict';
import {
  WORKFORCE_AUTHORIZATION_SERVICE_VERSION,
  WORKFORCE_AUTHORIZATION_PERMISSIONS,
  workforceAuthorizationServiceContract,
  hasWorkforcePermission,
  isSameOrganization,
  isSameTenant,
  canAccessWorkforceResource,
  canAccessWorkforceAssignment,
  canAccessProviderAppointment,
  workforceAuthorizationDecision,
} from '../backend/lib/workforce-authorization-service.js';

const contract = workforceAuthorizationServiceContract();

assert.equal(contract.contract_version, WORKFORCE_AUTHORIZATION_SERVICE_VERSION);
assert.equal(contract.capability, 'workforce.membership');
assert.equal(contract.organization_scoped, true);
assert.equal(contract.tenant_scoped, true);
assert.equal(contract.resource_scoped, true);
assert.equal(contract.provider_appointment_isolation, true);
assert.equal(contract.reuses_existing_user_identity, true);
assert.equal(contract.reuses_existing_organization_authority, true);
assert.equal(contract.creates_duplicate_user_identity, false);
assert.deepEqual(contract.permissions, WORKFORCE_AUTHORIZATION_PERMISSIONS);
assert.equal(WORKFORCE_AUTHORIZATION_PERMISSIONS.departmentView, 'workforce:department:view');
assert.equal(WORKFORCE_AUTHORIZATION_PERMISSIONS.positionManage, 'workforce:position:manage');

const context = {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  resource_id: 'resource-1',
  provider_id: 'provider-1',
  permissions: [
    'workforce:member:view',
    'workforce:member:manage',
    'workforce:assignment:view',
  ],
};

const resource = {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
};

assert.equal(hasWorkforcePermission(context, 'workforce:member:view'), true);
assert.equal(hasWorkforcePermission(context, 'workforce:member:manage'), true);
assert.equal(hasWorkforcePermission(context, 'workforce:member:activate'), false);
assert.equal(hasWorkforcePermission(context, 'workforce:member:suspend'), false);

assert.equal(isSameOrganization(context, resource), true);
assert.equal(isSameTenant(context, resource), true);

assert.equal(canAccessWorkforceResource(context, resource, 'workforce:member:view'), true);
assert.equal(canAccessWorkforceResource(context, resource, 'workforce:member:activate'), false);

const crossOrganizationResource = {
  organization_id: 'org-2',
  tenant_id: 'tenant-1',
};
assert.equal(canAccessWorkforceResource(context, crossOrganizationResource, 'workforce:member:view'), false);

const crossTenantResource = {
  organization_id: 'org-1',
  tenant_id: 'tenant-2',
};
assert.equal(canAccessWorkforceResource(context, crossTenantResource, 'workforce:member:view'), false);

const assignment = {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  resource_id: 'resource-1',
};

assert.equal(canAccessWorkforceAssignment(context, assignment, 'workforce:assignment:view'), true);

const crossResourceAssignment = {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  resource_id: 'resource-2',
};
assert.equal(canAccessWorkforceAssignment(context, crossResourceAssignment, 'workforce:assignment:view'), false);

const appointment = {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  provider_id: 'provider-1',
};

assert.equal(canAccessProviderAppointment(context, appointment, 'workforce:member:view'), true);

const crossProviderAppointment = {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  provider_id: 'provider-2',
};
assert.equal(canAccessProviderAppointment(context, crossProviderAppointment, 'workforce:member:view'), false);

const decision = workforceAuthorizationDecision(context, resource, 'workforce:member:view');
assert.equal(decision.allowed, true);
assert.equal(decision.organization_match, true);
assert.equal(decision.tenant_match, true);
assert.equal(decision.permission_granted, true);

const deniedDecision = workforceAuthorizationDecision(context, crossTenantResource, 'workforce:member:view');
assert.equal(deniedDecision.allowed, false);
assert.equal(deniedDecision.organization_match, true);
assert.equal(deniedDecision.tenant_match, false);
assert.equal(deniedDecision.permission_granted, true);

console.log('Workforce authorization and tenant isolation regression: PASS');

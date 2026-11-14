import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { authorize, AUTHZ } from '../backend/lib/authorization.js';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-service-provider-scope-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('service-scope-owner-' + suffix, 'Service Owner');
  const tenant = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Service Scope Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const db = store.getDatabaseForTests();
  const organizationId = db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(tenant.chatId)?.organization_id;
  assert.ok(organizationId);

  const now = new Date().toISOString();
  db.prepare(`INSERT INTO pack_lifecycle
    (id,organization_id,pack_id,pack_version,state,installed_at,activated_at,created_at,updated_at,version)
    VALUES (?,?,'service','1.0','ACTIVE',?,?,?,?,1)
    ON CONFLICT(organization_id,pack_id) DO UPDATE SET state='ACTIVE', updated_at=excluded.updated_at, version=pack_lifecycle.version+1`)
    .run('service-pack-' + suffix, organizationId, now, now, now, now);
  db.prepare(`INSERT INTO pack_lifecycle
    (id,organization_id,pack_id,pack_version,state,installed_at,activated_at,created_at,updated_at,version)
    VALUES (?,?,'logistics','1.0','ACTIVE',?,?,?,?,1)
    ON CONFLICT(organization_id,pack_id) DO UPDATE SET state='ACTIVE', updated_at=excluded.updated_at, version=pack_lifecycle.version+1`)
    .run('logistics-pack-' + suffix, organizationId, now, now, now, now);

  const created = await store.createServiceResource(tenant.chatId, {
    resource_type: 'PROVIDER', name: 'Provider One',
    idempotency_key: 'service-provider-resource-' + suffix,
  }, { userId: owner.id });
  const resource = created.resource;

  const provider = await store.getOrCreateUserByTelegram('service-scope-provider-' + suffix, 'Provider One');
  const membership = await store.ensureMembership(provider.id, tenant.chatId, 'staff');
  const assigned = await store.assignMembershipContextualRole({
    actorUserId: owner.id, chatId: tenant.chatId, membershipId: membership.id,
    role: 'service_provider', scopeType: 'RESOURCE', scopeId: resource.id,
  });
  assert.equal(assigned.changed, true);
  assert.equal(assigned.scopeType, 'RESOURCE');
  assert.equal(assigned.scopeId, resource.id);

  await assert.rejects(store.assignMembershipContextualRole({
    actorUserId: owner.id, chatId: tenant.chatId, membershipId: membership.id,
    role: 'service_provider', scopeType: 'ORGANIZATION',
  }), error => error?.code === 'SERVICE_PROVIDER_RESOURCE_SCOPE_REQUIRED');

  await assert.rejects(store.assignMembershipContextualRole({
    actorUserId: owner.id, chatId: tenant.chatId, membershipId: membership.id,
    role: 'logistics_courier', scopeType: 'RESOURCE', scopeId: resource.id,
  }), error => error?.code === 'RESOURCE_ROLE_SCOPE_UNSUPPORTED');

  const cashier = await store.getOrCreateUserByTelegram('service-scope-cashier-' + suffix, 'Cashier');
  const cashierMembership = await store.ensureMembership(cashier.id, tenant.chatId, 'cashier');
  await assert.rejects(store.assignMembershipContextualRole({
    actorUserId: owner.id, chatId: tenant.chatId, membershipId: cashierMembership.id,
    role: 'service_provider', scopeType: 'RESOURCE', scopeId: resource.id,
  }), error => error?.code === 'SERVICE_PROVIDER_MEMBERSHIP_ROLE_INVALID');

  const foreignOwner = await store.getOrCreateUserByTelegram('service-scope-foreign-' + suffix, 'Foreign Owner');
  const foreignTenant = await store.createTenantForUser({
    userId: foreignOwner.id, sellerName: 'Foreign Service Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const foreignResource = await store.createServiceResource(foreignTenant.chatId, {
    resource_type: 'PROVIDER', name: 'Foreign Provider',
    idempotency_key: 'foreign-service-resource-' + suffix,
  }, { userId: foreignOwner.id });
  await assert.rejects(store.assignMembershipContextualRole({
    actorUserId: owner.id, chatId: tenant.chatId, membershipId: membership.id,
    role: 'service_provider', scopeType: 'RESOURCE', scopeId: foreignResource.resource.id,
  }), error => error?.code === 'SERVICE_PROVIDER_RESOURCE_SCOPE_DENIED');

  const inactiveResource = await store.createServiceResource(tenant.chatId, {
    resource_type: 'PROVIDER', name: 'Inactive Provider Resource',
    idempotency_key: 'inactive-service-resource-' + suffix,
  }, { userId: owner.id });
  await store.updateServiceResource(tenant.chatId, inactiveResource.resource.id, {
    status: 'INACTIVE', expected_version: inactiveResource.resource.version,
    idempotency_key: 'deactivate-service-resource-' + suffix,
  }, { userId: owner.id });
  await assert.rejects(store.assignMembershipContextualRole({
    actorUserId: owner.id, chatId: tenant.chatId, membershipId: membership.id,
    role: 'service_provider', scopeType: 'RESOURCE', scopeId: inactiveResource.resource.id,
  }), error => error?.code === 'SERVICE_PROVIDER_RESOURCE_SCOPE_DENIED');

  const session = await store.createSession({ userId: provider.id, chatId: tenant.chatId });
  const authenticated = await store.authenticateSessionToken(session.token);
  assert.ok(authenticated.contextualRoles.some(item =>
    item.role === 'service_provider' && item.scopeType === 'RESOURCE' && item.scopeId === resource.id));

  const location = resource.locationId ? await store.getOrganizationLocation(tenant.chatId, resource.locationId) : null;
  const resourceContext = {
    resourceType: 'service_resource', resourceId: resource.id,
    organizationId, locationId: resource.locationId,
  };
  const actor = {
    userId: provider.id, role: 'staff', organizationId,
    contextualRoles: authenticated.contextualRoles,
  };
  assert.equal(authorize(actor, organizationId, location, 'service_resource', 'service:service_resource:view', resourceContext), AUTHZ.ALLOW);
  assert.equal(authorize(actor, organizationId, location, 'service_resource', 'service:resource_availability:view', resourceContext), AUTHZ.ALLOW);
  assert.equal(authorize(actor, organizationId, location, 'service_resource', 'service:resource_availability:manage', resourceContext), AUTHZ.ALLOW);
  assert.equal(authorize(actor, organizationId, location, 'service_resource', 'service:service_resource:manage', resourceContext), AUTHZ.DENY);
  assert.equal(authorize(actor, organizationId, location, 'service_resource', 'service:resource_availability:view'), AUTHZ.DENY);
  assert.equal(authorize(actor, organizationId, location, 'service_resource', 'service:resource_availability:view', {
    ...resourceContext, resourceId: foreignResource.resource.id,
  }), AUTHZ.DENY);
  assert.equal(authorize(actor, organizationId, location, 'service_resource', 'service:resource_availability:view', {
    ...resourceContext, organizationId: 'foreign-org',
  }), AUTHZ.DENY);
  assert.equal(authorize(actor, organizationId, location, 'service_resource', 'logistics:scheduling:manage', resourceContext), AUTHZ.DENY);

  const managerActor = { userId: owner.id, role: 'owner', organizationId };
  assert.equal(authorize(managerActor, organizationId, null, 'service_resource', 'service:resource_availability:manage'), AUTHZ.ALLOW);

  await store.revokeMembershipContextualRole({
    actorUserId: owner.id, chatId: tenant.chatId, membershipId: membership.id,
    role: 'service_provider', scopeType: 'RESOURCE', scopeId: resource.id,
  });
  const revokedSession = await store.authenticateSessionToken(session.token);
  assert.equal(revokedSession.contextualRoles.some(item => item.role === 'service_provider'), false);

  // Reassign while the Service Pack is active, then verify deactivation gates
  // the role out of the authenticated session projection.
  await store.assignMembershipContextualRole({
    actorUserId: owner.id, chatId: tenant.chatId, membershipId: membership.id,
    role: 'service_provider', scopeType: 'RESOURCE', scopeId: resource.id,
  });
  assert.ok((await store.authenticateSessionToken(session.token)).contextualRoles.some(item => item.role === 'service_provider'));
  db.prepare("UPDATE pack_lifecycle SET state='DEACTIVATED', updated_at=?, version=version+1 WHERE organization_id=? AND pack_id='service'")
    .run(new Date().toISOString(), organizationId);
  const inactivePackSession = await store.authenticateSessionToken(session.token);
  assert.equal(inactivePackSession.contextualRoles.some(item => item.role === 'service_provider'), false);
  const newInactiveSession = await store.createSession({ userId: provider.id, chatId: tenant.chatId });
  assert.equal(newInactiveSession.contextualRoles.some(item => item.role === 'service_provider'), false);
  await assert.rejects(store.assignMembershipContextualRole({
    actorUserId: owner.id, chatId: tenant.chatId, membershipId: membership.id,
    role: 'service_provider', scopeType: 'RESOURCE', scopeId: resource.id,
  }), error => error?.statusCode === 409);


  const serverSource = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
  const uiSource = fs.readFileSync(new URL('../app/src/logistics/service-bookings.js', import.meta.url), 'utf8');
  assert.match(serverSource, /resourceContext: \{ resourceType: 'service_resource'/);
  assert.match(serverSource, /ASSIGNED_RESOURCES/);
  assert.match(uiSource, /serviceResourceManageProviders/);
  assert.match(uiSource, /service-resource-provider-assign/);
  assert.match(uiSource, /service-resource-provider-revoke/);
  assert.match(uiSource, /hasServiceProviderResourceScope/);
  assert.match(uiSource, /serviceResourceProviderDescription/);
  for (const locale of ['en','am','om','so','sw','es','hi','fr','ar','ha','yo','ru','pt']) {
    const source = fs.readFileSync(new URL('../app/src/i18n/locales/' + locale + '.js', import.meta.url), 'utf8');
    for (const key of ['serviceResourceManageProviders','serviceResourceSelectProvider','serviceResourceAssignProvider','serviceResourceProviderAssigned','serviceResourceRevokeProvider','serviceResourceProviderAssignFailed','serviceResourceNoProviderMembers','serviceResourceProviderDescription']) {
      const count = source.split(key + ':').length - 1;
      assert.equal(count, 1, locale + ' must define ' + key + ' exactly once');
    }
  }

  console.log('SC-03.3 Service Provider resource-scoped membership + UI regression: PASS');
  console.log('Exact resource/org/location authorization and tenant isolation: PASS');
  console.log('Service Pack activation and membership role constraints: PASS');
  console.log('Provider can manage only own availability; no Logistics authority: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

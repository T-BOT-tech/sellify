import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-service-resource-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('resource-owner-' + suffix, 'Resource Owner');
  const seller = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Resource Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(seller.chatId, [
    { id: 'consultation', name: 'Consultation', price: 25000, item_type: 'service' },
    { id: 'chair', name: 'Chair', price: 8000, item_type: 'product' },
  ]);
  const locations = await store.listOrganizationLocations(seller.chatId, { includeInactive: true });
  const location = locations.find(item => item.status === 'active');
  assert.ok(location, 'canonical default organization location must exist');

  const request = {
    resource_type: 'PROVIDER',
    name: 'Dr. Example',
    description: 'Consultation provider',
    service_item_id: 'consultation',
    location_id: location.id,
    idempotency_key: 'service-resource-create-' + suffix,
  };
  const created = await store.createServiceResource(seller.chatId, request, { userId: owner.id });
  assert.equal(created.replayed, false);
  assert.equal(created.resource.name, 'Dr. Example');
  assert.equal(created.resource.resourceType, 'PROVIDER');
  assert.equal(created.resource.serviceItemId, 'consultation');
  assert.equal(created.resource.locationId, location.id);
  assert.equal(created.resource.status, 'ACTIVE');
  assert.equal(created.resource.version, 1);

  const replay = await store.createServiceResource(seller.chatId, request, { userId: owner.id });
  assert.equal(replay.replayed, true);
  assert.equal(replay.resource.id, created.resource.id);
  await assert.rejects(
    store.createServiceResource(seller.chatId, {
      ...request, name: 'Different provider',
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_RESOURCE_IDEMPOTENCY_CONFLICT',
  );

  await assert.rejects(
    store.createServiceResource(seller.chatId, {
      ...request, service_item_id: 'chair', idempotency_key: 'service-resource-invalid-catalog-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_RESOURCE_CATALOG_BINDING_INVALID',
    'resource Catalog binding must reject physical product items',
  );

  const updated = await store.updateServiceResource(seller.chatId, created.resource.id, {
    name: 'Dr. Example Updated',
    status: 'INACTIVE',
    expected_version: 1,
    idempotency_key: 'service-resource-update-' + suffix,
  }, { userId: owner.id });
  assert.equal(updated.replayed, false);
  assert.equal(updated.resource.name, 'Dr. Example Updated');
  assert.equal(updated.resource.status, 'INACTIVE');
  assert.equal(updated.resource.version, 2);

  const updateReplay = await store.updateServiceResource(seller.chatId, created.resource.id, {
    name: 'Dr. Example Updated',
    status: 'INACTIVE',
    expected_version: 1,
    idempotency_key: 'service-resource-update-' + suffix,
  }, { userId: owner.id });
  assert.equal(updateReplay.replayed, true);
  assert.equal(updateReplay.resource.version, 2);

  const clearedLocation = await store.updateServiceResource(seller.chatId, created.resource.id, {
    location_id: null,
    expected_version: 2,
    idempotency_key: 'service-resource-clear-location-' + suffix,
  }, { userId: owner.id });
  assert.equal(clearedLocation.resource.locationId, null,
    'an explicit null location patch must clear the prior location binding');
  assert.equal(clearedLocation.resource.version, 3);

  await assert.rejects(
    store.updateServiceResource(seller.chatId, created.resource.id, {
      name: 'Stale update', expected_version: 1,
      idempotency_key: 'service-resource-stale-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_RESOURCE_VERSION_CONFLICT',
  );

  assert.equal((await store.listServiceResources(seller.chatId)).length, 0,
    'inactive resources are excluded from the default active list');
  const allResources = await store.listServiceResources(seller.chatId, { includeInactive: true });
  assert.equal(allResources.length, 1);
  assert.equal(allResources[0].id, created.resource.id);
  assert.equal(allResources[0].locationId, null);
  const locationScopedList = await store.listServiceResources(seller.chatId, {
    includeInactive: true, locationId: location.id,
  });
  assert.equal(locationScopedList.length, 1,
    'organization-wide resources remain visible in a location-scoped list');

  const secondUser = await store.getOrCreateUserByTelegram('resource-other-' + suffix, 'Other Owner');
  const secondSeller = await store.createTenantForUser({
    userId: secondUser.id, sellerName: 'Other Resource Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  assert.equal((await store.listServiceResources(secondSeller.chatId, { includeInactive: true })).length, 0);
  await assert.rejects(
    store.updateServiceResource(secondSeller.chatId, created.resource.id, {
      name: 'Cross tenant edit', expected_version: 2,
      idempotency_key: 'service-resource-cross-tenant-' + suffix,
    }, { userId: secondUser.id }),
    error => error?.code === 'SERVICE_RESOURCE_NOT_FOUND',
  );

  const db = store.getDatabaseForTests();
  const audit = db.prepare(
    "SELECT action, organization_id, chat_id FROM audit_events WHERE entity_type = 'service_resource' AND entity_id = ? ORDER BY id"
  ).all(created.resource.id);
  assert.deepEqual(audit.map(row => row.action), [
    'services.resource.created', 'services.resource.updated', 'services.resource.updated',
  ]);
  assert.ok(audit.every(row => row.organization_id === seller.organizationId && row.chat_id === seller.chatId));

  console.log('SC-03.1 Service Resource Persistence Regression: PASS');
  console.log('Catalog service-only binding and canonical location validation: PASS');
  console.log('Tenant isolation and resource ownership: PASS');
  console.log('Create/update idempotency replay and optimistic version conflict: PASS');
  console.log('Lifecycle and atomic audit evidence: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

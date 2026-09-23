import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'sellify-17-1-demand-'));
process.env.SELLIFY_DATA_DIR = tmp;
process.env.SELLIFY_DB_PATH = path.join(tmp, 'test.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const user = await store.getOrCreateUserByTelegram(`tg-${Date.now()}`, 'Demand Test');
const tenant = await store.createTenantForUser({ userId: user.id, sellerName: 'Demand Test', currency: 'ETB' });
const chatId = tenant.chatId;
const locations = await store.listOrganizationLocations(chatId);
const locationId = locations[0].id;
await store.saveCatalog(chatId, [{ id: 'cement', name: 'Cement', price: 12500, currency: 'ETB', stock: 100 }]);

const demand = await store.createProcurementDemand(chatId, {
  requestNumber: 'PR-TEST-001',
  currency: 'ETB',
  requiredBy: '2026-10-01T00:00:00.000Z',
  deliveryLocationId: locationId,
  notes: 'Procure construction materials',
  source: 'MANUAL',
  idempotencyKey: 'idem-001',
  items: [
    { productId: 'cement', quantity: 25, unit: 'bag', targetPriceMinor: 11000, specification: '42.5R' },
    { description: 'River sand', specification: 'Washed', quantity: 10, unit: 'm3' },
  ],
}, { userId: user.id });
assert.equal(demand.status, 'DRAFT');
assert.equal(demand.items.length, 2);
const cementItem = demand.items.find(item => item.productId === 'cement');
assert.equal(cementItem.description, 'Cement');
assert.equal(cementItem.targetPriceMinor, 11000);
assert.equal(demand.organizationId, (await store.getTenant(chatId)).organizationId);

const idem = await store.createProcurementDemand(chatId, {
  requestNumber: 'SHOULD-NOT-BE-USED',
  currency: 'ETB',
  idempotencyKey: 'idem-001',
  items: [{ productId: 'cement', quantity: 25, unit: 'bag', targetPriceMinor: 11000, specification: '42.5R' }, { description: 'River sand', specification: 'Washed', quantity: 10, unit: 'm3' }],
  deliveryLocationId: locationId,
  notes: 'Procure construction materials',
  source: 'MANUAL',
  requiredBy: '2026-10-01T00:00:00.000Z',
}, { userId: user.id });
assert.equal(idem.id, demand.id);

await assert.rejects(
  () => store.createProcurementDemand(chatId, { currency: 'ETB', idempotencyKey: 'idem-001', items: [{ productId: 'cement', quantity: 26, unit: 'bag' }] }, { userId: user.id }),
  error => error?.code === 'IDEMPOTENCY_KEY_REUSED' && error?.statusCode === 409,
);

const updated = await store.updateProcurementDemand(chatId, demand.id, { notes: 'Updated request', items: [{ productId: 'cement', quantity: 30, unit: 'bag' }] }, { userId: user.id });
assert.equal(updated.status, 'DRAFT');
assert.equal(updated.items[0].quantity, 30);
assert.equal(updated.version, 2);

const submitted = await store.transitionProcurementDemand(chatId, demand.id, 'SUBMITTED', { userId: user.id });
assert.equal(submitted.status, 'SUBMITTED');
assert.ok(submitted.submittedAt);

await assert.rejects(
  () => store.updateProcurementDemand(chatId, demand.id, { notes: 'must fail' }, { userId: user.id }),
  error => error?.code === 'DEMAND_NOT_EDITABLE' && error?.statusCode === 409,
);

const sourcing = await store.transitionProcurementDemand(chatId, demand.id, 'SOURCING', { userId: user.id });
assert.equal(sourcing.status, 'SOURCING');

await assert.rejects(
  () => store.transitionProcurementDemand(chatId, demand.id, 'DRAFT', { userId: user.id }),
  error => error?.code === 'INVALID_DEMAND_TRANSITION' && error?.statusCode === 409,
);

const listed = await store.listProcurementDemands(chatId, { status: 'SOURCING' });
assert.equal(listed.length, 1);
assert.equal(listed[0].id, demand.id);

const db = store.getDatabaseForTests();
const schema = db.prepare("SELECT version FROM schema_migrations WHERE version = 21").get();
assert.equal(schema.version, 21);
const auditRows = db.prepare("SELECT action, entity_id FROM audit_events WHERE entity_type = 'procurement_demand' ORDER BY id ASC").all();
assert.ok(auditRows.some(row => row.action === 'procurement.demand.created' && row.entity_id === demand.id));
assert.ok(auditRows.some(row => row.action === 'procurement.demand.submitted' && row.entity_id === demand.id));
assert.ok(auditRows.some(row => row.action === 'procurement.demand.sourcing_started' && row.entity_id === demand.id));

await rm(tmp, { recursive: true, force: true });
console.log('Phase 17.1 Procurement Demand Regression: PASS');

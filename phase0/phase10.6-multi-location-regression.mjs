import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(join(tmpdir(), 'sellify-phase10-6-'));
process.env.SELLIFY_DATA_DIR = dir;
const store = await import('../backend/lib/store-sqlite.js');

const user = await store.getOrCreateUserByTelegram('phase106-user', 'Phase 10.6');
const tenant = await store.createTenantForUser({
  userId: user.id, sellerName: 'Multi Location Test', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa'
});
await store.saveCatalog(tenant.chatId, [{ id: 'coffee', name: 'Coffee', price: 1000, stock: 10 }]);
const session = await store.createSession({ userId: user.id, chatId: tenant.chatId });

const locations = await store.listOrganizationLocations(tenant.chatId);
assert.ok(locations.length >= 1);
const main = locations[0];
const warehouse = await store.createOrganizationLocation(tenant.chatId, {
  code: 'WH1', name: 'Central Warehouse', type: 'WAREHOUSE', status: 'active'
});
assert.equal(warehouse.type, 'WAREHOUSE');

const received = await store.appendInventoryMovement(tenant.chatId, {
  eventId: 'phase106-receive-wh1', productId: 'coffee', quantity: 25,
  movementType: 'PURCHASE', referenceType: 'receipt', referenceId: 'GRN-1', locationId: warehouse.id
}, session);
assert.equal(received.locationId, warehouse.id);

const mainSale = await store.appendInventoryMovement(tenant.chatId, {
  eventId: 'phase106-sale-main', productId: 'coffee', quantity: -3,
  movementType: 'SALE', referenceType: 'order', referenceId: 'ORDER-1', locationId: main.id
}, session);
assert.equal(mainSale.locationId, main.id);

const whBalances = await store.getInventoryBalances(tenant.chatId, { locationId: warehouse.id });
const mainBalances = await store.getInventoryBalances(tenant.chatId, { locationId: main.id });
assert.equal(whBalances.find(x => x.productId === 'coffee').quantity, 25);
assert.equal(mainBalances.find(x => x.productId === 'coffee').quantity, 7);

const allBalances = await store.getInventoryBalances(tenant.chatId);
assert.equal(allBalances.filter(x => x.productId === 'coffee').length, 2);

const scopedMovements = await store.listInventoryMovements(tenant.chatId, { locationId: warehouse.id });
assert.ok(scopedMovements.every(x => x.locationId === warehouse.id));

const db = new DatabaseSync(join(dir, 'sellify.sqlite'));
const locationCount = db.prepare('SELECT COUNT(*) AS c FROM locations WHERE organization_id = ?').get(main.organizationId).c;
assert.equal(locationCount, 2);
db.close();
await rm(dir, { recursive: true, force: true });
console.log('Phase 10.6 Multi-Location Inventory Regression: PASS');

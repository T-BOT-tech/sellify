import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(join(tmpdir(), 'sellify-phase10-5-'));
process.env.SELLIFY_DATA_DIR = dir;
const store = await import('../backend/lib/store-sqlite.js');

const user = await store.getOrCreateUserByTelegram('phase105-user', 'Phase 10.5');
const tenant = await store.createTenantForUser({
  userId: user.id, sellerName: 'Ledger Test Store', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa'
});
await store.saveCatalog(tenant.chatId, [{ id: 'coffee', name: 'Coffee', price: 1000, stock: 10 }]);
const session = await store.createSession({ userId: user.id, chatId: tenant.chatId });

let movements = await store.listInventoryMovements(tenant.chatId);
assert.equal(movements.length, 1);
assert.equal(movements[0].movementType, 'OPENING_BALANCE');
assert.equal(movements[0].quantity, 10);

const sale = await store.appendInventoryMovement(tenant.chatId, {
  eventId: 'phase105-sale-1', productId: 'coffee', quantity: -3, movementType: 'SALE', referenceType: 'order', referenceId: 'order-1'
}, session);
assert.equal(sale.quantity, -3);
const duplicate = await store.appendInventoryMovement(tenant.chatId, {
  eventId: 'phase105-sale-1', productId: 'coffee', quantity: -99, movementType: 'LOSS'
}, session);
assert.equal(duplicate.id, sale.id);
let balances = await store.getInventoryBalances(tenant.chatId);
assert.equal(balances.find(x => x.productId === 'coffee').quantity, 7);

const db = new DatabaseSync(join(dir, 'sellify.sqlite'));
const cols = db.prepare("PRAGMA table_info(inventory_movements)").all().map(x => x.name);
assert.ok(cols.includes('event_id') && cols.includes('organization_id') && cols.includes('location_id'));
const unique = db.prepare("SELECT COUNT(*) AS c FROM inventory_movements WHERE event_id = 'phase105-sale-1'").get().c;
assert.equal(unique, 1);
db.close();
await rm(dir, { recursive: true, force: true });
console.log('Phase 10.5 Inventory Ledger Regression: PASS');

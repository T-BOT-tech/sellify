import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(join(tmpdir(), 'sellify-phase11-1-money-'));
process.env.SELLIFY_DATA_DIR = dir;
const store = await import('../backend/lib/store-sqlite.js');

const user = await store.getOrCreateUserByTelegram('phase111-money-user', 'Money Test');
const tenantResult = await store.createTenantForUser({
  userId: user.id,
  sellerName: 'Money Test',
  country: 'ET',
  currency: 'etb',
  timezone: 'Africa/Addis_Ababa',
});
const chatId = tenantResult.chatId;
const session = await store.createSession({ userId: user.id, chatId });
const tenant = await store.getTenant(chatId);
assert.equal(tenant.branding.currency, 'ETB');

await store.saveCatalog(chatId, [
  { id: 'money-1', name: 'Coffee', price: 250, stock: 10, marketplace_listed: true },
]);
const catalog = await store.getCatalog(chatId);
assert.equal(catalog.products[0].currency, 'ETB');

const db = new (await import('node:sqlite')).DatabaseSync(store.getDatabasePath());
assert.equal(db.prepare('SELECT version FROM schema_migrations WHERE version = 12').get().version, 12);
assert.equal(db.prepare('SELECT currency FROM catalog_products WHERE chat_id = ? AND product_id = ?').get(chatId, 'money-1').currency, 'ETB');

autoCheck: {
  const result = await store.saveQueuedOrders(chatId, [{ id: 'money-order-1', currency: 'ETB', items: [{ id: 'money-1', qty: 2, price: 250, currency: 'ETB' }], total: 1 }]);
  assert.equal(result[0].status, 'synced');
  const row = db.prepare('SELECT total_minor, currency FROM orders WHERE chat_id = ? AND local_id = ?').get(chatId, 'money-order-1');
  assert.equal(row.total_minor, 500);
  assert.equal(row.currency, 'ETB');
}

const mismatch = await store.saveQueuedOrders(chatId, [{ id: 'money-order-bad', currency: 'USD', items: [{ id: 'money-1', qty: 1, price: 250, currency: 'USD' }], total: 250 }]);
assert.equal(mismatch[0].status, 'rejected');
assert.match(mismatch[0].error, /currency/i);

await assert.rejects(
  () => store.updateTenant(chatId, { branding: { ...tenant.branding, currency: 'USD' } }),
  error => error?.code === 'CURRENCY_LOCKED' && error?.statusCode === 409,
);

const otherUser = await store.getOrCreateUserByTelegram('phase111-money-user-2', 'Money Test 2');
const otherTenant = await store.createTenantForUser({ userId: otherUser.id, sellerName: 'USD Shop', country: 'US', currency: 'USD' });
await store.saveCatalog(otherTenant.chatId, [{ id: 'usd-1', name: 'USD Item', price: 100, stock: 5, marketplace_listed: true }]);
await assert.rejects(
  () => store.createMarketplaceOrder({ buyer_id: 'buyer', customer_name: 'Buyer', customer_phone: '', items: [
    { seller_id: chatId, item_id: 'money-1', qty: 1 },
    { seller_id: otherTenant.chatId, item_id: 'usd-1', qty: 1 },
  ] }),
  error => error?.statusCode === 409 && /one currency/i.test(error.message),
);

db.close();
console.log('Phase 11.1 Money Contract Regression: PASS');
await rm(dir, { recursive: true, force: true });

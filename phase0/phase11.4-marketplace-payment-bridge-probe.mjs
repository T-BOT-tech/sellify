
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dir = await mkdtemp(path.join(tmpdir(), 'sellify-phase11-4-probe-'));
process.env.SELLIFY_DATA_DIR = dir;
const store = await import('../backend/lib/store-sqlite.js');

try {
  const user = await store.getOrCreateUserByTelegram('phase114-probe-user', 'Phase 11.4 Probe');
  const tenant = await store.createTenantForUser({
    userId: user.id, sellerName: 'Probe Seller', country: 'ET',
    currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(tenant.chatId, [{
    id: 'probe-item', name: 'Probe Item', price: 1000, stock: 2, marketplace_listed: true,
  }]);

  const order = await store.createMarketplaceOrder({
    buyer_id: 'probe-buyer',
    items: [{ seller_id: tenant.chatId, item_id: 'probe-item', qty: 1 }],
    idempotency_key: 'probe-checkout',
  });

  const db = new DatabaseSync(path.join(dir, 'sellify.sqlite'));
  const seller = db.prepare(`
    SELECT id, seller_order_id FROM marketplace_seller_orders
    WHERE marketplace_order_id = ?
  `).get(order.marketplace_order_id);
  const legacy = db.prepare(`
    SELECT server_order_id FROM orders
    WHERE marketplace_order_id = ? LIMIT 1
  `).get(order.marketplace_order_id);

  const p1 = await store.createPayment(tenant.chatId, {
    orderId: legacy.server_order_id, amountMinor: 400, currency: 'ETB',
    state: 'RECEIVED', providerId: 'manual', channel: 'manual',
  });
  await store.transitionPayment(tenant.chatId, p1.id, 'VERIFIED');

  const p2 = await store.createPayment(tenant.chatId, {
    orderId: legacy.server_order_id, amountMinor: 600, currency: 'ETB',
    state: 'RECEIVED', providerId: 'manual', channel: 'manual',
  });
  await store.transitionPayment(tenant.chatId, p2.id, 'VERIFIED');

  const allocationCount = db.prepare(`
    SELECT COUNT(*) AS c FROM marketplace_payment_allocations
    WHERE seller_order_id = ? AND payment_id IS NOT NULL
  `).get(seller.id).c;
  const settlement = db.prepare(`
    SELECT status FROM marketplace_settlements WHERE seller_order_id = ?
  `).get(seller.id).status;

  if (Number(allocationCount) !== 2) throw new Error(`expected 2 payment allocations, got ${allocationCount}`);
  if (settlement !== 'READY') throw new Error(`expected READY settlement, got ${settlement}`);

  console.log('Phase 11.4 Marketplace Payment Bridge Probe: PASS');
  db.close();
} finally {
  await rm(dir, { recursive: true, force: true });
}

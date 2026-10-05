import assert from 'node:assert/strict';
import { getDatabaseForTests, getOrCreateUserByTelegram, createTenantForUser, getTelegramStorefrontConfig, upsertTelegramStorefrontConfig } from '../backend/lib/store-sqlite.js';

const db = getDatabaseForTests();
const x = Date.now().toString(36);
const user = await getOrCreateUserByTelegram(`tg1_${x}`, 'TG1 Seller');
const tenant = await createTenantForUser({ userId: user.id, sellerName: `TG1 ${x}`, businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
const row = db.prepare('SELECT chat_id, organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId);
const actor = { userId: user.id, role: 'owner', organizationId: row.organization_id, chatId: row.chat_id };

assert.equal(getTelegramStorefrontConfig(row.chat_id), null);
const created = await upsertTelegramStorefrontConfig(row.chat_id, {
  botId: '123456', botUsername: 'tg1_demo_bot', credentialRef: 'secret://telegram/tg1-demo',
  status: 'CONFIGURED', webappUrl: 'https://example.invalid/tg1',
  enabledCapabilities: ['browse', 'search', 'product', 'cart', 'checkout', 'order_status']
}, actor);
assert.equal(created.channelType, 'telegram');
assert.equal(created.status, 'CONFIGURED');
assert.equal(created.botUsername, 'tg1_demo_bot');
assert.equal(created.credentialRef, 'secret://telegram/tg1-demo');
assert.equal(created.enabledCapabilities.includes('checkout'), true);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM telegram_storefront_configs WHERE organization_id=?').get(row.organization_id).n, 1);
assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'telegram%'`).get().n, 1);

// Verification must be invalidated when an identity-bearing field changes.
db.prepare("UPDATE telegram_storefront_configs SET status='VERIFIED' WHERE organization_id=?").run(row.organization_id);
const changed = await upsertTelegramStorefrontConfig(row.chatId, {
  credentialRef: 'secret://telegram/tg1-replacement'
}, actor);
assert.equal(changed.status, 'CONFIGURED');
assert.equal(changed.credentialRef, 'secret://telegram/tg1-replacement');

db.prepare("UPDATE telegram_storefront_configs SET status='PUBLISHED' WHERE organization_id=?").run(row.organization_id);
const botChanged = await upsertTelegramStorefrontConfig(row.chatId, {
  botUsername: 'tg1_replacement_bot'
}, actor);
assert.equal(botChanged.status, 'CONFIGURED');

console.log('TG-1 Telegram seller-owned storefront regression: PASS');

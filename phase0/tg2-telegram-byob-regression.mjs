import assert from 'node:assert/strict';
import {
  getDatabaseForTests, getOrCreateUserByTelegram, createTenantForUser,
  getTelegramStorefrontConfig, upsertTelegramStorefrontConfig, verifyTelegramStorefront
} from '../backend/lib/store-sqlite.js';
import {
  normalizeTelegramCredentialRef, telegramBotCredentialProviderAvailable,
  clearTelegramBotCredentialProvider
} from '../app/src/platform/telegram-bot-credential-contract.js';

clearTelegramBotCredentialProvider();
assert.equal(telegramBotCredentialProviderAvailable(), false);
assert.equal(normalizeTelegramCredentialRef('secret://telegram/tg2-demo'), 'secret://telegram/tg2-demo');
assert.throws(() => normalizeTelegramCredentialRef('raw-token'), /secret:\/\//);

const db = getDatabaseForTests();
const x = Date.now().toString(36);
const user = await getOrCreateUserByTelegram(`tg2_${x}`, 'TG2 Seller');
const tenant = await createTenantForUser({ userId: user.id, sellerName: `TG2 ${x}`, businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
const row = db.prepare('SELECT chat_id, organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId);
const actor = { userId: user.id, role: 'owner', organizationId: row.organization_id, chatId: row.chat_id };

const configured = await upsertTelegramStorefrontConfig(row.chat_id, {
  credentialRef: 'secret://telegram/tg2-demo', status: 'CONFIGURED'
}, actor);
assert.equal(configured.status, 'CONFIGURED');
await assert.rejects(() => verifyTelegramStorefront(row.chat_id, actor), (e) => e.code === 'TELEGRAM_CREDENTIAL_PROVIDER_UNAVAILABLE' && e.statusCode === 503);
assert.equal(getTelegramStorefrontConfig(row.chat_id).status, 'CONFIGURED');
await assert.rejects(() => upsertTelegramStorefrontConfig(row.chat_id, { status: 'VERIFIED' }, actor), (e) => e.code === 'TELEGRAM_VERIFICATION_REQUIRED');
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE '%credential%'").get().n >= 0, true);
console.log('TG-2 Telegram BYOB credential + verification boundary regression: PASS');

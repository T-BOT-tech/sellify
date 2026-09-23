import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyTelegramBuyerInitDataWithSecret, normalizeTelegramBuyerInitData, TELEGRAM_BUYER_IDENTITY_CONSTITUTION } from '../app/src/platform/telegram-buyer-identity-contract.js';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

assert.equal(TELEGRAM_BUYER_IDENTITY_CONSTITUTION.rawTokenPersistence, false);
assert.equal(TELEGRAM_BUYER_IDENTITY_CONSTITUTION.sessionPersistence, false);
assert.equal(TELEGRAM_BUYER_IDENTITY_CONSTITUTION.tenantIsolation, true);
assert.throws(() => normalizeTelegramBuyerInitData(''), /required/);

const botToken = '123456:TG5_TEST_SECRET';
const authDate = Math.floor(Date.now() / 1000);
const user = { id: 987654321, first_name: 'TG5', last_name: 'Buyer', username: 'tg5buyer', language_code: 'en' };
const base = new URLSearchParams({ auth_date: String(authDate), query_id: 'AA_TG5', user: JSON.stringify(user) });
const dataCheckString = [...base.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
base.set('hash', hash);
const verified = verifyTelegramBuyerInitDataWithSecret(base.toString(), botToken, 86400);
assert.equal(verified.telegramUserId, String(user.id));
assert.equal(verified.user.username, user.username);
assert.equal(verified.queryId, 'AA_TG5');
assert.throws(() => verifyTelegramBuyerInitDataWithSecret(base.toString().replace(/hash=[^&]+/, 'hash=bad'), botToken, 86400), /signature/);

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-tg5-'));
const port = 19800 + Math.floor(Math.random() * 500);
process.env.SELLIFY_DATA_DIR = dataDir; process.env.SELLIFY_BACKUP_DIR = path.join(dataDir, 'backups');
const env = { ...process.env, PORT: String(port), NODE_ENV: 'test', CORS_ALLOWED_ORIGINS: 'http://localhost:3000' };
const child = spawn(process.execPath, [path.join(root, 'backend/server.js')], { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] });
const request = async (url, options={}) => { const r = await fetch(`http://127.0.0.1:${port}${url}`, options); const j = await r.json().catch(() => ({})); return { r, j }; };
try {
  for (let i=0;i<80;i++){ try { if((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch {} await sleep(50); }
  const store = await import('../backend/lib/store-sqlite.js');
  const x = Date.now().toString(36);
  const seller = await store.getOrCreateUserByTelegram(`tg5_seller_${x}`, 'TG5 Seller');
  const tenant = await store.createTenantForUser({ userId: seller.id, sellerName: `TG5 ${x}`, businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
  const db = store.getDatabaseForTests();
  const org = db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId).organization_id;
  const actor = { userId: seller.id, role: 'owner', organizationId: org, chatId: tenant.chatId };
  await store.upsertTelegramStorefrontConfig(tenant.chatId, { botId: '123', botUsername: 'tg5_bot', credentialRef: 'secret://tg5/test', status: 'CONFIGURED', webappUrl: 'https://example.invalid/tg5' }, actor);
  db.prepare("UPDATE telegram_storefront_configs SET status='PUBLISHED' WHERE organization_id=?").run(org);
  const blocked = await request(`/api/telegram-storefront/${encodeURIComponent(tenant.chatId)}/buyer-session`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ initData: base.toString() }) });
  assert.equal(blocked.r.status, 503);
  assert.equal(blocked.j.error?.status, 503);
  const noScope = await request('/api/marketplace/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ telegram_storefront_chat_id: tenant.chatId, items: [] }) });
  assert.equal(noScope.r.status, 400);
  console.log('TG-5 Telegram buyer identity/session regression: PASS');
} finally { child.kill('SIGTERM'); }

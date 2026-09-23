import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-tg4-'));
const port = 19100 + Math.floor(Math.random() * 700);
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_BACKUP_DIR = path.join(dataDir, 'backups');
const env = { ...process.env, PORT: String(port), NODE_ENV: 'test', CORS_ALLOWED_ORIGINS: 'http://localhost:3000' };
const child = spawn(process.execPath, [path.join(root, 'backend/server.js')], { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] });
const request = async (url) => { const r = await fetch(`http://127.0.0.1:${port}${url}`); const j = await r.json().catch(() => ({})); return { r, j }; };
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch {} await sleep(50); }
  const store = await import('../backend/lib/store-sqlite.js');
  const x = Date.now().toString(36);
  const user = await store.getOrCreateUserByTelegram(`tg4_${x}`, 'TG4 Buyer Seller');
  const tenant = await store.createTenantForUser({ userId: user.id, sellerName: `TG4 ${x}`, businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
  const db0 = store.getDatabaseForTests();
  const identity = db0.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId);
  const organizationId = identity.organization_id;
  const actor = { userId: user.id, role: 'owner', organizationId, chatId: tenant.chatId };
  await store.upsertTelegramStorefrontConfig(tenant.chatId, { credentialRef: 'secret://tg4/test', status: 'CONFIGURED', webappUrl: 'https://example.invalid/tg4', enabledCapabilities: ['browse','search','product','cart','checkout','order_status'] }, actor);
  const db = store.getDatabaseForTests();
  db.prepare("UPDATE telegram_storefront_configs SET status='PUBLISHED' WHERE organization_id=?").run(organizationId);
  const publicResult = await request(`/api/telegram-storefront/${encodeURIComponent(tenant.chatId)}`);
  assert.equal(publicResult.r.status, 200);
  assert.equal(publicResult.j.storefront.status, 'PUBLISHED');
  assert.equal(publicResult.j.storefront.channelType, 'telegram');
  assert.deepEqual(publicResult.j.storefront.enabledCapabilities, ['browse','search','product','cart','checkout','order_status']);
  assert.equal(Object.hasOwn(publicResult.j.storefront, 'credentialRef'), false);
  const hidden = await request(`/api/telegram-storefront/${encodeURIComponent(tenant.chatId)}-missing`);
  assert.equal(hidden.r.status, 404);
  console.log('TG-4 Telegram buyer storefront regression: PASS');
} finally { child.kill('SIGTERM'); }

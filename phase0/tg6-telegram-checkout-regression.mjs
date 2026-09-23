import assert from 'node:assert/strict';
import { normalizeTelegramCheckoutContext, buildTelegramPaymentBoundary, TELEGRAM_CHECKOUT_CONSTITUTION } from '../app/src/platform/telegram-checkout-contract.js';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

assert.equal(TELEGRAM_CHECKOUT_CONSTITUTION.telegramPaymentLedger, false);
assert.equal(TELEGRAM_CHECKOUT_CONSTITUTION.telegramPaymentExecution, false);
assert.equal(TELEGRAM_CHECKOUT_CONSTITUTION.orderAuthority, 'existing_commerce_marketplace');
const ctx = normalizeTelegramCheckoutContext({ enabledCapabilities: ['checkout','order_status'], metadata: { payment: { mode: 'payment_core' } } });
assert.equal(ctx.checkoutEnabled, true);
assert.equal(ctx.payment.authority, 'existing_payment_core');
assert.equal(ctx.payment.executionInTelegram, false);
const boundary = buildTelegramPaymentBoundary({ order: { marketplace_order_id: 'o1' } });
assert.equal(boundary.state, 'PENDING_SELLER_HANDLING');
assert.equal(boundary.telegramExecutesPayment, false);

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-tg6-'));
const port = 20300 + Math.floor(Math.random() * 300);
process.env.SELLIFY_DATA_DIR=dataDir; process.env.SELLIFY_BACKUP_DIR=path.join(dataDir,'backups');
const env = { ...process.env, PORT: String(port), NODE_ENV: 'test', CORS_ALLOWED_ORIGINS: 'http://localhost:3000', SELLIFY_DATA_DIR: dataDir, SELLIFY_BACKUP_DIR: path.join(dataDir, 'backups') };
const child = spawn(process.execPath, [path.join(root, 'backend/server.js')], { cwd: root, env, stdio: ['ignore','ignore','pipe'] });
try {
  let ready=false; for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok){ready=true;break}}catch{} await sleep(50)}
  assert.equal(ready,true);
  const store = await import('../backend/lib/store-sqlite.js');
  const x=Date.now().toString(36);
  const seller=await store.getOrCreateUserByTelegram(`tg6_seller_${x}`,'TG6 Seller');
  const tenant=await store.createTenantForUser({userId:seller.id,sellerName:`TG6 ${x}`,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});
  const db=store.getDatabaseForTests();
  const org=db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId).organization_id;
  const actor={userId:seller.id,role:'owner',organizationId:org,chatId:tenant.chatId};
  await store.upsertTelegramStorefrontConfig(tenant.chatId,{botId:'123',botUsername:'tg6_bot',credentialRef:'secret://tg6/test',status:'CONFIGURED',webappUrl:'https://example.invalid/tg6',enabledCapabilities:['browse','checkout','order_status'],metadata:{payment:{mode:'payment_core'}}},actor);
  db.prepare("UPDATE telegram_storefront_configs SET status='PUBLISHED' WHERE organization_id=?").run(org);
  const pub=await fetch(`http://127.0.0.1:${port}/api/telegram-storefront/${encodeURIComponent(tenant.chatId)}`); const pj=await pub.json();
  assert.equal(pub.status,200); assert.equal(pj.storefront.checkout.checkoutEnabled,true); assert.equal(pj.storefront.checkout.payment.authority,'existing_payment_core');
  await store.upsertTelegramStorefrontConfig(tenant.chatId,{enabledCapabilities:['browse','order_status'],status:'CONFIGURED'},actor);
  db.prepare("UPDATE telegram_storefront_configs SET status='PUBLISHED' WHERE organization_id=?").run(org);
  const blocked=await fetch('http://127.0.0.1:'+port+'/api/marketplace/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telegram_storefront_chat_id:tenant.chatId,telegram_init_data:'x',items:[{seller_id:tenant.chatId,item_id:'p1',qty:1}]})});
  const bj=await blocked.json(); assert.equal(blocked.status,403); assert.match(String(bj.error?.message || ''),/checkout capability is disabled/i);
  console.log('TG-6 Telegram checkout/payment boundary regression: PASS');
} finally { child.kill('SIGTERM'); }

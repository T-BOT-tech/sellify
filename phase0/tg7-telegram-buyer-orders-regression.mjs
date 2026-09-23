import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-tg7-'));
const port = 20600 + Math.floor(Math.random() * 200);
const env = { ...process.env, PORT: String(port), NODE_ENV: 'test', CORS_ALLOWED_ORIGINS: 'http://localhost:3000', SELLIFY_DATA_DIR: dataDir, SELLIFY_BACKUP_DIR: path.join(dataDir,'backups') };
const child = spawn(process.execPath, [path.join(root, 'backend/server.js')], { cwd: root, env, stdio: ['ignore','ignore','pipe'] });
try {
  let ready=false; for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok){ready=true;break}}catch{} await sleep(50)}
  assert.equal(ready,true);
  const store = await import('../backend/lib/store-sqlite.js');
  const x=Date.now().toString(36);
  const seller=await store.getOrCreateUserByTelegram(`tg7_seller_${x}`,'TG7 Seller');
  const tenant=await store.createTenantForUser({userId:seller.id,sellerName:`TG7 ${x}`,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});
  const db=store.getDatabaseForTests();
  const org=db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId).organization_id;
  const other=await store.getOrCreateUserByTelegram(`tg7_other_${x}`,'Other Seller');
  const otherTenant=await store.createTenantForUser({userId:other.id,sellerName:`Other ${x}`,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});
  const now=new Date().toISOString();
  const insertOrder=db.prepare('INSERT INTO marketplace_orders (id,buyer_identity,customer_name,customer_phone,currency,total_minor,status,tracking_token_hash,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  const insertSeller=db.prepare('INSERT INTO marketplace_seller_orders (id,marketplace_order_id,seller_id,seller_order_id,organization_id,currency,subtotal_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
  insertOrder.run(`tg7-order-1-${x}`,'telegram-user-7','Buyer','','ETB',12500,'confirmed','hash1',null,now,now);
  insertSeller.run(`tg7-so-1-${x}`,`tg7-order-1-${x}`,tenant.chatId,`SO-TG7-1-${x}`,org,'ETB',12500,'confirmed',now,now);
  insertOrder.run(`tg7-order-2-${x}`,'telegram-user-7','Buyer','','ETB',9000,'queued','hash2',null,now,now);
  insertSeller.run(`tg7-so-2-${x}`,`tg7-order-2-${x}`,otherTenant.chatId,`SO-TG7-2-${x}`,db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(otherTenant.chatId).organization_id,'ETB',9000,'queued',now,now);
  const orders=await store.listTelegramBuyerOrders(tenant.chatId,'telegram-user-7',20);
  assert.equal(orders.length,1);
  assert.equal(orders[0].marketplace_order_id,`tg7-order-1-${x}`);
  assert.equal(orders[0].sellers[0].seller_order_id,`SO-TG7-1-${x}`);
  const empty=await store.listTelegramBuyerOrders(tenant.chatId,'telegram-user-missing',20);
  assert.deepEqual(empty,[]);
  console.log('TG-7 Telegram buyer order history/self-service regression: PASS');
} finally { child.kill('SIGTERM'); }

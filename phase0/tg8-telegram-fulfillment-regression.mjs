import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const dataDir=await mkdtemp(path.join(tmpdir(),'sellify-tg8-')); const port=20800+Math.floor(Math.random()*100);
const env={...process.env,PORT:String(port),NODE_ENV:'test',CORS_ALLOWED_ORIGINS:'http://localhost:3000',SELLIFY_DATA_DIR:dataDir,SELLIFY_BACKUP_DIR:path.join(dataDir,'backups')};
const child=spawn(process.execPath,[path.join(root,'backend/server.js')],{cwd:root,env,stdio:['ignore','ignore','pipe']});
try { let ready=false; for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok){ready=true;break}}catch{} await sleep(50)} assert.equal(ready,true);
const store=await import('../backend/lib/store-sqlite.js'); const x=Date.now().toString(36); const seller=await store.getOrCreateUserByTelegram(`tg8_seller_${x}`,'TG8 Seller'); const tenant=await store.createTenantForUser({userId:seller.id,sellerName:`TG8 ${x}`,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'}); const db=store.getDatabaseForTests(); const org=db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId).organization_id;
const mo=`tg8-order-${x}`; const so=`tg8-so-${x}`; const now=new Date().toISOString(); db.prepare("INSERT INTO marketplace_orders (id,buyer_identity,customer_name,currency,total_minor,status,tracking_token_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(mo,'telegram-user-8','Buyer','ETB',5000,'confirmed','hash-tg8',now,now); db.prepare("INSERT INTO marketplace_seller_orders (id,marketplace_order_id,seller_id,seller_order_id,organization_id,currency,subtotal_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(so,mo,tenant.chatId,`SO-TG8-${x}`,org,'ETB',5000,'confirmed',now,now); db.prepare("INSERT INTO marketplace_fulfillments (id,seller_order_id,status,fulfillment_type,tracking_reference,proof_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(`f1-${x}`,so,'delivered','delivery',`TRK-TG8-${x}`,JSON.stringify({type:'photo',ref:`proof://tg8-${x}`}),now,now);
// Seed a canonical commerce order and Logistics fulfillment alongside the legacy marketplace projection.
const serverOrderId=`canonical-tg8-${x}`; const sellerOrderId=`SO-TG8-${x}`;
db.prepare("INSERT INTO orders (chat_id,local_id,server_order_id,order_json,total_minor,created_at,status,delivered_to_device,marketplace_order_id,is_marketplace) VALUES (?,?,?,?,?,?,?,?,?,1)")
 .run(tenant.chatId,sellerOrderId,serverOrderId,JSON.stringify({id:sellerOrderId,marketplace_order_id:mo,is_marketplace:true,status:'confirmed',total:5000,currency:'ETB',created_at:Date.now()}),5000,Date.now(),'confirmed',1,mo);
db.prepare("UPDATE marketplace_seller_orders SET seller_order_id=? WHERE id=?").run(sellerOrderId,so);
db.prepare("INSERT INTO fulfillments (id,server_order_id,organization_id,location_id,fulfillment_type,status,tracking_reference,proof_json,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,1)")
 .run(`canonical-f1-${x}`,serverOrderId,org,null,'delivery','out_for_delivery',`TRK-CANONICAL-TG8-${x}`,JSON.stringify({type:'photo',ref:`proof://canonical-tg8-${x}`}),now,now);
const out=await store.getTelegramBuyerFulfillmentExperience(tenant.chatId,'telegram-user-8',mo);
assert.equal(out.fulfillments[0].status,'out_for_delivery','Telegram tracking must prefer canonical Logistics over stale legacy delivered status');
assert.equal(out.fulfillments[0].trackingReference,`TRK-CANONICAL-TG8-${x}`);
assert.equal(out.fulfillments[0].proof.ref,`proof://canonical-tg8-${x}`);
assert.equal(out.authority.fulfillment,'canonical_logistics_with_legacy_marketplace_fallback');
assert.equal(out.returns.supported,false);
await assert.rejects(()=>store.getTelegramBuyerFulfillmentExperience(tenant.chatId,'other',mo),/Order not found/);
console.log('TG-8 Telegram fulfillment/tracking/proof/returns regression: PASS');
} finally {child.kill('SIGTERM')}

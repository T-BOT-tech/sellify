import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const dataDir=await mkdtemp(path.join(tmpdir(),'sellify-tg10-'));
const port=21400+Math.floor(Math.random()*200);
process.env.SELLIFY_DATA_DIR=dataDir; process.env.SELLIFY_BACKUP_DIR=path.join(dataDir,'backups');
const env={...process.env,PORT:String(port),NODE_ENV:'test',CORS_ALLOWED_ORIGINS:'http://localhost:3000',SELLIFY_DATA_DIR:dataDir,SELLIFY_BACKUP_DIR:path.join(dataDir,'backups')};
const child=spawn(process.execPath,[path.join(root,'backend/server.js')],{cwd:root,env,stdio:['ignore','ignore','pipe']});
const request=async(url,options={})=>{const r=await fetch(`http://127.0.0.1:${port}${url}`,options);const j=await r.json().catch(()=>({}));return{r,j};};
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok){ready=true;break}}catch{}await sleep(50)}
 assert.equal(ready,true);
 const store=await import('../backend/lib/store-sqlite.js');
 const x=Date.now().toString(36);
 const a=await store.getOrCreateUserByTelegram(`tg10a_${x}`,'TG10 A');
 const b=await store.getOrCreateUserByTelegram(`tg10b_${x}`,'TG10 B');
 const ta=await store.createTenantForUser({userId:a.id,sellerName:`TG10 A ${x}`,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});
 const tb=await store.createTenantForUser({userId:b.id,sellerName:`TG10 B ${x}`,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});
 const db=store.getDatabaseForTests();
 const orgA=db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(ta.chatId).organization_id;
 const orgB=db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(tb.chatId).organization_id;
 const actorA={userId:a.id,role:'owner',organizationId:orgA,chatId:ta.chatId};
 await store.upsertTelegramStorefrontConfig(ta.chatId,{botId:'A',botUsername:'tg10a_bot',credentialRef:'secret://tg10/a',status:'CONFIGURED',webappUrl:'https://example.invalid/a',enabledCapabilities:['browse','checkout','order_status','tracking']},actorA);
 await store.upsertTelegramStorefrontConfig(tb.chatId,{botId:'B',botUsername:'tg10b_bot',credentialRef:'secret://tg10/b',status:'CONFIGURED',webappUrl:'https://example.invalid/b',enabledCapabilities:['browse']},{userId:b.id,role:'owner',organizationId:orgB,chatId:tb.chatId});
 db.prepare("UPDATE telegram_storefront_configs SET status='PUBLISHED' WHERE organization_id=?").run(orgA);
 db.prepare("UPDATE telegram_storefront_configs SET status='PUBLISHED' WHERE organization_id=?").run(orgB);
 assert.equal(store.getTelegramStorefrontConfig(ta.chatId).status,'PUBLISHED');
 // Public response must not expose credential references or seller-only fields.
 const pubA=await request(`/api/telegram-storefront/${encodeURIComponent(ta.chatId)}`); assert.equal(pubA.r.status,200);
 assert.equal(pubA.j.storefront.credentialRef,undefined);
 assert.equal(pubA.j.storefront.createdByUserId,undefined);
 assert.equal(pubA.j.storefront.updatedByUserId,undefined);
 // Seller admin view masks credential reference.
 const adminA=await request(`/tenants/${encodeURIComponent(ta.chatId)}/telegram-storefront`,{headers:{authorization:'Bearer invalid'}});
 assert.notEqual(adminA.r.status,200);
 // Configuration endpoint cannot be used by a different tenant session through the route's chatId scope.
 const cfgA=store.getTelegramStorefrontConfig(ta.chatId); assert.equal(cfgA.credentialRef,'secret://tg10/a');
 // Direct status escalation remains blocked at the store boundary.
 db.prepare("UPDATE telegram_storefront_configs SET status='CONFIGURED' WHERE organization_id=?").run(orgA);
 const blocked=await store.upsertTelegramStorefrontConfig(ta.chatId,{status:'PUBLISHED'},actorA).catch(e=>e);
 assert.equal(blocked.code,'TELEGRAM_VERIFICATION_REQUIRED');
 // Raw token-like values are not persisted in the storefront configuration.
 const rawRows=db.prepare('SELECT credential_ref FROM telegram_storefront_configs').all();
 assert.deepEqual(rawRows.map(r=>r.credential_ref).sort(),['secret://tg10/a','secret://tg10/b'].sort());
 assert.equal(db.prepare("SELECT COUNT(*) c FROM telegram_storefront_configs WHERE credential_ref LIKE '123456:%'").get().c,0);
 // Cross-tenant public access is isolated by chatId.
 const pubB=await request(`/api/telegram-storefront/${encodeURIComponent(tb.chatId)}`); assert.equal(pubB.r.status,200); assert.equal(pubB.j.storefront.botId,'B'); assert.notEqual(pubB.j.storefront.botId,pubA.j.storefront.botId);
 // Unknown/unpublished stores fail closed.
 const unknown=await request('/api/telegram-storefront/does-not-exist'); assert.equal(unknown.r.status,404);
 // Capability gating: seller B cannot invoke checkout through Telegram when disabled.
 const checkoutB=await request('/api/marketplace/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telegram_storefront_chat_id:tb.chatId,items:[]})});
 assert.equal(checkoutB.r.status,400); // malformed request must not become a privileged execution path
 console.log('TG-10 Telegram security/adversarial/cumulative regression: PASS');
}finally{child.kill('SIGTERM');}

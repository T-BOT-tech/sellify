import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as sleep } from 'node:timers/promises';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const backend = path.join(root, 'backend');
const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-phase0-'));
const port = 19000 + Math.floor(Math.random() * 1000);
const env = {
  ...process.env,
  PORT: String(port), NODE_ENV: 'test', SELLIFY_DATA_DIR: dataDir,
  SELLIFY_BACKUP_DIR: path.join(dataDir, 'backups'), SELLIFY_BACKUP_TOKEN: 'phase0-test-backup-token',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000', RATE_LIMIT_MAX_WRITES: '1000', RATE_LIMIT_MAX_READS: '1000',
};

process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_BACKUP_DIR = path.join(dataDir, 'backups');
const results = [];
function pass(name) { results.push(['PASS', name]); }
async function test(name, fn) { try { await fn(); pass(name); } catch (e) { results.push(['FAIL', name, e]); throw e; } }
async function request(method, url, body, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${url}`, {
    method, headers: { ...(body === undefined ? {} : {'content-type':'application/json'}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, json, text };
}
async function waitForHealth(child) {
  for (let i=0;i<80;i++) {
    try { const r = await request('GET','/health'); if (r.response.ok) return; } catch {}
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
    await sleep(50);
  }
  throw new Error('server did not become healthy');
}

const child = spawn(process.execPath, [path.join(backend, 'server.js')], { cwd: root, env, stdio: ['ignore','pipe','pipe'] });
let stderr=''; child.stderr.on('data', d => stderr += d);
try {
  await waitForHealth(child);
  const store = await import(path.join(backend, 'lib/store-sqlite.js'));
  let backupPathForRestore;
  const user = await store.getOrCreateUserByTelegram('phase0-telegram-user', 'Phase 0 User');
  const created = await store.createTenantForUser({ userId: user.id, sellerName: 'Phase 0 Shop', businessType:'retail', country:'ET', currency:'ETB', timezone:'Africa/Addis_Ababa' });
  const session = await store.createSession({ userId:user.id, chatId:created.chatId, deviceName:'Phase 0 Test Device' });
  const auth = { Authorization: `Bearer ${session.token}` };

  await test('canonical identity maps every tenant to one organization, location, and Telegram channel', async () => {
    const identity = store.getIdentityForTenant(created.chatId);
    assert.ok(identity?.organization?.id);
    assert.equal(identity.organization.name, 'Phase 0 Shop');
    assert.equal(identity.locations.length, 1);
    assert.equal(identity.locations[0].type, 'STORE');
    assert.equal(identity.channelIdentities.length, 1);
    assert.equal(identity.channelIdentities[0].channelType, 'telegram_chat');
    assert.equal(identity.channelIdentities[0].channelIdentifier, created.chatId);
    const identityAgain = store.getIdentityForTenant(created.chatId);
    assert.equal(identityAgain.organization.id, identity.organization.id);
    assert.equal(identityAgain.locations[0].id, identity.locations[0].id);
    assert.equal(identityAgain.channelIdentities[0].id, identity.channelIdentities[0].id);
  });

  await test('organization locations API creates, validates, and isolates locations', async () => {
    let r = await request('GET', `/tenants/${created.chatId}/locations`, undefined, auth);
    assert.equal(r.response.status, 200);
    assert.equal(r.json.locations.length, 1);
    assert.equal(r.json.locations[0].type, 'STORE');
    r = await request('POST', `/tenants/${created.chatId}/locations`, { code: 'WH1', name: 'Main Warehouse', type: 'WAREHOUSE' }, auth);
    assert.equal(r.response.status, 201);
    assert.equal(r.json.location.type, 'WAREHOUSE');
    const locationId = r.json.location.id;
    r = await request('PATCH', `/tenants/${created.chatId}/locations/${locationId}`, { name: 'Central Warehouse', status: 'active' }, auth);
    assert.equal(r.response.status, 200);
    assert.equal(r.json.location.name, 'Central Warehouse');
    r = await request('POST', `/tenants/${created.chatId}/locations`, { code: 'BAD', name: 'Bad', type: 'NOT_A_LOCATION' }, auth);
    assert.equal(r.response.status, 400);
    const otherUser = await store.getOrCreateUserByTelegram('phase0-location-other', 'Other Location');
    const other = await store.createTenantForUser({ userId: otherUser.id, sellerName: 'Other Location Shop', country: 'ET', currency: 'ETB' });
    const otherSession = await store.createSession({ userId: otherUser.id, chatId: other.chatId });
    r = await request('GET', `/tenants/${created.chatId}/locations`, undefined, { Authorization: `Bearer ${otherSession.token}` });
    assert.equal(r.response.status, 403);
  });
  await test('health endpoint', async () => { const r=await request('GET','/health'); assert.equal(r.response.status,200); assert.equal(r.json.ok,true); });
  await test('static root', async () => { const r=await request('GET','/'); assert.equal(r.response.status,200); assert.match(r.text,/Sellify|<!doctype html/i); });
  await test('config generated at runtime', async () => { const r=await request('GET','/config.js'); assert.equal(r.response.status,200); assert.match(r.text,/SYNC_SERVER_URL/); });
  await test('tenant auth boundary rejects missing session', async () => { const r=await request('POST',`/catalog/${created.chatId}`,{products:[]}); assert.equal(r.response.status,401); });
  await test('tenant boundary rejects wrong session tenant', async () => {
    const otherUser=await store.getOrCreateUserByTelegram('phase0-other-user','Other');
    const other=await store.createTenantForUser({userId:otherUser.id,sellerName:'Other Shop',country:'ET',currency:'ETB'});
    const otherSession=await store.createSession({userId:otherUser.id,chatId:other.chatId});
    const r=await request('POST',`/catalog/${created.chatId}`,{products:[]},{Authorization:`Bearer ${otherSession.token}`}); assert.equal(r.response.status,403);
  });
  await test('catalog create/read', async () => {
    const products=[{id:'p1',name:'Coffee',price:250,stock:10,marketplace_listed:true},{id:'p2',name:'Tea',price:100,stock:5}];
    let r=await request('POST',`/catalog/${created.chatId}`,{products},auth); assert.equal(r.response.status,200); assert.equal(r.json.products.length,2);
    r=await request('GET',`/catalog/${created.chatId}`); assert.equal(r.response.status,200); assert.equal(r.json.products[0].id,'p1');
  });
  await test('catalog stock revision conflict', async () => {
    const current=(await store.getCatalog(created.chatId)).products.find(p=>p.id==='p1');
    const advanced={...current,stock:9,stock_revision:current.stock_revision};
    await request('POST',`/catalog/${created.chatId}`,{products:[advanced]},auth);
    const stale={...advanced,stock:8,stock_revision:current.stock_revision};
    const r=await request('POST',`/catalog/${created.chatId}`,{products:[stale]},auth); assert.equal(r.response.status,409); assert.equal(r.json.error.code,'CATALOG_STOCK_CONFLICT');
  });
  await test('order sync recomputes total server-side and is idempotent', async () => {
    const order={id:'local-1',items:[{id:'p1',qty:2,price:9999},{id:'p2',qty:1,price:100}],total:1};
    let r=await request('POST',`/sync/${created.chatId}`,{orders:[order]},auth); assert.equal(r.response.status,200); assert.equal(r.json.results[0].status,'synced');
    const orders=await store.getOrders(created.chatId); assert.equal(orders.length,1); assert.equal(orders[0].total,20098);
    r=await request('POST',`/sync/${created.chatId}`,{orders:[order]},auth); assert.equal(r.response.status,200); assert.equal(r.json.results[0].status,'synced'); assert.equal((await store.getOrders(created.chatId)).length,1);
  });
  await test('customer domain creates, deduplicates, lists, and links customers to orders', async () => {
    let r = await request('POST', `/tenants/${created.chatId}/customers`, { name: 'Alice', phone: '0900112233', customerType: 'retail' }, auth);
    assert.equal(r.response.status, 201); const customerId = r.json.customer.id; assert.ok(customerId);
    r = await request('POST', `/tenants/${created.chatId}/customers`, { name: 'Alice Updated', phone: '0900112233' }, auth);
    assert.equal(r.response.status, 201); assert.equal(r.json.customer.id, customerId); assert.equal(r.json.customer.name, 'Alice Updated');
    r = await request('GET', `/tenants/${created.chatId}/customers?q=0900112233`, undefined, auth);
    assert.equal(r.response.status, 200); assert.equal(r.json.customers.length, 1); assert.equal(r.json.customers[0].id, customerId);
    const customerOrder = { id: 'customer-linked-order', customer_id: customerId, customer_name: 'Alice Updated', customer_phone: '0900112233', items: [{ id: 'p2', qty: 1, price: 100 }], total: 100 };
    r = await request('POST', `/sync/${created.chatId}`, { orders: [customerOrder] }, auth);
    assert.equal(r.response.status, 200); assert.equal((await store.getOrders(created.chatId)).find(o => o.id === 'customer-linked-order').customer_id, customerId);
  });
  await test('marketplace search exposes listed in-stock product', async () => { const r=await request('GET','/api/marketplace/search'); assert.equal(r.response.status,200); assert.ok(r.json.results.some(x=>x.seller_id===created.chatId&&x.item_id==='p1')); });
  let marketplace;
  await test('marketplace checkout decrements stock atomically', async () => {
    const r=await request('POST','/api/marketplace/checkout',{buyer_id:'buyer-1',customer_name:'Buyer',customer_phone:'0911',items:[{seller_id:created.chatId,item_id:'p1',qty:3}]});
    assert.equal(r.response.status,200); marketplace=r.json; assert.ok(marketplace.marketplace_order_id); assert.equal(marketplace.sub_orders[0].sub_total,750);
    const p=(await store.getCatalog(created.chatId)).products.find(x=>x.id==='p1'); assert.equal(p.stock,7);
  });
  await test('marketplace checkout idempotency replays the original order without double stock decrement', async () => {
    const before = (await store.getCatalog(created.chatId)).products.find(x => x.id === 'p1').stock;
    const headers = { 'Idempotency-Key': 'phase0-marketplace-idempotency-1' };
    const payload = { buyer_id: 'buyer-idempotent', customer_name: 'Buyer', customer_phone: '0911', items: [{ seller_id: created.chatId, item_id: 'p1', qty: 1 }] };
    const first = await request('POST', '/api/marketplace/checkout', payload, headers);
    assert.equal(first.response.status, 200);
    const second = await request('POST', '/api/marketplace/checkout', payload, headers);
    assert.equal(second.response.status, 200);
    assert.equal(second.json.marketplace_order_id, first.json.marketplace_order_id);
    const after = (await store.getCatalog(created.chatId)).products.find(x => x.id === 'p1').stock;
    assert.equal(after, before - 1);
  });
  await test('marketplace checkout rejects stock overrun without partial commit', async () => {
    const before=(await store.getCatalog(created.chatId)).products.find(x=>x.id==='p1').stock;
    const r=await request('POST','/api/marketplace/checkout',{items:[{seller_id:created.chatId,item_id:'p1',qty:9999}]}); assert.equal(r.response.status,409);
    const after=(await store.getCatalog(created.chatId)).products.find(x=>x.id==='p1').stock; assert.equal(after,before);
  });
  await test('seller receives marketplace orders through pull queue', async () => { const r=await request('GET',`/sync/${created.chatId}`,undefined,auth); assert.equal(r.response.status,200); assert.equal(r.json.new_orders.length,2); assert.ok(r.json.new_orders.every(o=>o.is_marketplace===true)); const r2=await request('GET',`/sync/${created.chatId}`,undefined,auth); assert.equal(r2.json.new_orders.length,0); });
  await test('audit trail records core operations', async () => { const r=await request('GET',`/tenants/${created.chatId}/audit`,undefined,auth); assert.equal(r.response.status,200); const actions=r.json.events.map(e=>e.action); assert.ok(actions.includes('tenant.created_authenticated')); assert.ok(actions.includes('catalog.replaced')); assert.ok(actions.includes('order.synced')); assert.ok(actions.includes('marketplace.order_created')); });
  await test('compliance audit controls expose retention, request workflow, and export', async () => {
    let r = await request('GET', `/tenants/${created.chatId}/compliance/retention`, undefined, auth);
    assert.equal(r.response.status, 200); assert.equal(r.json.policy.retentionDays, 365);
    r = await request('PATCH', `/tenants/${created.chatId}/compliance/retention`, { retentionDays: 730 }, auth);
    assert.equal(r.response.status, 200); assert.equal(r.json.policy.retentionDays, 730);
    r = await request('POST', `/tenants/${created.chatId}/compliance/requests`, {
      requestType: 'EXPORT', subjectType: 'organization', reason: 'golden regression'
    }, auth);
    assert.equal(r.response.status, 201); assert.equal(r.json.request.status, 'pending');
    const requestId = r.json.request.id;
    r = await request('PATCH', `/tenants/${created.chatId}/compliance/requests`, {
      requestId, status: 'approved', resolutionNote: 'request reviewed'
    }, auth);
    assert.equal(r.response.status, 200); assert.equal(r.json.request.status, 'approved');
    r = await request('PATCH', `/tenants/${created.chatId}/compliance/requests`, {
      requestId, status: 'completed', resolutionNote: 'export prepared'
    }, auth);
    assert.equal(r.response.status, 200); assert.equal(r.json.request.status, 'completed');
    r = await request('GET', `/tenants/${created.chatId}/compliance/export/organization`, undefined, auth);
    assert.equal(r.response.status, 200); assert.equal(r.json.subject.type, 'organization');
    assert.ok(Array.isArray(r.json.customers)); assert.ok(Array.isArray(r.json.orders));
    r = await request('GET', `/tenants/${created.chatId}/audit?actor_id=${encodeURIComponent(user.id)}`, undefined, auth);
    assert.equal(r.response.status, 200);
    assert.ok(r.json.events.some(e => e.action === 'compliance.exported' && e.actorId === user.id));
  });
  await test('backup endpoint protects token and creates valid SQLite backup', async () => {
    let r=await request('POST','/admin/backup'); assert.equal(r.response.status,401);
    r=await request('POST','/admin/backup',undefined,{Authorization:'Bearer phase0-test-backup-token'}); assert.equal(r.response.status,201); assert.ok(r.json.file);
    const backupPath=path.join(dataDir,'backups',r.json.file); backupPathForRestore=backupPath; const info=await stat(backupPath); assert.ok(info.size>0);
    const db=new DatabaseSync(backupPath); const migrations=db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(x=>x.version); assert.deepEqual(migrations,Array.from({ length: 57 }, (_, index) => index + 1)); const tenantCount=db.prepare('SELECT COUNT(*) AS c FROM tenants').get().c; assert.ok(tenantCount>=2); db.close();
  });
  await test('backup restore opens and preserves core rows', async () => {
    assert.ok(backupPathForRestore);
    const restoreDir = await mkdtemp(path.join(tmpdir(), 'sellify-phase0-restore-'));
    const restorePath = path.join(restoreDir, 'restored.sqlite');
    const bytes = await readFile(backupPathForRestore);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(restorePath, bytes);
    const restored = new DatabaseSync(restorePath);
    const migrations=restored.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(x=>x.version);
    assert.deepEqual(migrations,Array.from({ length: 57 }, (_, index) => index + 1));
    assert.ok(restored.prepare('SELECT COUNT(*) AS c FROM tenants').get().c >= 2);
    assert.ok(restored.prepare('SELECT COUNT(*) AS c FROM orders').get().c >= 1);
    restored.close();
    await rm(restoreDir,{recursive:true,force:true});
  });
  await test('migration idempotency on second process start', async () => {
    child.kill('SIGTERM'); await new Promise(resolve=>child.once('exit',resolve));
    const second=spawn(process.execPath,[path.join(backend,'server.js')],{cwd:root,env,stdio:['ignore','ignore','pipe']});
    try { await waitForHealth(second); const db=new DatabaseSync(path.join(dataDir,'sellify.sqlite')); const migrations=db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(x=>x.version); assert.deepEqual(migrations,Array.from({ length: 57 }, (_, index) => index + 1)); db.close(); } finally { second.kill('SIGTERM'); await new Promise(resolve=>second.once('exit',resolve)); }
  });
  console.log(`\nPhase 0 Golden Regression: ${results.filter(x=>x[0]==='PASS').length} PASS, 0 FAIL`);
  for (const [status,name] of results) console.log(`${status}  ${name}`);
} catch (e) {
  console.error(`\nPhase 0 Golden Regression: FAILED`);
  for (const [status,name,err] of results) console.error(`${status}  ${name}${err ? ` — ${err.message}`:''}`);
  if (stderr) console.error('\nServer stderr:\n'+stderr);
  process.exitCode=1;
} finally {
  if (child.exitCode === null) child.kill('SIGTERM');
  await rm(dataDir,{recursive:true,force:true});
}

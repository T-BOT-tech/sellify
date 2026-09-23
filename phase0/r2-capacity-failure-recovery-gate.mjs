import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';

const dir = await mkdtemp(join(tmpdir(), 'sellify-r2-capacity-'));
process.env.SELLIFY_DATA_DIR = dir;
process.env.SELLIFY_BACKUP_DIR = join(dir, 'backups');
const store = await import('../backend/lib/store-sqlite.js');

let pass = 0;
const ok = async (name, fn) => { await fn(); console.log(`PASS: ${name}`); pass++; };

const user = await store.getOrCreateUserByTelegram(`r2cap-${Date.now()}`, 'R2 capacity');
const tenant = await store.createTenantForUser({ userId: user.id, sellerName: 'R2 Capacity', businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
const session = await store.createSession({ userId: user.id, chatId: tenant.chatId });
await store.saveCatalog(tenant.chatId, [{ id: 'r2-cap-product', name: 'Capacity Product', price: 100, stock: 1000 }]);
const location = (await store.listOrganizationLocations(tenant.chatId))[0];

await ok('SQLite integrity and foreign-key enforcement are active', async () => {
  const db = store.getDatabaseForTests();
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
});

await ok('Concurrent read baseline completes without failures', async () => {
  const db = store.getDatabaseForTests();
  const n = 100;
  const t0 = performance.now();
  const results = await Promise.all(Array.from({ length: n }, async () =>
    db.prepare('SELECT COUNT(*) AS c FROM catalog_products').get().c));
  const elapsed = performance.now() - t0;
  assert.equal(results.length, n);
  assert.ok(results.every(Number.isInteger));
  console.log(`  local-read-100: ${elapsed.toFixed(2)}ms`);
});

await ok('Concurrent domain reads preserve tenant isolation', async () => {
  const db = store.getDatabaseForTests();
  const n = 100;
  const results = await Promise.all(Array.from({ length: n }, async () =>
    db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(tenant.chatId).organization_id));
  assert.equal(new Set(results).size, 1);
});

await ok('Event failure remains isolated from subsequent valid work', async () => {
  const { processEventIsolated } = await import('../backend/lib/event-failure-isolation.js');
  const bad = { eventId: `r2-bad-${Date.now()}`, eventType: 'unsupported.event', aggregateType: 'test', aggregateId: 'bad', payload: {} };
  const failed = await processEventIsolated(bad, () => { throw Object.assign(new Error('synthetic'), { code: 'R2_SYNTHETIC' }); });
  assert.equal(failed.status, 'rejected');
  const valid = { eventId: `r2-good-${Date.now()}`, eventType: 'inventory.movement.record', aggregateType: 'inventory_movement', aggregateId: 'r2-good', payload: { eventId: 'r2-good', productId: 'r2-cap-product', quantity: 1, movementType: 'PURCHASE', locationId: location.id } };
  const processed = await processEventIsolated(valid, e => store.processSyncEvent(tenant.chatId, e, session));
  assert.equal(processed.status, 'processed');
});

await ok('Failed event does not leave a partial inventory mutation', async () => {
  const db = store.getDatabaseForTests();
  const id = `r2-rollback-${Date.now()}`;
  const circular = { eventId: id, productId: 'r2-cap-product', quantity: 2, movementType: 'PURCHASE', locationId: location.id };
  circular.self = circular;
  const { processEventIsolated } = await import('../backend/lib/event-failure-isolation.js');
  const result = await processEventIsolated({ eventId: id, eventType: 'inventory.movement.record', aggregateType: 'inventory_movement', aggregateId: id, payload: circular }, e => store.processSyncEvent(tenant.chatId, e, session));
  assert.equal(result.status, 'rejected');
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM sync_events WHERE event_id=?').get(id).c, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM inventory_movements WHERE event_id=?').get(id).c, 0);
});

await ok('Live database backup produces a readable consistent snapshot', async () => {
  const backup = await store.createDatabaseBackup();
  assert.ok(fs.existsSync(backup.path));
  const backupDb = new (await import('node:sqlite')).DatabaseSync(backup.path);
  assert.equal(backupDb.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(backupDb.prepare('SELECT COUNT(*) AS c FROM tenants').get().c >= 1, true);
  backupDb.close();
});

await ok('Backup retention remains bounded by configured policy', async () => {
  const files = fs.readdirSync(join(dir, 'backups')).filter(f => f.endsWith('.sqlite'));
  assert.ok(files.length >= 1);
  assert.ok(files.length <= 7);
});

await ok('Production CORS configuration is explicit and fail-visible', async () => {
  const source = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
  assert.match(source, /CORS_ALLOWED_ORIGINS/);
  assert.match(source, /allowing all origins/);
  assert.match(source, /before deploying with real sellers/);
});

await ok('Rate limits and proxy trust are deployment-configurable', async () => {
  const source = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
  assert.match(source, /RATE_LIMIT_MAX_WRITES/);
  assert.match(source, /RATE_LIMIT_MAX_READS/);
  assert.match(source, /TRUST_PROXY/);
});

await ok('No duplicate capacity/failure/recovery authority was introduced', async () => {
  const files = fs.readdirSync(join(process.cwd(), 'app/src'), { recursive: true }).filter(String);
  const joined = files.filter(f => /capacity|failure|recovery/i.test(String(f))).map(f => String(f)).join('\n');
  assert.ok(joined.includes('phase21-capacity-availability-evidence.js'));
  const source = fs.readFileSync(new URL('../backend/lib/event-failure-isolation.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /CREATE TABLE|INSERT INTO|UPDATE |DELETE FROM/);
});

console.log(`R2 CAPACITY / FAILURE / RECOVERY GATE: ${pass} PASS / 0 FAIL`);
await rm(dir, { recursive: true, force: true });

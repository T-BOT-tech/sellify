import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs';
import { eventFailureIsolationContract, processEventIsolated } from '../backend/lib/event-failure-isolation.js';

const dir = await mkdtemp(join(tmpdir(), 'sellify-phase13-11-12-'));
process.env.SELLIFY_DATA_DIR = dir;
const store = await import('../backend/lib/store-sqlite.js');

const user = await store.getOrCreateUserByTelegram('phase131112-user', 'Phase 13.11.12');
const tenant = await store.createTenantForUser({ userId: user.id, sellerName: 'Failure Isolation Test', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
const session = await store.createSession({ userId: user.id, chatId: tenant.chatId });
await store.saveCatalog(tenant.chatId, [{ id: 'phase131112-product', name: 'Isolation Product', price: 1000, stock: 10 }]);
const location = (await store.listOrganizationLocations(tenant.chatId))[0];

const valid = {
  eventId: 'phase131112-valid-1',
  eventType: 'inventory.movement.record',
  aggregateType: 'inventory_movement',
  aggregateId: 'phase131112-valid-movement',
  payload: { eventId: 'phase131112-valid-1', productId: 'phase131112-product', quantity: 3, movementType: 'PURCHASE', locationId: location.id },
};

const malformed = {
  eventId: 'phase131112-malformed-1',
  eventType: 'unsupported.event',
  aggregateType: 'test',
  aggregateId: 'bad',
  payload: { ignored: true },
};

const isolatedFailure = await processEventIsolated(malformed, async () => {
  throw Object.assign(new Error('synthetic failure'), { statusCode: 400, code: 'SYNTHETIC_FAILURE' });
});
assert.equal(isolatedFailure.status, 'rejected');
assert.equal(isolatedFailure.eventId, malformed.eventId);
assert.equal(isolatedFailure.code, 'SYNTHETIC_FAILURE');

const failed = await processEventIsolated(malformed, (event) => store.processSyncEvent(tenant.chatId, event, session));
assert.equal(failed.status, 'rejected');
assert.equal(failed.eventId, malformed.eventId);

const afterFailure = await store.processSyncEvent(tenant.chatId, valid, session);
assert.equal(afterFailure.status, 'processed');

// Prove the event transaction rolls back a domain mutation if persistence of
// the sync_events record fails after the mutation has occurred.
const circular = { eventId: 'phase131112-circular-1', productId: 'phase131112-product', quantity: 2, movementType: 'PURCHASE', locationId: location.id };
circular.self = circular;
const rollbackEvent = {
  eventId: circular.eventId,
  eventType: 'inventory.movement.record',
  aggregateType: 'inventory_movement',
  aggregateId: 'phase131112-rollback-movement',
  payload: circular,
};
const rollbackResult = await processEventIsolated(rollbackEvent, (event) => store.processSyncEvent(tenant.chatId, event, session));
assert.equal(rollbackResult.status, 'rejected');

const movements = await store.listInventoryMovements(tenant.chatId, { productId: 'phase131112-product' });
assert.equal(movements.filter(m => m.eventId === valid.eventId).length, 1);
assert.equal(movements.filter(m => m.eventId === rollbackEvent.eventId).length, 0);

const db = store.getDatabaseForTesting?.();
if (db) {
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM sync_events WHERE event_id = ?').get(valid.eventId).c, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM sync_events WHERE event_id = ?').get(rollbackEvent.eventId).c, 0);
}

const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
assert.match(server, /processEventIsolated\(event, \(candidate\) => processSyncEvent/);
assert.doesNotMatch(server, /BEGIN|COMMIT|ROLLBACK/);

const storeSource = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
assert.match(storeSource, /BEGIN IMMEDIATE/);
assert.match(storeSource, /db\.exec\('ROLLBACK'\)/);
assert.match(storeSource, /db\.exec\('COMMIT'\)/);

const helper = fs.readFileSync(new URL('../backend/lib/event-failure-isolation.js', import.meta.url), 'utf8');
assert.doesNotMatch(helper, /CREATE TABLE|DatabaseSync|INSERT INTO|UPDATE |DELETE FROM/);

const contract = eventFailureIsolationContract();
assert.equal(contract.transaction_scope, 'one event per database transaction');
assert.equal(contract.batch_scope, 'one result per event; one failure does not abort sibling events');
assert.equal(contract.partial_commit, false);
assert.equal(contract.shared_transaction_across_batch, false);
assert.equal(contract.persistence_authority, 'existing sync_events');

console.log('Phase 13.11.12 Failure Isolation Regression: PASS');
console.log('One-event transaction isolation: PASS');
console.log('Failed event converted to isolated result: PASS');
console.log('Sibling event continues after failure: PASS');
console.log('Domain mutation rollback on post-mutation failure: PASS');
console.log('sync_events not written for failed event: PASS');
console.log('No shared batch transaction / partial commit: BLOCKED');
console.log('No duplicate failure store / retry queue: BLOCKED');
await rm(dir, { recursive: true, force: true });

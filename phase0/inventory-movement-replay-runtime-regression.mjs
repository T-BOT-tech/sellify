import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-inventory-replay-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('inventory-owner-' + suffix, 'Inventory Owner');
  const seller = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Inventory Seller', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(seller.chatId, [
    { id: 'rice', name: 'Rice', price: 100, item_type: 'product' },
    { id: 'consultation', name: 'Consultation', price: 250, item_type: 'service' },
  ]);
  const locations = await store.listOrganizationLocations(seller.chatId, { includeInactive: true });
  const location = locations.find(item => item.status === 'active');
  assert.ok(location, 'tenant must have an active canonical location');

  const eventId = 'inventory-replay-' + suffix;
  const command = {
    eventId, productId: 'rice', quantity: 12, movementType: 'PURCHASE',
    locationId: location.id, referenceType: 'purchase_order',
    referenceId: 'po-' + suffix, reason: 'Initial receipt',
    metadata: { source: 'runtime-regression', nested: { b: 2, a: 1 } },
  };
  const first = await store.appendInventoryMovement(seller.chatId, command, { userId: owner.id });
  const replay = await store.appendInventoryMovement(seller.chatId, {
    ...command, metadata: { nested: { a: 1, b: 2 }, source: 'runtime-regression' },
  }, { userId: owner.id });
  assert.equal(replay.id, first.id, 'canonicalized metadata must allow exact replay');

  await assert.rejects(
    store.appendInventoryMovement(seller.chatId, { ...command, quantity: 13 }, { userId: owner.id }),
    error => error?.statusCode === 409 && error?.code === 'INVENTORY_EVENT_ID_REUSED',
    'same event ID with altered quantity must conflict',
  );
  await assert.rejects(
    store.appendInventoryMovement(seller.chatId, { ...command, productId: 'consultation' }, { userId: owner.id }),
    error => error?.statusCode === 409 && error?.code === 'INVENTORY_EVENT_ID_REUSED',
    'same event ID with altered product must conflict before product-type validation',
  );

  const db = store.getDatabaseForTests();
  db.prepare("UPDATE locations SET status = 'inactive' WHERE id = ?").run(location.id);
  const replayAfterDeactivation = await store.appendInventoryMovement(seller.chatId, command, { userId: owner.id });
  assert.equal(replayAfterDeactivation.id, first.id,
    'an exact committed movement must remain replayable after its location is deactivated');
  await assert.rejects(
    store.appendInventoryMovement(seller.chatId, {
      ...command, eventId: eventId + '-new', quantity: 2,
    }, { userId: owner.id }),
    error => error?.statusCode === 400,
    'a new movement must not use an inactive location',
  );
  assert.equal(db.isTransaction, false, 'failed new movement must not leave a transaction open');

  const otherOwner = await store.getOrCreateUserByTelegram('inventory-other-' + suffix, 'Other Inventory Owner');
  const otherSeller = await store.createTenantForUser({
    userId: otherOwner.id, sellerName: 'Other Inventory Seller', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(otherSeller.chatId, [
    { id: 'rice', name: 'Rice', price: 100, item_type: 'product' },
  ]);
  await assert.rejects(
    store.appendInventoryMovement(otherSeller.chatId, {
      ...command, locationId: undefined,
    }, { userId: otherOwner.id }),
    error => error?.statusCode === 409 && error?.code === 'INVENTORY_EVENT_ID_REUSED',
    'another organization must not reuse an existing globally unique event ID',
  );

  const concurrentEventId = eventId + '-concurrent';
  const concurrentCommand = { ...command, eventId: concurrentEventId, locationId: undefined };
  const duplicateResults = await Promise.all([
    store.appendInventoryMovement(otherSeller.chatId, { ...concurrentCommand, eventId: concurrentEventId + '-other-org' }, { userId: otherOwner.id }),
    store.appendInventoryMovement(seller.chatId, concurrentCommand, { userId: owner.id }),
    store.appendInventoryMovement(seller.chatId, concurrentCommand, { userId: owner.id }),
  ]);
  assert.equal(duplicateResults[1].id, duplicateResults[2].id,
    'concurrent identical submissions must resolve to one canonical movement');

  const conflictEventId = eventId + '-concurrent-conflict';
  const conflictResults = await Promise.allSettled([
    store.appendInventoryMovement(seller.chatId, { ...command, eventId: conflictEventId, quantity: 4 }, { userId: owner.id }),
    store.appendInventoryMovement(seller.chatId, { ...command, eventId: conflictEventId, quantity: 5 }, { userId: owner.id }),
  ]);
  assert.equal(conflictResults.filter(x => x.status === 'fulfilled').length, 1,
    'only one concurrent intent may claim an event ID');
  assert.equal(conflictResults.filter(x => x.status === 'rejected' && x.reason?.code === 'INVENTORY_EVENT_ID_REUSED').length, 1,
    'the competing altered intent must fail closed');

  const outerEventId = eventId + '-outer-transaction';
  db.exec('BEGIN IMMEDIATE');
  const nestedMovement = await store.appendInventoryMovement(seller.chatId, {
    ...command, eventId: outerEventId, locationId: undefined,
  }, { userId: owner.id });
  assert.equal(db.isTransaction, true,
    'appendInventoryMovement must leave a caller-owned transaction open');
  db.exec('ROLLBACK');
  assert.equal(db.isTransaction, false);
  assert.equal(db.prepare('SELECT id FROM inventory_movements WHERE event_id = ?').get(outerEventId), undefined,
    'rolling back the outer sync transaction must roll back the nested Inventory movement');

  const rows = db.prepare('SELECT id, organization_id, event_id FROM inventory_movements WHERE event_id = ?').all(eventId);
  assert.equal(rows.length, 1, 'exact retries must not create duplicate movements');
  assert.equal(rows[0].id, first.id);
  const sellerOrgId = db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(seller.chatId).organization_id;
  assert.equal(rows[0].organization_id, sellerOrgId);
  assert.equal(db.isTransaction, false, 'all operations must leave the connection outside a transaction');

  console.log('Inventory Movement Replay Runtime Regression: PASS');
  console.log('Same-organization exact replay: PASS');
  console.log('Altered intent conflict: PASS');
  console.log('Exact replay after location deactivation: PASS');
  console.log('New movement at inactive location rejected: PASS');
  console.log('Cross-organization event ID reuse rejected: PASS');
  console.log('Concurrent identical submissions: PASS');
  console.log('Concurrent conflicting submissions: PASS');
  console.log('Caller-owned sync transaction rollback: PASS');
  console.log('Single canonical movement persisted: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

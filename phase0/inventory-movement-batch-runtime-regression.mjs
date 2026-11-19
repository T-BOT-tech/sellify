import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-inventory-batch-'));
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_DB_PATH = path.join(dataDir, 'sellify.sqlite');

try {
  const serverSource = await readFile(new URL('../backend/server.js', import.meta.url), 'utf8');
  assert.ok(serverSource.includes("handleInventoryMovementBatchCreate(req, res, decodeURIComponent(m[1]))"),
    'atomic Inventory command must be exposed through a dedicated API route');
  const batchHandlerStart = serverSource.indexOf('async function handleInventoryMovementBatchCreate');
  const batchHandlerEnd = serverSource.indexOf('async function handleLocationsList', batchHandlerStart);
  const batchHandler = serverSource.slice(batchHandlerStart, batchHandlerEnd);
  assert.match(batchHandler, /requireAuthorization\\(session, tenant, 'inventory', 'inventory:edit'/,
    'atomic Inventory command must reuse server-side Inventory edit authorization');
  assert.match(batchHandler, /assertLocationScope\\(session, tenant, location\\)/,
    'atomic Inventory command must enforce canonical location scope');

  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('inventory-batch-owner-' + suffix, 'Inventory Batch Owner');
  const tenant = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Inventory Batch Seller', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(tenant.chatId, [
    { id: 'rice', name: 'Rice', price: 100, item_type: 'product' },
    { id: 'beans', name: 'Beans', price: 120, item_type: 'product' },
    { id: 'consultation', name: 'Consultation', price: 250, item_type: 'service' },
  ]);
  const locations = await store.listOrganizationLocations(tenant.chatId, { includeInactive: true });
  const location = locations.find(item => item.status === 'active');
  assert.ok(location, 'tenant must have an active canonical Inventory location');
  const db = store.getDatabaseForTests();

  const commandId = 'restaurant-preparation-' + suffix;
  const command = {
    commandId,
    locationId: location.id,
    referenceType: 'restaurant_preparation',
    referenceId: 'prep-' + suffix,
    reason: 'Consume ingredients for preparation',
    metadata: { source: 'restaurant', context: { b: 2, a: 1 } },
    lines: [
      { lineId: 'rice', productId: 'rice', quantity: -2, movementType: 'SALE', metadata: { unit: 'kg' } },
      { lineId: 'beans', productId: 'beans', quantity: -3, movementType: 'SALE', metadata: { unit: 'kg' } },
    ],
  };
  const first = await store.appendInventoryMovementBatch(tenant.chatId, command, { userId: owner.id });
  assert.equal(first.duplicate, false);
  assert.equal(first.movements.length, 2);
  assert.equal(new Set(first.movements.map(item => item.eventId)).size, 2);
  assert.ok(first.movements.every(item => item.locationId === location.id));
  const storedRows = db.prepare(`
    SELECT event_id, metadata_json FROM inventory_movements
    WHERE reference_type = 'restaurant_preparation' AND reference_id = ?
    ORDER BY product_id
  `).all('prep-' + suffix);
  assert.equal(storedRows.length, 2, 'the full preparation command must create all canonical Inventory movements');
  for (const row of storedRows) {
    const metadata = JSON.parse(row.metadata_json);
    assert.equal(metadata.inventoryCommand.commandId, commandId);
    assert.equal(metadata.inventoryCommand.fingerprint, first.fingerprint);
    assert.equal(metadata.inventoryCommand.lineCount, 2);
  }

  const replay = await store.appendInventoryMovementBatch(tenant.chatId, {
    ...command,
    metadata: { context: { a: 1, b: 2 }, source: 'restaurant' },
    lines: [...command.lines].reverse(),
  }, { userId: owner.id });
  assert.equal(replay.duplicate, true, 'exact full-command retry must be idempotent');
  assert.equal(replay.fingerprint, first.fingerprint, 'line order and object-key order do not change command identity');
  assert.deepEqual(replay.movements.map(item => item.id).sort(), first.movements.map(item => item.id).sort());

  await assert.rejects(
    store.appendInventoryMovementBatch(tenant.chatId, {
      ...command,
      lines: command.lines.map((line, index) => index === 0 ? { ...line, quantity: -4 } : line),
    }, { userId: owner.id }),
    error => error?.statusCode === 409 && error?.code === 'INVENTORY_COMMAND_ID_REUSED',
    'reusing a command ID with altered line intent must fail closed',
  );
  await assert.rejects(
    store.appendInventoryMovementBatch(tenant.chatId, {
      ...command, lines: command.lines.slice(0, 1),
    }, { userId: owner.id }),
    error => error?.statusCode === 409 && error?.code === 'INVENTORY_COMMAND_ID_REUSED',
    'reusing a command ID with a changed line count must fail closed',
  );

  const failedCommandId = 'failed-preparation-' + suffix;
  await assert.rejects(
    store.appendInventoryMovementBatch(tenant.chatId, {
      ...command,
      commandId: failedCommandId,
      referenceId: failedCommandId,
      lines: [
        { lineId: 'valid-first', productId: 'rice', quantity: -1, movementType: 'SALE' },
        { lineId: 'invalid-service', productId: 'consultation', quantity: -1, movementType: 'SALE' },
      ],
    }, { userId: owner.id }),
    error => error?.statusCode === 422 && error?.code === 'SERVICE_HAS_NO_INVENTORY',
    'an invalid later line must reject the entire command',
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE reference_id = ?').get(failedCommandId).count, 0,
    'a failed command must not leave earlier line movements committed');
  assert.equal(db.isTransaction, false, 'failed atomic command must close its transaction');

  const concurrentCommand = {
    ...command,
    commandId: 'concurrent-preparation-' + suffix,
    referenceId: 'concurrent-prep-' + suffix,
  };
  const concurrent = await Promise.all([
    store.appendInventoryMovementBatch(tenant.chatId, concurrentCommand, { userId: owner.id }),
    store.appendInventoryMovementBatch(tenant.chatId, concurrentCommand, { userId: owner.id }),
  ]);
  assert.equal(concurrent.filter(item => item.duplicate === false).length, 1);
  assert.equal(concurrent.filter(item => item.duplicate === true).length, 1);
  assert.deepEqual(
    concurrent[0].movements.map(item => item.id).sort(),
    concurrent[1].movements.map(item => item.id).sort(),
    'concurrent same-connection command retries must return one canonical set of movements',
  );

  const otherOwner = await store.getOrCreateUserByTelegram('inventory-batch-other-' + suffix, 'Other Inventory Owner');
  const otherTenant = await store.createTenantForUser({
    userId: otherOwner.id, sellerName: 'Other Inventory Seller', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(otherTenant.chatId, [
    { id: 'rice', name: 'Rice', price: 100, item_type: 'product' },
    { id: 'beans', name: 'Beans', price: 120, item_type: 'product' },
  ]);
  const otherLocation = (await store.listOrganizationLocations(otherTenant.chatId)).find(item => item.status === 'active');
  const otherTenantCommand = await store.appendInventoryMovementBatch(otherTenant.chatId, {
    ...command, locationId: otherLocation.id,
  }, { userId: otherOwner.id });
  assert.notDeepEqual(
    otherTenantCommand.movements.map(item => item.eventId).sort(),
    first.movements.map(item => item.eventId).sort(),
    'same caller command ID in another organization must produce organization-bound event IDs',
  );
  assert.equal(db.isTransaction, false, 'all command paths must leave the connection outside a transaction');

  console.log('Inventory Movement Batch Runtime Regression: PASS');
  console.log('Atomic multi-line commit and audit: PASS');
  console.log('Full-command exact replay: PASS');
  console.log('Altered intent and changed line-count rejection: PASS');
  console.log('Invalid later-line rollback: PASS');
  console.log('Concurrent command replay: PASS');
  console.log('Organization-bound command identity: PASS');
} finally {
  await rm(dataDir, { recursive: true, force: true });
}

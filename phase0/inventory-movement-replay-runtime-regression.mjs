import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('./inventory-movement-replay-worker.mjs', import.meta.url));
function startInventoryWorker(chatId) {
  const child = spawn(process.execPath, [workerPath, String(chatId)], {
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    stdout += chunk;
    if (stdout.includes('READY\n')) resolveReady();
  });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', rejectReady);
  const result = new Promise((resolve, reject) => {
    child.on('close', code => {
      const outputLine = stdout.trim().split('\n').filter(Boolean).at(-1);
      let parsed;
      try { parsed = JSON.parse(outputLine || 'null'); }
      catch { reject(new Error('Inventory worker returned invalid output. stderr=' + stderr + ' stdout=' + stdout)); return; }
      if (code !== 0) {
        reject(new Error('Inventory worker exited with code ' + code + '. stderr=' + stderr + ' stdout=' + stdout));
        return;
      }
      resolve(parsed);
    });
  });
  return { child, ready, result };
}

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
  const duplicateWorkers = [
    startInventoryWorker(otherSeller.chatId),
    startInventoryWorker(otherSeller.chatId),
  ];
  await Promise.all(duplicateWorkers.map(worker => worker.ready));
  for (const worker of duplicateWorkers) {
    worker.child.stdin.end(JSON.stringify({ command: concurrentCommand, actor: { userId: otherOwner.id } }));
  }
  const duplicateResults = await Promise.all(duplicateWorkers.map(worker => worker.result));
  assert.equal(duplicateResults.every(result => result.ok), true,
    'concurrent exact submissions from independent SQLite connections must both succeed');
  assert.equal(duplicateResults[0].id, duplicateResults[1].id,
    'independent SQLite connections must resolve exact concurrent submissions to one movement');

  const conflictEventId = eventId + '-concurrent-conflict';
  const conflictWorkers = [
    startInventoryWorker(otherSeller.chatId),
    startInventoryWorker(otherSeller.chatId),
  ];
  await Promise.all(conflictWorkers.map(worker => worker.ready));
  conflictWorkers[0].child.stdin.end(JSON.stringify({
    command: { ...command, eventId: conflictEventId, quantity: 4, locationId: undefined },
    actor: { userId: otherOwner.id },
  }));
  conflictWorkers[1].child.stdin.end(JSON.stringify({
    command: { ...command, eventId: conflictEventId, quantity: 5, locationId: undefined },
    actor: { userId: otherOwner.id },
  }));
  const conflictResults = await Promise.all(conflictWorkers.map(worker => worker.result));
  assert.equal(conflictResults.filter(result => result.ok).length, 1,
    'only one cross-connection intent may claim an event ID');
  assert.equal(conflictResults.filter(result =>
    !result.ok && result.statusCode === 409 && result.code === 'INVENTORY_EVENT_ID_REUSED').length, 1,
    'the competing altered intent must fail closed across SQLite connections');

  const outerEventId = eventId + '-outer-transaction';
  db.exec('BEGIN IMMEDIATE');
  const nestedMovement = await store.appendInventoryMovement(otherSeller.chatId, {
    ...command, eventId: outerEventId, locationId: undefined,
  }, { userId: otherOwner.id }, { withinTransaction: true });
  assert.equal(db.isTransaction, true,
    'appendInventoryMovement must leave an explicitly declared caller-owned transaction open');
  db.exec('ROLLBACK');
  assert.equal(db.isTransaction, false);
  assert.equal(db.prepare('SELECT id FROM inventory_movements WHERE event_id = ?').get(outerEventId), undefined,
    'rolling back the outer sync transaction must roll back the nested Inventory movement');

  const syncEventId = eventId + '-sync-success';
  const syncMovementEventId = eventId + '-sync-movement';
  const syncResult = await store.processSyncEvent(otherSeller.chatId, {
    eventId: syncEventId,
    eventType: 'inventory.movement.record',
    aggregateType: 'inventory_movement',
    aggregateId: syncMovementEventId,
    payload: {
      eventId: syncMovementEventId, productId: 'rice', quantity: 3,
      movementType: 'PURCHASE',
    },
  }, { userId: otherOwner.id });
  assert.equal(syncResult.status, 'processed');
  assert.equal(db.prepare('SELECT event_id FROM sync_events WHERE event_id = ?').get(syncEventId).event_id, syncEventId);
  assert.ok(db.prepare('SELECT event_id FROM inventory_movements WHERE event_id = ?').get(syncMovementEventId),
    'successful sync must persist the canonical movement and sync receipt together');

  const failedSyncEventId = eventId + '-sync-failure';
  const failedMovementEventId = eventId + '-sync-movement-failure';
  await assert.rejects(store.processSyncEvent(otherSeller.chatId, {
    eventId: failedSyncEventId,
    eventType: 'inventory.movement.record',
    aggregateType: 'inventory_movement',
    aggregateId: failedMovementEventId,
    payload: {
      eventId: failedMovementEventId, productId: 'rice', quantity: 3,
      movementType: 'PURCHASE', locationId: 'location-does-not-exist',
    },
  }, { userId: otherOwner.id }), error => error?.statusCode === 400);
  assert.equal(db.prepare('SELECT event_id FROM sync_events WHERE event_id = ?').get(failedSyncEventId), undefined,
    'failed sync command must not leave a processed sync receipt');
  assert.equal(db.prepare('SELECT event_id FROM inventory_movements WHERE event_id = ?').get(failedMovementEventId), undefined,
    'failed sync command must not leave a partial Inventory movement');
  assert.equal(db.isTransaction, false, 'sync failure must roll back and close its transaction');

  // A direct request must not infer that it owns an unrelated sync transaction
  // merely because DatabaseSync.isTransaction is true on the shared connection.
  const raceOwner = await store.getOrCreateUserByTelegram('inventory-race-' + suffix, 'Inventory Race Owner');
  const raceSeller = await store.createTenantForUser({
    userId: raceOwner.id, sellerName: 'Inventory Race Seller', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(raceSeller.chatId, [
    { id: 'rice', name: 'Rice', price: 100, item_type: 'product' },
    { id: 'consultation', name: 'Consultation', price: 250, item_type: 'service' },
  ]);
  const raceSyncId = eventId + '-race-sync';
  const raceSyncMovementId = eventId + '-race-invalid-service';
  const raceDirectMovementId = eventId + '-race-direct';
  const raceSync = store.processSyncEvent(raceSeller.chatId, {
    eventId: raceSyncId,
    eventType: 'inventory.movement.record',
    aggregateType: 'inventory_movement',
    aggregateId: raceSyncMovementId,
    payload: { eventId: raceSyncMovementId, productId: 'consultation', quantity: 1, movementType: 'ADJUSTMENT' },
  }, { userId: raceOwner.id });
  const independentWrite = store.appendInventoryMovement(raceSeller.chatId, {
    eventId: raceDirectMovementId, productId: 'rice', quantity: 2, movementType: 'PURCHASE',
  }, { userId: raceOwner.id });
  const [raceSyncResult, independentWriteResult] = await Promise.allSettled([raceSync, independentWrite]);
  assert.equal(raceSyncResult.status, 'rejected');
  assert.equal(raceSyncResult.reason?.code, 'SERVICE_HAS_NO_INVENTORY');
  assert.equal(independentWriteResult.status, 'fulfilled',
    'an independent Inventory request waits for the sync transaction instead of joining it');
  assert.ok(db.prepare('SELECT event_id FROM inventory_movements WHERE event_id = ?').get(raceDirectMovementId),
    'the independent movement must commit after the failed sync transaction rolls back');
  assert.equal(db.prepare('SELECT event_id FROM inventory_movements WHERE event_id = ?').get(raceSyncMovementId), undefined,
    'the rejected service movement must not be persisted');
  assert.equal(db.prepare('SELECT event_id FROM sync_events WHERE event_id = ?').get(raceSyncId), undefined,
    'the failed sync receipt must not be persisted');
  assert.equal(db.isTransaction, false, 'concurrent sync and direct writes must leave no open transaction');

  const rows = db.prepare('SELECT id, organization_id, event_id FROM inventory_movements WHERE event_id = ?').all(eventId);
  assert.equal(rows.length, 1, 'exact retries must not create duplicate movements');
  assert.equal(rows[0].id, first.id);
  const sellerOrgId = db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(seller.chatId).organization_id;
  assert.equal(rows[0].organization_id, sellerOrgId);
  assert.equal(db.isTransaction, false, 'all operations must leave the connection outside a transaction');


  // Shared-connection regression: a transactional catalog write queued at the
  // first async boundary must not join or roll back the sync-event transaction.
  const organizationLocations = await store.listOrganizationLocations(otherSeller.chatId, { includeInactive: true });
  const isolationLocation = organizationLocations.find(item => item.status === 'active');
  const marketplaceDefaultLocation = organizationLocations.find(item =>
    item.code === 'DEFAULT' && item.status === 'active'
  );
  assert.ok(isolationLocation, 'concurrency fixture must have an active location');
  assert.ok(marketplaceDefaultLocation, 'marketplace checkout must use the canonical active DEFAULT location');
  const isolationProduct = 'market-rice-' + suffix;
  await store.saveCatalog(otherSeller.chatId, [
    { id: isolationProduct, name: 'Marketplace Rice', price: 100, item_type: 'product', marketplace_listed: true },
    { id: 'rice', name: 'Rice', price: 100, item_type: 'product' },
  ]);
  await store.appendInventoryMovement(otherSeller.chatId, {
    eventId: eventId + '-marketplace-opening',
    productId: isolationProduct,
    locationId: marketplaceDefaultLocation.id,
    quantity: 10,
    movementType: 'PURCHASE',
    referenceType: 'runtime_regression',
    referenceId: eventId,
  }, { userId: otherOwner.id });

  async function competingCatalogWrite(label) {
    return store.saveCatalog(otherSeller.chatId, [
      { id: isolationProduct, name: 'Marketplace Rice', price: 100, item_type: 'product', marketplace_listed: true },
      { id: 'rice', name: 'Rice', price: 100, item_type: 'product' },
      { id: label, name: 'Concurrent Catalog Marker', price: 1, item_type: 'product' },
    ]);
  }

  const isolatedSyncId = eventId + '-isolated-sync';
  const isolatedMovementId = eventId + '-isolated-movement';
  const isolatedSync = store.processSyncEvent(otherSeller.chatId, {
    eventId: isolatedSyncId,
    eventType: 'inventory.movement.record',
    aggregateType: 'inventory_movement',
    aggregateId: isolatedMovementId,
    payload: {
      eventId: isolatedMovementId, productId: 'rice', quantity: 1,
      movementType: 'PURCHASE', locationId: isolationLocation.id,
    },
  }, { userId: otherOwner.id });
  const isolatedCatalog = Promise.resolve().then(() => competingCatalogWrite('sync-catalog-' + suffix));
  const [isolatedSyncResult, isolatedCatalogResult] = await Promise.allSettled([isolatedSync, isolatedCatalog]);
  assert.equal(isolatedSyncResult.status, 'fulfilled', 'Inventory sync must commit before the competing catalog transaction begins');
  assert.equal(isolatedCatalogResult.status, 'fulfilled', 'the independent catalog transaction must not join or roll back sync');
  assert.equal(db.isTransaction, false, 'sync/catalog overlap must leave no transaction open');
  assert.ok(db.prepare('SELECT event_id FROM inventory_movements WHERE event_id = ?').get(isolatedMovementId));
  assert.ok(db.prepare('SELECT event_id FROM sync_events WHERE event_id = ?').get(isolatedSyncId));
  assert.ok((await store.getCatalog(otherSeller.chatId)).products.some(item => item.id === 'sync-catalog-' + suffix));

  // customer.upsert has the same atomic sync receipt boundary and must not
  // yield while the shared connection is inside its transaction.
  const customerSyncId = eventId + '-customer-sync';
  const customerSync = store.processSyncEvent(otherSeller.chatId, {
    eventId: customerSyncId,
    eventType: 'customer.upsert',
    aggregateType: 'customer',
    aggregateId: 'customer-' + suffix,
    payload: { id: 'customer-' + suffix, name: 'Sync Customer ' + suffix, source: 'sync' },
  }, { userId: otherOwner.id });
  const customerCatalog = Promise.resolve().then(() => competingCatalogWrite('customer-catalog-' + suffix));
  const [customerSyncResult, customerCatalogResult] = await Promise.allSettled([customerSync, customerCatalog]);
  assert.equal(customerSyncResult.status, 'fulfilled', 'customer sync must not yield inside its transaction');
  assert.equal(customerCatalogResult.status, 'fulfilled', 'catalog write must execute independently after customer sync');
  assert.equal(db.isTransaction, false);
  assert.ok(db.prepare('SELECT event_id FROM sync_events WHERE event_id = ?').get(customerSyncId));
  assert.ok(db.prepare('SELECT id FROM customers WHERE id = ?').get('customer-' + suffix));

  // Marketplace checkout owns its transaction and must call the synchronous
  // movement helper. A second transactional write is deliberately queued at
  // the old async movement boundary.
  const checkoutKey = 'tx-isolation-checkout-' + suffix;
  // Checkout deducts from the canonical DEFAULT location. Scope both sides
  // of this assertion to that same location; organization-wide balances are
  // returned as one row per location and must not be compared by product alone.
  const inventoryBeforeCheckout = (await store.getInventoryBalances(otherSeller.chatId, {
    locationId: marketplaceDefaultLocation.id,
  })).find(row => row.productId === isolationProduct)?.quantity;
  assert.equal(typeof inventoryBeforeCheckout, 'number', 'opening marketplace inventory balance must exist');
  const checkout = store.createMarketplaceOrder({
    buyer_id: 'tx-isolation-buyer-' + suffix,
    customer_name: 'Transaction Isolation Buyer',
    items: [{ seller_id: otherSeller.chatId, item_id: isolationProduct, qty: 1 }],
    idempotency_key: checkoutKey,
  });
  const checkoutCatalog = Promise.resolve().then(() => competingCatalogWrite('checkout-catalog-' + suffix));
  const [checkoutResult, checkoutCatalogResult] = await Promise.allSettled([checkout, checkoutCatalog]);
  assert.equal(checkoutResult.status, 'fulfilled', 'marketplace checkout must retain its caller-owned transaction');
  assert.equal(checkoutCatalogResult.status, 'fulfilled', 'catalog write must run after checkout commits');
  assert.equal(db.isTransaction, false);
  const checkoutOrder = checkoutResult.value;
  const checkoutSellerOrder = (await store.getOrders(otherSeller.chatId)).find(order =>
    order.is_marketplace && order.marketplace_order_id === checkoutOrder.marketplace_order_id
  );
  assert.ok(checkoutSellerOrder, 'checkout must persist its seller order');
  assert.equal(
    (await store.getInventoryBalances(otherSeller.chatId, {
      locationId: marketplaceDefaultLocation.id,
    })).find(row => row.productId === isolationProduct)?.quantity,
    inventoryBeforeCheckout - 1,
    'checkout must deduct exactly one unit from the pre-checkout canonical balance',
  );

  // Cancellation has its own transaction and the same no-yield requirement.
  const cancellation = store.updateMarketplaceOrderStatus(otherSeller.chatId, checkoutSellerOrder.id, 'cancelled');
  const cancellationCatalog = Promise.resolve().then(() => competingCatalogWrite('cancel-catalog-' + suffix));
  const [cancellationResult, cancellationCatalogResult] = await Promise.allSettled([cancellation, cancellationCatalog]);
  assert.equal(cancellationResult.status, 'fulfilled', 'marketplace cancellation must retain its caller-owned transaction');
  assert.equal(cancellationCatalogResult.status, 'fulfilled', 'catalog write must run after cancellation commits');
  assert.equal(db.isTransaction, false);
  assert.equal(cancellationResult.value.status, 'cancelled');
  assert.equal(
    (await store.getInventoryBalances(otherSeller.chatId, {
      locationId: marketplaceDefaultLocation.id,
    })).find(row => row.productId === isolationProduct)?.quantity,
    inventoryBeforeCheckout,
    'cancellation must restore exactly the deducted unit',
  );

  console.log('Inventory Movement Replay Runtime Regression: PASS');
  console.log('Same-organization exact replay: PASS');
  console.log('Altered intent conflict: PASS');
  console.log('Exact replay after location deactivation: PASS');
  console.log('New movement at inactive location rejected: PASS');
  console.log('Cross-organization event ID reuse rejected: PASS');
  console.log('Concurrent identical submissions: PASS');
  console.log('Concurrent conflicting submissions: PASS');
  console.log('Caller-owned sync transaction rollback: PASS');
  console.log('Successful Inventory sync event atomicity: PASS');
  console.log('Failed Inventory sync event rollback: PASS');
  console.log('Same-connection transaction isolation: PASS');
  console.log('Single canonical movement persisted: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

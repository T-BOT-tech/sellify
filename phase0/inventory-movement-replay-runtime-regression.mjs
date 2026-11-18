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
  }, { userId: otherOwner.id });
  assert.equal(db.isTransaction, true,
    'appendInventoryMovement must leave a caller-owned transaction open');
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

  const batchEventId = eventId + '-batch';
  const batchMovementA = {
    eventId: batchEventId + '-line-a', productId: 'rice', quantity: 4,
    movementType: 'PURCHASE', reason: 'Atomic batch line A',
  };
  const batchMovementB = {
    eventId: batchEventId + '-line-b', productId: 'rice', quantity: 6,
    movementType: 'PURCHASE', reason: 'Atomic batch line B',
  };
  const batchEnvelope = {
    eventId: batchEventId,
    eventType: 'inventory.movement.batch.record',
    aggregateType: 'inventory_movement_batch',
    aggregateId: batchEventId,
    payload: { movements: [batchMovementA, batchMovementB] },
  };
  const batchResult = await store.processSyncEvent(otherSeller.chatId, batchEnvelope, { userId: otherOwner.id });
  assert.equal(batchResult.status, 'processed');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE event_id IN (?, ?)')
    .get(batchMovementA.eventId, batchMovementB.eventId).count, 2,
  'batch command must persist every canonical movement line');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sync_events WHERE event_id = ?').get(batchEventId).count, 1,
    'batch command must persist one outer sync receipt');
  const batchReplay = await store.processSyncEvent(otherSeller.chatId, batchEnvelope, { userId: otherOwner.id });
  assert.equal(batchReplay.duplicate, true, 'exact batch replay must return the existing outer receipt');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE event_id IN (?, ?)')
    .get(batchMovementA.eventId, batchMovementB.eventId).count, 2,
  'exact batch replay must not create additional movements');
  await assert.rejects(store.processSyncEvent(otherSeller.chatId, {
    ...batchEnvelope, payload: { movements: [{ ...batchMovementA, quantity: 99 }, batchMovementB] },
  }, { userId: otherOwner.id }), error => error?.statusCode === 409 && error?.code === 'EVENT_ID_REUSED',
  'conflicting outer batch replay must be rejected');

  // Exercise the outer batch receipt and all movement lines from two
  // independently initialized SQLite connections, not merely one connection.
  const concurrentBatchId = eventId + '-batch-concurrent-exact';
  const concurrentBatch = {
    eventId: concurrentBatchId,
    eventType: 'inventory.movement.batch.record',
    aggregateType: 'inventory_movement_batch',
    aggregateId: concurrentBatchId,
    payload: { movements: [
      { eventId: concurrentBatchId + '-line-a', productId: 'rice', quantity: 2, movementType: 'PURCHASE' },
      { eventId: concurrentBatchId + '-line-b', productId: 'rice', quantity: 3, movementType: 'PURCHASE' },
    ] },
  };
  const concurrentBatchWorkers = [
    startInventoryWorker(otherSeller.chatId),
    startInventoryWorker(otherSeller.chatId),
  ];
  await Promise.all(concurrentBatchWorkers.map(worker => worker.ready));
  for (const worker of concurrentBatchWorkers) {
    worker.child.stdin.end(JSON.stringify({
      mode: 'sync-event', event: concurrentBatch, actor: { userId: otherOwner.id },
    }));
  }
  const concurrentBatchResults = await Promise.all(concurrentBatchWorkers.map(worker => worker.result));
  assert.equal(concurrentBatchResults.every(result => result.ok), true,
    'concurrent identical batch envelopes from independent SQLite connections must both succeed');
  assert.equal(concurrentBatchResults.filter(result => result.result?.duplicate === true).length, 1,
    'one concurrent identical batch must be recognized as the duplicate outer receipt');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sync_events WHERE event_id = ?')
    .get(concurrentBatchId).count, 1, 'concurrent exact batches must persist one outer receipt');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE event_id IN (?, ?)')
    .get(concurrentBatchId + '-line-a', concurrentBatchId + '-line-b').count, 2,
  'concurrent exact batches must persist each movement line exactly once');

  const concurrentConflictId = eventId + '-batch-concurrent-conflict';
  const conflictingBatchA = {
    eventId: concurrentConflictId,
    eventType: 'inventory.movement.batch.record',
    aggregateType: 'inventory_movement_batch',
    aggregateId: concurrentConflictId,
    payload: { movements: [
      { eventId: concurrentConflictId + '-line-a', productId: 'rice', quantity: 7, movementType: 'PURCHASE' },
      { eventId: concurrentConflictId + '-line-b', productId: 'rice', quantity: 8, movementType: 'PURCHASE' },
    ] },
  };
  const conflictingBatchB = {
    ...conflictingBatchA,
    payload: { movements: [
      { ...conflictingBatchA.payload.movements[0], quantity: 17 },
      conflictingBatchA.payload.movements[1],
    ] },
  };
  const conflictingBatchWorkers = [
    startInventoryWorker(otherSeller.chatId),
    startInventoryWorker(otherSeller.chatId),
  ];
  await Promise.all(conflictingBatchWorkers.map(worker => worker.ready));
  conflictingBatchWorkers[0].child.stdin.end(JSON.stringify({
    mode: 'sync-event', event: conflictingBatchA, actor: { userId: otherOwner.id },
  }));
  conflictingBatchWorkers[1].child.stdin.end(JSON.stringify({
    mode: 'sync-event', event: conflictingBatchB, actor: { userId: otherOwner.id },
  }));
  const conflictingBatchResults = await Promise.all(conflictingBatchWorkers.map(worker => worker.result));
  assert.equal(conflictingBatchResults.filter(result => result.ok).length, 1,
    'only one conflicting batch envelope may claim the outer event ID');
  assert.equal(conflictingBatchResults.filter(result =>
    !result.ok && result.statusCode === 409 && result.code === 'EVENT_ID_REUSED').length, 1,
  'the competing changed batch intent must fail with EVENT_ID_REUSED');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sync_events WHERE event_id = ?')
    .get(concurrentConflictId).count, 1, 'conflicting concurrent batches must leave one receipt');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE event_id IN (?, ?)')
    .get(concurrentConflictId + '-line-a', concurrentConflictId + '-line-b').count, 2,
  'the losing conflicting batch must not partially write movement lines');

  const invalidBatchEventId = eventId + '-batch-invalid';
  const invalidBatchLineId = invalidBatchEventId + '-valid-first-line';
  await assert.rejects(store.processSyncEvent(otherSeller.chatId, {
    eventId: invalidBatchEventId,
    eventType: 'inventory.movement.batch.record',
    payload: { movements: [
      { ...batchMovementA, eventId: invalidBatchLineId },
      { eventId: invalidBatchEventId + '-service-line', productId: 'consultation', quantity: 1, movementType: 'PURCHASE' },
    ] },
  }, { userId: otherOwner.id }), error => error?.statusCode === 422,
  'an invalid line must reject the entire batch');
  assert.equal(db.prepare('SELECT event_id FROM inventory_movements WHERE event_id = ?').get(invalidBatchLineId), undefined,
    'preflight must roll back valid earlier lines when a later line is invalid');
  assert.equal(db.prepare('SELECT event_id FROM sync_events WHERE event_id = ?').get(invalidBatchEventId), undefined,
    'a rejected batch must not persist an outer receipt');
  const duplicateLineBatchId = eventId + '-batch-duplicate-lines';
  await assert.rejects(store.processSyncEvent(otherSeller.chatId, {
    eventId: duplicateLineBatchId,
    eventType: 'inventory.movement.batch.record',
    payload: { movements: [
      { ...batchMovementA, eventId: duplicateLineBatchId + '-same' },
      { ...batchMovementB, eventId: duplicateLineBatchId + '-same' },
    ] },
  }, { userId: otherOwner.id }), error => error?.code === 'INVALID_INVENTORY_MOVEMENT_BATCH',
  'duplicate movement event IDs within one batch must be rejected');
  assert.equal(db.prepare('SELECT event_id FROM sync_events WHERE event_id = ?').get(duplicateLineBatchId), undefined);
  assert.equal(db.isTransaction, false, 'batch success and failure paths must close the transaction');

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
  console.log('Concurrent exact batch envelopes: PASS');
  console.log('Concurrent conflicting batch envelopes: PASS');
  console.log('Caller-owned sync transaction rollback: PASS');
  console.log('Successful Inventory sync event atomicity: PASS');
  console.log('Failed Inventory sync event rollback: PASS');
  console.log('Single canonical movement persisted: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

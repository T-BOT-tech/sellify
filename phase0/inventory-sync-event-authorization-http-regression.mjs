import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-inventory-sync-auth-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_BACKUP_DIR = path.join(tempDir, 'backups');
process.env.NODE_ENV = 'test';

let child;
let output = '';

async function reservePort() {
  const probe = createNetServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForBackend(baseUrl) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error('Backend exited before HTTP authorization checks: ' + output);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + output);
}

async function postEvents(baseUrl, chatId, token, events) {
  return fetch(baseUrl + '/events/' + encodeURIComponent(chatId), {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ events }),
  });
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('inventory-sync-owner-' + suffix, 'Inventory Sync Owner');
  const cashier = await store.getOrCreateUserByTelegram('inventory-sync-cashier-' + suffix, 'Inventory Sync Cashier');
  const foreignOwner = await store.getOrCreateUserByTelegram('inventory-sync-foreign-' + suffix, 'Foreign Owner');

  const tenant = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Inventory Sync Auth Tenant', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const foreignTenant = await store.createTenantForUser({
    userId: foreignOwner.id, sellerName: 'Inventory Sync Foreign Tenant', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.ensureMembership(cashier.id, tenant.chatId, 'cashier');
  const ownerSession = await store.createSession({
    userId: owner.id, chatId: tenant.chatId, deviceName: 'Inventory Sync Owner Regression',
  });
  const cashierSession = await store.createSession({
    userId: cashier.id, chatId: tenant.chatId, deviceName: 'Inventory Sync Cashier Regression',
  });
  await store.saveCatalog(tenant.chatId, [
    { id: 'sync-rice', name: 'Sync Rice', price: 100, item_type: 'product' },
  ]);

  const locations = await store.listOrganizationLocations(tenant.chatId, { includeInactive: true });
  const defaultLocation = locations.find(location => location.status === 'active');
  assert.ok(defaultLocation, 'tenant requires an active canonical default location');
  const sameOrgLocation = await store.createOrganizationLocation(tenant.chatId, {
    code: 'SYNC-SECONDARY-' + suffix.slice(-8),
    name: 'Sync Secondary Location',
  });
  const foreignLocation = await store.createOrganizationLocation(foreignTenant.chatId, {
    code: 'SYNC-FOREIGN-' + suffix.slice(-8),
    name: 'Foreign Sync Location',
  });

  const port = await reservePort();
  const baseUrl = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      CORS_ALLOWED_ORIGINS: baseUrl,
      RATE_LIMIT_MAX_WRITES: '500',
      RATE_LIMIT_MAX_READS: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  await waitForBackend(baseUrl);

  const movementEvent = (label, payload = {}) => {
    const eventId = 'sync-auth-' + label + '-' + suffix;
    return {
      eventId,
      eventType: 'inventory.movement.record',
      aggregateType: 'inventory_movement',
      aggregateId: eventId + '-aggregate',
      payload: {
        eventId: eventId + '-movement',
        productId: 'sync-rice',
        quantity: 2,
        movementType: 'PURCHASE',
        ...payload,
      },
    };
  };

  const deniedEvent = movementEvent('cashier-denied');
  const deniedResponse = await postEvents(baseUrl, tenant.chatId, cashierSession.token, [deniedEvent]);
  assert.equal(deniedResponse.status, 200, 'event batch keeps per-event rejection response semantics');
  const deniedBody = await deniedResponse.json();
  assert.equal(deniedBody.results[0].status, 'rejected');
  assert.equal(deniedBody.results[0].code, 'AUTHORIZATION_DENIED',
    'cashier without Inventory edit permission must be rejected by central authorization');
  assert.equal(store.getDatabaseForTests().prepare('SELECT COUNT(*) AS count FROM inventory_movements').get().count, 0,
    'unauthorized event must not create a canonical Inventory movement');

  const deniedBatchEventId = 'sync-auth-cashier-batch-denied-' + suffix;
  const deniedBatchEvent = {
    eventId: deniedBatchEventId,
    eventType: 'inventory.movement.batch.record',
    aggregateType: 'inventory_movement_batch',
    aggregateId: deniedBatchEventId,
    payload: { movements: [
      { eventId: deniedBatchEventId + '-line-a', productId: 'sync-rice', quantity: 1, movementType: 'PURCHASE' },
      { eventId: deniedBatchEventId + '-line-b', productId: 'sync-rice', quantity: 2, movementType: 'PURCHASE' },
    ] },
  };
  const deniedBatchResponse = await postEvents(baseUrl, tenant.chatId, cashierSession.token, [deniedBatchEvent]);
  const deniedBatchBody = await deniedBatchResponse.json();
  assert.equal(deniedBatchBody.results[0].status, 'rejected',
    'cashier without Inventory edit permission must not submit a movement batch');
  assert.equal(store.getDatabaseForTests().prepare(
    'SELECT COUNT(*) AS count FROM inventory_movements WHERE event_id IN (?, ?)'
  ).get(deniedBatchEventId + '-line-a', deniedBatchEventId + '-line-b').count, 0,
  'unauthorized batch must not create any canonical movement lines');

  const allowedEvent = movementEvent('owner-same-org', { locationId: sameOrgLocation.id });
  const allowedResponse = await postEvents(baseUrl, tenant.chatId, ownerSession.token, [allowedEvent]);
  assert.equal(allowedResponse.status, 200);
  const allowedBody = await allowedResponse.json();
  assert.equal(allowedBody.results[0].status, 'processed',
    'owner with Inventory edit permission may submit a same-organization explicit location');
  const allowedMovement = store.getDatabaseForTests().prepare(
    'SELECT location_id FROM inventory_movements WHERE event_id = ?'
  ).get(allowedEvent.payload.eventId);
  assert.equal(allowedMovement.location_id, sameOrgLocation.id);

  const allowedBatchEventId = 'sync-auth-owner-batch-' + suffix;
  const allowedBatchEvent = {
    eventId: allowedBatchEventId,
    eventType: 'inventory.movement.batch.record',
    aggregateType: 'inventory_movement_batch',
    aggregateId: allowedBatchEventId,
    payload: { movements: [
      { eventId: allowedBatchEventId + '-line-a', productId: 'sync-rice', quantity: 3,
        movementType: 'PURCHASE', locationId: sameOrgLocation.id },
      { eventId: allowedBatchEventId + '-line-b', productId: 'sync-rice', quantity: 5,
        movementType: 'PURCHASE' },
    ] },
  };
  const allowedBatchResponse = await postEvents(baseUrl, tenant.chatId, ownerSession.token, [allowedBatchEvent]);
  const allowedBatchBody = await allowedBatchResponse.json();
  assert.equal(allowedBatchBody.results[0].status, 'processed',
    'authorized owner may submit an atomic batch with same-organization and default locations');
  assert.equal(store.getDatabaseForTests().prepare(
    'SELECT COUNT(*) AS count FROM inventory_movements WHERE event_id IN (?, ?)'
  ).get(allowedBatchEventId + '-line-a', allowedBatchEventId + '-line-b').count, 2,
  'authorized batch must persist every movement line');

  // The location may be deactivated after a movement has committed. An exact
  // retry under a fresh sync-envelope ID must still resolve to the original
  // canonical movement, while a genuinely new movement at that inactive
  // location must fail closed.
  await store.updateOrganizationLocation(tenant.chatId, sameOrgLocation.id, { status: 'inactive' });
  const replayEvent = {
    ...allowedEvent,
    eventId: allowedEvent.eventId + '-retry',
    aggregateId: allowedEvent.aggregateId + '-retry',
  };
  const replayResponse = await postEvents(baseUrl, tenant.chatId, ownerSession.token, [replayEvent]);
  assert.equal(replayResponse.status, 200);
  const replayBody = await replayResponse.json();
  assert.equal(replayBody.results[0].status, 'processed',
    'exact movement replay remains valid after its location is deactivated');
  assert.equal(store.getDatabaseForTests().prepare(
    'SELECT COUNT(*) AS count FROM inventory_movements WHERE event_id = ?'
  ).get(allowedEvent.payload.eventId).count, 1,
  'replay after deactivation must not create a second canonical movement');

  const inactiveNewEvent = movementEvent('owner-inactive-new', { locationId: sameOrgLocation.id });
  const inactiveResponse = await postEvents(baseUrl, tenant.chatId, ownerSession.token, [inactiveNewEvent]);
  assert.equal(inactiveResponse.status, 200);
  const inactiveBody = await inactiveResponse.json();
  assert.equal(inactiveBody.results[0].status, 'rejected',
    'new movement at an inactive location must be rejected');
  assert.equal(store.getDatabaseForTests().prepare(
    'SELECT COUNT(*) AS count FROM inventory_movements WHERE event_id = ?'
  ).get(inactiveNewEvent.payload.eventId).count, 0,
  'inactive location must not accept a new movement');

  const foreignEvent = movementEvent('owner-foreign-org', { locationId: foreignLocation.id });
  const foreignResponse = await postEvents(baseUrl, tenant.chatId, ownerSession.token, [foreignEvent]);
  assert.equal(foreignResponse.status, 200);
  const foreignBody = await foreignResponse.json();
  assert.equal(foreignBody.results[0].status, 'rejected');
  assert.equal(foreignBody.results[0].code, 'LOCATION_SCOPE_DENIED',
    'explicit location owned by another organization must be rejected');
  assert.equal(store.getDatabaseForTests().prepare(
    'SELECT COUNT(*) AS count FROM inventory_movements WHERE event_id = ?'
  ).get(foreignEvent.payload.eventId).count, 0,
  'foreign-location event must not create a movement');

  const defaultEvent = movementEvent('owner-default-location');
  const defaultResponse = await postEvents(baseUrl, tenant.chatId, ownerSession.token, [defaultEvent]);
  assert.equal(defaultResponse.status, 200);
  const defaultBody = await defaultResponse.json();
  assert.equal(defaultBody.results[0].status, 'processed',
    'omitted location continues to use the canonical default location');
  const defaultMovement = store.getDatabaseForTests().prepare(
    'SELECT location_id FROM inventory_movements WHERE event_id = ?'
  ).get(defaultEvent.payload.eventId);
  assert.equal(defaultMovement.location_id, defaultLocation.id);

  const customerEventId = 'sync-auth-customer-' + suffix;
  const customerEvent = {
    eventId: customerEventId,
    eventType: 'customer.upsert',
    aggregateType: 'customer',
    aggregateId: 'customer-' + suffix,
    payload: { id: 'sync-customer-' + suffix, name: 'Non Inventory Sync Customer' },
  };
  const customerResponse = await postEvents(baseUrl, tenant.chatId, cashierSession.token, [customerEvent]);
  assert.equal(customerResponse.status, 200);
  const customerBody = await customerResponse.json();
  assert.equal(customerBody.results[0].status, 'processed',
    'non-Inventory sync event behavior remains unchanged and does not inherit Inventory permission checks');
  assert.ok(store.getDatabaseForTests().prepare(
    'SELECT id FROM customers WHERE id = ?'
  ).get(customerEvent.payload.id));

  console.log('Inventory Sync Event Authorization HTTP Regression: PASS');
  console.log('Unauthorized cashier Inventory event: DENIED');
  console.log('Authorized owner same-organization location: ALLOWED');
  console.log('Foreign-organization location: DENIED');
  console.log('Omitted location canonical default: ALLOWED');
  console.log('Non-Inventory customer sync compatibility: PRESERVED');
} catch (error) {
  console.error(error);
  if (output) console.error('Backend output:\n' + output);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await rm(tempDir, { recursive: true, force: true });
}

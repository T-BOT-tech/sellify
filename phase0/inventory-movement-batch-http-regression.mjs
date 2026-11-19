import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-inventory-batch-http-'));
const dbPath = path.join(dataDir, 'sellify.sqlite');
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_DB_PATH = dbPath;

let child = null;
let childOutput = '';

async function freePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(baseUrl) {
  let lastError;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error('Backend exited before becoming healthy (exit ' + child.exitCode + ')\\n' + childOutput);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
      lastError = new Error('Health endpoint returned ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + (lastError?.message || 'unknown error') + '\\n' + childOutput);
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('inventory-batch-http-' + suffix, 'Inventory Batch HTTP');
  const tenant = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Inventory Batch HTTP Store', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(tenant.chatId, [
    { id: 'rice-http', name: 'Rice', price: 100, item_type: 'product' },
    { id: 'beans-http', name: 'Beans', price: 120, item_type: 'product' },
  ]);
  const location = (await store.listOrganizationLocations(tenant.chatId)).find(item => item.status === 'active');
  assert.ok(location, 'HTTP regression requires an active canonical location');
  const session = await store.createSession({
    userId: owner.id, chatId: tenant.chatId, deviceName: 'Inventory batch HTTP regression',
  });

  const port = await freePort();
  const baseUrl = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env, PORT: String(port), SELLIFY_DATA_DIR: dataDir, SELLIFY_DB_PATH: dbPath,
      NODE_ENV: 'test', RATE_LIMIT_MAX_WRITES: '100', SERVE_STATIC: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { childOutput += chunk.toString(); });
  child.stderr.on('data', chunk => { childOutput += chunk.toString(); });
  await waitForHealth(baseUrl);

  const endpoint = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId) + '/inventory/movements/batch';
  const command = {
    commandId: 'http-preparation-' + suffix,
    locationId: location.id,
    referenceType: 'restaurant_preparation',
    referenceId: 'http-prep-' + suffix,
    reason: 'HTTP atomic preparation consumption',
    lines: [
      { lineId: 'rice', productId: 'rice-http', quantity: -2, movementType: 'SALE', metadata: { unit: 'kg' } },
      { lineId: 'beans', productId: 'beans-http', quantity: -1, movementType: 'SALE', metadata: { unit: 'kg' } },
    ],
  };
  const headers = {
    Authorization: 'Bearer ' + session.token,
    'Content-Type': 'application/json',
  };

  const unauthenticated = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command),
  });
  assert.equal(unauthenticated.status, 401, 'batch command must reject unauthenticated requests');

  const created = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(command) });
  assert.equal(created.status, 201, 'first authorized batch command must be created');
  const createdBody = await created.json();
  assert.equal(createdBody.movements.length, 2);
  assert.equal(createdBody.duplicate, false);
  assert.equal(createdBody.movements.every(item => item.locationId === location.id), true);

  const replay = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({
    ...command, lines: [...command.lines].reverse(),
  }) });
  assert.equal(replay.status, 200, 'exact full-command retry must return HTTP 200');
  const replayBody = await replay.json();
  assert.equal(replayBody.duplicate, true);
  assert.deepEqual(
    replayBody.movements.map(item => item.id).sort(),
    createdBody.movements.map(item => item.id).sort(),
  );

  const conflict = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({
    ...command, lines: command.lines.map((line, index) => index === 0 ? { ...line, quantity: -9 } : line),
  }) });
  assert.equal(conflict.status, 409, 'changed command intent must return HTTP 409');
  const conflictBody = await conflict.json();
  assert.equal(conflictBody.error?.code, 'INVENTORY_COMMAND_ID_REUSED');

  const db = store.getDatabaseForTests();
  const persisted = db.prepare(`
    SELECT COUNT(*) AS count FROM inventory_movements
    WHERE reference_type = 'restaurant_preparation' AND reference_id = ?
  `).get(command.referenceId);
  assert.equal(persisted.count, 2, 'HTTP create and replay must persist exactly one canonical movement per line');

  console.log('Inventory Movement Batch HTTP Regression: PASS');
  console.log('Authentication and server authorization boundary: PASS');
  console.log('Atomic batch creation: PASS');
  console.log('Exact replay HTTP response: PASS');
  console.log('Altered intent HTTP conflict: PASS');
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
  await rm(dataDir, { recursive: true, force: true });
}

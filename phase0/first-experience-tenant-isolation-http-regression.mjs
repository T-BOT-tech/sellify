import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-tenant-isolation-http-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_BACKUP_DIR = path.join(tempDir, 'backups');
process.env.NODE_ENV = 'test';

let child;
let output = '';

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
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error('Backend exited before tenant-isolation checks: ' + output);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + output);
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const userA = await store.getOrCreateUserByTelegram('tenant-isolation-a-' + suffix, 'Isolation A');
  const userB = await store.getOrCreateUserByTelegram('tenant-isolation-b-' + suffix, 'Isolation B');
  const tenantA = await store.createTenantForUser({
    userId: userA.id, sellerName: 'Isolation Store A', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const tenantB = await store.createTenantForUser({
    userId: userB.id, sellerName: 'Isolation Store B', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const sessionA = await store.createSession({
    userId: userA.id, chatId: tenantA.chatId, deviceName: 'Isolation regression A',
  });
  const sessionB = await store.createSession({
    userId: userB.id, chatId: tenantB.chatId, deviceName: 'Isolation regression B',
  });

  await store.saveCatalog(tenantA.chatId, [{
    id: 'a-private-item', name: 'A private item', price: 100, item_type: 'product',
  }]);
  await store.saveCatalog(tenantB.chatId, [{
    id: 'b-owned-item', name: 'B owned item', price: 200, item_type: 'product',
  }]);
  await store.saveBusinessTemplateConfig(tenantA.chatId, { templateKey: 'retail-shop' }, { userId: userA.id });
  await store.saveBusinessTemplateConfig(tenantB.chatId, { templateKey: 'repair' }, { userId: userB.id });

  const port = await freePort();
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
  await waitForHealth(baseUrl);

  const templateUrlB = baseUrl + '/tenants/' + encodeURIComponent(tenantB.chatId) + '/business-template';
  const ownTemplate = await fetch(templateUrlB, {
    headers: { Authorization: 'Bearer ' + sessionB.token },
  });
  assert.equal(ownTemplate.status, 200, 'tenant B must read its own canonical template');
  assert.equal((await ownTemplate.json()).businessTemplate?.templateKey, 'repair');

  const crossTenantTemplateRead = await fetch(templateUrlB, {
    headers: { Authorization: 'Bearer ' + sessionA.token },
  });
  assert.ok(!crossTenantTemplateRead.ok,
    'tenant A session must not read tenant B authenticated business-template configuration');

  const crossTenantTemplateWrite = await fetch(templateUrlB, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + sessionA.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ templateKey: 'other' }),
  });
  assert.ok(!crossTenantTemplateWrite.ok,
    'tenant A session must not write tenant B business-template configuration');

  const catalogUrlB = baseUrl + '/catalog/' + encodeURIComponent(tenantB.chatId);
  const crossTenantCatalogWrite = await fetch(catalogUrlB, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + sessionA.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      products: [{ id: 'cross-tenant-injection', name: 'Injected item', price: 1, item_type: 'product' }],
    }),
  });
  assert.ok(!crossTenantCatalogWrite.ok,
    'tenant A session must not write tenant B catalog through the authenticated catalog route');

  const ownTemplateAfterAttack = await fetch(templateUrlB, {
    headers: { Authorization: 'Bearer ' + sessionB.token },
  });
  assert.equal(ownTemplateAfterAttack.status, 200);
  assert.equal((await ownTemplateAfterAttack.json()).businessTemplate?.templateKey, 'repair',
    'failed cross-tenant writes must leave tenant B canonical template unchanged');

  const publicCatalogRead = await fetch(catalogUrlB);
  assert.equal(publicCatalogRead.status, 200,
    'public marketplace catalog reads remain available without a seller session');
  const catalogAfterAttack = await publicCatalogRead.json();
  assert.ok((catalogAfterAttack.products || []).some(item => item.id === 'b-owned-item'),
    'tenant B catalog must remain intact after rejected cross-tenant write');
  assert.ok(!(catalogAfterAttack.products || []).some(item => item.id === 'cross-tenant-injection'),
    'rejected cross-tenant catalog write must not persist injected data');

  const ownCatalogWrite = await fetch(catalogUrlB, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + sessionB.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      products: [{ id: 'b-valid-update', name: 'B valid update', price: 300, item_type: 'product' }],
    }),
  });
  assert.ok(ownCatalogWrite.ok, 'tenant B must retain the ability to write its own catalog');

  console.log('First-experience tenant-isolation HTTP regression: PASS');
  console.log('Cross-tenant business-template read/write: BLOCKED');
  console.log('Cross-tenant catalog write: BLOCKED');
  console.log('Public catalog read and own-tenant writes: PRESERVED');
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

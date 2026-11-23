import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-supplier-discovery-http-'));
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
      throw new Error('Backend exited before Supplier Network HTTP checks: ' + output);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + output);
}

async function request(baseUrl, path, { token, method = 'GET', body } = {}) {
  return fetch(baseUrl + path, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('supplier-discovery-owner-' + suffix, 'Supplier Discovery Owner');
  const buyer = await store.getOrCreateUserByTelegram('supplier-discovery-buyer-' + suffix, 'Supplier Discovery Buyer');
  const viewer = await store.getOrCreateUserByTelegram('supplier-discovery-viewer-' + suffix, 'Supplier Discovery Viewer');
  const foreignOwner = await store.getOrCreateUserByTelegram('supplier-discovery-foreign-' + suffix, 'Supplier Discovery Foreign Owner');

  const tenant = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Supplier Discovery HTTP Tenant', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const foreignTenant = await store.createTenantForUser({
    userId: foreignOwner.id, sellerName: 'Supplier Discovery Foreign Tenant', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });

  await store.ensureMembership(buyer.id, tenant.chatId, 'buyer');
  await store.ensureMembership(viewer.id, tenant.chatId, 'viewer');

  const buyerSession = await store.createSession({
    userId: buyer.id, chatId: tenant.chatId, deviceName: 'Supplier Discovery Buyer HTTP Regression',
  });
  const viewerSession = await store.createSession({
    userId: viewer.id, chatId: tenant.chatId, deviceName: 'Supplier Discovery Viewer HTTP Regression',
  });
  const foreignSession = await store.createSession({
    userId: foreignOwner.id, chatId: foreignTenant.chatId, deviceName: 'Supplier Discovery Foreign HTTP Regression',
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

  const directPath = '/tenants/' + encodeURIComponent(tenant.chatId) + '/supplier-network/discovery';
  const unauthenticated = await request(baseUrl, directPath);
  assert.equal(unauthenticated.status, 401,
    'direct Supplier Network discovery must reject requests without a tenant session');

  const foreignTenantResponse = await request(baseUrl, directPath, { token: foreignSession.token });
  assert.equal(foreignTenantResponse.status, 403,
    'a valid session for another tenant must not access this tenant discovery route');

  const viewerResponse = await request(baseUrl, directPath, { token: viewerSession.token });
  assert.equal(viewerResponse.status, 403,
    'an authenticated role without Supplier Network discovery permission must be denied');

  const buyerResponse = await request(baseUrl, directPath, { token: buyerSession.token });
  assert.equal(buyerResponse.status, 200,
    'buyer role with Supplier Network discovery permission must access direct discovery');
  const buyerBody = await buyerResponse.json();
  assert.equal(buyerBody.deterministic, true);
  assert.equal(buyerBody.ai, false);
  assert.ok(Array.isArray(buyerBody.results));

  const directPostResponse = await request(baseUrl, directPath, {
    token: buyerSession.token,
    method: 'POST',
    body: { search: 'supplier discovery HTTP regression' },
  });
  assert.equal(directPostResponse.status, 200,
    'authorized buyer session may use the supported POST discovery route');
  const directPostBody = await directPostResponse.json();
  assert.equal(directPostBody.deterministic, true);
  assert.ok(Array.isArray(directPostBody.results));

  const unifiedPath = '/api/discovery';
  const missingTenant = await request(baseUrl, unifiedPath, {
    method: 'POST',
    body: { providers: ['supplier-network'] },
  });
  assert.equal(missingTenant.status, 400,
    'unified Supplier Network federation must require an explicit tenant context');

  const unauthenticatedUnified = await request(baseUrl, unifiedPath, {
    method: 'POST',
    body: { providers: ['supplier-network'], chatId: tenant.chatId },
  });
  assert.equal(unauthenticatedUnified.status, 401,
    'unified Supplier Network federation must reject unauthenticated requests');

  const spoofedActor = await request(baseUrl, unifiedPath, {
    method: 'POST',
    token: viewerSession.token,
    body: {
      providers: ['supplier-network'],
      chatId: tenant.chatId,
      actor: { userId: owner.id, chatId: tenant.chatId, role: 'owner', roles: ['owner'] },
    },
  });
  assert.equal(spoofedActor.status, 403,
    'client-supplied owner actor must not elevate a viewer session');

  const unifiedBuyer = await request(baseUrl, unifiedPath, {
    method: 'POST',
    token: buyerSession.token,
    body: {
      providers: ['supplier-network'],
      chatId: tenant.chatId,
      actor: { userId: owner.id, chatId: foreignTenant.chatId, role: 'owner', roles: ['owner'] },
    },
  });
  assert.equal(unifiedBuyer.status, 200,
    'authorized buyer session may use unified Supplier Network federation');
  const unifiedBody = await unifiedBuyer.json();
  assert.equal(unifiedBody.deterministic, true);
  assert.equal(unifiedBody.ai, false);
  assert.ok(Array.isArray(unifiedBody.candidates));

  console.log('Supplier Network Discovery HTTP Authorization Regression: PASS');
  console.log('Unauthenticated direct and unified discovery: DENIED');
  console.log('Cross-tenant session: DENIED');
  console.log('Viewer without discovery permission: DENIED');
  console.log('Client actor spoofing: DENIED');
  console.log('Authorized buyer direct and unified discovery: ALLOWED');
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

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-workforce-api-http-'));
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
      throw new Error('Backend exited before Workforce HTTP checks: ' + output);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + output);
}

async function jsonRequest(baseUrl, pathname, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(baseUrl + pathname, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let payload = {};
  try { payload = await response.json(); } catch {}
  return { response, payload };
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('workforce-http-owner-' + suffix, 'Workforce HTTP Owner');
  const memberUser = await store.getOrCreateUserByTelegram('workforce-http-member-' + suffix, 'Workforce HTTP Member');
  const otherOwner = await store.getOrCreateUserByTelegram('workforce-http-other-' + suffix, 'Other Tenant Owner');
  const tenant = await store.createTenantForUser({
    userId: owner.id,
    sellerName: 'Workforce HTTP Test',
    businessType: 'services',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const otherTenant = await store.createTenantForUser({
    userId: otherOwner.id,
    sellerName: 'Other Workforce Tenant',
    businessType: 'services',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  await store.ensureMembership(memberUser.id, tenant.chatId, 'staff');
  const ownerSession = await store.createSession({
    userId: owner.id, chatId: tenant.chatId, deviceName: 'Workforce HTTP owner',
  });
  const otherSession = await store.createSession({
    userId: otherOwner.id, chatId: otherTenant.chatId, deviceName: 'Other tenant owner',
  });

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

  const collection = '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/members';
  const unauthorized = await jsonRequest(baseUrl, collection);
  assert.equal(unauthorized.response.status, 401, 'Workforce reads require an authenticated tenant session');

  const missingIdempotency = await jsonRequest(baseUrl, collection, {
    token: ownerSession.token,
    method: 'POST',
    body: { user_id: memberUser.id, member_type: 'PROVIDER', display_name: 'HTTP Provider' },
  });
  assert.equal(missingIdempotency.response.status, 400);
  assert.equal(missingIdempotency.payload.error?.code, 'IDEMPOTENCY_KEY_REQUIRED');

  const created = await jsonRequest(baseUrl, collection, {
    token: ownerSession.token,
    method: 'POST',
    headers: { 'Idempotency-Key': 'workforce-http-member-' + suffix },
    body: { user_id: memberUser.id, member_type: 'PROVIDER', display_name: 'HTTP Provider' },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  assert.equal(created.payload.record?.status, 'DRAFT');
  const memberId = created.payload.record?.id;
  assert.ok(memberId, 'create response must return the canonical Workforce member id');

  const replay = await jsonRequest(baseUrl, collection, {
    token: ownerSession.token,
    method: 'POST',
    headers: { 'Idempotency-Key': 'workforce-http-member-' + suffix },
    body: { user_id: memberUser.id, member_type: 'PROVIDER', display_name: 'HTTP Provider' },
  });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.payload.duplicate, true);
  assert.equal(replay.payload.record?.id, memberId, 'idempotent replay must return the original member');

  const listed = await jsonRequest(baseUrl, collection, { token: ownerSession.token });
  assert.equal(listed.response.status, 200);
  assert.ok(listed.payload.records?.some(record => record.id === memberId));

  const item = collection + '/' + encodeURIComponent(memberId);
  const fetched = await jsonRequest(baseUrl, item, { token: ownerSession.token });
  assert.equal(fetched.response.status, 200);
  assert.equal(fetched.payload.record?.user_id, memberUser.id);

  const missingVersion = await jsonRequest(baseUrl, item, {
    token: ownerSession.token, method: 'PATCH', body: { display_name: 'Updated Provider' },
  });
  assert.equal(missingVersion.response.status, 400);
  assert.equal(missingVersion.payload.error?.code, 'WORKFORCE_EXPECTED_VERSION_REQUIRED');

  const activated = await jsonRequest(baseUrl, item + '/activate', {
    token: ownerSession.token, method: 'POST', body: { expected_version: 1 },
  });
  assert.equal(activated.response.status, 200, JSON.stringify(activated.payload));
  assert.equal(activated.payload.record?.status, 'ACTIVE');
  assert.equal(activated.payload.record?.version, 2);

  const updated = await jsonRequest(baseUrl, item, {
    token: ownerSession.token,
    method: 'PATCH',
    body: { expected_version: 2, display_name: 'Updated HTTP Provider' },
  });
  assert.equal(updated.response.status, 200, JSON.stringify(updated.payload));
  assert.equal(updated.payload.record?.display_name, 'Updated HTTP Provider');
  assert.equal(updated.payload.record?.version, 3);

  const invalidLifecycle = await jsonRequest(baseUrl, item + '/complete', {
    token: ownerSession.token, method: 'POST', body: { expected_version: 3 },
  });
  assert.equal(invalidLifecycle.response.status, 400,
    'an operation not defined for the member entity must be rejected');

  const crossTenantRead = await jsonRequest(
    baseUrl,
    '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/members',
    { token: otherSession.token },
  );
  assert.equal(crossTenantRead.response.status, 403,
    'a session from another tenant must not read Workforce records');

  const crossTenantWrite = await jsonRequest(
    baseUrl,
    '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/members',
    {
      token: otherSession.token,
      method: 'POST',
      headers: { 'Idempotency-Key': 'cross-tenant-' + suffix },
      body: { user_id: otherOwner.id, member_type: 'PROVIDER' },
    },
  );
  assert.equal(crossTenantWrite.response.status, 403,
    'a session from another tenant must not create Workforce records');

  console.log('Workforce authenticated HTTP API regression: PASS');
  console.log('Session authentication, idempotency, CRUD, lifecycle, optimistic concurrency, and tenant isolation: VERIFIED');
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

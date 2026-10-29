import assert from 'node:assert/strict';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-multi-business-tenant-'));
const dbPath = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = dbPath;
let child;
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
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(`Backend exited: ${child.exitCode}\n${childOutput}`);
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Backend did not become healthy\n${childOutput}`);
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram(`multi-business-${Date.now()}`, 'Multi Business Owner');
  const businessA = await store.createTenantForUser({ userId: user.id, sellerName: 'Business A', businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
  const businessB = await store.createTenantForUser({ userId: user.id, sellerName: 'Business B', businessType: 'repair', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
  const sessionA = await store.createSession({ userId: user.id, chatId: businessA.chatId, deviceName: 'Multi-business A' });
  const otherUser = await store.getOrCreateUserByTelegram(`multi-business-other-${Date.now()}`, 'Other User');
  const otherTenant = await store.createTenantForUser({ userId: otherUser.id, sellerName: 'Other Business', businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
  const otherSession = await store.createSession({ userId: otherUser.id, chatId: otherTenant.chatId, deviceName: 'Other device' });

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port), NODE_ENV: 'test', SERVE_STATIC: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { childOutput += chunk.toString(); });
  child.stderr.on('data', chunk => { childOutput += chunk.toString(); });
  await waitForHealth(baseUrl);

  const ownerHeaders = { Authorization: `Bearer ${sessionA.token}`, 'Content-Type': 'application/json' };
  const listed = await fetch(`${baseUrl}/auth/tenants`, { headers: ownerHeaders });
  assert.equal(listed.status, 200);
  const memberships = (await listed.json()).memberships;
  assert.deepEqual(memberships.map(item => item.chatId), [businessA.chatId, businessB.chatId]);
  assert.deepEqual(memberships.map(item => item.sellerName), ['Business A', 'Business B']);
  assert.ok(memberships.every(item => item.tenantId && item.role === 'owner'), 'tenant listing must expose canonical membership identity only');

  const selected = await fetch(`${baseUrl}/auth/select-tenant`, {
    method: 'POST', headers: ownerHeaders,
    body: JSON.stringify({ chatId: businessB.chatId, deviceName: 'Selected Business B' }),
  });
  assert.equal(selected.status, 200);
  const selectedBody = await selected.json();
  assert.equal(selectedBody.membership.chatId, businessB.chatId);
  assert.equal(selectedBody.session.chatId, businessB.chatId);
  assert.equal(selectedBody.session.organizationId, (await store.getTenant(businessB.chatId)).organizationId);
  const selectedTenant = await fetch(`${baseUrl}/tenants/${encodeURIComponent(businessB.chatId)}`, { headers: { Authorization: `Bearer ${selectedBody.session.token}` } });
  assert.equal(selectedTenant.status, 200);
  assert.equal((await selectedTenant.json()).tenant.sellerName, 'Business B');

  const originalSessionStillA = await fetch(`${baseUrl}/tenants/${encodeURIComponent(businessA.chatId)}`, { headers: ownerHeaders });
  assert.equal(originalSessionStillA.status, 200, 'selecting another tenant must not mutate the original session context');
  assert.equal((await originalSessionStillA.json()).tenant.sellerName, 'Business A');

  const denied = await fetch(`${baseUrl}/auth/select-tenant`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${otherSession.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: businessB.chatId, deviceName: 'Unauthorized cross-business selection' }),
  });
  assert.equal(denied.status, 403, 'a user must not select a tenant without an active membership');

  const challenge = await store.createAuthChallenge(user.id);
  const challengeSelected = await fetch(`${baseUrl}/auth/select-tenant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: businessA.chatId, challengeToken: challenge.token, deviceName: 'Recovered returning merchant' }),
  });
  assert.equal(challengeSelected.status, 200, 'expired-session returning merchant must select a business through the one-time challenge');
  const challengeBody = await challengeSelected.json();
  assert.equal(challengeBody.session.chatId, businessA.chatId);
  assert.equal(challengeBody.membership.tenantId, businessA.tenantId);

  console.log('PASS: multi-business tenant listing, selection, challenge recovery, canonical session context, and cross-user denial');
} finally {
  if (child) {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
  await rm(tempDir, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-gap1-19-production-http-'));
const port = await new Promise((resolve, reject) => {
  const probe = createNetServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const value = probe.address().port;
    probe.close(error => error ? reject(error) : resolve(value));
  });
});
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: 'test',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
  SELLIFY_DATA_DIR: dataDir,
  SELLIFY_BACKUP_DIR: path.join(dataDir, 'backups'),
};
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_BACKUP_DIR = path.join(dataDir, 'backups');

const child = spawn(process.execPath, [path.join(root, 'backend/server.js')], {
  cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'],
});
let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => { stderr += chunk; });

async function request(url, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${url}`, options);
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) { ready = true; break; }
    } catch {}
    if (child.exitCode !== null) throw new Error(`backend exited: ${child.exitCode} ${stderr}`);
    await sleep(50);
  }
  assert.equal(ready, true, `backend did not become ready: ${stderr}`);

  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram(`gap119-cert-owner-${suffix}`, 'GAP-1.19 Certification Owner');
  const tenant = await store.createTenantForUser({
    userId: owner.id, sellerName: `GAP-1.19 Certification Tenant ${suffix}`,
    businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const otherOwner = await store.getOrCreateUserByTelegram(`gap119-cert-other-${suffix}`, 'GAP-1.19 Other Owner');
  const otherTenant = await store.createTenantForUser({
    userId: otherOwner.id, sellerName: `GAP-1.19 Other Tenant ${suffix}`,
    businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const db = store.getDatabaseForTests();
  const organizationId = String(db.prepare(
    'SELECT organization_id FROM tenants WHERE chat_id = ?'
  ).get(tenant.chatId)?.organization_id || '');
  assert.ok(organizationId, 'tenant must have a canonical organization');

  const manager = await store.getOrCreateUserByTelegram(`gap119-cert-manager-${suffix}`, 'GAP-1.19 Certification Manager');
  await store.ensureMembership(manager.id, tenant.chatId, 'manager');
  const cashier = await store.getOrCreateUserByTelegram(`gap119-cert-cashier-${suffix}`, 'GAP-1.19 Certification Cashier');
  await store.ensureMembership(cashier.id, tenant.chatId, 'cashier');

  const ownerSession = await store.createSession({ userId: owner.id, chatId: tenant.chatId, deviceName: 'GAP-1.19 owner HTTP test' });
  const managerSession = await store.createSession({ userId: manager.id, chatId: tenant.chatId, deviceName: 'GAP-1.19 manager HTTP test' });
  const cashierSession = await store.createSession({ userId: cashier.id, chatId: tenant.chatId, deviceName: 'GAP-1.19 cashier HTTP test' });
  const otherSession = await store.createSession({ userId: otherOwner.id, chatId: otherTenant.chatId, deviceName: 'GAP-1.19 other tenant HTTP test' });

  const base = `/tenants/${encodeURIComponent(tenant.chatId)}/payments/production-certification`;
  const headers = token => ({ Authorization: `Bearer ${token}`, Accept: 'application/json' });
  const jsonHeaders = token => ({ ...headers(token), 'Content-Type': 'application/json' });

  const unauthenticated = await request(base);
  assert.equal(unauthenticated.response.status, 401, 'production certification must require a session');

  const crossTenant = await request(base, { headers: headers(otherSession.token) });
  assert.equal(crossTenant.response.status, 403, 'a session for another tenant cannot read certifications');

  const allowedPreflight = await request(base, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  assert.equal(allowedPreflight.response.status, 204);
  assert.equal(allowedPreflight.response.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(allowedPreflight.response.headers.get('access-control-allow-methods'), 'GET,POST,PATCH,OPTIONS');

  const deniedPreflight = await request(base, {
    method: 'OPTIONS',
    headers: { Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(deniedPreflight.response.status, 204);
  assert.equal(deniedPreflight.response.headers.get('access-control-allow-origin'), null);

  const empty = await request(base, {
    headers: { ...headers(ownerSession.token), Origin: 'http://localhost:3000' },
  });
  assert.equal(empty.response.status, 200, JSON.stringify(empty.json));
  assert.deepEqual(empty.json.certifications, []);
  assert.equal(empty.response.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(empty.response.headers.get('vary'), 'Origin');
  assert.ok(empty.response.headers.get('x-request-id'));

  const deniedOrigin = await request(base, {
    headers: { ...headers(ownerSession.token), Origin: 'https://untrusted.example' },
  });
  assert.equal(deniedOrigin.response.status, 200);
  assert.equal(deniedOrigin.response.headers.get('access-control-allow-origin'), null,
    'disallowed origins must not receive an allow-origin header');

  const cashierRead = await request(base, { headers: headers(cashierSession.token) });
  assert.equal(cashierRead.response.status, 200, 'payments:view permits reading production certification');

  const cashierWrite = await request(base, {
    method: 'POST',
    headers: jsonHeaders(cashierSession.token),
    body: JSON.stringify({ providerId: 'telebirr' }),
  });
  assert.equal(cashierWrite.response.status, 403, 'payments:view alone cannot certify production readiness');

  const missingProvider = await request(base, {
    method: 'POST',
    headers: jsonHeaders(managerSession.token),
    body: JSON.stringify({ organizationId: 'forged-organization' }),
  });
  assert.equal(missingProvider.response.status, 400, 'providerId is required');

  const certified = await request(base, {
    method: 'POST',
    headers: jsonHeaders(managerSession.token),
    body: JSON.stringify({
      chatId: 'forged-chat',
      organizationId: 'forged-organization',
      providerId: 'telebirr',
    }),
  });
  assert.equal(certified.response.status, 200, JSON.stringify(certified.json));
  assert.equal(certified.json.status, 'BLOCKED', 'unknown provider evidence must fail closed');
  assert.equal(certified.json.certification.organizationId, organizationId,
    'HTTP handler must use the tenant organization, not the forged request value');
  assert.equal(certified.json.certification.status, 'BLOCKED');
  assert.equal(certified.json.certification.certifiedByUserId, manager.id);

  const listed = await request(`${base}?scope=PRODUCTION`, { headers: headers(ownerSession.token) });
  assert.equal(listed.response.status, 200, JSON.stringify(listed.json));
  assert.equal(listed.json.certifications.length, 1);
  assert.equal(listed.json.certifications[0].providerId, 'telebirr');
  assert.equal(listed.json.certifications[0].status, 'BLOCKED');
  assert.equal(listed.json.certifications[0].organizationId, organizationId);
  assert.notEqual(listed.json.certifications[0].organizationId, 'forged-organization');

  console.log('GAP-1.19 Payment production-certification HTTP authorization/isolation regression: PASS');
} finally {
  child.kill('SIGTERM');
  await rm(dataDir, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-tenant-response-loss-'));
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
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`Backend exited before health: ${child.exitCode}\n${childOutput}`);
    }
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Backend did not become healthy\n${childOutput}`);
}

function sendAndDropResponse(port, pathName, body, headers) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1', port, path: pathName, method: 'POST', headers: {
        ...headers, 'Content-Length': Buffer.byteLength(body),
      },
    });
    request.on('error', error => {
      if (['ECONNRESET', 'EPIPE', 'ERR_STREAM_DESTROYED'].includes(error.code)) return resolve();
      reject(error);
    });
    request.write(body);
    setTimeout(() => { request.destroy(); resolve(); }, 5);
    request.end();
  });
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram(`tenant-response-loss-${Date.now()}`, 'Tenant Response Loss Test');
  const existing = await store.createTenantForUser({
    userId: user.id, sellerName: 'Existing Response Loss Store', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const session = await store.createSession({ userId: user.id, chatId: existing.chatId, deviceName: 'Response-loss regression' });
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port), NODE_ENV: 'test', SERVE_STATIC: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { childOutput += chunk.toString(); });
  child.stderr.on('data', chunk => { childOutput += chunk.toString(); });
  await waitForHealth(baseUrl);

  const body = JSON.stringify({
    sellerName: 'Created Before Response Loss', businessType: 'retail', country: 'ET',
    timezone: 'Africa/Addis_Ababa', deviceName: 'Response-loss regression',
  });
  await sendAndDropResponse(port, '/auth/tenants', body, {
    Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json',
  });

  let memberships = [];
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/auth/tenants`, { headers: { Authorization: `Bearer ${session.token}` } });
    assert.equal(response.status, 200);
    memberships = (await response.json()).memberships || [];
    if (memberships.some(item => item.sellerName === 'Created Before Response Loss')) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const recovered = memberships.filter(item => item.sellerName === 'Created Before Response Loss');
  assert.equal(recovered.length, 1, 'membership discovery must recover exactly one server-created tenant after response loss');
  assert.ok(recovered[0].chatId && recovered[0].tenantId, 'recovered membership must include canonical tenant identity');

  const retry = await fetch(`${baseUrl}/auth/tenants`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
    body,
  });
  assert.equal(retry.status, 201, 'a deliberate retry remains an ordinary new-tenant request without an idempotency contract');
  const afterRetry = (await (await fetch(`${baseUrl}/auth/tenants`, { headers: { Authorization: `Bearer ${session.token}` } })).json()).memberships;
  assert.equal(afterRetry.filter(item => item.sellerName === 'Created Before Response Loss').length, 2,
    'the regression must expose that retrying without recovery would create a duplicate');
  console.log('PASS: response-loss membership discovery recovers the created tenant; duplicate risk on blind retry is characterized');
} finally {
  if (child) {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
  await rm(tempDir, { recursive: true, force: true });
}

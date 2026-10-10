import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-pf-http-sqlite-'));
const dbPath = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = dbPath;

let child = null;
let providerServer = null;
let db = null;
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;
const originalDocument = globalThis.document;
const originalGetComputedStyle = globalThis.getComputedStyle;
const localValues = new Map();

globalThis.localStorage = {
  getItem(key) { return localValues.has(key) ? localValues.get(key) : null; },
  setItem(key, value) { localValues.set(key, String(value)); },
  removeItem(key) { localValues.delete(key); },
  clear() { localValues.clear(); },
};

const noop = () => {};
const fakeElement = {
  style: { setProperty: noop, removeProperty: noop, getPropertyValue: () => '' },
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  setAttribute: noop, getAttribute: () => null, appendChild: noop,
  addEventListener: noop, removeEventListener: noop, dataset: {}, children: [],
  options: [], value: '',
};
globalThis.document = new Proxy({
  documentElement: fakeElement,
  head: fakeElement,
  body: fakeElement,
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: () => ({ ...fakeElement, style: { ...fakeElement.style }, classList: { ...fakeElement.classList } }),
}, {
  get(target, key) { return key in target ? target[key] : noop; },
});
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });

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

async function waitForHealth(baseUrl, processRef) {
  let lastError = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (processRef.exitCode !== null) {
      throw new Error('Backend exited before becoming healthy (exit ' + processRef.exitCode + ')');
    }
    try {
      const response = await originalFetch(baseUrl + '/health');
      if (response.ok) return;
      lastError = new Error('Health endpoint returned ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + (lastError?.message || 'unknown error'));
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const userA = await store.getOrCreateUserByTelegram('pf-http-user-a-' + randomUUID(), 'PF HTTP User A');
  const tenantA = await store.createTenantForUser({
    userId: userA.id, sellerName: 'PF HTTP Store A', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const sessionA = await store.createSession({ userId: userA.id, chatId: tenantA.chatId, deviceName: 'PF HTTP test device A' });
  const accountA = await store.createPaymentAccount(tenantA.chatId, {
    providerId: 'telebirr', accountIdentifier: '251900123456', phone: '251900123456',
  });
  const createdA = await store.createPaymentWithIntent(tenantA.chatId, {
    organizationId: sessionA.organizationId,
    paymentAccountId: accountA.id,
    providerId: 'telebirr',
    channel: 'api',
    amountMinor: 150000,
    currency: 'ETB',
    externalReference: 'PF-HTTP-' + randomUUID(),
    idempotencyKey: 'pf-http-create-' + randomUUID(),
  });
  const paymentA = createdA.payment;
  const createdSuccessA = await store.createPaymentWithIntent(tenantA.chatId, {
    organizationId: sessionA.organizationId,
    paymentAccountId: accountA.id,
    providerId: 'telebirr',
    channel: 'api',
    amountMinor: 150000,
    currency: 'ETB',
    externalReference: 'PF-HTTP-SUCCESS-' + randomUUID(),
    idempotencyKey: 'pf-http-create-success-' + randomUUID(),
  });
  const paymentSuccessA = createdSuccessA.payment;

  const userB = await store.getOrCreateUserByTelegram('pf-http-user-b-' + randomUUID(), 'PF HTTP User B');
  const tenantB = await store.createTenantForUser({
    userId: userB.id, sellerName: 'PF HTTP Store B', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const sessionB = await store.createSession({ userId: userB.id, chatId: tenantB.chatId, deviceName: 'PF HTTP test device B' });
  const accountB = await store.createPaymentAccount(tenantB.chatId, {
    providerId: 'telebirr', accountIdentifier: '251900123457', phone: '251900123457',
  });
  const createdB = await store.createPaymentWithIntent(tenantB.chatId, {
    organizationId: sessionB.organizationId,
    paymentAccountId: accountB.id,
    providerId: 'telebirr',
    channel: 'api',
    amountMinor: 99000,
    currency: 'ETB',
    externalReference: 'PF-HTTP-B-' + randomUUID(),
    idempotencyKey: 'pf-http-create-b-' + randomUUID(),
  });
  const paymentB = createdB.payment;

  const providerCalls = { unknown: 0, success: 0 };
  providerServer = createHttpServer((req, res) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    if (req.headers.authorization !== 'Bearer pf-http-test-provider-key') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'FAILED' }));
      return;
    }
    if (pathname === '/unknown') {
      providerCalls.unknown += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'UNAVAILABLE' }));
      return;
    }
    if (pathname === '/success') {
      providerCalls.success += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'SUCCESS',
        amountMinor: paymentSuccessA.amountMinor,
        currency: paymentSuccessA.currency,
        receiverAccount: accountA.accountIdentifier,
        reference: paymentSuccessA.externalReference,
        transactionId: 'PF-HTTP-TX-' + paymentSuccessA.id,
        observedAt: new Date().toISOString(),
      }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'NOT_FOUND' }));
  });
  await new Promise((resolve, reject) => {
    providerServer.once('error', reject);
    providerServer.listen(0, '127.0.0.1', resolve);
  });
  const providerBaseUrl = 'http://127.0.0.1:' + providerServer.address().port;

  const port = await freePort();
  const baseUrl = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      SELLIFY_DATA_DIR: tempDir,
      SELLIFY_DB_PATH: dbPath,
      NODE_ENV: 'test',
      SERVE_STATIC: 'false',
      SELLIFY_TELEBIRR_BASE_URL: providerBaseUrl,
      SELLIFY_TELEBIRR_API_KEY: 'pf-http-test-provider-key',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let childOutput = '';
  child.stdout.on('data', chunk => { childOutput += chunk.toString(); });
  child.stderr.on('data', chunk => { childOutput += chunk.toString(); });
  await waitForHealth(baseUrl, child);

  globalThis.window = { location: { origin: baseUrl }, matchMedia: () => ({ addEventListener: noop }), addEventListener: noop, removeEventListener: noop, navigator: { onLine: true } };
  const { setConfig } = await import('../app/src/state.js');
  setConfig({
    chatId: tenantA.chatId,
    sessionToken: sessionA.token,
    syncUrl: baseUrl,
    lang: 'en',
    currencyCode: 'ETB',
  });
  const { queryPaymentStatus } = await import('../app/src/payments/client.js');

  const idempotencyKey = 'pf-http-lost-response-' + randomUUID();
  const statusPath = '/tenants/' + encodeURIComponent(tenantA.chatId) +
    '/payments/' + encodeURIComponent(paymentA.id) + '/status';
  const successStatusPath = '/tenants/' + encodeURIComponent(tenantA.chatId) +
    '/payments/' + encodeURIComponent(paymentSuccessA.id) + '/status';
  let lostResponsePath = statusPath;
  let simulateLostResponse = true;
  const simulateResponseLoss = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = String(init.method || 'GET').toUpperCase();
    const response = await originalFetch(input, init);
    if (simulateLostResponse && method === 'POST' && url.endsWith(lostResponsePath)) {
      simulateLostResponse = false;
      await response.arrayBuffer();
      throw new TypeError('Simulated response loss after backend completion');
    }
    return response;
  };
  globalThis.fetch = simulateResponseLoss;

  await assert.rejects(
    () => queryPaymentStatus(paymentA.id, { query: { statusPath: '/unknown' } }, { idempotencyKey }),
    /Simulated response loss/,
    'first client call should lose the response after the backend has completed',
  );
  globalThis.fetch = originalFetch;

  let retry;
  try {
    retry = await queryPaymentStatus(paymentA.id, { query: { statusPath: '/unknown' } }, { idempotencyKey });
  } catch (error) {
    throw new Error('Status-query retry failed: ' + JSON.stringify(error) + '\\nBackend output:\\n' + childOutput);
  }
  assert.equal(retry.status, 'UNKNOWN', 'an unavailable provider observation must remain unresolved');
  assert.equal(retry.supported, true, 'the configured adapter supports status queries even when the outcome is unavailable');
  assert.equal(retry.payment.id, paymentA.id);

  const afterRetry = await store.getPayment(tenantA.chatId, paymentA.id);
  assert.equal(afterRetry.state, 'UNPAID', 'an unknown provider result must not mutate financial state');
  const ledgerAfter = await store.listPaymentLedger(tenantA.chatId, paymentA.id);
  assert.equal(ledgerAfter.length, 1, 'lost-response retry must not duplicate ledger entries');
  assert.equal(ledgerAfter[0].entryType, 'CREATED');

  db = new DatabaseSync(dbPath);
  const commandRows = db.prepare(
    'SELECT status, payment_id, request_hash FROM payment_status_query_commands WHERE idempotency_key = ?'
  ).all(idempotencyKey);
  assert.equal(commandRows.length, 1, 'the HTTP route must persist one durable status-query command');
  assert.equal(commandRows[0].status, 'SUCCEEDED', 'the unresolved provider result must be durably replayable');
  assert.equal(commandRows[0].payment_id, paymentA.id);
  assert.equal(providerCalls.unknown, 1, 'replay must not query the provider again');

  // Exercise the successful provider observation through the same real client,
  // HTTP route, adapter, Payment Core, and SQLite persistence boundary.
  const successIdempotencyKey = 'pf-http-success-lost-response-' + randomUUID();
  lostResponsePath = successStatusPath;
  simulateLostResponse = true;
  globalThis.fetch = simulateResponseLoss;
  await assert.rejects(
    () => queryPaymentStatus(paymentSuccessA.id, { query: { statusPath: '/success' } }, { idempotencyKey: successIdempotencyKey }),
    /Simulated response loss/,
    'successful status query should commit before the simulated response loss',
  );
  globalThis.fetch = originalFetch;

  let successfulRetry;
  try {
    successfulRetry = await queryPaymentStatus(
      paymentSuccessA.id,
      { query: { statusPath: '/success' } },
      { idempotencyKey: successIdempotencyKey },
    );
  } catch (error) {
    throw new Error('Successful status-query retry failed: ' + JSON.stringify(error) + '\\nBackend output:\\n' + childOutput);
  }
  assert.equal(successfulRetry.status, 'MATCH');
  assert.equal(successfulRetry.supported, true);
  assert.equal(successfulRetry.payment.state, 'VERIFIED');
  assert.equal(successfulRetry.invariants.passed, true);
  assert.equal(successfulRetry.decision.targetState, 'VERIFIED');
  assert.equal(providerCalls.success, 1, 'successful result replay must not query the provider twice');

  const successfulPaymentAfterRetry = await store.getPayment(tenantA.chatId, paymentSuccessA.id);
  assert.equal(successfulPaymentAfterRetry.state, 'VERIFIED');
  const successfulLedger = await store.listPaymentLedger(tenantA.chatId, paymentSuccessA.id);
  assert.deepEqual(successfulLedger.map(entry => entry.entryType), ['CREATED', 'VERIFIED'],
    'successful status-query replay must not duplicate financial ledger entries');
  const successfulEvidence = await store.listPaymentEvidence(tenantA.chatId, paymentSuccessA.id);
  const successfulVerifications = await store.listPaymentVerifications(tenantA.chatId, paymentSuccessA.id);
  const successfulDecisions = await store.listPaymentDecisions(tenantA.chatId, paymentSuccessA.id);
  assert.equal(successfulEvidence.length, 1, 'replay must not duplicate provider evidence');
  assert.equal(successfulVerifications.length, 1, 'replay must not duplicate verification');
  assert.equal(successfulDecisions.length, 1, 'replay must not duplicate the authoritative decision');

  const successCommandRows = db.prepare(
    'SELECT status, payment_id FROM payment_status_query_commands WHERE idempotency_key = ?'
  ).all(successIdempotencyKey);
  assert.equal(successCommandRows.length, 1);
  assert.equal(successCommandRows[0].status, 'SUCCEEDED');
  assert.equal(successCommandRows[0].payment_id, paymentSuccessA.id);

  const crossTenantKey = 'pf-http-cross-tenant-' + randomUUID();
  const crossTenantResponse = await originalFetch(
    baseUrl + '/tenants/' + encodeURIComponent(tenantB.chatId) +
      '/payments/' + encodeURIComponent(paymentB.id) + '/status',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + sessionA.token,
        'Content-Type': 'application/json',
        'Idempotency-Key': crossTenantKey,
      },
      body: JSON.stringify({}),
    },
  );
  assert.ok([401, 403].includes(crossTenantResponse.status),
    'a session from tenant A must not query tenant B payment status');
  const crossTenantCommands = db.prepare(
    'SELECT COUNT(*) AS count FROM payment_status_query_commands WHERE idempotency_key = ?'
  ).get(crossTenantKey);
  assert.equal(Number(crossTenantCommands.count), 0, 'unauthorized cross-tenant requests must not claim commands');
  assert.equal((await store.getPayment(tenantB.chatId, paymentB.id)).state, 'UNPAID');
  assert.equal((await store.listPaymentLedger(tenantB.chatId, paymentB.id)).length, 1);

  console.log('PASS PF-1 HTTP + real frontend client + SQLite lost-response retry');
  console.log('PASS unavailable provider outcome remains UNKNOWN and causes no financial transition');
  console.log('PASS successful MATCH -> VERIFIED -> ledger transition and lost-response replay');
  console.log('PASS evidence, verification, decision, and ledger are not duplicated on replay');
  console.log('PASS durable status-query command replays through the actual HTTP route');
  console.log('PASS cross-tenant session is rejected before command claim');
} catch (error) {
  globalThis.fetch = originalFetch;
  throw error;
} finally {
  globalThis.fetch = originalFetch;
  if (db) db.close();
  if (providerServer?.listening) {
    await new Promise(resolve => providerServer.close(() => resolve()));
  }
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 2000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalGetComputedStyle === undefined) delete globalThis.getComputedStyle;
  else globalThis.getComputedStyle = originalGetComputedStyle;
  await rm(tempDir, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';

async function reservePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, HOST, resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error('Frontend server exited: ' + child.exitCode);
    try { if ((await fetch(url)).status === 200) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Frontend server did not become ready');
}

const port = await reservePort();
const baseUrl = 'http://' + HOST + ':' + port;
const child = spawn(process.execPath, ['app/dev-server.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, HOST, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => { stderr += chunk; });
let browser;
const browserDiagnostics = { consoleErrors: [], failedRequests: [], badResponses: [] };
const pageErrors = [];
const apiCalls = [];

try {
  await waitForServer(baseUrl, child);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  pageErrors.length = 0;
  apiCalls.length = 0;
  page.on('console', message => { if (message.type() === 'error') browserDiagnostics.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => browserDiagnostics.failedRequests.push({
    url: request.url(), error: request.failure()?.errorText || 'unknown',
  }));
  page.on('response', response => {
    if (response.status() >= 400) browserDiagnostics.badResponses.push({ url: response.url(), status: response.status() });
  });
  let member = {
    id: 'member-synthetic-1', display_name: 'Synthetic Workforce Member',
    member_type: 'PROVIDER', status: 'ACTIVE', version: 1,
  };
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));

  await page.route('**/tenants/*/workforce/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();
    const body = method !== 'GET' ? (request.postDataJSON?.() || {}) : null;
    apiCalls.push({
      method, pathname, body,
      idempotencyKey: request.headers()['idempotency-key'] || '',
      authorization: request.headers().authorization || '',
    });

    if (pathname.endsWith('/utilization/summary') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        summary: { planned_minutes: 480, measured_planned_minutes: 450, actual_minutes: 420,
          variance_minutes: -30, completed_events: 2, open_events: 1, cancelled_events: 0,
          completed_missing_actual_events: 0 },
      }) });
      return;
    }
    if (pathname.endsWith('/members') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [member] }) });
      return;
    }
    if (pathname.endsWith('/suspend') && method === 'POST') {
      assert.equal(body.expected_version, member.version, 'member action must send the current optimistic version');
      member = { ...member, status: 'SUSPENDED', version: member.version + 1 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: member }) });
      return;
    }
    if (pathname.endsWith('/availability') && method === 'POST') {
      assert.equal(body.member_id, member.id);
      assert.equal(body.availability, 'AVAILABLE');
      assert.ok(typeof body.timezone === 'string' && body.timezone.length > 0);
      assert.ok(Number.isFinite(Date.parse(body.starts_at)) && Number.isFinite(Date.parse(body.ends_at)));
      assert.ok(Date.parse(body.starts_at) < Date.parse(body.ends_at));
      assert.equal(body.effective_from, body.starts_at);
      assert.match(request.headers()['idempotency-key'] || '', /^workforce-ui-/);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        record: { id: 'availability-synthetic-1', member_id: member.id, availability: 'AVAILABLE', version: 1 },
      }) });
      return;
    }
    if (pathname.includes('/workforce/') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [] }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({
      error: { message: 'Unexpected synthetic Workforce API request: ' + method + ' ' + pathname },
    }) });
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const state = await import('/src/state.js');
    state.setConfig({
      ...state.config,
      chatId: 'synthetic-tenant',
      sessionToken: 'synthetic-session-token',
      syncUrl: window.location.origin,
      tenantRole: 'owner',
      authRole: 'owner',
      authRoles: ['owner'],
    });
    const workspace = await import('/src/workforce/ui.js');
    const host = document.createElement('main');
    host.id = 'workforceWorkspaceHost';
    host.innerHTML = workspace.workforceWorkspaceShell();
    document.body.append(host);
    workspace.mountWorkforceWorkspace(host);
  });

  await page.waitForFunction(() => {
    const status = document.querySelector('#workforceStatus');
    return ['READY', 'ERROR', 'DENIED'].includes(status?.dataset.state || '');
  }, null, { timeout: 10000 });
  const workspaceStatus = await page.locator('#workforceStatus').textContent();
  assert.equal(
    await page.locator('#workforceStatus').getAttribute('data-state'),
    'READY',
    'Workforce workspace must load successfully. Status: ' + workspaceStatus
      + '; intercepted API calls: ' + JSON.stringify(apiCalls),
  );
  await page.getByText('Synthetic Workforce Member').waitFor({ timeout: 10000 });
  await page.getByText('Planned', { exact: true }).waitFor();
  await page.locator('.workforce-member-card').getByRole('button', { name: 'Open member' }).click();
  await page.locator('#workforceMemberDetails').waitFor({ state: 'visible' });
  await page.locator('#workforceAvailabilityForm').waitFor({ state: 'visible' });

  const form = page.locator('#workforceAvailabilityForm');
  await form.locator('[name="availability"]').selectOption('AVAILABLE');
  await form.locator('[name="starts_at"]').fill('2026-11-26T09:00');
  await form.locator('[name="ends_at"]').fill('2026-11-26T17:00');
  const browserTimezone = await form.locator('[name="timezone"]').inputValue();
  assert.ok(browserTimezone, 'workspace must provide a read-only timezone context');
  await form.getByRole('button', { name: 'Save availability' }).click();
  await page.getByText('Availability saved.').waitFor({ timeout: 10000 });

  const availabilityCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/availability'));
  assert.ok(availabilityCall, 'browser form must submit availability through the API');
  assert.equal(availabilityCall.authorization, 'Bearer synthetic-session-token');
  assert.match(availabilityCall.idempotencyKey, /^workforce-ui-/);
  assert.equal(availabilityCall.body.timezone, browserTimezone);

  await page.getByRole('button', { name: 'Suspend' }).click();
  await page.waitForFunction(() => {
    const status = document.querySelector('.workforce-member-card .logistics-status');
    return status?.textContent?.trim() === 'SUSPENDED';
  }, null, { timeout: 10000 });
  const suspendCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/suspend'));
  assert.ok(suspendCall, 'member lifecycle action must reach the API');
  assert.equal(suspendCall.body.expected_version, 1);
  assert.equal(suspendCall.authorization, 'Bearer synthetic-session-token');

  const card = await page.locator('#workforceWorkspace').boundingBox();
  assert.ok(card && card.width <= 390, 'Workforce workspace must fit the mobile viewport');
  assert.deepEqual(pageErrors, [], 'browser journey must not emit uncaught page errors');

  console.log('Workforce operator browser journey: PASS');
  console.log('Mobile workspace, authenticated API requests, member detail, availability creation, idempotency, and optimistic member lifecycle: VERIFIED');
} catch (error) {
  console.error(error);
  console.error('Browser diagnostics:\n' + JSON.stringify(browserDiagnostics, null, 2));
  if (typeof pageErrors !== 'undefined' && pageErrors.length) console.error('Page errors:\n' + JSON.stringify(pageErrors, null, 2));
  if (typeof apiCalls !== 'undefined' && apiCalls.length) console.error('Intercepted API calls:\n' + JSON.stringify(apiCalls, null, 2));
  if (stderr) console.error('Frontend server stderr:\n' + stderr);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

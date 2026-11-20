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
async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Sellify dev server exited: ${child.exitCode}`);
    try { if ((await fetch(baseUrl)).status === 200) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Sellify dev server did not become ready');
}

const port = await reservePort();
const baseUrl = `http://${HOST}:${port}`;
const child = spawn(process.execPath, ['app/dev-server.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, HOST, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => { stderr += chunk; });
let browser;
try {
  await waitForServer(baseUrl, child);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  let activity = null;
  const calls = [];
  await page.route('**/tenants/test-tenant/delivery-assignments*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: [] }) }));
  await page.route('**/tenants/test-tenant/memberships', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ memberships: [] }) }));
  await page.route('**/tenants/test-tenant/logistics/scheduling*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = request.postDataJSON?.() || {};
    calls.push({ method, path: url.pathname, body });

    if (method === 'GET' && url.pathname.endsWith('/logistics/scheduling')) {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          state: activity ? 'READY' : 'EMPTY',
          timeZone: 'Africa/Addis_Ababa',
          activities: activity ? [activity] : [],
        }),
      });
      return;
    }
    if (method === 'POST' && url.pathname.endsWith('/logistics/scheduling')) {
      activity = {
        id: 'scheduling-browser-1',
        activityType: body.activity_type,
        mode: body.mode,
        status: 'REQUESTED',
        requestedStart: body.requested_start,
        requestedEnd: body.requested_end,
        scheduledStart: null,
        scheduledEnd: null,
        timezone: 'Africa/Addis_Ababa',
        relatedOrderId: body.related_order?.id || null,
        relatedFulfillmentId: null,
        relatedMovementId: null,
        version: 1,
      };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ activity }) });
      return;
    }
    if (method === 'POST' && url.pathname.endsWith('/evaluate')) {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          evaluation: { evaluation: 'UNKNOWN', reason: 'NO_AUTHORITATIVE_CAPACITY_DECISION' },
          state: 'UNKNOWN',
        }),
      });
      return;
    }
    if (method === 'PATCH' && url.pathname.endsWith('/transition')) {
      activity = { ...activity, status: body.status, version: 2 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activity }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Unexpected scheduling route' } }) });
  });

  await page.route(baseUrl + '/', route => route.fulfill({
    status: 200, contentType: 'text/html',
    body: '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="tab-logistics" style="display:block"><div id="logisticsList"></div></div></body></html>',
  }));
  await page.goto(baseUrl);
  await page.evaluate(async () => {
    const state = await import('/src/state.js');
    state.setConfig({
      ...state.config,
      chatId: 'test-tenant',
      sessionToken: 'test-session',
      syncUrl: window.location.origin,
      logisticsEnabled: true,
      currentStaffRole: 'logistics_manager',
      authUser: { id: 'manager-browser-1' },
      userId: 'manager-browser-1',
      contextualRoles: [{ role: 'logistics_manager' }],
      authRoles: [],
      locationId: null,
    });
    state.setOrders([]);
    const logistics = await import('/src/logistics/ui.js');
    logistics.renderLogistics();
  });

  await page.locator('#logisticsSchedulingRequestForm').waitFor();
  await page.locator('#logisticsSchedulingTimezone').waitFor();
  assert.match(await page.locator('#logisticsSchedulingTimezone').innerText(), /Africa\/Addis_Ababa/);

  await page.locator('#logisticsSchedulingRequestForm [name="activityType"]').selectOption('DELIVERY');
  await page.locator('#logisticsSchedulingRequestForm [name="mode"]').selectOption('WINDOWED');
  await page.locator('#logisticsSchedulingRequestForm [name="referenceType"]').selectOption('order');
  await page.locator('#logisticsSchedulingRequestForm [name="referenceId"]').fill('core-order-browser-1');
  await page.locator('#logisticsSchedulingRequestForm [name="requestedStart"]').fill('2026-11-16T09:00');
  await page.locator('#logisticsSchedulingRequestForm [name="requestedEnd"]').fill('2026-11-16T10:00');
  await page.locator('#logisticsSchedulingRequestForm button[type="submit"]').click();
  await page.locator('[data-scheduling-card="scheduling-browser-1"]').waitFor();

  const createCall = calls.find(call => call.method === 'POST' && call.path.endsWith('/logistics/scheduling'));
  assert.ok(createCall, 'request form must call the canonical scheduling endpoint');
  assert.equal(createCall.body.requested_start, '2026-11-16T06:00:00.000Z',
    'local start must be converted using the canonical Addis Ababa timezone');
  assert.equal(createCall.body.requested_end, '2026-11-16T07:00:00.000Z',
    'local end must be converted using the canonical Addis Ababa timezone');
  assert.equal(Object.hasOwn(createCall.body, 'timezone'), false,
    'browser must not assert or send the scheduling timezone');

  await page.locator('[data-scheduled-start="scheduling-browser-1"]').fill('2026-11-16T09:30');
  await page.locator('[data-scheduled-end="scheduling-browser-1"]').fill('2026-11-16T10:30');
  await page.locator('[data-scheduling-evaluate="scheduling-browser-1"]').click();
  const evaluationCall = calls.find(call => call.method === 'POST' && call.path.endsWith('/evaluate'));
  assert.ok(evaluationCall, 'candidate window must be evaluated through the API');
  assert.equal(evaluationCall.body.scheduledStart, '2026-11-16T06:30:00.000Z');
  assert.equal(evaluationCall.body.scheduledEnd, '2026-11-16T07:30:00.000Z');
  assert.equal(await page.locator('[data-scheduling-transition="SCHEDULED"]').isDisabled(), true,
    'UNKNOWN feasibility must keep the SCHEDULED transition disabled');

  await page.locator('[data-scheduling-reason="scheduling-browser-1"]').fill('Buyer cancelled request');
  await page.locator('[data-scheduling-transition="CANCELLED"]').click();
  await page.waitForFunction(() => document.querySelector('[data-scheduling-card="scheduling-browser-1"]')?.textContent.includes('CANCELLED'));
  const cancelCall = calls.find(call => call.method === 'PATCH' && call.path.endsWith('/transition'));
  assert.equal(cancelCall.body.status, 'CANCELLED');
  assert.equal(cancelCall.body.reason, 'Buyer cancelled request');
  assert.equal(calls.filter(call => call.method === 'PATCH').length, 1,
    'read-only evaluation must not issue a lifecycle mutation');
  assert.equal(pageErrors.length, 0, `scheduling browser errors: ${pageErrors.join(' | ')}`);

  console.log('L11 Logistics Scheduling workspace browser regression: PASS');
} catch (error) {
  if (stderr) process.stderr.write(stderr);
  throw error;
} finally {
  if (browser) await browser.close();
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 2000)),
  ]);
}

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
  let assignment = {
    id: 'assignment-browser-1',
    server_order_id: 'server-order-browser-1',
    courier_user_id: 'courier-browser-1',
    courier_name: 'Browser Courier',
    status: 'ASSIGNED',
    fulfillment_type: 'delivery',
    fulfillment_status: 'pending',
    destination: 'Test delivery destination',
    tracking_reference: 'TRACK-BROWSER-1',
    dispatch: {
      destination: { address: 'Test delivery destination' },
      locationName: 'DEFAULT',
      scheduledAt: '2026-11-15T09:00:00.000Z',
      trackingReference: 'TRACK-BROWSER-1',
    },
  };
  let assignmentReads = 0;
  let schedulingActivities = [];
  const schedulingReads = [];
  const schedulingCreates = [];
  const schedulingTransitions = [];
  await page.route('**/tenants/test-tenant/logistics/scheduling**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET') {
      schedulingReads.push(url.searchParams.get('locationId'));
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          activities: schedulingActivities,
          timezone: 'Africa/Addis_Ababa',
          state: schedulingActivities.length ? 'READY' : 'EMPTY',
          authority: 'logistics_scheduling_activities',
        }),
      });
      return;
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/evaluate')) {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          evaluation: { evaluation: 'UNKNOWN', reason: 'NO_AUTHORITATIVE_CAPACITY_DECISION' },
          state: 'UNKNOWN',
        }),
      });
      return;
    }
    if (request.method() === 'PATCH' && url.pathname.endsWith('/transition')) {
      const body = request.postDataJSON();
      schedulingTransitions.push(body);
      schedulingActivities = schedulingActivities.map(activity => ({
        ...activity, status: body.status, version: activity.version + 1,
      }));
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ activity: schedulingActivities[0] }),
      });
      return;
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/logistics/scheduling')) {
      const body = request.postDataJSON();
      schedulingCreates.push(body);
      const activity = {
        id: 'scheduling-browser-1',
        activityType: body.activity_type,
        mode: body.mode,
        status: 'REQUESTED',
        requestedStart: body.requested_start,
        requestedEnd: body.requested_end,
        scheduledStart: null,
        scheduledEnd: null,
        timezone: 'Africa/Addis_Ababa',
        relatedFulfillmentId: body.related_fulfillment?.id || null,
        relatedOrderId: body.related_order?.id || null,
        relatedMovementId: body.related_movement?.id || null,
        version: 1,
      };
      schedulingActivities = [activity];
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ activity }),
      });
      return;
    }
    await route.fulfill({ status: 405, body: 'Method not allowed' });
  });
  await page.route('**/tenants/test-tenant/delivery-assignments*', async route => {
    assignmentReads++;
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ assignments: [assignment] }),
    });
  });
  await page.route('**/tenants/test-tenant/memberships', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ memberships: [] }) }));
  const lifecycleCalls = [];
  await page.route('**/tenants/test-tenant/orders/server-order-browser-1/delivery-assignment', async route => {
    const request = route.request();
    const body = request.postDataJSON();
    lifecycleCalls.push({ method: request.method(), body });
    if (request.method() !== 'PATCH') {
      await route.fulfill({ status: 405, body: 'Method not allowed' });
      return;
    }
    assignment = { ...assignment, status: body.action };
    if (body.proof) assignment.proof = body.proof;
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ assignment }),
    });
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
      locationId: null,
      currentStaffRole: 'logistics_courier',
      authUser: { id: 'courier-browser-1' },
      userId: 'courier-browser-1',
      contextualRoles: [{ role: 'logistics_courier', scopeType: 'LOCATION', scopeId: 'loc-browser-1' }],
      authRoles: [],
    });
    state.setOrders([]);
    const logistics = await import('/src/logistics/ui.js');
    logistics.renderLogistics();
  });

  await page.locator('[data-assignment-only="1"]').waitFor();
  await page.locator('#logisticsSchedulingTimezone').filter({ hasText: 'Africa/Addis_Ababa' }).waitFor();
  assert.ok(schedulingReads.includes('loc-browser-1'),
    'location-scoped courier scheduling list must request only its canonical location');
  assert.equal(await page.locator('#logisticsSchedulingRequestForm').count(), 0,
    'courier may view scheduling but cannot create scheduling requests');
  assert.equal(await page.locator('[data-assignment-only="1"]').count(), 1,
    'courier must see an assignment even when its local Order projection is absent');
  assert.match(await page.locator('[data-assignment-only="1"]').innerText(), /server-order-browser-1/);
  const assignmentCardText = await page.locator('[data-assignment-only="1"]').innerText();
  assert.match(assignmentCardText, /Test delivery destination/);
  assert.match(assignmentCardText, /Location: DEFAULT/);
  assert.match(assignmentCardText, /TRACK-BROWSER-1/);
  assert.match(assignmentCardText, /Browser Courier/);
  assert.equal(await page.getByRole('button', { name: 'Accept' }).count(), 1);
  assert.equal(pageErrors.length, 0, `renderLogistics browser errors: ${pageErrors.join(' | ')}`);

  // Assignment-only cards must support the existing canonical lifecycle commands.
  await page.getByRole('button', { name: 'Accept' }).click();
  await page.getByRole('button', { name: 'Start delivery' }).waitFor();
  assert.equal(lifecycleCalls.at(-1).body.action, 'ACCEPTED');
  await page.getByRole('button', { name: 'Start delivery' }).click();
  await page.locator('.delivery-proof-input').waitFor();
  assert.equal(lifecycleCalls.at(-1).body.action, 'OUT_FOR_DELIVERY');
  await page.locator('.delivery-proof-input').fill('proof-browser-1');
  await page.getByRole('button', { name: 'Complete' }).click();
  await page.waitForFunction(() => document.querySelector('[data-assignment-only="1"] .logistics-status')?.textContent === 'DELIVERED');
  assert.equal(lifecycleCalls.at(-1).body.action, 'DELIVERED');
  assert.equal(lifecycleCalls.at(-1).body.proof, 'proof-browser-1');

  // A general settings render must not trigger assignment network reads;
  // opening the workspace and explicit refresh are the refresh boundaries.
  const readsBeforeApply = assignmentReads;
  await page.evaluate(async () => {
    const logistics = await import('/src/logistics/ui.js');
    logistics.applyLogisticsUI();
  });
  assert.equal(assignmentReads, readsBeforeApply, 'applyLogisticsUI must not refetch assignments on every app render');
  const explicitRefresh = page.waitForRequest(request =>
    request.url().includes('/tenants/test-tenant/delivery-assignments')
  );
  await page.getByRole('button', { name: 'Refresh' }).click();
  await explicitRefresh;
  assert.ok(assignmentReads > readsBeforeApply, 'explicit workspace refresh must fetch canonical assignments');

  // Viewer sees operational evidence but no courier lifecycle controls.
  await page.evaluate(async () => {
    const state = await import('/src/state.js');
    state.setConfig({
      ...state.config,
      currentStaffRole: 'logistics_viewer',
      locationId: null,
      contextualRoles: [{ role: 'logistics_viewer', scopeType: 'LOCATION', scopeId: 'loc-browser-1' }],
      authRoles: [],
    });
    const logistics = await import('/src/logistics/ui.js');
    logistics.renderLogistics();
  });
  assert.equal(await page.locator('.delivery-action-btn').count(), 0, 'viewer cannot see courier mutation controls');
  assert.equal(await page.locator('[data-assignment-only="1"]').count(), 1, 'viewer retains assignment visibility');
  await page.locator('#logisticsSchedulingTimezone').filter({ hasText: 'Africa/Addis_Ababa' }).waitFor();
  assert.equal(await page.locator('#logisticsSchedulingRequestForm').count(), 0,
    'viewer may view scheduling but cannot create scheduling requests');

  await page.evaluate(async () => {
    const state = await import('/src/state.js');
    state.setConfig({
      ...state.config,
      currentStaffRole: 'logistics_manager',
      locationId: null,
      contextualRoles: [{ role: 'logistics_manager', scopeType: 'LOCATION', scopeId: 'loc-browser-1' }],
      authRoles: [],
    });
    const logistics = await import('/src/logistics/ui.js');
    logistics.renderLogistics();
  });
  const schedulingForm = page.locator('#logisticsSchedulingRequestForm');
  await schedulingForm.waitFor();
  await schedulingForm.locator('[name="referenceId"]').fill('fulfillment-browser-1');
  await schedulingForm.locator('[name="requestedStart"]').fill('2026-11-16T09:00');
  await schedulingForm.locator('[name="requestedEnd"]').fill('2026-11-16T10:00');
  await schedulingForm.getByRole('button', { name: 'Submit request' }).click();
  await page.waitForFunction(() => document.querySelector('[data-scheduling-card="scheduling-browser-1"]'));
  assert.equal(schedulingCreates.length, 1);
  assert.equal(schedulingCreates[0].timezone, 'Africa/Addis_Ababa');
  assert.equal(schedulingCreates[0].requested_start, '2026-11-16T06:00:00.000Z');
  assert.equal(schedulingCreates[0].requested_end, '2026-11-16T07:00:00.000Z');
  assert.equal(schedulingCreates[0].location_id, 'loc-browser-1');

  // Feasibility evaluation is read-only and UNKNOWN must not enable scheduling.
  await page.locator('[data-scheduled-start="scheduling-browser-1"]').fill('2026-11-16T09:30');
  await page.locator('[data-scheduled-end="scheduling-browser-1"]').fill('2026-11-16T10:30');
  const evaluationResponse = page.waitForResponse(response =>
    response.request().method() === 'POST' && response.url().endsWith('/evaluate'));
  await page.locator('[data-scheduling-evaluate="scheduling-browser-1"]').click();
  await evaluationResponse;
  assert.equal(await page.locator('[data-scheduling-transition="SCHEDULED"]').isDisabled(), true,
    'UNKNOWN feasibility must keep the SCHEDULED transition disabled');
  assert.equal(schedulingTransitions.length, 0, 'evaluation must not mutate the scheduling lifecycle');

  // Terminal transitions require an operator reason before the command is sent.
  await page.locator('[data-scheduling-transition="CANCELLED"]').click();
  assert.equal(schedulingTransitions.length, 0, 'cancellation without a reason must not reach the API');
  await page.locator('[data-scheduling-reason="scheduling-browser-1"]').fill('Buyer cancelled request');
  await page.locator('[data-scheduling-transition="CANCELLED"]').click();
  await page.waitForFunction(() =>
    document.querySelector('[data-scheduling-card="scheduling-browser-1"]')?.textContent.includes('CANCELLED'));
  assert.equal(schedulingTransitions.length, 1);
  assert.equal(schedulingTransitions[0].status, 'CANCELLED');
  assert.equal(schedulingTransitions[0].reason, 'Buyer cancelled request');

  assert.equal(pageErrors.length, 0, `browser runtime errors: ${pageErrors.join(' | ')}`);

  console.log('Phase 13.10.24 Logistics workspace browser regression: PASS');
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

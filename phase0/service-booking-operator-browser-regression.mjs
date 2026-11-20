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
    try {
      if ((await fetch(baseUrl)).status === 200) return;
    } catch {}
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
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    // The deliberate HTTP 409 below is the version-conflict recovery fixture.
    if (message.type() === 'error' && !message.text().includes('409 (Conflict)')) {
      pageErrors.push(message.text());
    }
  });

  const booking = {
    id: 'booking-1',
    service_item_id: 'consultation',
    status: 'REQUESTED',
    version: 1,
    appointment_mode: 'REMOTE',
    requested_start: '2026-11-01T06:00:00.000Z',
    requested_end: '2026-11-01T07:00:00.000Z',
    customer_note: '<img src=x onerror=alert(1)>customer note',
    status_reason: '',
    completion_note: '',
  };
  const calls = [];
  let forceConflict = false;
  let resourcesAvailable = false;
  const resourceAvailabilityCalls = [];
  await page.route('**/tenants/test-tenant/service-resources**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    resourceAvailabilityCalls.push({ method: request.method(), path: url.pathname });
    if (url.pathname.endsWith('/availability')) {
      if (request.method() !== 'GET') {
        await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Method not allowed' } }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          availability: {
            state: 'DECLARED',
            version: 1,
            timeZone: 'Africa/Addis_Ababa',
            effectiveTimeZone: 'Africa/Addis_Ababa',
            workingHours: [{ weekday: 1, startTime: '09:00', endTime: '17:00' }],
            exceptions: [],
          },
        }),
      });
      return;
    }
    if (request.method() !== 'GET') {
      await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Method not allowed' } }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ resources: resourcesAvailable ? [{ id: 'resource-room-1', name: 'Room 1', resourceType: 'ROOM', status: 'ACTIVE' }] : [], state: 'READY', authority: 'service_resource_registry' }),
    });
  });

  await page.route('**/tenants/test-tenant/orders/order-1/service-bookings**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push({
      method: request.method(),
      url: url.pathname,
      idempotencyKey: request.headers()['idempotency-key'] || '',
      body: request.postDataJSON?.() || null,
    });
    if (request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ order_id: 'order-1', bookings: [{ ...booking }] }) });
      return;
    }
    if (request.method() === 'PATCH') {
      if (forceConflict) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Version conflict' } }) });
        return;
      }
      assert.equal(request.headers()['idempotency-key'].startsWith('service-booking-ui-'), true);
      const body = request.postDataJSON();
      assert.equal(body.expected_version, 1);
      assert.equal(body.status, 'ACCEPTED');
      booking.status = body.status;
      booking.version = 2;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ booking: { ...booking } }) });
      return;
    }
    await route.fulfill({ status: 405, body: 'Method not allowed' });
  });

  // Use a minimal shell but load the production module and its real imports from app/src.
  await page.route(baseUrl + '/', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><head><meta charset="utf-8"></head><body><button id="navAppointments" style="display:none">Appointments</button><section id="tab-appointments" style="display:none"><div id="appointmentsWorkspace"></div></section><main id="test-root"></main></body></html>',
  }));
  await page.goto(baseUrl);
  await page.evaluate(async () => {
    const state = await import('/src/state.js');
    state.setConfig({
      ...state.config,
      chatId: 'test-tenant',
      sessionToken: 'test-session',
      syncUrl: window.location.origin,
      currentStaffRole: 'owner',
      contextualRoles: [],
    });
    state.setProducts([{ id: 'service-1', item_type: 'service', name: 'Consultation' }]);
    const logisticsUI = await import('/src/logistics/ui.js');
    logisticsUI.applyLogisticsUI();
    const ownerWithServices = document.getElementById('navAppointments').style.display !== 'none';
    state.setConfig({ ...state.config, currentStaffRole: 'cashier', contextualRoles: [
      { role: 'service_provider', scopeType: 'RESOURCE', scopeId: 'resource-room-1' },
    ] });
    logisticsUI.applyLogisticsUI();
    const scopedProvider = document.getElementById('navAppointments').style.display !== 'none';
    state.setConfig({ ...state.config, currentStaffRole: 'cashier', contextualRoles: [
      { role: 'service_provider', scopeType: 'ORGANIZATION', scopeId: 'test-tenant' },
    ] });
    logisticsUI.applyLogisticsUI();
    const unscopedProvider = document.getElementById('navAppointments').style.display !== 'none';
    state.setConfig({ ...state.config, currentStaffRole: 'owner', contextualRoles: [] });
    state.setProducts([]);
    logisticsUI.applyLogisticsUI();
    const ownerWithoutServices = document.getElementById('navAppointments').style.display !== 'none';
    state.setProducts([{ id: 'service-1', item_type: 'service', name: 'Consultation' }]);
    state.setConfig({ ...state.config, currentStaffRole: 'owner', contextualRoles: [] });
    logisticsUI.applyLogisticsUI();
    state.setOrders([{
      id: 'local-order-1',
      server_order_id: 'order-1',
      items: [{ item_id: 'service-1', item_type: 'service' }],
    }]);
    window.__appointmentsVisibility = { ownerWithServices, scopedProvider, unscopedProvider, ownerWithoutServices };
    const workspace = await import('/src/logistics/service-bookings.js');
    document.querySelector('#test-root').innerHTML = workspace.serviceBookingsWorkspaceShell();
    workspace.mountServiceBookingsWorkspace(document);
  });
  const visibility = await page.evaluate(() => window.__appointmentsVisibility);
  assert.deepEqual(visibility, {
    ownerWithServices: true,
    scopedProvider: true,
    unscopedProvider: false,
    ownerWithoutServices: false,
  }, 'Appointments visibility follows service offerings and resource-scoped provider context');

  await page.locator('.service-booking-card').waitFor();
  assert.equal(await page.locator('#serviceBookingsStatus').getAttribute('data-state'), 'READY',
    'manager appointment workspace exposes an explicit ready state');
  await page.locator('#serviceResourceForm').waitFor();
  await page.locator('#serviceResourcesStatus').filter({ hasText: 'No service resources yet' }).waitFor();

  assert.equal(await page.locator('.service-booking-action').count(), 3, 'owner sees valid REQUESTED transitions');
  assert.equal(await page.locator('.service-booking-card img').count(), 0, 'customer note is escaped rather than parsed as markup');
  assert.match(await page.locator('.service-booking-card').innerText(), /<img src=x onerror=alert\(1\)>customer note/);

  // Cancel a reason-required inline action form: it must not send a mutation.
  await page.getByRole('button', { name: 'REJECTED' }).click();
  await page.locator('.service-booking-action-form').waitFor();
  assert.equal(await page.locator('.service-booking-action-form textarea').evaluate(el => el === document.activeElement), true,
    'opening a reason form moves keyboard focus to its required input');
  const reasonFormBox = await page.locator('.service-booking-action-form').boundingBox();
  assert.ok(reasonFormBox && reasonFormBox.width <= 375, 'inline action form fits the mobile viewport');
  await page.locator('.service-booking-action-form .service-booking-action-cancel').click();
  assert.equal(calls.filter(call => call.method === 'PATCH').length, 0, 'cancelled inline reason form does not mutate booking');

  // A successful transition sends the current version and idempotency key, then reloads canonical state.
  await page.getByRole('button', { name: 'ACCEPTED' }).click();
  assert.equal(await page.locator('.service-booking-action-status').getAttribute('aria-live'), 'polite',
    'inline transition feedback is announced to assistive technology');
  await page.locator('.service-booking-action-form [type="submit"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('.service-booking-card .logistics-status').filter({ hasText: 'ACCEPTED' }).waitFor();
  const patch = calls.find(call => call.method === 'PATCH');
  assert.ok(patch, 'transition sends PATCH');
  assert.equal(patch.body.expected_version, 1);
  assert.match(patch.idempotencyKey, /^service-booking-ui-/);
  assert.ok(calls.filter(call => call.method === 'GET').length >= 2, 'successful transition refreshes canonical booking state');

  // Non-operator roles see the projection but no lifecycle controls.
  await page.evaluate(async () => {
    const state = await import('/src/state.js');
    state.setConfig({ ...state.config, currentStaffRole: 'cashier', contextualRoles: [] });
    const workspace = await import('/src/logistics/service-bookings.js');
    await workspace.refreshServiceBookings(document);
  });
  assert.equal(await page.locator('.service-booking-action').count(), 0, 'cashier has no operator lifecycle controls');

  // Restore operator role, force a version conflict, and verify the control recovers for retry.
  await page.evaluate(async () => {
    const state = await import('/src/state.js');
    state.setConfig({ ...state.config, currentStaffRole: 'owner' });
    const workspace = await import('/src/logistics/service-bookings.js');
    await workspace.refreshServiceBookings(document);
  });
  forceConflict = true;
  resourcesAvailable = true;
  const restoredRole = await page.evaluate(async () => {
    const state = await import('/src/state.js');
    state.setConfig({ ...state.config, currentStaffRole: 'owner', contextualRoles: [] });
    return state.config.currentStaffRole;
  });
  assert.equal(restoredRole, 'owner', 'resource availability controls require the restored owner role');
  await page.locator('#serviceBookingsRefresh').click();
  await page.locator('[data-resource-id="resource-room-1"] .service-resource-availability').waitFor();

  // Declared-hours assessment uses the resource timezone and does not create a booking or mutate schedule state.
  await page.locator('.service-resource-availability').click();
  await page.locator('.service-window-start').fill('2026-11-16T09:00');
  await page.locator('.service-window-end').fill('2026-11-16T10:00');
  await page.locator('.service-window-assess').click();
  const assessmentResult = page.locator('.service-window-assessment-result');
  await assessmentResult.filter({ hasText: 'Within declared working hours' }).waitFor();
  assert.match(await assessmentResult.innerText(), /Existing appointments and resource commitments were not checked; availability is unconfirmed/);
  await page.locator('.service-window-start').fill('2026-11-16T06:00');
  await page.locator('.service-window-end').fill('2026-11-16T07:00');
  await page.locator('.service-window-assess').click();
  await assessmentResult.filter({ hasText: 'Outside declared working hours' }).waitFor();
  assert.equal(resourceAvailabilityCalls.filter(call => call.path.endsWith('/availability') && call.method !== 'GET').length, 0,
    'assessment is a read-only projection and does not persist schedule or booking changes');

  await page.getByRole('button', { name: 'CONFIRMED' }).click();
  await page.locator('.service-booking-action-form select[name="service_resource_id"]').selectOption('resource-room-1');
  await page.locator('.service-booking-action-form [type="submit"]').click();
  await page.waitForFunction(() => {
    const submit = document.querySelector('.service-booking-action-form [type="submit"]');
    return Boolean(submit && !submit.disabled);
  }, null, { timeout: 3000 });
  assert.equal(await page.locator('.service-booking-action-form [type="submit"]').isDisabled(), false,
    'failed version-conflict mutation re-enables the inline form for retry');
  assert.ok(pageErrors.length === 0, `browser runtime errors: ${pageErrors.join(' | ')}`);

  console.log('Service booking operator browser regression: PASS');
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

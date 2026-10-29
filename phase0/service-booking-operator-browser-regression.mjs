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
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') pageErrors.push(message.text());
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
    body: '<!doctype html><html><head><meta charset="utf-8"></head><body><main id="test-root"></main></body></html>',
  }));
  await page.goto(baseUrl);
  await page.evaluate(async () => {
    const state = await import('/app/src/state.js');
    state.setConfig({
      ...state.config,
      chatId: 'test-tenant',
      sessionToken: 'test-session',
      syncUrl: window.location.origin,
      currentStaffRole: 'owner',
      contextualRoles: [],
    });
    state.setProducts([{ id: 'service-1', item_type: 'service', name: 'Consultation' }]);
    state.setOrders([{
      id: 'local-order-1',
      server_order_id: 'order-1',
      items: [{ item_id: 'service-1', item_type: 'service' }],
    }]);
    const workspace = await import('/app/src/logistics/service-bookings.js');
    document.querySelector('#test-root').innerHTML = workspace.serviceBookingsWorkspaceShell();
    workspace.mountServiceBookingsWorkspace(document);
  });

  await page.locator('.service-booking-card').waitFor();
  assert.equal(await page.locator('.service-booking-action').count(), 3, 'owner sees valid REQUESTED transitions');
  assert.equal(await page.locator('.service-booking-card img').count(), 0, 'customer note is escaped rather than parsed as markup');
  assert.match(await page.locator('.service-booking-card').innerText(), /<img src=x onerror=alert\(1\)>customer note/);

  // Cancel a reason-required transition: it must not send a mutation.
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'REJECTED' }).click();
  assert.equal(calls.filter(call => call.method === 'PATCH').length, 0, 'cancelled reason prompt does not mutate booking');

  // A successful transition sends the current version and idempotency key, then reloads canonical state.
  await page.getByRole('button', { name: 'ACCEPTED' }).click();
  await page.getByText('ACCEPTED', { exact: true }).waitFor();
  const patch = calls.find(call => call.method === 'PATCH');
  assert.ok(patch, 'transition sends PATCH');
  assert.equal(patch.body.expected_version, 1);
  assert.match(patch.idempotencyKey, /^service-booking-ui-/);
  assert.ok(calls.filter(call => call.method === 'GET').length >= 2, 'successful transition refreshes canonical booking state');

  // Non-operator roles see the projection but no lifecycle controls.
  await page.evaluate(async () => {
    const state = await import('/app/src/state.js');
    state.setConfig({ ...state.config, currentStaffRole: 'cashier', contextualRoles: [] });
    const workspace = await import('/app/src/logistics/service-bookings.js');
    await workspace.refreshServiceBookings(document);
  });
  assert.equal(await page.locator('.service-booking-action').count(), 0, 'cashier has no operator lifecycle controls');

  // Restore operator role, force a version conflict, and verify the control recovers for retry.
  await page.evaluate(async () => {
    const state = await import('/app/src/state.js');
    state.setConfig({ ...state.config, currentStaffRole: 'owner' });
    const workspace = await import('/app/src/logistics/service-bookings.js');
    await workspace.refreshServiceBookings(document);
  });
  forceConflict = true;
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'CONFIRMED' }).click();
  await page.locator('.service-booking-action[data-target="CONFIRMED"]').waitFor();
  assert.equal(await page.locator('.service-booking-action[data-target="CONFIRMED"]').isDisabled(), false,
    'failed version-conflict mutation re-enables the control for refresh/retry');
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

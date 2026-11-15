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
  page.on('response', response => {
    const expectedProviderQueueFailure = response.url().includes('/service-provider/bookings')
      && [403, 503].includes(response.status());
    if (response.status() >= 400 && response.status() !== 409 && !expectedProviderQueueFailure) {
      pageErrors.push('HTTP ' + response.status() + ' ' + response.url());
    }
  });
  page.on('console', message => {
    // Ignore only network errors deliberately induced by this regression:
    // version conflict, provider access denial/unavailability, and offline.
    const text = message.text();
    const expectedProviderQueueFailure =
      (providerQueueScenario === 'DENIED' && text.includes('403 (Forbidden)'))
      || (providerQueueScenario === 'ERROR' && text.includes('503 (Service Unavailable)'))
      || (providerQueueScenario === 'OFFLINE' && text.includes('net::ERR_INTERNET_DISCONNECTED'));
    if (message.type() === 'error'
        && !text.includes('409 (Conflict)')
        && !expectedProviderQueueFailure) {
      pageErrors.push(text);
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
  let providerMode = false;
  let providerQueueScenario = 'READY';
  let resourceSelectionMode = false;
  // The logistics shell also refreshes its canonical delivery-assignment
  // projection. Keep this focused service-booking browser fixture isolated
  // from that unrelated endpoint rather than allowing a noisy 404.
  await page.route('**/tenants/test-tenant/delivery-assignments*', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ assignments: [] }),
    }));

  await page.route('**/tenants/test-tenant/service-resources**', async route => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Method not allowed' } }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        resources: providerMode ? [{
          id: 'provider-resource-1', name: 'Provider One', resourceType: 'PROVIDER',
          status: 'ACTIVE', version: 1, organizationId: 'test-org',
          locationId: null, serviceItemId: null,
        }] : resourceSelectionMode ? [{
          id: 'resource-room-1', name: 'Consultation Room', resourceType: 'FACILITY',
          status: 'ACTIVE', version: 1, organizationId: 'test-org',
          locationId: null, serviceItemId: 'consultation',
        }] : [],
        state: 'READY', authority: 'service_resource_registry',
        scope: providerMode ? 'ASSIGNED_RESOURCES' : 'ORGANIZATION',
      }),
    });
  });

  await page.route('**/tenants/test-tenant/service-provider/bookings', async route => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Method not allowed' } }) });
      return;
    }
    if (providerQueueScenario === 'DENIED') {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SERVICE_PROVIDER_ASSIGNMENT_REQUIRED' } }) });
      return;
    }
    if (providerQueueScenario === 'ERROR') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Temporarily unavailable' } }) });
      return;
    }
    if (providerQueueScenario === 'OFFLINE') {
      await route.abort('internetdisconnected');
      return;
    }
    const bookings = providerQueueScenario === 'EMPTY' ? [] : providerQueueScenario === 'MULTI' ? [{
      id: 'provider-booking-later', service_item_id: 'consultation', status: 'CONFIRMED',
      order_id: 'provider-order-later', service_resource_name: 'Provider One',
      commitment_starts_at: '2026-11-16T08:00:00.000Z',
      commitment_ends_at: '2026-11-16T09:00:00.000Z',
      customer_note: 'Later appointment',
    }, {
      id: 'provider-booking-earlier', service_item_id: 'consultation', status: 'CONFIRMED',
      order_id: 'provider-order-earlier', service_resource_name: 'Provider One',
      commitment_starts_at: '2026-11-16T06:00:00.000Z',
      commitment_ends_at: '2026-11-16T07:00:00.000Z',
      customer_note: 'Earlier appointment',
    }] : [{
      id: 'provider-booking-1', service_item_id: 'consultation', status: 'CONFIRMED',
      order_id: 'provider-order-1', service_resource_name: 'Provider One',
      commitment_starts_at: '2026-11-16T06:00:00.000Z',
      commitment_ends_at: '2026-11-16T07:00:00.000Z',
      customer_note: 'Please call on arrival',
    }];
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ bookings, state: bookings.length ? 'READY' : 'EMPTY', scope: 'ACTIVE_ASSIGNED_RESOURCES' }),
    });
  });

  await page.route('**/service-resources/provider-resource-1/availability', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          availability: {
            state: 'DECLARED', timeZone: 'Africa/Addis_Ababa',
            workingHours: [], exceptions: [], version: 1,
          },
          state: 'DECLARED', authority: 'service_resource_availability',
        }),
      });
      return;
    }
    await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Method not allowed' } }) });
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
    body: '<!doctype html><html><head><meta charset="utf-8"></head><body><main id="test-root"></main></body></html>',
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
    state.setOrders([{
      id: 'local-order-1',
      server_order_id: 'order-1',
      items: [{ item_id: 'service-1', item_type: 'service' }],
    }]);
    const workspace = await import('/src/logistics/service-bookings.js');
    document.querySelector('#test-root').innerHTML = workspace.serviceBookingsWorkspaceShell();
    workspace.mountServiceBookingsWorkspace(document);
  });

  await page.locator('.service-booking-card').waitFor();
  await page.locator('#serviceResourceForm').waitFor();
  await page.locator('#serviceResourcesStatus').filter({ hasText: 'No service resources yet' }).waitFor();

  assert.equal(await page.locator('.service-booking-action').count(), 3, 'owner sees valid REQUESTED transitions');
  assert.equal(await page.locator('.service-booking-card img').count(), 0, 'customer note is escaped rather than parsed as markup');
  assert.match(await page.locator('.service-booking-card').innerText(), /<img src=x onerror=alert\(1\)>customer note/);

  // Cancel a reason-required transition: it must not send a mutation.
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'REJECTED' }).click();
  assert.equal(calls.filter(call => call.method === 'PATCH').length, 0, 'cancelled reason prompt does not mutate booking');

  // A successful transition sends the current version and idempotency key, then reloads canonical state.
  await page.getByRole('button', { name: 'ACCEPTED' }).click();
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
  resourceSelectionMode = true;
  page.once('dialog', dialog => dialog.type() === 'prompt' ? dialog.accept('1') : dialog.accept());
  await page.getByRole('button', { name: 'CONFIRMED' }).click();
  await page.waitForFunction(() => {
    const button = document.querySelector('.service-booking-action[data-target="CONFIRMED"]');
    return Boolean(button && !button.disabled);
  }, null, { timeout: 3000 });
  assert.equal(await page.locator('.service-booking-action[data-target="CONFIRMED"]').isDisabled(), false,
    'failed version-conflict mutation re-enables the control for refresh/retry');
  const confirmAttempt = calls.filter(call => call.method === 'PATCH').at(-1);
  assert.equal(confirmAttempt.body.status, 'CONFIRMED');
  assert.equal(confirmAttempt.body.service_resource_id, 'resource-room-1',
    'operator confirmation must submit the selected service resource');
  assert.ok(pageErrors.length === 0, `browser runtime errors: ${pageErrors.join(' | ')}`);


  // Provider workspace is resource-scoped: no booking lifecycle or resource administration.
  providerMode = true;
  await page.evaluate(async () => {
    const state = await import('/src/state.js');
    state.setConfig({
      ...state.config,
      currentStaffRole: 'staff',
      contextualRoles: [{ role: 'service_provider', scopeType: 'RESOURCE', scopeId: 'provider-resource-1' }],
    });
    const workspace = await import('/src/logistics/service-bookings.js');
    document.querySelector('#test-root').innerHTML = workspace.serviceBookingsWorkspaceShell();
    workspace.mountServiceBookingsWorkspace(document);
  });
  await page.locator('.service-resource-card').filter({ hasText: 'Provider One' }).waitFor();
  assert.equal(await page.locator('.service-booking-card').count(), 1, 'Provider sees only the assigned-resource appointment projection');
  assert.match(await page.locator('#serviceBookingsList').innerText(), /Provider One|Please call on arrival/);
  assert.equal(await page.locator('.service-booking-action').count(), 0, 'Provider appointment queue is read-only');
  assert.equal(await page.locator('#serviceResourceForm').count(), 0, 'Provider cannot create resources');
  assert.equal(await page.locator('.service-resource-rename').count(), 0, 'Provider cannot rename resources');
  assert.equal(await page.locator('.service-resource-toggle').count(), 0, 'Provider cannot activate or deactivate resources');
  assert.equal(await page.locator('.service-resource-providers').count(), 0, 'Provider cannot assign other providers');
  assert.equal(await page.locator('.service-resource-availability').count(), 1, 'Provider can configure assigned resource availability');
  await page.locator('.service-resource-availability').click();
  await page.locator('.service-resource-availability-panel').waitFor();
  await page.waitForFunction(() => {
    const panel = document.querySelector('.service-resource-availability-panel');
    return panel && /declaration only|Declared|Empty|Could not load/i.test(panel.innerText);
  }, null, { timeout: 5000 });
  assert.match(await page.locator('.service-resource-availability-panel').innerText(), /declaration only|Declared/i);

  // Verify the provider appointment queue's complete server-state presentation.
  const refreshProviderQueue = async () => page.evaluate(async () => {
    const workspace = await import('/src/logistics/service-bookings.js');
    await workspace.refreshServiceBookings(document);
  });
  providerQueueScenario = 'EMPTY';
  await refreshProviderQueue();
  assert.equal(await page.locator('#serviceBookingsStatus').getAttribute('data-state'), 'EMPTY',
    'an authoritative empty provider queue is distinct from loading or failure');
  assert.equal(await page.locator('.service-booking-card').count(), 0,
    'empty provider queue does not retain stale appointment cards');

  providerQueueScenario = 'DENIED';
  await refreshProviderQueue();
  assert.equal(await page.locator('#serviceBookingsStatus').getAttribute('data-state'), 'DENIED',
    'revoked or missing provider assignment is presented as denied');
  assert.equal(await page.locator('.service-booking-card').count(), 0,
    'denied provider queue clears previously visible appointment details');

  providerQueueScenario = 'ERROR';
  await refreshProviderQueue();
  assert.equal(await page.locator('#serviceBookingsStatus').getAttribute('data-state'), 'ERROR',
    'server failure is not represented as an empty appointment queue');
  assert.equal(await page.locator('.service-booking-card').count(), 0,
    'failed provider refresh does not leave stale appointment details visible');

  providerQueueScenario = 'OFFLINE';
  await context.setOffline(true);
  await refreshProviderQueue();
  assert.equal(await page.locator('#serviceBookingsStatus').getAttribute('data-state'), 'UNKNOWN_STALE',
    'offline provider refresh is explicitly unknown/stale rather than successful or empty');
  assert.equal(await page.locator('.service-booking-card').count(), 0,
    'offline provider refresh clears unverified appointment details');
  await context.setOffline(false);
  providerQueueScenario = 'MULTI';
  await refreshProviderQueue();
  assert.equal(await page.locator('.service-booking-card').count(), 2,
    'provider queue retains all confirmed appointments');
  const orderedProviderCards = page.locator('.service-booking-card');
  assert.match(await orderedProviderCards.nth(0).innerText(), /Earlier appointment/,
    'provider queue prioritizes the earliest committed appointment');
  assert.match(await orderedProviderCards.nth(1).innerText(), /Later appointment/,
    'later appointments follow earlier commitments');
  assert.equal(await orderedProviderCards.nth(0).locator('time[datetime]').count(), 2,
    'appointment start and end are exposed as semantic machine-readable times');

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

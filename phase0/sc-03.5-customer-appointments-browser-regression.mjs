import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const chatId = 'sc035-browser-store';
const marketplaceOrderId = 'sc035-browser-marketplace-order';

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
    try { if ((await fetch(baseUrl + '/store.html')).status === 200) return; } catch {}
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
  const calls = [];
  let feasibility = 'FEASIBLE';
  let offlineFeasibility = false;
  let staleCancelOnce = true;
  let denyServiceBookingReads = false;
  let bookings = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.Telegram = { WebApp: {
      initData: 'signed-telegram-init-data-fixture',
      initDataUnsafe: { user: { id: 778899, first_name: 'Buyer', username: 'buyer_fixture' } },
      ready() {}, expand() {},
    } };
  });

  await page.route('**/api/telegram-storefront/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    const body = request.postDataJSON?.() || null;
    calls.push({ method, path, body, headers: request.headers() });
    const json = (status, payload) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(payload),
    });

    if (path.endsWith('/buyer-session') && method === 'POST') {
      return json(200, { buyer: { telegramUserId: '778899' } });
    }
    if (path === `/api/telegram-storefront/${chatId}` && method === 'GET') {
      return json(200, { storefront: {
        channelType: 'telegram', status: 'PUBLISHED',
        enabledCapabilities: ['browse', 'checkout', 'order_status'],
      } });
    }
    if (path.endsWith('/orders') && method === 'GET') {
      return json(200, { orders: [{
        marketplace_order_id: marketplaceOrderId,
        status: 'confirmed', total_minor: 25000, currency: 'ETB',
        sellers: [{ seller_order_id: 'seller-order-1', status: 'confirmed' }],
      }] });
    }
    if (path.endsWith('/service-feasibility') && method === 'GET') {
      if (offlineFeasibility) return route.abort('internetdisconnected');
      return json(200, { feasibility: {
        state: feasibility, reasonCode: feasibility === 'FEASIBLE' ? 'DECLARED_HOURS_AND_COMMITMENTS_MATCH' : 'ALL_MATCHING_RESOURCES_COMMITTED',
        timeZone: 'Africa/Addis_Ababa', confirmsAvailability: false, reservesResource: false,
      } });
    }
    if (path.endsWith('/service-bookings') && method === 'GET') {
      if (denyServiceBookingReads) return json(403, { error: { message: 'Appointment access is unavailable for this store.' } });
      return json(200, {
        order: { marketplaceOrderId, serviceLines: [{ item_id: 'consultation', name: 'Consultation', item_type: 'service' }] },
        bookings,
      });
    }
    if (path.endsWith('/service-bookings') && method === 'POST') {
      assert.equal(request.headers()['idempotency-key']?.length > 0, true);
      assert.equal(body.service_item_id, 'consultation');
      assert.equal(body.appointment_mode, 'REMOTE');
      const booking = {
        id: 'customer-booking-1', service_item_id: 'consultation',
        requested_start: body.requested_start, requested_end: body.requested_end,
        appointment_mode: body.appointment_mode, customer_note: body.customer_note,
        status: 'REQUESTED', version: 1, service_resource_name: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      bookings = [booking];
      return json(201, { booking, bookings, message: 'Appointment request received' });
    }
    if (path.endsWith('/cancel') && method === 'POST') {
      if (staleCancelOnce) {
        staleCancelOnce = false;
        bookings = bookings.map(item => ({ ...item, status: 'ACCEPTED', version: 2 }));
        return json(409, { error: { message: 'Booking version is stale.' } });
      }
      assert.equal(body.expected_version, 2);
      bookings = bookings.map(item => ({ ...item, status: 'CANCELLED', version: 3 }));
      return json(200, { booking: bookings[0], message: 'Appointment cancelled' });
    }
    return json(404, { error: { message: `Unexpected fixture route: ${method} ${path}` } });
  });

  await page.route('**/catalog/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      products: [{
        id: 'consultation', name: 'Consultation', price: 25000,
        item_type: 'service', marketplace_listed: true,
      }],
      branding: { currency: 'ETB' }, seller_name: 'SC-03.5 Test Provider',
    }),
  }));

  await page.goto(`${baseUrl}/store.html?store=${encodeURIComponent(chatId)}`);
  await page.getByRole('button', { name: 'My orders' }).waitFor();
  await page.getByRole('button', { name: 'My orders' }).click();
  await page.getByRole('button', { name: 'Appointments' }).click();
  await page.locator('#customerAppointmentForm').waitFor();

  const appointmentForm = page.locator('#customerAppointmentForm');
  for (const label of ['Service', 'Start (your device local time)', 'End (your device local time)', 'Appointment type', 'Note (optional)']) {
    assert.equal(await appointmentForm.getByLabel(label).count(), 1, `appointment field has accessible label: ${label}`);
  }
  assert.equal(await appointmentForm.locator('[role="status"]').count(), 1,
    'feasibility feedback is exposed as a live status region');
  assert.equal(await appointmentForm.locator('[role="alert"]').count(), 1,
    'request errors are exposed as an alert region');
  const focusState = async () => page.evaluate(() => ({
    name: document.activeElement?.getAttribute('name') || '',
    id: document.activeElement?.id || '',
    type: document.activeElement?.getAttribute('type') || '',
  }));
  await appointmentForm.locator('[name="service_item_id"]').focus();
  await page.keyboard.press('Tab');
  assert.equal((await focusState()).name, 'requested_start',
    'keyboard navigation moves from service to the first time field');
  await appointmentForm.locator('[name="requested_start"]').focus();
  assert.equal((await focusState()).name, 'requested_start', 'start time field is keyboard focusable');
  await appointmentForm.locator('[name="requested_end"]').focus();
  assert.equal((await focusState()).name, 'requested_end', 'end time field is keyboard focusable');
  // Native datetime-local controls can expose segmented sub-fields as tab stops.
  const tabUntil = async predicate => {
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.keyboard.press('Tab');
      if (predicate(await focusState())) return true;
    }
    return false;
  };
  assert.equal(await tabUntil(active => active.name === 'appointment_mode'), true,
    'keyboard navigation moves from end time to appointment mode');
  assert.equal(await tabUntil(active => active.name === 'customer_note'), true,
    'keyboard navigation moves to the optional note');
  assert.equal(await tabUntil(active => active.id === 'checkAppointmentFeasibility'), true,
    'keyboard navigation reaches feasibility check');
  assert.equal(await tabUntil(active => active.type === 'submit'), true,
    'keyboard navigation reaches request submission');

  await page.locator('[name="requested_start"]').fill('2027-01-20T09:00');
  await page.locator('[name="requested_end"]').fill('2027-01-20T10:00');
  await page.locator('[name="appointment_mode"]').selectOption('REMOTE');
  await page.locator('[name="customer_note"]').fill('Please call first.');
  await page.getByRole('button', { name: 'Check time' }).click();
  await page.getByText(/Likely feasible based on declared hours/).waitFor();
  assert.match(await page.locator('#appointmentFeasibilityState').innerText(), /not a reservation/i);

  await page.getByRole('button', { name: 'Send appointment request' }).click();
  await page.getByText('REQUESTED', { exact: true }).waitFor();
  assert.equal(calls.filter(call => call.method === 'POST' && call.path.endsWith('/service-bookings')).length, 1,
    'one customer request is submitted through the existing service booking authority');
  const createCall = calls.find(call => call.method === 'POST' && call.path.endsWith('/service-bookings'));
  assert.equal(createCall.body.requested_start, '2027-01-20T09:00:00.000Z');
  assert.equal(createCall.body.requested_end, '2027-01-20T10:00:00.000Z');

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Cancel request' }).click();
  await page.getByText('ACCEPTED', { exact: true }).waitFor();
  await page.getByText(/current status has been refreshed/i).waitFor();
  assert.equal(calls.filter(call => call.method === 'GET' && call.path.endsWith('/service-bookings')).length >= 2, true,
    'stale cancellation refreshes the authoritative booking projection');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Cancel request' }).click();
  await page.getByText('CANCELLED', { exact: true }).waitFor();
  assert.equal(calls.filter(call => call.method === 'POST' && call.path.endsWith('/cancel')).length, 2,
    'eligible buyer cancellation retries against the refreshed booking version');

  feasibility = 'CONFLICT';
  await page.locator('[name="requested_start"]').fill('2027-01-21T09:00');
  await page.locator('[name="requested_end"]').fill('2027-01-21T10:00');
  await page.getByRole('button', { name: 'Check time' }).click();
  await page.getByText(/No matching resource currently fits this time/).waitFor();
  await page.getByRole('button', { name: 'Send appointment request' }).click();
  assert.equal(calls.filter(call => call.method === 'POST' && call.path.endsWith('/service-bookings')).length, 1,
    'known conflict blocks a customer request until another time is checked');

  feasibility = 'UNKNOWN';
  await page.locator('[name="requested_start"]').fill('2027-01-22T09:00');
  await page.locator('[name="requested_end"]').fill('2027-01-22T10:00');
  await page.getByRole('button', { name: 'Check time' }).click();
  await page.getByText(/Availability is unknown/).waitFor();
  assert.equal(await page.locator('#appointmentFeasibilityState').getAttribute('data-state'), 'UNKNOWN');

  // Exercise the narrow Telegram WebApp viewport and the explicit offline retry state.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(50);
  const mobileMetrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert.ok(mobileMetrics.content <= mobileMetrics.viewport + 1,
    `appointment journey overflows narrow mobile viewport: ${JSON.stringify(mobileMetrics)}`);

  offlineFeasibility = true;
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Check time' }).click();
  await page.getByText(/Offline: time feasibility cannot be checked/).waitFor();
  assert.equal(await page.locator('#appointmentFeasibilityState').getAttribute('data-state'), 'UNKNOWN');
  await context.setOffline(false);
  offlineFeasibility = false;

  // Product-only orders must not expose an appointment request form.
  const originalRoute = calls.length;
  await page.route('**/api/telegram-storefront/**/service-bookings', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          order: { marketplaceOrderId, serviceLines: [] },
          bookings: [],
        }),
      });
    }
    return route.fallback();
  });
  await page.getByRole('button', { name: 'Appointments' }).click();
  await page.getByText(/This order has no appointment-based service lines/).waitFor();
  assert.equal(await page.locator('#customerAppointmentForm').count(), 0,
    'product-only order must not show an appointment request form');
  assert.ok(calls.length >= originalRoute);

  // A server-side denial must be visible and must not leave a usable request form.
  await page.unroute('**/api/telegram-storefront/**/service-bookings');
  denyServiceBookingReads = true;
  await page.locator('[data-appointment-order]').click();
  await page.getByText('Appointment access is unavailable for this store.').waitFor();
  assert.equal(await page.locator('#customerAppointmentForm').count(), 0,
    'denied appointment access does not expose a request form');

  assert.equal(pageErrors.length, 0, `browser runtime errors: ${pageErrors.join(' | ')}`);

  console.log('SC-03.5 customer appointment browser regression: PASS');
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

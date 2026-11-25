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
  // Keep browser requests under Playwright routing; the app's service worker can otherwise bypass page.route().
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const dismissSettingsOverlay = async () => {
    // Keep the app-shell modal DOM intact for its existing handlers, but hide it from this Workforce-only journey.
    const modal = page.locator('#settingsModal');
    if (await modal.count()) await modal.evaluate(element => {
      element.classList.remove('open');
      element.style.display = 'none';
      element.setAttribute('aria-hidden', 'true');
    });
  };
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
  let engagement = null;
  let profile = null;
  let locationAssignment = null;
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));

  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const workforcePath = /^\/tenants\/[^/]+\/workforce\//.test(url.pathname);
    const locationsPath = /^\/tenants\/[^/]+\/locations$/.test(url.pathname);
    if (!workforcePath && !locationsPath) {
      await route.continue();
      return;
    }
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
    if (pathname.endsWith('/locations') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ locations: [
        { id: 'location-synthetic-1', name: 'Addis Ababa Branch', status: 'ACTIVE' },
      ] }) });
      return;
    }
    if (pathname.endsWith('/members') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [member] }) });
      return;
    }
    if (pathname.endsWith('/profiles') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: profile ? [profile] : [] }) });
      return;
    }
    if (pathname.endsWith('/profiles') && method === 'POST') {
      assert.equal(body.member_id, member.id, 'professional profile must belong to the selected member');
      assert.deepEqual(body.skills, ['Consultation','Customer care']);
      assert.deepEqual(body.qualifications, ['Certificate in Retail Operations']);
      assert.deepEqual(body.languages, ['Amharic','English']);
      assert.deepEqual(body.service_capabilities, ['Sales','Returns']);
      assert.equal(body.visibility, 'ORGANIZATION');
      assert.ok(body.effective_from);
      assert.match(request.headers()['idempotency-key'] || '', /^workforce-ui-/);
      profile = { id: 'profile-synthetic-1', member_id: member.id, ...body, version: 1 };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ record: profile }) });
      return;
    }
    if (pathname.endsWith('/profiles/profile-synthetic-1') && method === 'PATCH') {
      assert.equal(body.expected_version, profile.version, 'profile update must use optimistic concurrency');
      profile = { ...profile, ...body, version: profile.version + 1 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: profile }) });
      return;
    }
    if (pathname.endsWith('/assignments') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: locationAssignment ? [locationAssignment] : [] }) });
      return;
    }
    if (pathname.endsWith('/members/member-synthetic-1/link-account') && method === 'POST') {
      assert.equal(body.expected_version, member.version);
      assert.equal(body.user_id, 'synthetic-existing-user');
      member = { ...member, user_id: body.user_id, version: member.version + 1 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: member }) });
      return;
    }
    if (pathname.endsWith('/members/member-synthetic-1/unlink-account') && method === 'POST') {
      assert.equal(body.expected_version, member.version);
      member = { ...member, user_id: null, version: member.version + 1 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: member }) });
      return;
    }
    if (pathname.endsWith('/members/member-synthetic-1') && method === 'PATCH') {
      assert.equal(body.expected_version, member.version, 'member assignment update must use the current version');
      assert.equal(body.primary_location_id, 'location-synthetic-1');
      member = { ...member, ...body, version: member.version + 1 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: member }) });
      return;
    }
    if (pathname.endsWith('/assignments') && method === 'POST') {
      assert.equal(body.member_id, member.id);
      assert.equal(body.assignment_type, 'LOCATION');
      assert.equal(body.location_id, 'location-synthetic-1');
      assert.ok(Number.isFinite(Date.parse(body.starts_at)) && Number.isFinite(Date.parse(body.ends_at)));
      assert.ok(Date.parse(body.starts_at) < Date.parse(body.ends_at));
      assert.match(request.headers()['idempotency-key'] || '', /^workforce-ui-/);
      locationAssignment = { id: 'assignment-synthetic-1', ...body, status: 'DRAFT', version: 1 };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ record: locationAssignment }) });
      return;
    }
    if (pathname.endsWith('/assignments/assignment-synthetic-1/activate') && method === 'POST') {
      assert.equal(body.expected_version, locationAssignment.version);
      locationAssignment = { ...locationAssignment, status: 'ACTIVE', version: locationAssignment.version + 1 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: locationAssignment }) });
      return;
    }
    if (pathname.endsWith('/engagements') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: engagement ? [engagement] : [] }) });
      return;
    }
    if (pathname.endsWith('/engagements') && method === 'POST') {
      assert.equal(body.member_id, member.id, 'engagement must belong to the selected Workforce member');
      assert.equal(body.engagement_type, 'EMPLOYMENT');
      assert.ok(Number.isFinite(Date.parse(body.starts_at)) && Number.isFinite(Date.parse(body.ends_at)));
      assert.ok(Date.parse(body.starts_at) < Date.parse(body.ends_at));
      assert.match(request.headers()['idempotency-key'] || '', /^workforce-ui-/);
      engagement = { id: 'engagement-synthetic-1', member_id: member.id, engagement_type: body.engagement_type,
        starts_at: body.starts_at, ends_at: body.ends_at, status: 'DRAFT', version: 1 };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ record: engagement }) });
      return;
    }
    if (pathname.endsWith('/engagement-synthetic-1/submit') && method === 'POST') {
      assert.equal(body.expected_version, engagement.version);
      engagement = { ...engagement, status: 'PENDING_APPROVAL', version: engagement.version + 1 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: engagement }) });
      return;
    }
    if (pathname.endsWith('/engagement-synthetic-1/activate') && method === 'POST') {
      assert.equal(body.expected_version, engagement.version);
      engagement = { ...engagement, status: 'ACTIVE', version: engagement.version + 1 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: engagement }) });
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
  await dismissSettingsOverlay();
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
  await dismissSettingsOverlay();
  assert.equal(
    await page.locator('#workforceStatus').getAttribute('data-state'),
    'READY',
    'Workforce workspace must load successfully. Status: ' + workspaceStatus
      + '; intercepted API calls: ' + JSON.stringify(apiCalls),
  );
  await page.locator('#workforceMembers').getByText('Synthetic Workforce Member').waitFor({ timeout: 10000 });
  await page.getByText('Planned', { exact: true }).waitFor();
  await page.locator('.workforce-member-card').getByRole('button', { name: 'Open member' }).click();
  await page.locator('#workforceMemberDetails').waitFor({ state: 'visible' });
  await page.locator('#workforceAvailabilityForm').waitFor({ state: 'visible' });
  const memberAssignmentForm = page.locator('#workforceMemberProfileForm');
  await memberAssignmentForm.locator('[name="primary_location_id"]').selectOption('location-synthetic-1');
  await memberAssignmentForm.getByRole('button', { name: 'Save profile and assignments' }).click();
  await page.getByText('Profile and assignments saved.').waitFor({ timeout: 10000 });
  const memberLocationCall = apiCalls.find(call => call.method === 'PATCH' && call.pathname.endsWith('/members/member-synthetic-1'));
  assert.equal(memberLocationCall?.body.expected_version, 1);
  assert.equal(memberLocationCall?.body.primary_location_id, 'location-synthetic-1');
  const accountLinkForm = page.locator('#workforceAccountLinkForm');
  await accountLinkForm.locator('[name="user_id"]').fill('synthetic-existing-user');
  await accountLinkForm.getByRole('button', { name: 'Link existing account' }).click();
  await page.getByText('Existing account linked.').waitFor({ timeout: 10000 });
  const accountLinkCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/link-account'));
  assert.equal(accountLinkCall?.body.expected_version, 2);
  assert.equal(accountLinkCall?.body.user_id, 'synthetic-existing-user');
  await page.getByRole('button', { name: 'Unlink account' }).click();
  const accountUnlinkCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/unlink-account'));
  assert.equal(accountUnlinkCall?.body.expected_version, 3);
  await page.locator('#workforceAccountLinkForm').waitFor({ state: 'visible' });
  const locationAssignmentForm = page.locator('#workforceLocationAssignmentForm');
  await locationAssignmentForm.waitFor({ state: 'visible' });
  await locationAssignmentForm.locator('[name="location_id"]').selectOption('location-synthetic-1');
  await locationAssignmentForm.locator('[name="starts_at"]').fill('2026-11-26T08:00');
  await locationAssignmentForm.locator('[name="ends_at"]').fill('2026-11-26T17:00');
  await locationAssignmentForm.getByRole('button', { name: 'Create location assignment' }).click();
  await page.getByText('Location assignment created.').waitFor({ timeout: 10000 });
  await page.locator('.workforce-assignment-row .logistics-status').filter({ hasText: 'DRAFT' }).waitFor();
  await page.locator('.workforce-assignment-row').getByRole('button', { name: 'Activate', exact: true }).click();
  await page.locator('.workforce-assignment-row .logistics-status').filter({ hasText: 'ACTIVE' }).waitFor();
  const locationAssignmentCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/assignments'));
  assert.ok(locationAssignmentCall, 'location assignment form must submit through the canonical API');
  assert.equal(locationAssignmentCall.body.location_id, 'location-synthetic-1');
  assert.match(locationAssignmentCall.idempotencyKey, /^workforce-ui-/);
  await page.locator('#workforceProfileForm').waitFor({ state: 'visible' });
  await page.locator('#workforceEngagementForm').waitFor({ state: 'visible' });

  const profileForm = page.locator('#workforceProfileForm');
  await profileForm.locator('[name="skills"]').fill('Consultation, Customer care');
  await profileForm.locator('[name="qualifications"]').fill('Certificate in Retail Operations');
  await profileForm.locator('[name="languages"]').fill('Amharic, English');
  await profileForm.locator('[name="service_capabilities"]').fill('Sales, Returns');
  await profileForm.locator('[name="visibility"]').selectOption('ORGANIZATION');
  await profileForm.locator('[name="effective_from"]').fill('2026-11-25');
  await profileForm.locator('[name="notes"]').fill('Synthetic profile for browser regression');
  await profileForm.getByRole('button', { name: 'Save professional profile' }).click();
  await page.getByText('Profile saved.').waitFor({ timeout: 10000 });
  const profileCreateCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/profiles'));
  assert.ok(profileCreateCall, 'professional profile form must create through the canonical API');
  assert.equal(profileCreateCall.authorization, 'Bearer synthetic-session-token');
  assert.match(profileCreateCall.idempotencyKey, /^workforce-ui-/);
  await profileForm.locator('[name="notes"]').fill('Verified synthetic professional profile');
  await profileForm.getByRole('button', { name: 'Save professional profile' }).click();
  await page.getByText('Profile saved.').waitFor({ timeout: 10000 });
  const profileUpdateCall = apiCalls.find(call => call.method === 'PATCH' && call.pathname.endsWith('/profiles/profile-synthetic-1'));
  assert.equal(profileUpdateCall?.body.expected_version, 1);
  assert.equal(profileUpdateCall?.body.notes, 'Verified synthetic professional profile');

  const engagementForm = page.locator('#workforceEngagementForm');
  await engagementForm.locator('[name="engagement_type"]').selectOption('EMPLOYMENT');
  await engagementForm.locator('[name="starts_at"]').fill('2026-11-26T08:00');
  await engagementForm.locator('[name="ends_at"]').fill('2026-12-26T17:00');
  await engagementForm.locator('[name="terms_reference"]').fill('SYNTHETIC-EMPLOYMENT-001');
  await engagementForm.getByRole('button', { name: 'Create engagement' }).click();
  await page.getByText('Engagement recorded.').waitFor({ timeout: 10000 });
  await dismissSettingsOverlay();
  await page.locator('.workforce-engagement-row .logistics-status').filter({ hasText: 'DRAFT' }).waitFor();
  const engagementCreateCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/engagements'));
  assert.ok(engagementCreateCall, 'manager engagement form must submit through the canonical API');
  assert.equal(engagementCreateCall.body.member_id, member.id);
  assert.equal(engagementCreateCall.authorization, 'Bearer synthetic-session-token');
  assert.match(engagementCreateCall.idempotencyKey, /^workforce-ui-/);
  await dismissSettingsOverlay();
  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await page.locator('.workforce-engagement-row .logistics-status').filter({ hasText: 'PENDING APPROVAL' }).waitFor();
  await dismissSettingsOverlay();
  await page.getByRole('button', { name: 'Activate', exact: true }).click();
  await page.locator('.workforce-engagement-row .logistics-status').filter({ hasText: 'ACTIVE' }).waitFor();
  await dismissSettingsOverlay();
  const engagementSubmitCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/engagement-synthetic-1/submit'));
  const engagementActivateCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/engagement-synthetic-1/activate'));
  assert.equal(engagementSubmitCall?.body.expected_version, 1, 'engagement submit must use optimistic concurrency');
  assert.equal(engagementActivateCall?.body.expected_version, 2, 'engagement activation must use the latest version');

  const form = page.locator('#workforceAvailabilityForm');
  await form.locator('[name="availability"]').selectOption('AVAILABLE');
  await form.locator('[name="starts_at"]').fill('2026-11-26T09:00');
  await form.locator('[name="ends_at"]').fill('2026-11-26T17:00');
  const browserTimezone = await form.locator('[name="timezone"]').inputValue();
  assert.ok(browserTimezone, 'workspace must provide a read-only timezone context');
  await form.getByRole('button', { name: 'Save availability' }).click();
  await page.getByText('Availability saved.').waitFor({ timeout: 10000 });
  await dismissSettingsOverlay();

  const availabilityCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/availability'));
  assert.ok(availabilityCall, 'browser form must submit availability through the API');
  assert.equal(availabilityCall.authorization, 'Bearer synthetic-session-token');
  assert.match(availabilityCall.idempotencyKey, /^workforce-ui-/);
  assert.equal(availabilityCall.body.timezone, browserTimezone);

  await page.locator('.workforce-member-card').getByRole('button', { name: 'Suspend' }).click();
  await page.waitForFunction(() => {
    const status = document.querySelector('.workforce-member-card .logistics-status');
    return status?.textContent?.trim() === 'SUSPENDED';
  }, null, { timeout: 10000 });
  const suspendCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/suspend'));
  assert.ok(suspendCall, 'member lifecycle action must reach the API');
  assert.equal(suspendCall.body.expected_version, 4);
  assert.equal(suspendCall.authorization, 'Bearer synthetic-session-token');

  const card = await page.locator('#workforceWorkspace').boundingBox();
  assert.ok(card && card.width <= 390, 'Workforce workspace must fit the mobile viewport');
  assert.deepEqual(pageErrors, [], 'browser journey must not emit uncaught page errors');

  console.log('Workforce operator browser journey: PASS');
  console.log('Mobile workspace, primary location editing, account link/unlink, location assignment lifecycle, structured profile create/update, engagement lifecycle, availability, and optimistic concurrency: VERIFIED');
} catch (error) {
  console.error(error);
  console.error('Browser diagnostics:\n' + JSON.stringify(browserDiagnostics, null, 2));
  if (typeof pageErrors !== 'undefined' && pageErrors.length) console.error('Page errors:\n' + JSON.stringify(pageErrors, null, 2));
  if (typeof page !== 'undefined' && page) {
    try {
      console.error('Workforce UI state:\n' + JSON.stringify(await page.evaluate(() => {
        const workspace = document.querySelector('#workforceWorkspace');
        return {
          status: document.querySelector('#workforceStatus')?.textContent,
          statusState: document.querySelector('#workforceStatus')?.dataset.state,
          refreshSequence: workspace?.dataset.refreshSequence,
          detailSequence: workspace?.dataset.detailSequence,
          selectedMemberId: workspace?.dataset.selectedMemberId,
          memberCards: [...document.querySelectorAll('.workforce-member-card')].map(card => ({
            text: card.querySelector('.logistics-status')?.textContent,
            actionDisabled: card.querySelector('.workforce-member-action')?.disabled,
          })),
        };
      }), null, 2));
    } catch (diagnosticError) { console.error('Could not capture Workforce UI state:', diagnosticError.message); }
  }
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

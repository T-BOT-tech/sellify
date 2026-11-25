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
  await page.addInitScript(() => {
    // The app shell may open Settings asynchronously after boot; this isolated Workforce journey does not test that modal.
    const installSettingsOverlayGuard = () => {
      const root = document.documentElement;
      if (!root) return;
      const hide = () => {
        const modal = document.getElementById('settingsModal');
        if (!modal) return;
        modal.classList.remove('open');
        modal.style.setProperty('display', 'none', 'important');
        modal.setAttribute('aria-hidden', 'true');
      };
      new MutationObserver(hide).observe(root, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
      });
      hide();
    };
    if (document.documentElement) installSettingsOverlayGuard();
    else document.addEventListener('DOMContentLoaded', installSettingsOverlayGuard, { once: true });
  });
  const dismissSettingsOverlay = async () => {
    const modal = page.locator('#settingsModal');
    if (await modal.count()) await modal.evaluate(element => {
      element.classList.remove('open');
      element.style.setProperty('display', 'none', 'important');
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
  const replacementMember = {
    id: 'member-synthetic-2', display_name: 'Replacement Workforce Member',
    member_type: 'EMPLOYEE', status: 'ACTIVE', version: 1,
  };
  let shiftHistory = [];
  let engagement = null;
  let shiftTemplate = null;
  let generatedShift = null;
  let profile = null;
  let locationAssignment = null;
  let leaveRequest = null;
  let absenceRecord = null;
  const leaveHistory = [];
  const absenceHistory = [];
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));

  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const unrelatedAppEntrypoints = new Set([
      '/src/p0-ai-procurement-proposal.js',
      '/src/agriculture-cross-border-productization.js',
      '/src/window-bridge.js',
    ]);
    if (unrelatedAppEntrypoints.has(url.pathname)) {
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: '// Isolated Workforce browser regression: unrelated app bootstrap is not under test.\n' });
      return;
    }
    if (url.hostname === 'telegram.org' && url.pathname === '/js/telegram-web-app.js') {
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Telegram = window.Telegram || { WebApp: { initData: "", initDataUnsafe: {}, ready() {}, expand() {} } };' });
      return;
    }
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [member, replacementMember] }) });
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
    if (pathname.endsWith('/leave-requests') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: leaveRequest ? [leaveRequest] : [] }) });
      return;
    }
    if (pathname.endsWith('/absences') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: absenceRecord ? [absenceRecord] : [] }) });
      return;
    }
    if (pathname.endsWith('/leave-requests') && method === 'POST') {
      assert.equal(body.member_id, member.id);
      assert.equal(body.leave_category, 'ANNUAL');
      assert.equal(body.all_day, true);
      assert.ok(Number.isFinite(Date.parse(body.starts_at)) && Number.isFinite(Date.parse(body.ends_at)));
      assert.ok(Date.parse(body.starts_at) < Date.parse(body.ends_at));
      assert.ok(body.timezone);
      assert.equal(body.reason, 'Synthetic planned leave');
      assert.match(request.headers()['idempotency-key'] || '', /^workforce-ui-/);
      leaveRequest = { id: 'leave-synthetic-1', ...body, requested_by: 'synthetic-manager', status: 'DRAFT', version: 1 };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ record: leaveRequest }) });
      return;
    }
    if (pathname.endsWith('/leave-synthetic-1/submit') && method === 'POST') {
      assert.equal(body.expected_version, leaveRequest.version);
      leaveRequest = { ...leaveRequest, status: 'PENDING_APPROVAL', version: leaveRequest.version + 1 };
      leaveHistory.push({ action: 'workforce.leave_request.submit', created_at: '2026-11-25T10:00:00.000Z', metadata: {} });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: leaveRequest }) });
      return;
    }
    if (pathname.endsWith('/leave-synthetic-1/approve') && method === 'POST') {
      assert.equal(body.expected_version, leaveRequest.version);
      leaveRequest = { ...leaveRequest, status: 'APPROVED', decision_reason: body.decision_reason || '', version: leaveRequest.version + 1 };
      leaveHistory.push({ action: 'workforce.leave_request.approve', created_at: '2026-11-25T10:05:00.000Z', metadata: { decision_reason: body.decision_reason || '' } });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: leaveRequest }) });
      return;
    }
    if (pathname.endsWith('/leave-synthetic-1/cancel') && method === 'POST') {
      assert.equal(body.expected_version, leaveRequest.version);
      assert.equal(body.reason, 'Coverage changed');
      leaveRequest = { ...leaveRequest, status: 'CANCELLED', version: leaveRequest.version + 1 };
      leaveHistory.push({ action: 'workforce.leave_request.cancel', created_at: '2026-11-25T10:10:00.000Z', metadata: { reason: body.reason } });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: leaveRequest }) });
      return;
    }
    if (pathname.endsWith('/absences') && method === 'POST') {
      assert.equal(body.member_id, member.id);
      assert.equal(body.absence_type, 'SICKNESS');
      assert.ok(Number.isFinite(Date.parse(body.starts_at)) && Number.isFinite(Date.parse(body.ends_at)));
      assert.ok(Date.parse(body.starts_at) < Date.parse(body.ends_at));
      assert.ok(body.timezone);
      assert.equal(body.reason, 'Synthetic unplanned absence');
      assert.match(request.headers()['idempotency-key'] || '', /^workforce-ui-/);
      absenceRecord = { id: 'absence-synthetic-1', ...body, status: 'RECORDED', version: 1 };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ record: absenceRecord }) });
      return;
    }
    if (pathname.endsWith('/absence-synthetic-1/void') && method === 'POST') {
      assert.equal(body.expected_version, absenceRecord.version);
      assert.equal(body.reason, 'Incorrect synthetic record');
      absenceRecord = { ...absenceRecord, status: 'VOIDED', version: absenceRecord.version + 1 };
      absenceHistory.push({ action: 'workforce.absence.void', created_at: '2026-11-25T10:15:00.000Z', metadata: { reason: body.reason } });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: absenceRecord }) });
      return;
    }
    if (pathname.endsWith('/shifts') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: generatedShift ? [generatedShift] : [] }) });
      return;
    }
    if (pathname.endsWith('/history') && method === 'GET') {
      const records = pathname.includes('/leave-requests/') ? leaveHistory
        : pathname.includes('/absences/') ? absenceHistory : shiftHistory;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records }) });
      return;
    }
    if (pathname.endsWith('/shift-templates') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: shiftTemplate ? [shiftTemplate] : [] }) });
      return;
    }
    if (pathname.endsWith('/shift-templates') && method === 'POST') {
      assert.equal(body.name, 'Morning Shift');
      assert.equal(body.start_local_time, '08:00');
      assert.equal(body.end_local_time, '16:30');
      assert.equal(body.timezone, 'Africa/Addis_Ababa');
      assert.deepEqual(body.work_days, [1,2,3,4,5]);
      assert.deepEqual(body.break_rules, [{ start_local_time: '12:00', end_local_time: '12:30' }]);
      assert.equal(body.location_id, 'location-synthetic-1');
      assert.match(request.headers()['idempotency-key'] || '', /^workforce-ui-/);
      shiftTemplate = { id: 'shift-template-synthetic-1', ...body, status: 'ACTIVE', version: 1 };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ record: shiftTemplate }) });
      return;
    }
    if (pathname.endsWith('/shift-template-synthetic-1/activate') && method === 'POST') {
      assert.equal(body.expected_version, shiftTemplate.version);
      shiftTemplate = { ...shiftTemplate, status: 'ACTIVE', version: shiftTemplate.version + 1 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: shiftTemplate }) });
      return;
    }
    if (pathname.endsWith('/shift-template-synthetic-1/generate') && method === 'POST') {
      assert.equal(body.expected_version, shiftTemplate.version);
      assert.equal(body.member_id, member.id);
      assert.equal(body.from_date, '2026-11-26');
      assert.equal(body.to_date, '2026-11-26');
      assert.match(request.headers()['idempotency-key'] || '', /^workforce-ui-/);
      generatedShift = { id: 'generated-shift-synthetic-1', member_id: member.id, shift_template_id: shiftTemplate.id,
        generated_local_date: body.from_date, starts_at: '2026-11-26T05:00:00.000Z', ends_at: '2026-11-26T13:30:00.000Z',
        timezone: shiftTemplate.timezone, status: 'PLANNED', version: 1 };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        created_count: 1, existing_count: 0, conflict_count: 0, skipped_count: 0,
        created_records: [generatedShift], existing_records: [], conflicts: [], skipped: [],
      }) });
      return;
    }
    if (pathname.endsWith('/generated-shift-synthetic-1/reassign') && method === 'POST') {
      assert.equal(body.expected_version, generatedShift.version);
      assert.equal(body.member_id, replacementMember.id);
      assert.equal(body.reason, 'Coverage transfer');
      generatedShift = { ...generatedShift, member_id: body.member_id, version: generatedShift.version + 1 };
      shiftHistory.push({ action: 'workforce.shift.reassigned', created_at: '2026-11-25T12:00:00.000Z',
        metadata: { from_member_id: member.id, to_member_id: replacementMember.id, reason: body.reason } });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: generatedShift }) });
      return;
    }
    for (const [action, from, to] of [['confirm','PLANNED','CONFIRMED'],['start','CONFIRMED','IN_PROGRESS'],['complete','IN_PROGRESS','COMPLETED']]) {
      if (pathname.endsWith('/generated-shift-synthetic-1/' + action) && method === 'POST') {
        assert.equal(body.expected_version, generatedShift.version);
        assert.equal(generatedShift.status, from);
        generatedShift = { ...generatedShift, status: to, version: generatedShift.version + 1 };
        shiftHistory.push({ action: 'workforce.shift.' + action, created_at: '2026-11-25T12:05:00.000Z', metadata: { from, to, version: generatedShift.version } });
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: generatedShift }) });
        return;
      }
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

  await page.goto(baseUrl, { waitUntil: 'commit' });
  await page.setContent('<!doctype html><html><head></head><body></body></html>', { waitUntil: 'domcontentloaded' });
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
  await page.locator('.workforce-member-card').first().getByRole('button', { name: 'Open member' }).click();
  await page.locator('#workforceMemberDetails').waitFor({ state: 'visible' });
  await page.locator('#workforceAvailabilityForm').waitFor({ state: 'visible' });
  const memberAssignmentForm = page.locator('#workforceMemberProfileForm');
  await memberAssignmentForm.locator('[name="primary_location_id"]').selectOption('location-synthetic-1');
  await memberAssignmentForm.getByRole('button', { name: 'Save profile and assignments' }).click();
  await page.locator('.workforce-profile-summary strong').filter({ hasText: 'Addis Ababa Branch' }).waitFor({ timeout: 10000 });
  const memberLocationCall = apiCalls.find(call => call.method === 'PATCH' && call.pathname.endsWith('/members/member-synthetic-1'));
  assert.equal(memberLocationCall?.body.expected_version, 1);
  assert.equal(memberLocationCall?.body.primary_location_id, 'location-synthetic-1');
  const accountLinkForm = page.locator('#workforceAccountLinkForm');
  await accountLinkForm.locator('[name="user_id"]').fill('synthetic-existing-user');
  await accountLinkForm.getByRole('button', { name: 'Link existing account' }).click();
  await page.getByRole('button', { name: 'Unlink account' }).waitFor({ state: 'visible', timeout: 10000 });
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

  const leaveForm = page.locator('#workforceLeaveRequestForm');
  await leaveForm.locator('[name="member_id"]').selectOption('member-synthetic-1');
  await leaveForm.locator('[name="leave_category"]').selectOption('ANNUAL');
  await leaveForm.locator('[name="starts_at"]').fill('2026-11-27T09:00');
  await leaveForm.locator('[name="ends_at"]').fill('2026-11-27T12:00');
  await leaveForm.locator('[name="all_day"]').check();
  await leaveForm.locator('[name="reason"]').fill('Synthetic planned leave');
  await leaveForm.getByRole('button', { name: 'Submit leave request' }).click();
  await page.getByText('Leave request submitted.').waitFor({ timeout: 10000 });
  await page.locator('.workforce-leave-row .logistics-status').filter({ hasText: 'PENDING APPROVAL' }).waitFor();
  const leaveCreateCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/leave-requests'));
  const leaveSubmitCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/leave-synthetic-1/submit'));
  assert.ok(leaveCreateCall, 'leave request must be created through the canonical API');
  assert.equal(leaveCreateCall.authorization, 'Bearer synthetic-session-token');
  assert.match(leaveCreateCall.idempotencyKey, /^workforce-ui-/);
  assert.equal(leaveSubmitCall?.body.expected_version, 1, 'leave submission must use the created record version');
  const approveForm = page.locator('.workforce-leave-action-form[data-action="approve"]');
  await approveForm.locator('[name="decision_reason"]').fill('Coverage confirmed');
  await approveForm.getByRole('button', { name: 'Approve' }).click();
  await page.getByText('Leave request approved.').waitFor({ timeout: 10000 });
  await page.locator('.workforce-leave-row .logistics-status').filter({ hasText: 'APPROVED' }).waitFor();
  const leaveApproveCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/leave-synthetic-1/approve'));
  assert.equal(leaveApproveCall?.body.expected_version, 2);
  assert.equal(leaveApproveCall?.body.decision_reason, 'Coverage confirmed');
  const cancelForm = page.locator('.workforce-leave-action-form[data-action="cancel"]');
  await cancelForm.locator('[name="reason"]').fill('Coverage changed');
  await cancelForm.getByRole('button', { name: 'Cancel approval' }).click();
  await page.getByText('Leave request cancelled.').waitFor({ timeout: 10000 });
  await page.locator('.workforce-leave-row .logistics-status').filter({ hasText: 'CANCELLED' }).waitFor();
  const leaveCancelCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/leave-synthetic-1/cancel'));
  assert.equal(leaveCancelCall?.body.expected_version, 3);
  await page.locator('.workforce-leave-row').getByRole('button', { name: 'View history' }).click();
  await page.getByText('approve', { exact: true }).waitFor({ timeout: 10000 });

  const absenceForm = page.locator('#workforceAbsenceForm');
  await absenceForm.locator('[name="member_id"]').selectOption('member-synthetic-1');
  await absenceForm.locator('[name="absence_type"]').selectOption('SICKNESS');
  await absenceForm.locator('[name="starts_at"]').fill('2026-11-28T09:00');
  await absenceForm.locator('[name="ends_at"]').fill('2026-11-28T12:00');
  await absenceForm.locator('[name="reason"]').fill('Synthetic unplanned absence');
  await absenceForm.getByRole('button', { name: 'Record absence' }).click();
  await page.getByText('Unplanned absence recorded.').waitFor({ timeout: 10000 });
  await page.locator('.workforce-absence-row .logistics-status').filter({ hasText: 'RECORDED' }).waitFor();
  const absenceCreateCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/absences'));
  assert.ok(absenceCreateCall, 'absence must be recorded through the canonical API');
  assert.match(absenceCreateCall.idempotencyKey, /^workforce-ui-/);
  const voidForm = page.locator('.workforce-absence-void-form');
  await voidForm.locator('[name="reason"]').fill('Incorrect synthetic record');
  await voidForm.getByRole('button', { name: 'Void record' }).click();
  await page.getByText('Absence record voided.').waitFor({ timeout: 10000 });
  await page.locator('.workforce-absence-row .logistics-status').filter({ hasText: 'VOIDED' }).waitFor();
  const absenceVoidCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/absence-synthetic-1/void'));
  assert.equal(absenceVoidCall?.body.expected_version, 1);
  await page.locator('.workforce-absence-row').getByRole('button', { name: 'View history' }).click();
  await page.getByText('void', { exact: true }).waitFor({ timeout: 10000 });

  const templateForm = page.locator('#workforceShiftTemplateForm');
  await templateForm.locator('[name="name"]').fill('Morning Shift');
  await templateForm.locator('[name="start_local_time"]').fill('08:00');
  await templateForm.locator('[name="end_local_time"]').fill('16:30');
  await templateForm.locator('[name="timezone"]').fill('Africa/Addis_Ababa');
  await templateForm.locator('[name="break_start_local_time"]').fill('12:00');
  await templateForm.locator('[name="break_end_local_time"]').fill('12:30');
  await templateForm.locator('[name="location_id"]').selectOption('location-synthetic-1');
  await templateForm.locator('[name="effective_from"]').fill('2026-11-26');
  await templateForm.getByRole('button', { name: 'Create shift template' }).click();
  await page.getByText('Shift template created.').waitFor({ timeout: 10000 });
  await page.locator('.workforce-shift-template-row .logistics-status').filter({ hasText: 'ACTIVE' }).waitFor();
  const templateCreateCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/shift-templates'));
  assert.ok(templateCreateCall, 'manager shift template form must use the canonical API');
  assert.equal(templateCreateCall.authorization, 'Bearer synthetic-session-token');
  assert.match(templateCreateCall.idempotencyKey, /^workforce-ui-/);
  const generationForm = page.locator('.workforce-shift-generation-form');
  await generationForm.locator('[name="member_id"]').selectOption('member-synthetic-1');
  await generationForm.locator('[name="from_date"]').fill('2026-11-26');
  await generationForm.locator('[name="to_date"]').fill('2026-11-26');
  await generationForm.getByRole('button', { name: 'Generate dated shifts' }).click();
  await page.getByText('Created 1, already existed 0, conflicts 0, skipped 0.').waitFor({ timeout: 10000 });
  await page.locator('.workforce-dated-shift-row').waitFor({ timeout: 10000 });
  const reassignForm = page.locator('.workforce-shift-reassign-form');
  await reassignForm.locator('[name="member_id"]').selectOption('member-synthetic-2');
  await reassignForm.locator('[name="reason"]').fill('Coverage transfer');
  await reassignForm.getByRole('button', { name: 'Reassign shift' }).click();
  await page.getByText('Shift reassigned.').waitFor({ timeout: 10000 });
  const reassignCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/generated-shift-synthetic-1/reassign'));
  assert.equal(reassignCall?.body.expected_version, 1);
  assert.equal(reassignCall?.body.member_id, replacementMember.id);
  await page.locator('.workforce-dated-shift-row').getByRole('button', { name: 'View history' }).click();
  await page.getByText('reassigned', { exact: true }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Confirm shift' }).click();
  await page.getByRole('button', { name: 'Start shift' }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Start shift' }).click();
  await page.getByRole('button', { name: 'Complete shift' }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Complete shift' }).click();
  await page.getByText('Shift complete recorded.').waitFor({ timeout: 10000 });
  const generationCall = apiCalls.find(call => call.method === 'POST' && call.pathname.endsWith('/shift-template-synthetic-1/generate'));
  assert.equal(generationCall?.body.expected_version, 1, 'generation must use the active template version');
  assert.equal(generationCall?.body.member_id, member.id);
  assert.equal(generationCall?.authorization, 'Bearer synthetic-session-token');
  assert.match(generationCall?.idempotencyKey || '', /^workforce-ui-/);

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

  await page.locator('.workforce-member-card').first().getByRole('button', { name: 'Suspend' }).click();
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
  console.log('Mobile workspace, member administration, leave submission/approval/cancellation, absence recording/correction/history, shift templates and dated roster lifecycle, availability, and optimistic concurrency: VERIFIED');
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

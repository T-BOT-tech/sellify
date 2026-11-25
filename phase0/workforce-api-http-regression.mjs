import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-workforce-api-http-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_BACKUP_DIR = path.join(tempDir, 'backups');
process.env.NODE_ENV = 'test';

let child;
let output = '';

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

async function waitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error('Backend exited before Workforce HTTP checks: ' + output);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + output);
}

async function jsonRequest(baseUrl, pathname, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(baseUrl + pathname, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let payload = {};
  try { payload = await response.json(); } catch {}
  return { response, payload };
}

async function createWorkforceRecord(baseUrl, token, collection, key, body) {
  const result = await jsonRequest(baseUrl, collection, {
    token,
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body,
  });
  assert.equal(result.response.status, 201, collection + ': ' + JSON.stringify(result.payload));
  assert.ok(result.payload.record?.id, collection + ' must return a canonical record id');
  return result.payload.record;
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('workforce-http-owner-' + suffix, 'Workforce HTTP Owner');
  const memberUser = await store.getOrCreateUserByTelegram('workforce-http-member-' + suffix, 'Workforce HTTP Member');
  const externalAccountUser = await store.getOrCreateUserByTelegram('workforce-http-external-account-' + suffix, 'External Workforce Account');
  const otherOwner = await store.getOrCreateUserByTelegram('workforce-http-other-' + suffix, 'Other Tenant Owner');
  const tenant = await store.createTenantForUser({
    userId: owner.id,
    sellerName: 'Workforce HTTP Test',
    businessType: 'services',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const managerUser = await store.getOrCreateUserByTelegram('workforce-http-manager-' + suffix, 'Workforce HTTP Manager');
  await store.ensureMembership(managerUser.id, tenant.chatId, 'manager');
  await store.ensureMembership(memberUser.id, tenant.chatId, 'staff');
  const primaryLocation = await store.createOrganizationLocation(tenant.chatId, {
    code: 'WF-HTTP-PRIMARY-' + suffix, name: 'Workforce HTTP Primary Branch', timezone: 'Africa/Addis_Ababa',
  });
  const secondaryLocation = await store.createOrganizationLocation(tenant.chatId, {
    code: 'WF-HTTP-SECONDARY-' + suffix, name: 'Workforce HTTP Secondary Branch', timezone: 'Africa/Addis_Ababa',
  });
  const otherTenant = await store.createTenantForUser({
    userId: otherOwner.id,
    sellerName: 'Other Workforce Tenant',
    businessType: 'services',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  await store.ensureMembership(memberUser.id, tenant.chatId, 'staff');
  await store.ensureMembership(externalAccountUser.id, tenant.chatId, 'staff');
  const ownerSession = await store.createSession({
    userId: owner.id, chatId: tenant.chatId, deviceName: 'Workforce HTTP owner',
  });
  const managerSession = await store.createSession({
    userId: managerUser.id, chatId: tenant.chatId, deviceName: 'Workforce HTTP manager',
  });
  const employeeSession = await store.createSession({
    userId: memberUser.id, chatId: tenant.chatId, deviceName: 'Workforce HTTP employee',
  });
  const otherSession = await store.createSession({
    userId: otherOwner.id, chatId: otherTenant.chatId, deviceName: 'Other tenant owner',
  });

  const port = await freePort();
  const baseUrl = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      CORS_ALLOWED_ORIGINS: baseUrl,
      RATE_LIMIT_MAX_WRITES: '500',
      RATE_LIMIT_MAX_READS: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  await waitForHealth(baseUrl);

  const locationList = await jsonRequest(baseUrl, '/tenants/' + encodeURIComponent(tenant.chatId) + '/locations', {
    token: ownerSession.token,
  });
  assert.equal(locationList.response.status, 200, JSON.stringify(locationList.payload));
  assert.ok(locationList.payload.locations?.some(item => item.id === primaryLocation.id));

  const collection = '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/members';
  const departmentsPath = '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/departments';
  const positionsPath = '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/positions';
  const department = await createWorkforceRecord(baseUrl, ownerSession.token, departmentsPath, 'workforce-http-department-' + suffix, { code: 'OPS', name: 'Operations' });
  const position = await createWorkforceRecord(baseUrl, ownerSession.token, positionsPath, 'workforce-http-position-' + suffix, { code: 'LEAD', name: 'Team Lead', department_id: department.id });
  const departmentRead = await jsonRequest(baseUrl, departmentsPath + '/' + encodeURIComponent(department.id), { token: ownerSession.token });
  assert.equal(departmentRead.response.status, 200, JSON.stringify(departmentRead.payload));
  assert.equal(departmentRead.payload.record?.name, 'Operations');
  const positionList = await jsonRequest(baseUrl, positionsPath, { token: ownerSession.token });
  assert.equal(positionList.response.status, 200, JSON.stringify(positionList.payload));
  assert.ok(positionList.payload.records?.some(record => record.id === position.id));
  const departmentUpdate = await jsonRequest(baseUrl, departmentsPath + '/' + encodeURIComponent(department.id), {
    token: ownerSession.token, method: 'PATCH', body: { expected_version: 1, description: 'Operations department' },
  });
  assert.equal(departmentUpdate.response.status, 200, JSON.stringify(departmentUpdate.payload));
  assert.equal(departmentUpdate.payload.record?.version, 2);
  const positionUpdate = await jsonRequest(baseUrl, positionsPath + '/' + encodeURIComponent(position.id), {
    token: ownerSession.token, method: 'PATCH', body: { expected_version: 1, classification: 'LEAD' },
  });
  assert.equal(positionUpdate.response.status, 200, JSON.stringify(positionUpdate.payload));
  assert.equal(positionUpdate.payload.record?.version, 2);
  const utilizationSummaryPath = '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/utilization/summary';
  const unauthorizedSummary = await jsonRequest(baseUrl, utilizationSummaryPath);
  assert.equal(unauthorizedSummary.response.status, 401,
    'utilization summaries require an authenticated tenant session');
  const ownSummary = await jsonRequest(baseUrl, utilizationSummaryPath, { token: ownerSession.token });
  assert.equal(ownSummary.response.status, 200, JSON.stringify(ownSummary.payload));
  assert.equal(ownSummary.payload.summary?.event_count, 0);
  const invalidSummaryRange = await jsonRequest(baseUrl,
    utilizationSummaryPath + '?from=2026-11-26T00%3A00%3A00.000Z&to=2026-11-25T00%3A00%3A00.000Z',
    { token: ownerSession.token });
  assert.equal(invalidSummaryRange.response.status, 400);
  assert.equal(invalidSummaryRange.payload.error?.code, 'WORKFORCE_ANALYTICS_RANGE_INVALID');
  const crossTenantSummary = await jsonRequest(baseUrl, utilizationSummaryPath, { token: otherSession.token });
  assert.equal(crossTenantSummary.response.status, 403,
    'a session from another tenant must not read utilization analytics');

  const unauthorized = await jsonRequest(baseUrl, collection);
  assert.equal(unauthorized.response.status, 401, 'Workforce reads require an authenticated tenant session');

  const missingIdempotency = await jsonRequest(baseUrl, collection, {
    token: ownerSession.token,
    method: 'POST',
    body: { user_id: memberUser.id, member_type: 'PROVIDER', display_name: 'HTTP Provider' },
  });
  assert.equal(missingIdempotency.response.status, 400);
  assert.equal(missingIdempotency.payload.error?.code, 'IDEMPOTENCY_KEY_REQUIRED');

  const created = await jsonRequest(baseUrl, collection, {
    token: ownerSession.token,
    method: 'POST',
    headers: { 'Idempotency-Key': 'workforce-http-member-' + suffix },
    body: { user_id: memberUser.id, member_type: 'PROVIDER', display_name: 'HTTP Provider', employee_number: 'EMP-HTTP-001', primary_location_id: primaryLocation.id, department_id: department.id, position_id: position.id },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  assert.equal(created.payload.record?.status, 'DRAFT');
  const memberId = created.payload.record?.id;
  assert.ok(memberId, 'create response must return the canonical Workforce member id');
  assert.equal(created.payload.record?.employee_number, 'EMP-HTTP-001');
  assert.equal(created.payload.record?.primary_location_id, primaryLocation.id);
  assert.equal(created.payload.record?.department_id, department.id);
  assert.equal(created.payload.record?.position_id, position.id);

  const externalMember = await createWorkforceRecord(baseUrl, ownerSession.token, collection,
    'workforce-http-external-' + suffix, { member_type: 'CONTRACTOR', display_name: 'External HTTP Contractor' });
  assert.equal(externalMember.user_id, null, 'external contractor creation must not require an Identity account');
  const externalItem = collection + '/' + encodeURIComponent(externalMember.id);
  const linkedExternal = await jsonRequest(baseUrl, externalItem + '/link-account', {
    token: ownerSession.token, method: 'POST',
    body: { expected_version: 1, user_id: externalAccountUser.id },
  });
  assert.equal(linkedExternal.response.status, 200, JSON.stringify(linkedExternal.payload));
  assert.equal(linkedExternal.payload.record?.user_id, externalAccountUser.id);
  assert.equal(linkedExternal.payload.record?.version, 2);
  const unlinkedExternal = await jsonRequest(baseUrl, externalItem + '/unlink-account', {
    token: ownerSession.token, method: 'POST', body: { expected_version: 2 },
  });
  assert.equal(unlinkedExternal.response.status, 200, JSON.stringify(unlinkedExternal.payload));
  assert.equal(unlinkedExternal.payload.record?.user_id, null);
  assert.equal(unlinkedExternal.payload.record?.version, 3);
  const crossTenantLink = await jsonRequest(baseUrl, externalItem + '/link-account', {
    token: ownerSession.token, method: 'POST',
    body: { expected_version: 3, user_id: otherOwner.id },
  });
  assert.equal(crossTenantLink.response.status, 422);
  assert.equal(crossTenantLink.payload.error?.code, 'WORKFORCE_USER_MEMBERSHIP_REQUIRED');

  const replay = await jsonRequest(baseUrl, collection, {
    token: ownerSession.token,
    method: 'POST',
    headers: { 'Idempotency-Key': 'workforce-http-member-' + suffix },
    body: { user_id: memberUser.id, member_type: 'PROVIDER', display_name: 'HTTP Provider', employee_number: 'EMP-HTTP-001', primary_location_id: primaryLocation.id, department_id: department.id, position_id: position.id },
  });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.payload.duplicate, true);
  assert.equal(replay.payload.record?.id, memberId, 'idempotent replay must return the original member');
  assert.equal(replay.payload.record?.employee_number, 'EMP-HTTP-001');

  const listed = await jsonRequest(baseUrl, collection, { token: ownerSession.token });
  assert.equal(listed.response.status, 200);
  assert.ok(listed.payload.records?.some(record => record.id === memberId));

  const item = collection + '/' + encodeURIComponent(memberId);
  const fetched = await jsonRequest(baseUrl, item, { token: ownerSession.token });
  assert.equal(fetched.response.status, 200);
  assert.equal(fetched.payload.record?.user_id, memberUser.id);

  const missingVersion = await jsonRequest(baseUrl, item, {
    token: ownerSession.token, method: 'PATCH', body: { display_name: 'Updated Provider' },
  });
  assert.equal(missingVersion.response.status, 400);
  assert.equal(missingVersion.payload.error?.code, 'WORKFORCE_EXPECTED_VERSION_REQUIRED');

  const activated = await jsonRequest(baseUrl, item + '/activate', {
    token: ownerSession.token, method: 'POST', body: { expected_version: 1 },
  });
  assert.equal(activated.response.status, 200, JSON.stringify(activated.payload));
  assert.equal(activated.payload.record?.status, 'ACTIVE');
  assert.equal(activated.payload.record?.version, 2);

  const updated = await jsonRequest(baseUrl, item, {
    token: ownerSession.token,
    method: 'PATCH',
    body: { expected_version: 2, display_name: 'Updated HTTP Provider' },
  });
  assert.equal(updated.response.status, 200, JSON.stringify(updated.payload));
  assert.equal(updated.payload.record?.display_name, 'Updated HTTP Provider');
  assert.equal(updated.payload.record?.version, 3);
  const locationUpdated = await jsonRequest(baseUrl, item, {
    token: ownerSession.token, method: 'PATCH',
    body: { expected_version: 3, primary_location_id: secondaryLocation.id },
  });
  assert.equal(locationUpdated.response.status, 200, JSON.stringify(locationUpdated.payload));
  assert.equal(locationUpdated.payload.record?.primary_location_id, secondaryLocation.id);
  assert.equal(locationUpdated.payload.record?.version, 4);

  const invalidLifecycle = await jsonRequest(baseUrl, item + '/complete', {
    token: ownerSession.token, method: 'POST', body: { expected_version: 3 },
  });
  assert.equal(invalidLifecycle.response.status, 400,
    'an operation not defined for the member entity must be rejected');

  // Exercise the remaining authenticated entity routes through the same live HTTP server.
  // These records use synthetic data and stay inside the isolated test tenant.
  const entityFixtures = [
    ['profiles', { member_id: memberId, effective_from: '2026-11-24T00:00:00.000Z', skills: ['HTTP regression skill'], visibility: 'ORGANIZATION' }],
    ['engagements', {
      member_id: memberId, engagement_type: 'EMPLOYMENT',
      starts_at: '2026-11-25T00:00:00.000Z', ends_at: '2026-12-26T08:00:00.000Z',
    }],
    ['shift-templates', {
      name: 'Morning Shift', start_local_time: '08:00', end_local_time: '16:30',
      timezone: 'Africa/Addis_Ababa', break_rules: [{ start_local_time: '12:00', end_local_time: '12:30' }],
      work_days: [1,2,3,4,5], department_id: department.id, position_id: position.id,
      location_id: primaryLocation.id, effective_from: '2026-11-25',
    }],
    ['calendars', {
      member_id: memberId, timezone: 'Africa/Addis_Ababa',
      effective_from: '2026-11-24T00:00:00.000Z',
      weekly_schedule: [{ day: 'THURSDAY', intervals: [{ start: '09:00', end: '17:00' }] }],
    }],
  ];
  const createdEntities = {};
  for (const [plural, body] of entityFixtures) {
    createdEntities[plural] = await createWorkforceRecord(
      baseUrl, ownerSession.token,
      '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/' + plural,
      'workforce-http-' + plural + '-' + suffix,
      body,
    );
  }


  const assessmentPath = item + '/availability-assessment';
  const unauthenticatedAssessment = await jsonRequest(baseUrl, assessmentPath, {
    method: 'POST',
    body: {
      starts_at: '2026-11-26T06:00:00.000Z',
      ends_at: '2026-11-26T07:00:00.000Z',
      timezone: 'Africa/Addis_Ababa',
    },
  });
  assert.equal(unauthenticatedAssessment.response.status, 401,
    'availability assessment requires an authenticated tenant session');
  const assessmentResponse = await jsonRequest(baseUrl, assessmentPath, {
    token: ownerSession.token,
    method: 'POST',
    body: {
      starts_at: '2026-11-26T06:00:00.000Z',
      ends_at: '2026-11-26T07:00:00.000Z',
      timezone: 'Africa/Addis_Ababa',
    },
  });
  assert.equal(assessmentResponse.response.status, 200, JSON.stringify(assessmentResponse.payload));
  assert.equal(assessmentResponse.payload.assessment?.state, 'UNKNOWN',
    'incomplete calendar and operational evidence must never be projected as AVAILABLE');
  assert.equal(assessmentResponse.payload.assessment?.is_booking, false);

  // A separate active engagement supplies the eligibility evidence for the
  // shift fixture while the original DRAFT engagement remains available for
  // the lifecycle transition assertions below.
  const shiftEngagement = await createWorkforceRecord(
    baseUrl, ownerSession.token,
    '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/engagements',
    'workforce-http-shift-engagement-' + suffix,
    { member_id: memberId, engagement_type: 'EMPLOYMENT',
      starts_at: '2026-11-25T00:00:00.000Z', ends_at: '2026-12-26T08:00:00.000Z' },
  );
  const shiftEngagementPath = '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/workforce/engagements/' + encodeURIComponent(shiftEngagement.id);
  const shiftEngagementSubmitted = await jsonRequest(baseUrl, shiftEngagementPath + '/submit', {
    token: ownerSession.token, method: 'POST', body: { expected_version: 1 },
  });
  assert.equal(shiftEngagementSubmitted.response.status, 200, JSON.stringify(shiftEngagementSubmitted.payload));
  const shiftEngagementActivated = await jsonRequest(baseUrl, shiftEngagementPath + '/activate', {
    token: ownerSession.token, method: 'POST', body: { expected_version: 2 },
  });
  assert.equal(shiftEngagementActivated.response.status, 200, JSON.stringify(shiftEngagementActivated.payload));

  const calendarId = createdEntities.calendars.id;
  const additionalFixtures = [
    ['calendar-exceptions', {
      calendar_id: calendarId, exception_type: 'HOLIDAY',
      starts_at: '2026-12-01T00:00:00.000Z', ends_at: '2026-12-02T00:00:00.000Z',
      all_day: true, reason: 'HTTP regression fixture',
    }],
    ['availability', {
      member_id: memberId, availability: 'AVAILABLE',
      starts_at: '2026-11-26T06:00:00.000Z', ends_at: '2026-11-26T14:00:00.000Z',
      timezone: 'Africa/Addis_Ababa', effective_from: '2026-11-24T00:00:00.000Z',
    }],
    ['assignments', {
      member_id: memberId, assignment_type: 'RESOURCE',
      starts_at: '2026-11-26T06:00:00.000Z', ends_at: '2026-11-26T14:00:00.000Z',
    }],
    ['shifts', {
      member_id: memberId,
      starts_at: '2026-11-26T06:00:00.000Z', ends_at: '2026-11-26T12:00:00.000Z',
      timezone: 'Africa/Addis_Ababa', break_rules: [],
    }],
    ['allocations', {
      member_id: memberId,
      starts_at: '2026-11-26T12:00:00.000Z', ends_at: '2026-11-26T13:00:00.000Z',
    }],
    ['utilization', {
      member_id: memberId,
      planned_starts_at: '2026-11-26T06:00:00.000Z',
      planned_ends_at: '2026-11-26T07:00:00.000Z',
      status: 'PLANNED', evidence_source: 'HTTP_REGRESSION',
    }],
  ];
  for (const [plural, body] of additionalFixtures) {
    createdEntities[plural] = await createWorkforceRecord(
      baseUrl, ownerSession.token,
      '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/' + plural,
      'workforce-http-' + plural + '-' + suffix,
      body,
    );
  }

  const locationAssignment = await createWorkforceRecord(
    baseUrl, ownerSession.token,
    '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/assignments',
    'workforce-http-location-assignment-' + suffix,
    { member_id: memberId, assignment_type: 'LOCATION', location_id: primaryLocation.id,
      starts_at: '2026-11-27T05:00:00.000Z', ends_at: '2026-11-27T13:30:00.000Z' },
  );
  for (const [plural, record] of Object.entries(createdEntities)) {
    const collectionPath = '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/' + plural;
    const read = await jsonRequest(baseUrl, collectionPath + '/' + encodeURIComponent(record.id), {
      token: ownerSession.token,
    });
    assert.equal(read.response.status, 200, plural + ' item read: ' + JSON.stringify(read.payload));
    assert.equal(read.payload.record?.id, record.id);
    const list = await jsonRequest(baseUrl, collectionPath, { token: ownerSession.token });
    assert.equal(list.response.status, 200, plural + ' collection read: ' + JSON.stringify(list.payload));
    assert.ok(list.payload.records?.some(item => item.id === record.id), plural + ' collection must include its created record');
  }
  const profileUpdate = await jsonRequest(baseUrl,
    '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/profiles/' + encodeURIComponent(createdEntities.profiles.id), {
      token: ownerSession.token, method: 'PATCH',
      body: { expected_version: 1, notes: 'Verified HTTP profile update', skills: ['HTTP regression skill','Inventory control'] },
    });
  assert.equal(profileUpdate.response.status, 200, JSON.stringify(profileUpdate.payload));
  assert.equal(profileUpdate.payload.record?.version, 2);
  assert.equal(profileUpdate.payload.record?.notes, 'Verified HTTP profile update');
  assert.deepEqual(profileUpdate.payload.record?.skills, ['HTTP regression skill','Inventory control']);

  async function lifecycle(plural, record, action, expectedVersion, expectedState, stateField = 'status') {
    const result = await jsonRequest(
      baseUrl,
      '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/' + plural + '/' +
        encodeURIComponent(record.id) + '/' + action,
      { token: ownerSession.token, method: 'POST', body: { expected_version: expectedVersion } },
    );
    assert.equal(result.response.status, 200, plural + '/' + action + ': ' + JSON.stringify(result.payload));
    assert.equal(result.payload.record?.[stateField], expectedState);
    assert.equal(result.payload.record?.version, expectedVersion + 1);
    return result.payload.record;
  }

  let shiftTemplate = await lifecycle('shift-templates', createdEntities['shift-templates'], 'deactivate', 1, 'INACTIVE');
  shiftTemplate = await lifecycle('shift-templates', shiftTemplate, 'activate', 2, 'ACTIVE');
  let engagement = await lifecycle('engagements', createdEntities.engagements, 'submit', 1, 'PENDING_APPROVAL');
  engagement = await lifecycle('engagements', engagement, 'activate', 2, 'ACTIVE');
  const activeLocationAssignment = await lifecycle('assignments', locationAssignment, 'activate', 1, 'ACTIVE');
  const generated = await jsonRequest(
    baseUrl,
    '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/shift-templates/' + encodeURIComponent(shiftTemplate.id) + '/generate',
    { token: ownerSession.token, method: 'POST', headers: { 'Idempotency-Key': 'workforce-http-generate-' + suffix },
      body: { expected_version: shiftTemplate.version, member_id: memberId, from_date: '2026-11-27', to_date: '2026-11-27' } },
  );
  assert.equal(generated.response.status, 201, JSON.stringify(generated.payload));
  assert.equal(generated.payload.created_count, 1);
  assert.equal(generated.payload.created_records?.[0]?.generated_local_date, '2026-11-27');
  assert.equal(generated.payload.created_records?.[0]?.starts_at, '2026-11-27T05:00:00.000Z');
  assert.equal(generated.payload.created_records?.[0]?.ends_at, '2026-11-27T13:30:00.000Z');
  assert.equal(generated.payload.created_records?.[0]?.timezone, 'Africa/Addis_Ababa');
  const generatedReplay = await jsonRequest(
    baseUrl,
    '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/shift-templates/' + encodeURIComponent(shiftTemplate.id) + '/generate',
    { token: ownerSession.token, method: 'POST', headers: { 'Idempotency-Key': 'workforce-http-generate-replay-' + suffix },
      body: { expected_version: shiftTemplate.version, member_id: memberId, from_date: '2026-11-27', to_date: '2026-11-27' } },
  );
  assert.equal(generatedReplay.response.status, 200, JSON.stringify(generatedReplay.payload));
  assert.equal(generatedReplay.payload.created_count, 0);
  assert.equal(generatedReplay.payload.existing_count, 1, 'repeated generation must return the existing dated shift');
  const replacementMember = await createWorkforceRecord(baseUrl, ownerSession.token, collection,
    'workforce-http-reassignment-member-' + suffix, {
      member_type: 'EMPLOYEE', display_name: 'Replacement HTTP Professional',
      primary_location_id: primaryLocation.id, department_id: department.id, position_id: position.id,
    });
  const activeReplacementMember = await lifecycle('members', replacementMember, 'activate', 1, 'ACTIVE');
  const replacementEngagement = await createWorkforceRecord(baseUrl, ownerSession.token,
    '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/engagements',
    'workforce-http-reassignment-engagement-' + suffix, {
      member_id: activeReplacementMember.id, engagement_type: 'EMPLOYMENT',
      starts_at: '2026-11-25T00:00:00.000Z', ends_at: '2026-12-26T08:00:00.000Z',
    });
  let replacementEngagementLifecycle = await lifecycle('engagements', replacementEngagement, 'submit', 1, 'PENDING_APPROVAL');
  replacementEngagementLifecycle = await lifecycle('engagements', replacementEngagementLifecycle, 'activate', 2, 'ACTIVE');
  const generatedShift = generated.payload.created_records[0];
  const shiftsPath = '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/shifts';
  const reassignShift = await jsonRequest(baseUrl, shiftsPath + '/' + encodeURIComponent(generatedShift.id) + '/reassign', {
    token: ownerSession.token, method: 'POST',
    body: { expected_version: generatedShift.version, member_id: activeReplacementMember.id, reason: 'Coverage transfer' },
  });
  assert.equal(reassignShift.response.status, 200, JSON.stringify(reassignShift.payload));
  assert.equal(reassignShift.payload.record?.member_id, activeReplacementMember.id);
  assert.equal(reassignShift.payload.record?.version, 2);
  const shiftHistory = await jsonRequest(baseUrl, shiftsPath + '/' + encodeURIComponent(generatedShift.id) + '/history', { token: ownerSession.token });
  assert.equal(shiftHistory.response.status, 200, JSON.stringify(shiftHistory.payload));
  assert.ok(shiftHistory.payload.records?.some(event => event.action === 'workforce.shift.reassigned' && event.metadata?.reason === 'Coverage transfer'));
  const staleReassignment = await jsonRequest(baseUrl, shiftsPath + '/' + encodeURIComponent(generatedShift.id) + '/reassign', {
    token: ownerSession.token, method: 'POST', body: { expected_version: 1, member_id: memberId, reason: 'Stale reassignment attempt' },
  });
  assert.equal(staleReassignment.response.status, 409, 'reassignment must enforce optimistic concurrency');
  const cancellationShift = await createWorkforceRecord(baseUrl, ownerSession.token, shiftsPath,
    'workforce-http-cancellation-shift-' + suffix, {
      member_id: memberId, starts_at: '2026-11-26T15:00:00.000Z', ends_at: '2026-11-26T16:00:00.000Z',
      timezone: 'Africa/Addis_Ababa', break_rules: [],
    });
  const missingCancellationReason = await jsonRequest(baseUrl, shiftsPath + '/' + encodeURIComponent(cancellationShift.id) + '/cancel', {
    token: ownerSession.token, method: 'POST', body: { expected_version: 1 },
  });
  assert.equal(missingCancellationReason.response.status, 400);
  const cancelledShift = await jsonRequest(baseUrl, shiftsPath + '/' + encodeURIComponent(cancellationShift.id) + '/cancel', {
    token: ownerSession.token, method: 'POST', body: { expected_version: 1, reason: 'Branch closed for maintenance' },
  });
  assert.equal(cancelledShift.response.status, 200, JSON.stringify(cancelledShift.payload));
  assert.equal(cancelledShift.payload.record?.status, 'CANCELLED');
  const cancellationHistory = await jsonRequest(baseUrl, shiftsPath + '/' + encodeURIComponent(cancellationShift.id) + '/history', { token: ownerSession.token });
  assert.ok(cancellationHistory.payload.records?.some(event => event.action === 'workforce.shift.cancel' && event.metadata?.reason === 'Branch closed for maintenance'));
  const leavePath = '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/leave-requests';
  const employeeMembers = await jsonRequest(baseUrl, collection, { token: employeeSession.token });
  assert.equal(employeeMembers.response.status, 200, JSON.stringify(employeeMembers.payload));
  assert.deepEqual(employeeMembers.payload.records?.map(item => item.id), [memberId],
    'staff Workforce member reads must be scoped to the linked employee');
  const leaveRequest = await createWorkforceRecord(baseUrl, employeeSession.token, leavePath,
    'workforce-http-employee-leave-' + suffix, {
      member_id: memberId, leave_category: 'ANNUAL',
      starts_at: '2026-12-10T00:00:00.000Z', ends_at: '2026-12-11T00:00:00.000Z',
      timezone: 'Africa/Addis_Ababa', reason: 'Employee planned leave', all_day: true,
    });
  assert.equal(leaveRequest.status, 'DRAFT');
  assert.equal(leaveRequest.requested_by, memberUser.id);
  const employeeLeaveSubmit = await jsonRequest(baseUrl, leavePath + '/' + encodeURIComponent(leaveRequest.id) + '/submit', {
    token: employeeSession.token, method: 'POST', body: { expected_version: 1 },
  });
  assert.equal(employeeLeaveSubmit.response.status, 200, JSON.stringify(employeeLeaveSubmit.payload));
  assert.equal(employeeLeaveSubmit.payload.record?.status, 'PENDING_APPROVAL');
  const employeeLeaveList = await jsonRequest(baseUrl, leavePath, { token: employeeSession.token });
  assert.equal(employeeLeaveList.response.status, 200, JSON.stringify(employeeLeaveList.payload));
  assert.ok(employeeLeaveList.payload.records?.some(item => item.id === leaveRequest.id));
  const employeeCannotApprove = await jsonRequest(baseUrl, leavePath + '/' + encodeURIComponent(leaveRequest.id) + '/approve', {
    token: employeeSession.token, method: 'POST', body: { expected_version: 2 },
  });
  assert.equal(employeeCannotApprove.response.status, 403, 'employees cannot approve leave requests');
  const managerApproval = await jsonRequest(baseUrl, leavePath + '/' + encodeURIComponent(leaveRequest.id) + '/approve', {
    token: managerSession.token, method: 'POST', body: { expected_version: 2, decision_reason: 'Coverage confirmed' },
  });
  assert.equal(managerApproval.response.status, 200, JSON.stringify(managerApproval.payload));
  assert.equal(managerApproval.payload.record?.status, 'APPROVED');
  const leaveHistory = await jsonRequest(baseUrl, leavePath + '/' + encodeURIComponent(leaveRequest.id) + '/history', {
    token: managerSession.token,
  });
  assert.equal(leaveHistory.response.status, 200, JSON.stringify(leaveHistory.payload));
  assert.ok(leaveHistory.payload.records?.some(event => event.action === 'workforce.leave_request.approve'));
  const leaveCancellation = await jsonRequest(baseUrl, leavePath + '/' + encodeURIComponent(leaveRequest.id) + '/cancel', {
    token: managerSession.token, method: 'POST',
    body: { expected_version: 3, reason: 'Coverage plan changed' },
  });
  assert.equal(leaveCancellation.response.status, 200, JSON.stringify(leaveCancellation.payload));
  assert.equal(leaveCancellation.payload.record?.status, 'CANCELLED');

  const managerCreatedLeave = await createWorkforceRecord(baseUrl, managerSession.token, leavePath,
    'workforce-http-manager-created-leave-' + suffix, {
      member_id: memberId, leave_category: 'PERSONAL',
      starts_at: '2026-12-12T00:00:00.000Z', ends_at: '2026-12-13T00:00:00.000Z',
      timezone: 'Africa/Addis_Ababa', reason: 'Manager-created leave request',
    });
  const managerLeaveSubmit = await jsonRequest(baseUrl, leavePath + '/' + encodeURIComponent(managerCreatedLeave.id) + '/submit', {
    token: managerSession.token, method: 'POST', body: { expected_version: 1 },
  });
  assert.equal(managerLeaveSubmit.response.status, 200);
  const selfApproval = await jsonRequest(baseUrl, leavePath + '/' + encodeURIComponent(managerCreatedLeave.id) + '/approve', {
    token: managerSession.token, method: 'POST', body: { expected_version: 2 },
  });
  assert.equal(selfApproval.response.status, 403, 'a requester cannot approve their own leave request');

  const absencePath = '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/absences';
  const absence = await createWorkforceRecord(baseUrl, managerSession.token, absencePath,
    'workforce-http-absence-' + suffix, {
      member_id: memberId, absence_type: 'SICKNESS',
      starts_at: '2026-12-14T06:00:00.000Z', ends_at: '2026-12-14T12:00:00.000Z',
      timezone: 'Africa/Addis_Ababa', reason: 'Unplanned sickness',
    });
  assert.equal(absence.status, 'RECORDED');
  const voidAbsence = await jsonRequest(baseUrl, absencePath + '/' + encodeURIComponent(absence.id) + '/void', {
    token: managerSession.token, method: 'POST',
    body: { expected_version: 1, reason: 'Absence record corrected' },
  });
  assert.equal(voidAbsence.response.status, 200, JSON.stringify(voidAbsence.payload));
  assert.equal(voidAbsence.payload.record?.status, 'VOIDED');
  const absenceHistory = await jsonRequest(baseUrl, absencePath + '/' + encodeURIComponent(absence.id) + '/history', {
    token: managerSession.token,
  });
  assert.ok(absenceHistory.payload.records?.some(event => event.action === 'workforce.absence.void'
    && event.metadata?.reason === 'Absence record corrected'));

  const policyPath = '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/scheduling-policies';
  const policy = await createWorkforceRecord(baseUrl, managerSession.token, policyPath,
    'workforce-http-scheduling-policy-' + suffix, {
      name: 'Operations scheduling policy', effective_from: '2026-11-25',
      rules: { max_shift_minutes: 600, max_daily_minutes: 600, max_weekly_minutes: 2400,
        minimum_rest_minutes: 660, minimum_break_after_minutes: 360,
        minimum_break_duration_minutes: 30, max_consecutive_days: 6,
        allow_overrides: true, allow_unknown_overrides: false,
        required_qualifications: ['First Aid'], location_policy: 'ASSIGNED_ONLY',
        enforcement: { max_daily_minutes: 'WARN' } },
    });
  assert.equal(policy.status, 'DRAFT');
  assert.equal(policy.version, 1);
  const policyList = await jsonRequest(baseUrl, policyPath, { token: managerSession.token });
  assert.equal(policyList.response.status, 200, JSON.stringify(policyList.payload));
  assert.ok(policyList.payload.records?.some(item => item.id === policy.id));
  const policyActivation = await jsonRequest(baseUrl, policyPath + '/' + encodeURIComponent(policy.id) + '/activate', {
    token: managerSession.token, method: 'POST', body: { expected_version: 1 },
  });
  assert.equal(policyActivation.response.status, 200, JSON.stringify(policyActivation.payload));
  assert.equal(policyActivation.payload.record?.status, 'ACTIVE');
  assert.equal(policyActivation.payload.record?.version, 2);
  const policyUpdate = await jsonRequest(baseUrl, policyPath + '/' + encodeURIComponent(policy.id), {
    token: managerSession.token, method: 'PATCH',
    body: { expected_version: 2, rules: { max_shift_minutes: 540, max_daily_minutes: 540, allow_overrides: true,
      allow_unknown_overrides: false, enforcement: { max_daily_minutes: 'BLOCK' } } },
  });
  assert.equal(policyUpdate.response.status, 200, JSON.stringify(policyUpdate.payload));
  assert.equal(policyUpdate.payload.record?.version, 3);
  assert.equal(policyUpdate.payload.record?.rules?.max_shift_minutes, 540);
  const policyHistory = await jsonRequest(baseUrl, policyPath + '/' + encodeURIComponent(policy.id) + '/history', {
    token: managerSession.token,
  });
  assert.equal(policyHistory.response.status, 200, JSON.stringify(policyHistory.payload));
  assert.ok(policyHistory.payload.records?.some(event => event.action === 'workforce.scheduling_policy.updated'
    && event.metadata?.policy_version === 3 && event.metadata?.rules?.max_shift_minutes === 540),
  'policy history must retain the exact rule snapshot for each version');
  const shiftPath = '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/shifts';
  const overriddenShift = await createWorkforceRecord(baseUrl, managerSession.token, shiftPath,
    'workforce-http-scheduling-override-' + suffix, {
      member_id: memberId, starts_at: '2026-12-20T06:00:00.000Z',
      ends_at: '2026-12-20T16:00:00.000Z', timezone: 'Africa/Addis_Ababa',
      break_rules: [], override_reason: 'Emergency coverage approved by manager',
    });
  assert.equal(overriddenShift.constraint_state, 'BLOCKING_CONFLICT');
  assert.equal(overriddenShift.constraint_policy_version, 3);
  assert.equal(overriddenShift.constraint_override_reason, 'Emergency coverage approved by manager');
  assert.equal(overriddenShift.constraint_override_by, managerUser.id);
  assert.ok(overriddenShift.constraint_override_at);
  const overriddenShiftHistory = await jsonRequest(baseUrl, shiftPath + '/' + encodeURIComponent(overriddenShift.id) + '/history', {
    token: managerSession.token,
  });
  assert.equal(overriddenShiftHistory.response.status, 200, JSON.stringify(overriddenShiftHistory.payload));
  assert.ok(overriddenShiftHistory.payload.records?.some(event => event.action === 'workforce.shift.created'
    && event.metadata?.constraint_state === 'BLOCKING_CONFLICT'
    && event.metadata?.constraint_override_reason === 'Emergency coverage approved by manager'),
  'the original conflict and manager override reason must both remain in audit history');

  const crossTenantPolicyRead = await jsonRequest(baseUrl, policyPath, { token: otherSession.token });
  assert.equal(crossTenantPolicyRead.response.status, 403,
    'a session from another tenant must not read scheduling policies');

  engagement = await lifecycle('engagements', engagement, 'suspend', 3, 'SUSPENDED');
  engagement = await lifecycle('engagements', engagement, 'activate', 4, 'ACTIVE');
  await lifecycle('engagements', engagement, 'end', 5, 'ENDED');
  await lifecycle('calendar-exceptions', createdEntities['calendar-exceptions'], 'cancel', 1, 'CANCELLED');
  await lifecycle('assignments', createdEntities.assignments, 'activate', 1, 'ACTIVE');
  await lifecycle('assignments', activeLocationAssignment, 'suspend', 2, 'SUSPENDED');
  let shift = await lifecycle('shifts', createdEntities.shifts, 'confirm', 1, 'CONFIRMED');
  shift = await lifecycle('shifts', shift, 'start', 2, 'IN_PROGRESS');
  await lifecycle('shifts', shift, 'complete', 3, 'COMPLETED');
  let allocation = await lifecycle('allocations', createdEntities.allocations, 'submit', 1, 'PENDING_APPROVAL', 'state');
  allocation = await lifecycle('allocations', allocation, 'approve', 2, 'COMMITTED', 'state');
  await lifecycle('allocations', allocation, 'release', 3, 'RELEASED', 'state');
  let utilization = await lifecycle('utilization', createdEntities.utilization, 'start', 1, 'IN_PROGRESS');
  await lifecycle('utilization', utilization, 'complete', 2, 'COMPLETED');

  const crossTenantTemplateRead = await jsonRequest(
    baseUrl,
    '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/shift-templates',
    { token: otherSession.token },
  );
  assert.equal(crossTenantTemplateRead.response.status, 403,
    'a session from another tenant must not read shift templates');

  const crossTenantRead = await jsonRequest(
    baseUrl,
    '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/members',
    { token: otherSession.token },
  );
  assert.equal(crossTenantRead.response.status, 403,
    'a session from another tenant must not read Workforce records');

  const crossTenantWrite = await jsonRequest(
    baseUrl,
    '/tenants/' + encodeURIComponent(tenant.chatId) + '/workforce/members',
    {
      token: otherSession.token,
      method: 'POST',
      headers: { 'Idempotency-Key': 'cross-tenant-' + suffix },
      body: { user_id: otherOwner.id, member_type: 'PROVIDER' },
    },
  );
  assert.equal(crossTenantWrite.response.status, 403,
    'a session from another tenant must not create Workforce records');

  console.log('Workforce authenticated HTTP API regression: PASS');
  console.log('Session authentication, Workforce CRUD, leave/absence lifecycle, versioned scheduling policy administration, template-based dated shift generation, DST-aware time conversion, idempotency, conflict detection, optimistic concurrency, and tenant isolation: VERIFIED');
} catch (error) {
  console.error(error);
  if (output) console.error('Backend output:\n' + output);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await rm(tempDir, { recursive: true, force: true });
}

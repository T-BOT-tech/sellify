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
      starts_at: '2026-11-26T08:00:00.000Z', ends_at: '2026-12-26T08:00:00.000Z',
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
      starts_at: '2026-11-26T06:00:00.000Z', ends_at: '2026-11-26T14:00:00.000Z',
      timezone: 'Africa/Addis_Ababa', break_rules: [],
    }],
    ['allocations', {
      member_id: memberId,
      starts_at: '2026-11-26T06:00:00.000Z', ends_at: '2026-11-26T07:00:00.000Z',
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
      starts_at: '2026-11-27T06:00:00.000Z', ends_at: '2026-11-27T14:00:00.000Z' },
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

  let engagement = await lifecycle('engagements', createdEntities.engagements, 'submit', 1, 'PENDING_APPROVAL');
  engagement = await lifecycle('engagements', engagement, 'activate', 2, 'ACTIVE');
  engagement = await lifecycle('engagements', engagement, 'suspend', 3, 'SUSPENDED');
  engagement = await lifecycle('engagements', engagement, 'activate', 4, 'ACTIVE');
  await lifecycle('engagements', engagement, 'end', 5, 'ENDED');
  await lifecycle('calendar-exceptions', createdEntities['calendar-exceptions'], 'cancel', 1, 'CANCELLED');
  await lifecycle('assignments', createdEntities.assignments, 'activate', 1, 'ACTIVE');
  const activeLocationAssignment = await lifecycle('assignments', locationAssignment, 'activate', 1, 'ACTIVE');
  await lifecycle('assignments', activeLocationAssignment, 'suspend', 2, 'SUSPENDED');
  let shift = await lifecycle('shifts', createdEntities.shifts, 'confirm', 1, 'CONFIRMED');
  shift = await lifecycle('shifts', shift, 'start', 2, 'IN_PROGRESS');
  await lifecycle('shifts', shift, 'complete', 3, 'COMPLETED');
  let allocation = await lifecycle('allocations', createdEntities.allocations, 'submit', 1, 'PENDING_APPROVAL', 'state');
  allocation = await lifecycle('allocations', allocation, 'approve', 2, 'COMMITTED', 'state');
  await lifecycle('allocations', allocation, 'release', 3, 'RELEASED', 'state');
  let utilization = await lifecycle('utilization', createdEntities.utilization, 'start', 1, 'IN_PROGRESS');
  await lifecycle('utilization', utilization, 'complete', 2, 'COMPLETED');

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
  console.log('Session authentication, all Workforce entity CRUD routes, entity-specific lifecycle, idempotency, optimistic concurrency, and tenant isolation: VERIFIED');
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

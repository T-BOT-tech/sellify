import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-customer-http-'));
const port = await new Promise((resolve, reject) => {
  const probe = createNetServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const value = probe.address().port;
    probe.close(error => error ? reject(error) : resolve(value));
  });
});
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: 'test',
  SELLIFY_DATA_DIR: dataDir,
  SELLIFY_BACKUP_DIR: path.join(dataDir, 'backups'),
};
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_BACKUP_DIR = path.join(dataDir, 'backups');

const child = spawn(process.execPath, [path.join(root, 'backend/server.js')], {
  cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'],
});
let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => { stderr += chunk; });

async function request(url, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${url}`, options);
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

try {
  let ready = false;
  for (let i = 0; i < 120; i += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) { ready = true; break; }
    } catch {}
    if (child.exitCode !== null) throw new Error(`backend exited: ${child.exitCode} ${stderr}`);
    await sleep(50);
  }
  assert.equal(ready, true, `backend did not become ready: ${stderr}`);

  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram(`customer-http-owner-${suffix}`, 'Customer HTTP Owner');
  const tenant = await store.createTenantForUser({
    userId: owner.id, sellerName: `Customer HTTP Tenant ${suffix}`,
    businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const staff = await store.getOrCreateUserByTelegram(`customer-http-staff-${suffix}`, 'Customer HTTP Staff');
  await store.ensureMembership(staff.id, tenant.chatId, 'staff');
  const otherOwner = await store.getOrCreateUserByTelegram(`customer-http-other-${suffix}`, 'Customer HTTP Other Owner');
  const otherTenant = await store.createTenantForUser({
    userId: otherOwner.id, sellerName: `Customer HTTP Other Tenant ${suffix}`,
    businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });

  const ownerSession = await store.createSession({
    userId: owner.id, chatId: tenant.chatId, deviceName: 'Customer HTTP owner',
  });
  const staffSession = await store.createSession({
    userId: staff.id, chatId: tenant.chatId, deviceName: 'Customer HTTP staff',
  });
  const otherSession = await store.createSession({
    userId: otherOwner.id, chatId: otherTenant.chatId, deviceName: 'Customer HTTP other tenant',
  });

  const base = `/tenants/${encodeURIComponent(tenant.chatId)}/customers`;
  const auth = token => ({ Authorization: `Bearer ${token}` });
  const jsonAuth = token => ({ ...auth(token), 'Content-Type': 'application/json' });

  const unauthenticated = await request(base);
  assert.equal(unauthenticated.response.status, 401, 'customer reads must require a session');

  const crossTenantRead = await request(base, { headers: auth(otherSession.token) });
  assert.equal(crossTenantRead.response.status, 403, 'another tenant session cannot read this tenant customer list');

  const conflictingCustomerId = `foreign-customer-id-${suffix}`;
  await store.upsertCustomer(otherTenant.chatId, {
    id: conflictingCustomerId, name: 'Private Other Tenant Customer',
  });
  const idCollision = await request(base, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ id: conflictingCustomerId, name: 'Must Not Claim Foreign ID' }),
  });
  assert.equal(idCollision.response.status, 409, 'a caller cannot reuse a customer ID owned by another organization');
  assert.equal(idCollision.json.error?.code, 'CUSTOMER_ID_CONFLICT');
  const foreignIdLookup = await request(`${base}/${encodeURIComponent(conflictingCustomerId)}`, {
    headers: auth(ownerSession.token),
  });
  assert.equal(foreignIdLookup.response.status, 404,
    'rejecting a foreign customer ID must not reveal the other organization customer');

  const staffRead = await request(base, { headers: auth(staffSession.token) });
  assert.equal(staffRead.response.status, 200, 'staff may read customers');

  const deniedStaffCreate = await request(base, {
    method: 'POST',
    headers: jsonAuth(staffSession.token),
    body: JSON.stringify({ name: 'Staff Must Not Create' }),
  });
  assert.equal(deniedStaffCreate.response.status, 403, 'staff view permission does not permit customer management');

  const staffSyncCustomerId = `staff-sync-customer-${suffix}`;
  const staffSyncEventId = `staff-sync-customer-event-${suffix}`;
  const deniedStaffSync = await request(`/events/${encodeURIComponent(tenant.chatId)}`, {
    method: 'POST',
    headers: jsonAuth(staffSession.token),
    body: JSON.stringify({ events: [{
      eventId: staffSyncEventId,
      eventType: 'customer.upsert',
      aggregateType: 'customer',
      aggregateId: staffSyncCustomerId,
      occurredAt: new Date().toISOString(),
      payload: { id: staffSyncCustomerId, name: 'Staff Must Not Sync Customer' },
    }] }),
  });
  assert.equal(deniedStaffSync.response.status, 200, 'event batch reports per-event authorization rejection');
  assert.equal(deniedStaffSync.json.results?.[0]?.status, 'rejected',
    'customer.upsert must be rejected for a staff member without customers:manage');
  assert.match(deniedStaffSync.json.results?.[0]?.error || '', /Customer management permission required/);
  assert.equal(await store.getCustomer(tenant.chatId, staffSyncCustomerId), null,
    'unauthorized customer.upsert must not reach the canonical customer store');

  const created = await request(base, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ name: 'HTTP Audit Customer', phone: '+251911000001' }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.json));
  const customerId = created.json.customer?.id;
  assert.ok(customerId, 'customer creation returns the canonical customer');

  const updated = await request(`${base}/${encodeURIComponent(customerId)}`, {
    method: 'PATCH',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ notes: 'Updated through authenticated HTTP boundary' }),
  });
  assert.equal(updated.response.status, 200, JSON.stringify(updated.json));
  assert.equal(updated.json.customer.notes, 'Updated through authenticated HTTP boundary');

  const aliasUpdated = await request(`${base}/${encodeURIComponent(customerId)}`, {
    method: 'PATCH',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({
      customer_name: 'Updated Customer Alias',
      customer_type: 'business',
    }),
  });
  assert.equal(aliasUpdated.response.status, 200, JSON.stringify(aliasUpdated.json));
  assert.equal(aliasUpdated.json.customer.name, 'Updated Customer Alias',
    'PATCH must apply supported snake_case customer_name aliases');
  assert.equal(aliasUpdated.json.customer.customerType, 'business',
    'PATCH must apply supported snake_case customer_type aliases over existing camelCase values');

  const missing = await request(`${base}/missing-customer-${suffix}`, { headers: auth(ownerSession.token) });
  assert.equal(missing.response.status, 404, 'customer lookup is tenant-scoped and returns not found');

  const otherBase = `/tenants/${encodeURIComponent(otherTenant.chatId)}/customers`;
  const crossTenantCustomerList = await request(otherBase, { headers: auth(otherSession.token) });
  assert.equal(crossTenantCustomerList.response.status, 200);
  assert.equal(crossTenantCustomerList.json.customers.some(customer => customer.id === customerId), false,
    'a customer must never appear in another organization customer list');

  const crossTenantCustomerRead = await request(`${otherBase}/${encodeURIComponent(customerId)}`, {
    headers: auth(otherSession.token),
  });
  assert.equal(crossTenantCustomerRead.response.status, 404,
    'a valid session for another tenant must not resolve this customer ID');

  const crossTenantCustomerUpdate = await request(`${otherBase}/${encodeURIComponent(customerId)}`, {
    method: 'PATCH',
    headers: jsonAuth(otherSession.token),
    body: JSON.stringify({ name: 'Cross-tenant overwrite attempt' }),
  });
  assert.equal(crossTenantCustomerUpdate.response.status, 404,
    'a valid owner in another tenant must not update this customer ID');

  const malformedJson = await request(base, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: '{"name":',
  });
  assert.equal(malformedJson.response.status, 400,
    'malformed JSON must be rejected at the shared HTTP body boundary');
  assert.equal(malformedJson.json.error?.message, 'Invalid JSON body');
  assert.equal(malformedJson.json.error?.status, 400);

  const invalidCustomer = await request(base, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ email: 'not-enough-to-identify-a-customer@example.test' }),
  });
  assert.equal(invalidCustomer.response.status, 400,
    'customer creation must require at least a name or phone number');

  const db = store.getDatabaseForTests();
  const organizationId = String(db.prepare(
    'SELECT organization_id FROM tenants WHERE chat_id = ?'
  ).get(tenant.chatId).organization_id);
  const auditRows = db.prepare(`
    SELECT action, entity_id, actor_id, device_id, organization_id, chat_id
    FROM audit_events
    WHERE entity_type = 'customer' AND entity_id = ?
    ORDER BY id ASC
  `).all(customerId);
  assert.deepEqual(auditRows.map(row => row.action), ['customer.created', 'customer.updated', 'customer.updated']);
  for (const event of auditRows) {
    assert.equal(String(event.actor_id), String(owner.id),
      `${event.action} must persist the authenticated user in canonical audit_events.actor_id`);
    assert.equal(String(event.device_id), String(ownerSession.deviceId),
      `${event.action} must persist the authenticated device in canonical audit_events.device_id`);
    assert.equal(String(event.organization_id), organizationId,
      'customer audit event must retain canonical organization scope');
    assert.equal(String(event.chat_id), String(tenant.chatId));
  }

  const deduplicated = await request(base, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ name: 'HTTP Audit Customer Updated', phone: '+251911000001' }),
  });
  assert.equal(deduplicated.response.status, 201);
  assert.equal(deduplicated.json.customer.id, customerId,
    'phone natural-key matching must update the existing organization customer rather than create a duplicate');
  assert.equal(deduplicated.json.customer.name, 'HTTP Audit Customer Updated');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM customers WHERE organization_id = ? AND phone = ?')
    .get(organizationId, '+251911000001').count, 1,
    'phone natural-key matching must not create duplicate customer rows');

  const syncCustomerId = `sync-customer-${suffix}`;
  const syncEventId = `customer-sync-event-${suffix}`;
  const syncEvent = await request(`/events/${encodeURIComponent(tenant.chatId)}`, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ events: [{
      eventId: syncEventId,
      eventType: 'customer.upsert',
      aggregateType: 'customer',
      aggregateId: syncCustomerId,
      occurredAt: new Date().toISOString(),
      payload: { id: syncCustomerId, name: 'Customer Sync Audit', source: 'http-regression' },
    }] }),
  });
  assert.equal(syncEvent.response.status, 200);
  assert.equal(syncEvent.json.results?.[0]?.status, 'processed',
    'owner customer.upsert must pass the authenticated HTTP event boundary');
  const syncAudit = db.prepare(`
    SELECT actor_id, device_id, organization_id
    FROM audit_events WHERE entity_type = 'customer' AND entity_id = ?
      AND action = 'customer.created'
  `).get(syncCustomerId);
  assert.equal(String(syncAudit.actor_id), String(owner.id),
    'customer.upsert sync must preserve the authenticated event actor in audit_events.actor_id');
  assert.equal(String(syncAudit.device_id), String(ownerSession.deviceId),
    'customer.upsert sync must preserve the authenticated event device in audit_events.device_id');
  assert.equal(String(syncAudit.organization_id), organizationId);

  const syncReceipt = db.prepare(
    'SELECT actor_id, device_id FROM sync_events WHERE event_id = ?'
  ).get(syncEventId);
  assert.equal(String(syncReceipt.actor_id), String(owner.id));
  assert.equal(String(syncReceipt.device_id), String(ownerSession.deviceId));

  // Customer sync must obey the shared event replay contract: exact retries
  // return the existing receipt without re-running the canonical upsert.
  const exactSyncReplay = await request(`/events/${encodeURIComponent(tenant.chatId)}`, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ events: [{
      eventId: syncEventId,
      eventType: 'customer.upsert',
      aggregateType: 'customer',
      aggregateId: syncCustomerId,
      occurredAt: new Date().toISOString(),
      payload: { id: syncCustomerId, name: 'Customer Sync Audit', source: 'http-regression' },
    }] }),
  });
  assert.equal(exactSyncReplay.response.status, 200);
  assert.equal(exactSyncReplay.json.results?.[0]?.status, 'processed');
  assert.equal(exactSyncReplay.json.results?.[0]?.duplicate, true,
    'an exact customer event retry must be recognized as a duplicate');
  assert.equal(db.prepare(`
    SELECT COUNT(*) AS count FROM audit_events
    WHERE entity_type = 'customer' AND entity_id = ? AND action = 'customer.created'
  `).get(syncCustomerId).count, 1,
  'an exact customer event retry must not execute the canonical customer upsert again');

  const changedSyncReplay = await request(`/events/${encodeURIComponent(tenant.chatId)}`, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ events: [{
      eventId: syncEventId,
      eventType: 'customer.upsert',
      aggregateType: 'customer',
      aggregateId: syncCustomerId,
      occurredAt: new Date().toISOString(),
      payload: { id: syncCustomerId, name: 'Changed Customer Sync Payload', source: 'http-regression' },
    }] }),
  });
  assert.equal(changedSyncReplay.json.results?.[0]?.status, 'rejected');
  assert.equal(changedSyncReplay.json.results?.[0]?.code, 'EVENT_ID_REUSED',
    'reusing a customer event ID with changed payload must fail closed');
  assert.equal((await store.getCustomer(tenant.chatId, syncCustomerId)).name, 'Customer Sync Audit',
    'a conflicting customer event must not mutate the canonical customer');

  const crossOrgSyncReplay = await request(`/events/${encodeURIComponent(otherTenant.chatId)}`, {
    method: 'POST',
    headers: jsonAuth(otherSession.token),
    body: JSON.stringify({ events: [{
      eventId: syncEventId,
      eventType: 'customer.upsert',
      aggregateType: 'customer',
      aggregateId: syncCustomerId,
      occurredAt: new Date().toISOString(),
      payload: { id: syncCustomerId, name: 'Customer Sync Audit', source: 'http-regression' },
    }] }),
  });
  assert.equal(crossOrgSyncReplay.json.results?.[0]?.status, 'rejected');
  assert.equal(crossOrgSyncReplay.json.results?.[0]?.code, 'EVENT_ID_REUSED',
    'another organization cannot replay a customer event ID owned by this organization');
  assert.equal(await store.getCustomer(otherTenant.chatId, syncCustomerId), null,
    'cross-organization event ID reuse must not create a customer in the other tenant');

  console.log('Customer HTTP authorization, tenant isolation, and audit actor provenance regression: PASS');
} finally {
  child.kill('SIGTERM');
  await rm(dataDir, { recursive: true, force: true });
}
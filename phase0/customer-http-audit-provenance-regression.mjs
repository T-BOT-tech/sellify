import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { setTimeout as sleep } from 'node:timers/promises';

// Exercise the real local Customer upsert implementation with a sparse
// order-shaped payload before starting the backend integration regression.
const customerModuleSource = await readFile(
  new URL('../app/src/customers.js', import.meta.url), 'utf8'
);
const normalizeSource = customerModuleSource.match(/function normalize\(value = \{\}\) \{[\s\S]*?^\}/m)?.[0];
const localUpsertSource = customerModuleSource.match(/export function upsertLocalCustomer\(input = \{\}\) \{[\s\S]*?^\}/m)?.[0]
  ?.replace('export function', 'function');
assert.ok(normalizeSource && localUpsertSource, 'local Customer normalization and upsert functions must remain inspectable');
const localCustomers = [{
  id: 'local-sparse-customer',
  name: 'Existing Local Customer',
  phone: '+251911000099',
  email: 'local-preserve@example.test',
  address: 'Local preserved address',
  taxId: 'LOCAL-TAX-99',
  notes: 'Local preserved notes',
  customerType: 'business',
  status: 'inactive',
  source: 'manual',
  createdAt: 1,
}];
const localCustomerSandbox = {
  customers: localCustomers,
  uid: () => 'generated-local-customer',
  setCustomers: () => {},
  persist: () => {},
  findCustomerById: id => localCustomers.find(customer => String(customer.id) === String(id)) || null,
  findCustomerByContact: (name, phone) => localCustomers.find(customer =>
    (phone && customer.phone === phone) || (!phone && customer.name.toLowerCase() === String(name).toLowerCase())
  ) || null,
};
const localUpsert = vm.runInNewContext(
  `${normalizeSource}\n${localUpsertSource}\nupsertLocalCustomer`,
  localCustomerSandbox
);
const locallyUpdated = localUpsert({
  name: 'Existing Local Customer Updated',
  phone: '+251911000099',
  source: 'order',
});
assert.equal(locallyUpdated.email, 'local-preserve@example.test',
  'sparse local order upsert must preserve email');
assert.equal(locallyUpdated.address, 'Local preserved address');
assert.equal(locallyUpdated.taxId, 'LOCAL-TAX-99');
assert.equal(locallyUpdated.notes, 'Local preserved notes');
assert.equal(locallyUpdated.customerType, 'business');
assert.equal(locallyUpdated.status, 'inactive');
const locallyCleared = localUpsert({
  name: 'Existing Local Customer Updated',
  phone: '+251911000099',
  email: '',
  source: 'manual',
});
assert.equal(locallyCleared.email, '',
  'an explicit empty local editor value must clear email');
assert.equal(locallyCleared.address, 'Local preserved address',
  'clearing one local field must not clear omitted fields');

// Tenant switches can overlap in-flight Customer requests. Exercise the real
// exported sync/load functions and prove stale responses cannot contaminate the
// next tenant's shared local Customer cache.
const syncSource = customerModuleSource.match(/export async function syncCustomer\(customer\) \{[\s\S]*?^\}/m)?.[0]
  ?.replace('export async function', 'async function');
const loadSource = customerModuleSource.match(/export async function loadCustomers\(\{ query = '' \} = \{\}\) \{[\s\S]*?^\}/m)?.[0]
  ?.replace('export async function', 'async function');
assert.ok(syncSource && loadSource, 'Customer sync and load functions must remain inspectable');
let resolveCustomerSync;
let resolveCustomerLoad;
let persistCount = 0;
let localMutationCount = 0;
const tenantRaceSandbox = {
  config: { chatId: 'tenant-a', sessionToken: 'token-a' },
  customers: [],
  setCustomers: null,
  api: () => new Promise(resolve => { resolveCustomerSync = resolve; }),
  upsertLocalCustomer: value => { localMutationCount += 1; return value; },
  persist: () => { persistCount += 1; },
  console: { warn: () => {} },
};
tenantRaceSandbox.setCustomers = next => { tenantRaceSandbox.customers = next; };
const customerAsyncFunctions = vm.runInNewContext(
  `${syncSource}\n${loadSource}\n({ syncCustomer, loadCustomers })`,
  tenantRaceSandbox
);
const staleSync = customerAsyncFunctions.syncCustomer({
  id: 'tenant-a-customer', name: 'Tenant A Customer',
});
tenantRaceSandbox.config.chatId = 'tenant-b';
tenantRaceSandbox.config.sessionToken = 'token-b';
resolveCustomerSync({ customer: { id: 'tenant-a-customer', name: 'Tenant A Customer' } });
assert.equal(await staleSync, null,
  'a customer sync response from a previous tenant must be discarded');
assert.equal(localMutationCount, 0,
  'a stale customer sync response must not mutate the current tenant cache');
assert.equal(persistCount, 0,
  'a stale customer sync response must not persist into the current tenant cache');

tenantRaceSandbox.config.chatId = 'tenant-a';
tenantRaceSandbox.config.sessionToken = 'token-a';
tenantRaceSandbox.customers = [{ id: 'tenant-b-customer', name: 'Tenant B Customer' }];
tenantRaceSandbox.api = () => new Promise(resolve => { resolveCustomerLoad = resolve; });
const staleLoad = customerAsyncFunctions.loadCustomers();
tenantRaceSandbox.config.chatId = 'tenant-b';
tenantRaceSandbox.config.sessionToken = 'token-b';
resolveCustomerLoad({ customers: [{ id: 'tenant-a-customer', name: 'Tenant A Customer' }] });
const currentTenantCustomers = await staleLoad;
assert.equal(currentTenantCustomers[0]?.id, 'tenant-b-customer',
  'a stale customer list response must leave the current tenant cache unchanged');
assert.equal(tenantRaceSandbox.customers[0]?.id, 'tenant-b-customer');
assert.equal(persistCount, 0,
  'a stale customer list response must not persist into the current tenant cache');

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

  const invalidCustomerBody = await request(base, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify(null),
  });
  assert.equal(invalidCustomerBody.response.status, 400,
    'a null customer request body must be rejected as invalid input rather than causing a server error');

  const created = await request(base, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ name: 'HTTP Audit Customer', phone: '+251911000001' }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.json));
  const customerId = created.json.customer?.id;
  assert.ok(customerId, 'customer creation returns the canonical customer');

  const staffCustomerRead = await request(`${base}/${encodeURIComponent(customerId)}`, {
    headers: auth(staffSession.token),
  });
  assert.equal(staffCustomerRead.response.status, 200,
    'staff with customers:view may read an individual customer');

  const deniedStaffPatch = await request(`${base}/${encodeURIComponent(customerId)}`, {
    method: 'PATCH',
    headers: jsonAuth(staffSession.token),
    body: JSON.stringify({ notes: 'Staff must not modify customer details' }),
  });
  assert.equal(deniedStaffPatch.response.status, 403,
    'staff with customers:view but without customers:manage cannot update a customer');
  assert.equal((await store.getCustomer(tenant.chatId, customerId)).notes, '',
    'a denied customer PATCH must not mutate the canonical customer');

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

  // A customer mutation and its mandatory audit event are one atomic write.
  // Force the audit insert to fail and prove neither create nor update leaks
  // a customer mutation without its corresponding audit record.
  const auditFailureUpdateId = `customer-audit-atomic-update-${suffix}`;
  await store.upsertCustomer(tenant.chatId, {
    id: auditFailureUpdateId,
    name: 'Customer Before Forced Audit Failure',
    phone: `+2519119${suffix.slice(-6)}`,
    source: 'http-regression',
  }, { userId: owner.id, deviceId: ownerSession.deviceId });
  db.exec(`
    CREATE TRIGGER fail_customer_audit_insert
    BEFORE INSERT ON audit_events
    WHEN NEW.entity_type = 'customer'
    BEGIN
      SELECT RAISE(ABORT, 'forced customer audit failure');
    END;
  `);
  try {
    const auditFailureCreateId = `customer-audit-atomic-create-${suffix}`;
    await assert.rejects(
      () => store.upsertCustomer(tenant.chatId, {
        id: auditFailureCreateId,
        name: 'Must Roll Back With Audit',
        source: 'http-regression',
      }, { userId: owner.id, deviceId: ownerSession.deviceId }),
      /forced customer audit failure/
    );
    assert.equal(await store.getCustomer(tenant.chatId, auditFailureCreateId), null,
      'failed customer-created audit must roll back the customer insert');

    await assert.rejects(
      () => store.upsertCustomer(tenant.chatId, {
        id: auditFailureUpdateId,
        name: 'Must Not Persist Without Audit',
        source: 'http-regression',
      }, { userId: owner.id, deviceId: ownerSession.deviceId }),
      /forced customer audit failure/
    );
    assert.equal((await store.getCustomer(tenant.chatId, auditFailureUpdateId)).name,
      'Customer Before Forced Audit Failure',
      'failed customer-updated audit must roll back the customer update');
  } finally {
    db.exec('DROP TRIGGER IF EXISTS fail_customer_audit_insert');
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

  // Characterize the documented name-only natural key: case is ignored, but
  // the fallback is restricted to existing records without a phone number.
  const nameOnlyCreated = await request(base, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ name: 'Name Only Natural Key' }),
  });
  assert.equal(nameOnlyCreated.response.status, 201);
  const nameOnlyId = nameOnlyCreated.json.customer?.id;
  assert.ok(nameOnlyId);

  const nameOnlyReplay = await request(base, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ name: 'name only natural key' }),
  });
  assert.equal(nameOnlyReplay.response.status, 201);
  assert.equal(nameOnlyReplay.json.customer.id, nameOnlyId,
    'case-insensitive name-only matching must reuse a same-organization customer without a phone');

  // A shared name is not sufficient to merge two customers that have
  // different phone numbers; phone identity takes precedence.
  const phoneIdentityA = await request(base, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ name: 'Shared Customer Name', phone: '+251911000002' }),
  });
  assert.equal(phoneIdentityA.response.status, 201);
  const phoneIdentityB = await request(base, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ name: 'Shared Customer Name', phone: '+251911000003' }),
  });
  assert.equal(phoneIdentityB.response.status, 201);
  assert.notEqual(phoneIdentityB.json.customer.id, phoneIdentityA.json.customer.id,
    'same-name customers with distinct phone numbers must not be merged by the name-only fallback');

  // Inactive customers are not eligible for natural-key reuse. This keeps
  // backend order/customer sync consistent with the local checkout lookup.
  const inactivePhoneId = `inactive-phone-customer-${suffix}`;
  await store.upsertCustomer(tenant.chatId, {
    id: inactivePhoneId,
    name: 'Inactive Phone Match Customer',
    phone: '+251911000005',
    status: 'inactive',
    source: 'http-regression',
  });
  const activePhoneReplacement = await store.upsertCustomer(tenant.chatId, {
    name: 'Replacement Phone Match Customer',
    phone: '+251911000005',
    source: 'order',
  });
  assert.notEqual(activePhoneReplacement.id, inactivePhoneId,
    'phone natural-key matching must not reuse an inactive customer');
  assert.equal(activePhoneReplacement.status, 'active');
  assert.equal((await store.getCustomer(tenant.chatId, inactivePhoneId)).status, 'inactive',
    'natural-key replacement must not reactivate or mutate the inactive customer');

  const inactiveNameId = `inactive-name-customer-${suffix}`;
  await store.upsertCustomer(tenant.chatId, {
    id: inactiveNameId,
    name: 'Inactive Name Only Match',
    phone: '',
    status: 'inactive',
    source: 'http-regression',
  });
  const activeNameReplacement = await store.upsertCustomer(tenant.chatId, {
    name: 'Inactive Name Only Match',
    phone: '',
    source: 'order',
  });
  assert.notEqual(activeNameReplacement.id, inactiveNameId,
    'name-only natural-key matching must not reuse an inactive customer');
  assert.equal(activeNameReplacement.status, 'active');

  // Sparse customer.upsert payloads (such as those emitted by order sync)
  // must not erase fields omitted from the event. Explicit empty values still
  // clear the corresponding field.
  const sparseCustomerId = `sparse-sync-customer-${suffix}`;
  await store.upsertCustomer(tenant.chatId, {
    id: sparseCustomerId,
    name: 'Customer With Complete Details',
    phone: '+251911000004',
    email: 'preserve@example.test',
    address: 'Preserved customer address',
    taxId: 'ET-TAX-004',
    notes: 'Preserved customer notes',
    customerType: 'business',
    status: 'inactive',
    source: 'http-regression',
  });
  const sparseSyncEventId = `sparse-customer-event-${suffix}`;
  const sparseSync = await request(`/events/${encodeURIComponent(tenant.chatId)}`, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ events: [{
      eventId: sparseSyncEventId,
      eventType: 'customer.upsert',
      aggregateType: 'customer',
      aggregateId: sparseCustomerId,
      occurredAt: new Date().toISOString(),
      payload: { id: sparseCustomerId, name: 'Customer Name Updated By Sparse Sync', source: 'order' },
    }] }),
  });
  assert.equal(sparseSync.json.results?.[0]?.status, 'processed');
  const sparseAfterUpdate = await store.getCustomer(tenant.chatId, sparseCustomerId);
  assert.equal(sparseAfterUpdate.name, 'Customer Name Updated By Sparse Sync');
  assert.equal(sparseAfterUpdate.phone, '+251911000004');
  assert.equal(sparseAfterUpdate.email, 'preserve@example.test',
    'sparse sync must preserve omitted email');
  assert.equal(sparseAfterUpdate.address, 'Preserved customer address',
    'sparse sync must preserve omitted address');
  assert.equal(sparseAfterUpdate.taxId, 'ET-TAX-004',
    'sparse sync must preserve omitted tax ID');
  assert.equal(sparseAfterUpdate.notes, 'Preserved customer notes',
    'sparse sync must preserve omitted notes');
  assert.equal(sparseAfterUpdate.customerType, 'business');
  assert.equal(sparseAfterUpdate.status, 'inactive');

  const explicitClearEvent = await request(`/events/${encodeURIComponent(tenant.chatId)}`, {
    method: 'POST',
    headers: jsonAuth(ownerSession.token),
    body: JSON.stringify({ events: [{
      eventId: `sparse-customer-clear-event-${suffix}`,
      eventType: 'customer.upsert',
      aggregateType: 'customer',
      aggregateId: sparseCustomerId,
      occurredAt: new Date().toISOString(),
      payload: { id: sparseCustomerId, name: 'Customer Name Updated By Sparse Sync', email: '', source: 'order' },
    }] }),
  });
  assert.equal(explicitClearEvent.json.results?.[0]?.status, 'processed');
  const sparseAfterClear = await store.getCustomer(tenant.chatId, sparseCustomerId);
  assert.equal(sparseAfterClear.email, '',
    'an explicitly supplied empty email must clear the stored value');
  assert.equal(sparseAfterClear.address, 'Preserved customer address',
    'clearing one field must not clear other omitted fields');

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
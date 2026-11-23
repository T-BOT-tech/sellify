import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-supplier-activation-auth-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_BACKUP_DIR = path.join(tempDir, 'backups');
process.env.NODE_ENV = 'test';

let child;
let output = '';

async function reservePort() {
  const probe = createNetServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForBackend(baseUrl) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error('Backend exited before Supplier Network activation checks: ' + output);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + output);
}

async function request(baseUrl, route, { token, body } = {}) {
  return fetch(baseUrl + route, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const db = store.getDatabaseForTests();
  const stamp = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('supplier-activation-owner-' + stamp, 'Supplier Activation Owner');
  const staff = await store.getOrCreateUserByTelegram('supplier-activation-staff-' + stamp, 'Supplier Activation Staff');
  const tenant = await store.createTenantForUser({
    userId: owner.id,
    sellerName: 'Supplier Activation HTTP Tenant',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const tenantRow = db.prepare('SELECT chat_id, organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId);
  const ownerActor = {
    userId: owner.id,
    role: 'owner',
    organizationId: tenantRow.organization_id,
    chatId: tenantRow.chat_id,
  };

  await store.ensureMembership(staff.id, tenant.chatId, 'staff');
  const staffMembership = db.prepare('SELECT id FROM memberships WHERE user_id=? AND chat_id=?').get(staff.id, tenant.chatId);
  await store.assignMembershipContextualRole({
    actorUserId: owner.id,
    chatId: tenant.chatId,
    membershipId: staffMembership.id,
    role: 'supplier_network_staff',
    scopeType: 'ORGANIZATION',
  });
  await store.setProcurementSupplierParticipation(tenant.chatId, {
    status: 'ACTIVE',
    discoverable: true,
  }, ownerActor);

  const productOwner = 'activation_owner_' + stamp;
  const productStaff = 'activation_staff_' + stamp;
  await store.saveCatalog(tenant.chatId, [
    { id: productOwner, name: 'Owner capacity product', price: 100, stock: 10 },
    { id: productStaff, name: 'Staff capacity product', price: 100, stock: 10 },
  ]);

  const ownerSession = await store.createSession({
    userId: owner.id,
    chatId: tenant.chatId,
    deviceName: 'Supplier Network activation owner HTTP regression',
  });
  const staffSession = await store.createSession({
    userId: staff.id,
    chatId: tenant.chatId,
    deviceName: 'Supplier Network activation staff HTTP regression',
  });

  const port = await reservePort();
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
  await waitForBackend(baseUrl);

  const prefix = '/tenants/' + encodeURIComponent(tenant.chatId) + '/supplier-network';
  const cases = [
    {
      name: 'capability',
      route: prefix + '/capabilities',
      key: 'capability',
      ownerBody: { code: 'OWNER_CAP_' + stamp, name: 'Owner capability', category: 'distribution' },
      staffBody: { code: 'STAFF_CAP_' + stamp, name: 'Staff capability', category: 'distribution' },
      absent: () => db.prepare('SELECT COUNT(*) AS count FROM supplier_network_capabilities WHERE organization_id=? AND code=?').get(tenantRow.organization_id, 'STAFF_CAP_' + stamp).count,
    },
    {
      name: 'catalog listing',
      route: prefix + '/catalog',
      key: 'listing',
      ownerBody: { productId: productOwner, unit: 'kg', visibility: 'NETWORK' },
      staffBody: { productId: productStaff, unit: 'kg', visibility: 'NETWORK' },
      absent: () => db.prepare('SELECT COUNT(*) AS count FROM supplier_network_catalog_listings WHERE organization_id=? AND product_id=?').get(tenantRow.organization_id, productStaff).count,
    },
    {
      name: 'service area',
      route: prefix + '/service-areas',
      key: 'serviceArea',
      ownerBody: { scopeType: 'COUNTRY', countryCode: 'ET', displayName: 'Ethiopia' },
      staffBody: { scopeType: 'COUNTRY', countryCode: 'KE', displayName: 'Kenya' },
      absent: () => db.prepare('SELECT COUNT(*) AS count FROM supplier_network_service_areas WHERE organization_id=? AND country_code=?').get(tenantRow.organization_id, 'KE').count,
    },
    {
      name: 'commercial terms',
      route: prefix + '/commercial-terms',
      key: 'commercialTerms',
      ownerBody: { subjectType: 'PRODUCT', subjectId: productOwner, supportedCurrencies: ['ETB'] },
      staffBody: { subjectType: 'PRODUCT', subjectId: productStaff, supportedCurrencies: ['ETB'] },
      absent: () => db.prepare('SELECT COUNT(*) AS count FROM supplier_network_commercial_terms WHERE organization_id=? AND subject_id=?').get(tenantRow.organization_id, productStaff).count,
    },
    {
      name: 'capacity signal',
      route: prefix + '/capacities',
      key: 'capacity',
      ownerBody: { subjectType: 'PRODUCT', subjectId: productOwner, quantity: 100, unit: 'kg', availability: 'AVAILABLE' },
      staffBody: { subjectType: 'PRODUCT', subjectId: productStaff, quantity: 100, unit: 'kg', availability: 'AVAILABLE' },
      absent: () => db.prepare('SELECT COUNT(*) AS count FROM supplier_network_capacity_signals WHERE organization_id=? AND subject_id=?').get(tenantRow.organization_id, productStaff).count,
    },
  ];

  for (const item of cases) {
    const ownerResponse = await request(baseUrl, item.route, { token: ownerSession.token, body: item.ownerBody });
    assert.equal(ownerResponse.status, 201, 'owner must retain default-active creation for ' + item.name);
    const ownerPayload = await ownerResponse.json();
    assert.equal(ownerPayload[item.key]?.status, 'ACTIVE', 'owner-created ' + item.name + ' must preserve the existing ACTIVE default');

    const staffResponse = await request(baseUrl, item.route, { token: staffSession.token, body: item.staffBody });
    assert.equal(staffResponse.status, 403,
      'supplier_network_staff must not create a default-ACTIVE ' + item.name + ' without the separate activate permission');
    assert.equal(item.absent(), 0, 'denied staff creation must not persist ' + item.name);
  }

  console.log('Supplier Network activation HTTP authorization regression: PASS');
  console.log('Owner default-active creation: ALLOWED for all five lifecycle resources');
  console.log('Supplier Network staff default-active creation without activate permission: DENIED for all five resources');
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

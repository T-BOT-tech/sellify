import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-sc035-http-'));
const backendPort = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const port = probe.address().port;
    probe.close(error => error ? reject(error) : resolve(port));
  });
});
const token = '123456:SC035_TEST_BOT_TOKEN';
const buyerId = '778899';
const otherBuyerId = '990011';
const env = {
  ...process.env,
  PORT: String(backendPort),
  NODE_ENV: 'test',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
  SELLIFY_DATA_DIR: dataDir,
  SELLIFY_BACKUP_DIR: path.join(dataDir, 'backups'),
  NODE_OPTIONS: [process.env.NODE_OPTIONS || '', `--import=${pathToFileURL(path.join(root, 'phase0/sc-03.5-telegram-credential-provider-fixture.mjs')).href}`].filter(Boolean).join(' '),
};
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_BACKUP_DIR = path.join(dataDir, 'backups');

function telegramInitData(userId, botToken = token) {
  const authDate = Math.floor(Date.now() / 1000);
  const user = JSON.stringify({ id: Number(userId), first_name: 'SC035 Buyer' });
  const pairs = [`auth_date=${authDate}`, `user=${user}`].sort();
  const checkString = pairs.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  return new URLSearchParams({ auth_date: String(authDate), user, hash }).toString();
}

async function request(url, options = {}) {
  const response = await fetch(`http://127.0.0.1:${backendPort}${url}`, options);
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

const child = spawn(process.execPath, [path.join(root, 'backend/server.js')], {
  cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'],
});
let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => { stderr += chunk; });

try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://127.0.0.1:${backendPort}/health`)).ok) { ready = true; break; } } catch {}
    if (child.exitCode !== null) throw new Error(`backend exited: ${child.exitCode}`);
    await sleep(50);
  }
  assert.equal(ready, true, stderr);

  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('sc035-http-owner-' + suffix, 'SC035 HTTP Owner');
  const tenant = await store.createTenantForUser({
    userId: owner.id, sellerName: 'SC035 HTTP Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const db = store.getDatabaseForTests();
  const organizationId = db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId).organization_id;
  const actor = { userId: owner.id, role: 'owner', organizationId, chatId: tenant.chatId };

  await store.saveCatalog(tenant.chatId, [{
    id: 'sc035-http-consultation', name: 'HTTP Consultation', price: 25000,
    item_type: 'service', marketplace_listed: true,
  }]);

  // Exercise the provider queue over HTTP, including immediate revocation of
  // the exact resource-scoped assignment while reusing the same session token.
  const providerResource = await store.createServiceResource(tenant.chatId, {
    name: 'HTTP Provider Resource', resourceType: 'PROVIDER',
    serviceItemId: 'sc035-http-consultation',
    idempotencyKey: 'sc035-http-provider-resource-' + suffix,
  }, null);
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO pack_lifecycle (
    id, organization_id, pack_id, pack_version, state, installed_at, activated_at,
    created_by_user_id, updated_by_user_id, created_at, updated_at, version
  ) VALUES (?, ?, 'service', '1.0.0', 'ACTIVE', ?, ?, ?, ?, ?, ?, 1)`).run(
    'sc035-http-service-pack-' + suffix, organizationId, now, now,
    owner.id, owner.id, now, now,
  );
  const providerUser = await store.getOrCreateUserByTelegram('sc035-http-provider-' + suffix, 'SC035 HTTP Provider');
  const providerMembership = await store.ensureMembership(providerUser.id, tenant.chatId, 'staff');
  await store.assignMembershipContextualRole({
    actorUserId: owner.id, chatId: tenant.chatId, membershipId: providerMembership.id,
    role: 'service_provider', scopeType: 'RESOURCE', scopeId: providerResource.resource.id,
  });
  const providerSession = await store.createSession({
    userId: providerUser.id, chatId: tenant.chatId, deviceName: 'SC-03.5 provider HTTP regression',
  });
  const providerQueueUrl = `/tenants/${encodeURIComponent(tenant.chatId)}/service-provider/bookings`;
  const providerHeaders = { Authorization: 'Bearer ' + providerSession.token, Accept: 'application/json' };
  const providerQueue = await request(providerQueueUrl, { headers: providerHeaders });
  assert.equal(providerQueue.response.status, 200, 'active resource-scoped provider assignment may read its queue');
  assert.equal(providerQueue.json.state, 'EMPTY');
  assert.equal(providerQueue.json.resource_count, 1);
  const providerResourcesUrl = `/tenants/${encodeURIComponent(tenant.chatId)}/service-provider/resources`;
  const providerResources = await request(providerResourcesUrl, { headers: providerHeaders });
  assert.equal(providerResources.response.status, 200,
    'provider can view its exact assigned resource and declared availability');
  assert.equal(providerResources.json.resources.length, 1);
  assert.equal(providerResources.json.resources[0].id, providerResource.resource.id);
  assert.equal(providerResources.json.resources[0].availability.state, 'EMPTY');
  const providerAvailabilityUrl = `/tenants/${encodeURIComponent(tenant.chatId)}/service-resources/${encodeURIComponent(providerResource.resource.id)}/availability`;
  const providerAvailabilitySave = await request(providerAvailabilityUrl, {
    method: 'PUT',
    headers: { ...providerHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': 'sc035-provider-hours-' + suffix },
    body: JSON.stringify({
      expected_version: 0,
      working_hours: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({
        weekday, startTime: '08:00', endTime: '18:00',
      })),
      exceptions: [],
    }),
  });
  assert.equal(providerAvailabilitySave.response.status, 200,
    'provider may maintain declared hours for its exact assigned resource');
  const providerResourcesAfterSave = await request(providerResourcesUrl, { headers: providerHeaders });
  assert.equal(providerResourcesAfterSave.json.resources[0].availability.state, 'DECLARED');
  const unassignedResource = await store.createServiceResource(tenant.chatId, {
    name: 'Unassigned Provider Resource', resourceType: 'PROVIDER',
    serviceItemId: 'sc035-http-consultation',
    idempotencyKey: 'sc035-http-unassigned-resource-' + suffix,
  }, null);
  const unassignedAvailability = await request(
    `/tenants/${encodeURIComponent(tenant.chatId)}/service-resources/${encodeURIComponent(unassignedResource.resource.id)}/availability`,
    { headers: providerHeaders },
  );
  assert.equal(unassignedAvailability.response.status, 403,
    'provider cannot view or manage availability for another unassigned resource');
  await store.revokeMembershipContextualRole({
    actorUserId: owner.id, chatId: tenant.chatId, membershipId: providerMembership.id,
    role: 'service_provider', scopeType: 'RESOURCE', scopeId: providerResource.resource.id,
  });
  const revokedProviderQueue = await request(providerQueueUrl, { headers: providerHeaders });
  assert.equal(revokedProviderQueue.response.status, 403,
    'the same provider session must lose queue access immediately after exact resource assignment revocation');
  assert.equal(revokedProviderQueue.json.error?.code, 'SERVICE_PROVIDER_ASSIGNMENT_REQUIRED');
  await store.upsertTelegramStorefrontConfig(tenant.chatId, {
    botId: '123456', botUsername: 'sc035_test_bot', credentialRef: 'secret://sc035/test',
    status: 'CONFIGURED', webappUrl: 'https://example.invalid/sc035',
    enabledCapabilities: ['browse', 'checkout', 'order_status'],
  }, actor);
  db.prepare("UPDATE telegram_storefront_configs SET status='PUBLISHED' WHERE organization_id=?").run(organizationId);

  const checkout = await store.createMarketplaceOrder({
    buyer_id: buyerId, customer_name: 'SC035 Buyer',
    items: [{ seller_id: tenant.chatId, item_id: 'sc035-http-consultation', qty: 1 }],
    idempotency_key: 'sc035-http-checkout-' + suffix,
  });
  const base = `/api/telegram-storefront/${encodeURIComponent(tenant.chatId)}/orders/${encodeURIComponent(checkout.marketplace_order_id)}`;
  const buyerHeaders = {
    Accept: 'application/json',
    'X-Telegram-Init-Data': telegramInitData(buyerId),
  };

  const unauthenticated = await request(base + '/service-bookings');
  assert.equal(unauthenticated.response.status, 401, 'missing initData must fail closed');
  const invalidSignature = await request(base + '/service-bookings', {
    headers: { 'X-Telegram-Init-Data': telegramInitData(buyerId).replace(/hash=[^&]+/, 'hash=invalid') },
  });
  assert.equal(invalidSignature.response.status, 401, 'invalid Telegram initData signature must fail closed');

  const foreignBuyer = await request(base + '/service-bookings', {
    headers: { Accept: 'application/json', 'X-Telegram-Init-Data': telegramInitData(otherBuyerId) },
  });
  assert.equal(foreignBuyer.response.status, 404, 'a different verified Telegram buyer cannot read the order');

  const history = await request(base + '/service-bookings', { headers: buyerHeaders });
  assert.equal(history.response.status, 200);
  assert.equal(history.json.order.serviceLines[0].item_id, 'sc035-http-consultation');
  assert.deepEqual(history.json.bookings, []);

  db.prepare('UPDATE telegram_storefront_configs SET enabled_capabilities_json=? WHERE organization_id=?')
    .run(JSON.stringify(['browse']), organizationId);
  const capabilityDisabled = await request(base + '/service-bookings', { headers: buyerHeaders });
  assert.equal(capabilityDisabled.response.status, 403, 'appointment endpoints must respect the existing order_status capability');
  db.prepare('UPDATE telegram_storefront_configs SET enabled_capabilities_json=? WHERE organization_id=?')
    .run(JSON.stringify(['browse', 'checkout', 'order_status']), organizationId);

  const start = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const end = new Date(Date.parse(start) + 60 * 60 * 1000).toISOString();
  const create = await request(base + '/service-bookings', {
    method: 'POST',
    headers: {
      ...buyerHeaders, 'Content-Type': 'application/json',
      'Idempotency-Key': 'sc035-http-booking-' + suffix,
    },
    body: JSON.stringify({
      service_item_id: 'sc035-http-consultation',
      requested_start: start,
      requested_end: end,
      appointment_mode: 'REMOTE',
      customer_note: 'Call before appointment.',
      buyer_id: otherBuyerId,
      organization_id: 'forged-organization',
      order_id: 'forged-order',
    }),
  });
  assert.equal(create.response.status, 201);
  assert.equal(create.json.booking.status, 'REQUESTED');
  assert.equal(create.json.booking.service_resource_name, null);
  assert.equal(create.json.booking.organization_id, undefined);
  assert.equal(create.json.booking.created_by, undefined);

  const requestedProjection = await request(base + '/service-bookings', { headers: buyerHeaders });
  assert.equal(requestedProjection.response.status, 200);
  assert.deepEqual(requestedProjection.json.bookings[0].allowed_actions, ['CANCEL'],
    'buyer-safe projection exposes cancellation only while the canonical request is cancellable');

  const feasibility = await request(base + `/service-feasibility?service_item_id=sc035-http-consultation&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
    headers: buyerHeaders,
  });
  assert.equal(feasibility.response.status, 200);
  assert.equal(feasibility.json.feasibility.state, 'UNKNOWN');
  assert.equal(feasibility.json.feasibility.reasonCode, 'NO_ACTIVE_MATCHING_RESOURCES',
    'declared provider hours cannot make a resource feasible after its exact provider assignment is revoked');
  assert.equal(feasibility.json.feasibility.confirmsAvailability, false);
  assert.equal(feasibility.json.feasibility.reservesResource, false);

  const bookingId = create.json.booking.id;
  const cancel = await request(base + `/service-bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: 'POST',
    headers: {
      ...buyerHeaders, 'Content-Type': 'application/json',
      'Idempotency-Key': 'sc035-http-cancel-' + suffix,
    },
    body: JSON.stringify({ expected_version: 1 }),
  });
  assert.equal(cancel.response.status, 200);
  assert.equal(cancel.json.booking.status, 'CANCELLED');
  const cancelledProjection = await request(base + '/service-bookings', { headers: buyerHeaders });
  assert.deepEqual(cancelledProjection.json.bookings[0].allowed_actions, [],
    'cancelled booking no longer advertises a cancellation action');

  const replay = await request(base + `/service-bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: 'POST',
    headers: {
      ...buyerHeaders, 'Content-Type': 'application/json',
      'Idempotency-Key': 'sc035-http-cancel-' + suffix,
    },
    body: JSON.stringify({ expected_version: 1 }),
  });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.json.replayed, true);

  const missingCredentialUser = await store.getOrCreateUserByTelegram('sc035-http-missing-' + suffix, 'Missing Credential');
  const missingTenant = await store.createTenantForUser({
    userId: missingCredentialUser.id, sellerName: 'Missing Credential Store', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const missingOrg = db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(missingTenant.chatId).organization_id;
  await store.upsertTelegramStorefrontConfig(missingTenant.chatId, {
    botId: '999999', botUsername: 'missing_bot', credentialRef: 'secret://sc035/missing',
    status: 'CONFIGURED', webappUrl: 'https://example.invalid/missing',
    enabledCapabilities: ['order_status'],
  }, { userId: missingCredentialUser.id, role: 'owner', organizationId: missingOrg, chatId: missingTenant.chatId });
  db.prepare("UPDATE telegram_storefront_configs SET status='PUBLISHED' WHERE organization_id=?").run(missingOrg);
  const providerUnavailable = await request(`/api/telegram-storefront/${encodeURIComponent(missingTenant.chatId)}/orders`, {
    headers: { 'X-Telegram-Init-Data': telegramInitData(buyerId) },
  });
  assert.equal(providerUnavailable.response.status, 503,
    'missing credential-provider result must fail closed before exposing buyer order history');

  console.log('SC-03.5 authenticated Telegram appointment HTTP regression: PASS');
} catch (error) {
  if (stderr) process.stderr.write(stderr);
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 2000)),
  ]);
  await rm(dataDir, { recursive: true, force: true });
}

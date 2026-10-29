import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createConnection, createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-service-catalog-http-'));
const dbPath = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = dbPath;

let child = null;
let childOutput = '';

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
  let lastError;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error('Backend exited before becoming healthy (exit ' + child.exitCode + ')\n' + childOutput);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
      lastError = new Error('Health endpoint returned ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + (lastError?.message || 'unknown error') + '\n' + childOutput);
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram('service-catalog-http-' + Date.now(), 'Service Catalog HTTP Test');
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'Service Catalog HTTP Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const session = await store.createSession({
    userId: user.id,
    chatId: tenant.chatId,
    deviceName: 'Service Catalog HTTP regression',
  });

  const otherTenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'Other Service Catalog HTTP Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });

  const port = await freePort();
  const baseUrl = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      SELLIFY_DATA_DIR: tempDir,
      SELLIFY_DB_PATH: dbPath,
      NODE_ENV: 'test',
      // The expanded end-to-end HTTP regression intentionally exercises many
      // legitimate writes; keep it independent of the production IP write limit.
      RATE_LIMIT_MAX_WRITES: '500',
      SERVE_STATIC: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { childOutput += chunk.toString(); });
  child.stderr.on('data', chunk => { childOutput += chunk.toString(); });
  await waitForHealth(baseUrl);

  const authHeaders = {
    Authorization: 'Bearer ' + session.token,
    'Content-Type': 'application/json',
  };

  // Simulate a successful tenant creation whose response body is lost to the
  // client. Retrying the same one-time challenge must recover the original
  // tenant and issue a fresh session rather than fail or create a duplicate.
  const lostResponseUser = await store.getOrCreateUserByTelegram(
    'tenant-create-lost-response-' + Date.now(), 'Tenant Create Lost Response Test');
  const lostResponseChallenge = await store.createAuthChallenge(lostResponseUser.id);
  const lostResponseRequest = {
    sellerName: 'Lost Response Recovery Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
    deviceName: 'Lost response regression',
    challengeToken: lostResponseChallenge.token,
  };
  const invalidCountryAttempt = await fetch(baseUrl + '/auth/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...lostResponseRequest, country: 'ZZ' }),
  });
  assert.equal(invalidCountryAttempt.status, 400,
    'invalid country validation must fail before consuming the onboarding challenge');
  assert.equal((await store.listUserMemberships(lostResponseUser.id)).length, 0,
    'invalid onboarding input must not partially create a tenant or membership');

  const firstTenantCreate = await fetch(baseUrl + '/auth/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lostResponseRequest),
  });
  assert.equal(firstTenantCreate.status, 201, 'first tenant creation should commit successfully');
  // Intentionally discard the first response body to model a disconnected client.
  const recoveredTenantCreate = await fetch(baseUrl + '/auth/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lostResponseRequest),
  });
  assert.equal(recoveredTenantCreate.status, 200,
    'retrying a committed tenant creation must replay the canonical tenant instead of rejecting its consumed challenge');
  const recoveredTenantBody = await recoveredTenantCreate.json();
  assert.equal(recoveredTenantBody.replayed, true);
  assert.ok(recoveredTenantBody.session?.token, 'a replay must issue a fresh usable tenant session');
  assert.equal(recoveredTenantBody.tenant.sellerName, lostResponseRequest.sellerName);
  const recoveredMemberships = await store.listUserMemberships(lostResponseUser.id);
  assert.equal(recoveredMemberships.length, 1, 'lost-response recovery must not create a duplicate tenant membership');
  assert.equal(recoveredMemberships[0].chatId, recoveredTenantBody.session.chatId);
  const creationRequestCount = store.getDatabaseForTests().prepare(
    'SELECT COUNT(*) AS count FROM tenant_creation_requests WHERE user_id = ?'
  ).get(String(lostResponseUser.id)).count;
  assert.equal(creationRequestCount, 1, 'the challenge must have exactly one durable creation result');
  const changedRetry = await fetch(baseUrl + '/auth/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...lostResponseRequest, sellerName: 'Different Store Name' }),
  });
  assert.equal(changedRetry.status, 409, 'a consumed challenge cannot be reused for a different tenant-creation request');
  assert.equal((await changedRetry.json()).error?.code, 'TENANT_CREATION_IDEMPOTENCY_CONFLICT');
  assert.equal((await store.listUserMemberships(lostResponseUser.id)).length, 1,
    'conflicting retries must not create another tenant');

  // A valid non-owner session must not fall through to the challenge branch
  // when the owner authorization check fails.
  const nonOwnerUser = await store.getOrCreateUserByTelegram(
    'tenant-create-non-owner-' + Date.now(), 'Tenant Create Non-owner Test');
  await store.ensureMembership(nonOwnerUser.id, tenant.chatId, 'staff');
  const nonOwnerSession = await store.createSession({
    userId: nonOwnerUser.id, chatId: tenant.chatId, deviceName: 'Non-owner challenge regression',
  });
  const nonOwnerChallenge = await store.createAuthChallenge(nonOwnerUser.id);
  const nonOwnerCreate = await fetch(baseUrl + '/auth/tenants', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + nonOwnerSession.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...lostResponseRequest,
      sellerName: 'Must Not Be Created',
      challengeToken: nonOwnerChallenge.token,
    }),
  });
  assert.equal(nonOwnerCreate.status, 403,
    'a valid non-owner session must be denied even if the request also contains an onboarding challenge');
  assert.equal((await store.listUserMemberships(nonOwnerUser.id)).length, 1,
    'non-owner challenge fallback must not create a tenant or membership');

  const tenantPath = '/tenants/' + encodeURIComponent(tenant.chatId);
  const unauthTenantRead = await fetch(baseUrl + tenantPath);
  assert.equal(unauthTenantRead.status, 401, 'canonical currency reads must require a tenant session');
  const tenantRead = await fetch(baseUrl + tenantPath, { headers: authHeaders });
  assert.equal(tenantRead.status, 200);
  const tenantReadBody = await tenantRead.json();
  assert.equal(tenantReadBody.tenant.currency, 'ETB',
    'tenant settings must read the canonical organization currency, not the local device default');
  assert.equal(Object.hasOwn(tenantReadBody.tenant, 'apiKey'), false,
    'tenant currency settings must not expose legacy tenant API credentials');

  const brandingWrite = await fetch(baseUrl + tenantPath, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ branding: { business_name: 'Currency Regression Brand', primary_color: '#123456' } }),
  });
  assert.equal(brandingWrite.status, 200);
  const currencyWrite = await fetch(baseUrl + tenantPath, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ branding: { currency: 'usd' } }),
  });
  assert.equal(currencyWrite.status, 200, 'an owner may intentionally set currency before monetary records exist');
  const currencyWriteBody = await currencyWrite.json();
  assert.equal(currencyWriteBody.tenant.currency, 'USD', 'the update response must report the confirmed canonical currency');
  assert.equal(currencyWriteBody.tenant.branding.business_name, 'Currency Regression Brand',
    'currency-only updates must preserve existing branding fields');
  assert.equal(currencyWriteBody.tenant.branding.primary_color, '#123456');
  const restoreCurrency = await fetch(baseUrl + tenantPath, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ branding: { currency: 'ETB' } }),
  });
  assert.equal(restoreCurrency.status, 200);
  assert.equal((await restoreCurrency.json()).tenant.currency, 'ETB');
  const invalidCurrency = await fetch(baseUrl + tenantPath, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ branding: { currency: 'ETBB' } }),
  });
  assert.equal(invalidCurrency.status, 400, 'currency settings must reject non-three-letter currency codes');
  assert.equal((await invalidCurrency.json()).error.code, 'INVALID_CURRENCY');

  const templatePath = '/tenants/' + encodeURIComponent(tenant.chatId) + '/business-template';
  const unauthTemplateRead = await fetch(baseUrl + templatePath);
  assert.equal(unauthTemplateRead.status, 401, 'business template config must require an authenticated tenant session');

  const templateWrite = await fetch(baseUrl + templatePath, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ templateKey: 'repair' }),
  });
  assert.equal(templateWrite.status, 200, 'owner can persist an allowlisted business template');
  const templateWriteBody = await templateWrite.json();
  assert.equal(templateWriteBody.businessTemplate.templateKey, 'repair');
  assert.equal(templateWriteBody.businessTemplate.schemaVersion, 1);
  assert.deepEqual(templateWriteBody.businessTemplate.config, {});

  const templateAuditEvents = await store.listAuditEvents(tenant.chatId, 100, {
    action: 'tenant.business_template.updated',
    entityType: 'tenant_business_template',
  });
  assert.equal(templateAuditEvents.length, 1,
    'one accepted template write must append exactly one canonical audit event');
  assert.equal(templateAuditEvents[0].actorId, String(user.id),
    'business-template audit evidence must populate the canonical actor_id field, not only metadata');
  assert.equal(templateAuditEvents[0].metadata.actorUserId, String(user.id));
  assert.equal(templateAuditEvents[0].metadata.templateKey, 'repair');

  const nonOwnerTemplateWrite = await fetch(baseUrl + templatePath, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + nonOwnerSession.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ templateKey: 'hotel-rooms' }),
  });
  assert.equal(nonOwnerTemplateWrite.status, 403,
    'a staff member may read shared template setup context but must not change the canonical tenant template');
  const templateAfterNonOwnerWrite = await fetch(baseUrl + templatePath, { headers: authHeaders });
  assert.equal((await templateAfterNonOwnerWrite.json()).businessTemplate.templateKey, 'repair',
    'a denied non-owner template write must leave the canonical template unchanged');
  assert.equal((await store.listAuditEvents(tenant.chatId, 100, {
    action: 'tenant.business_template.updated',
    entityType: 'tenant_business_template',
  })).length, 1, 'a denied template write must not append a successful template-update audit event');

  const templateRead = await fetch(baseUrl + templatePath, { headers: authHeaders });
  assert.equal(templateRead.status, 200);
  assert.equal((await templateRead.json()).businessTemplate.templateKey, 'repair',
    'template config must be read back from server-owned tenant storage');

  const invalidTemplateWrite = await fetch(baseUrl + templatePath, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ templateKey: 'unsupported-hotel-engine', capabilities: ['reservations', 'deposits'] }),
  });
  assert.equal(invalidTemplateWrite.status, 400, 'unknown templates and caller-asserted capabilities must be rejected');

  for (const [label, body] of [
    ['unsupported schema version', { templateKey: 'repair', schemaVersion: 2 }],
    ['unsupported snake-case schema version', { template_key: 'repair', schema_version: 2 }],
    ['caller-supplied capability flags', { templateKey: 'repair', config: { reservations: true } }],
    ['unknown authority fields', { templateKey: 'repair', paymentStatus: 'PAID' }],
    ['array configuration', { templateKey: 'repair', config: [] }],
    ['primitive configuration', { templateKey: 'repair', config: 'reservations-enabled' }],
  ]) {
    const response = await fetch(baseUrl + templatePath, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 400, label + ' must be rejected');
  }
  const templateAfterRejectedWrites = await fetch(baseUrl + templatePath, { headers: authHeaders });
  assert.equal(templateAfterRejectedWrites.status, 200);
  const unchangedTemplate = (await templateAfterRejectedWrites.json()).businessTemplate;
  assert.equal(unchangedTemplate.templateKey, 'repair', 'rejected writes must not mutate persisted template identity');
  assert.equal(unchangedTemplate.schemaVersion, 1);
  assert.deepEqual(unchangedTemplate.config, {});

  const crossTenantTemplateRead = await fetch(baseUrl + '/tenants/' + encodeURIComponent(otherTenant.chatId) + '/business-template', {
    headers: authHeaders,
  });
  assert.equal(crossTenantTemplateRead.status, 403,
    'a valid session for one business must not read another business template');

  const crossTenantTemplateWrite = await fetch(baseUrl + '/tenants/' + encodeURIComponent(otherTenant.chatId) + '/business-template', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ templateKey: 'repair' }),
  });
  assert.equal(crossTenantTemplateWrite.status, 403,
    'a valid owner session for one business must not write another business template');
  const otherTenantTemplateAfterDeniedWrite = await fetch(baseUrl + '/tenants/' + encodeURIComponent(otherTenant.chatId) + '/business-template', {
    headers: { Authorization: 'Bearer ' + (await store.createSession({
      userId: user.id,
      chatId: otherTenant.chatId,
      deviceName: 'Other Service Catalog HTTP read',
    })).token },
  });
  assert.equal(otherTenantTemplateAfterDeniedWrite.status, 200);
  assert.equal((await otherTenantTemplateAfterDeniedWrite.json()).businessTemplate, null,
    'a denied cross-tenant write must leave the other business template unchanged');
  const products = [
    { id: 'consultation-http', name: 'Consultation', price: 25000, currency: 'ETB', item_type: 'service', marketplace_listed: true },
    { id: 'parcel-instant-http', name: 'Instant Parcel Delivery', price: 12000, currency: 'ETB', item_type: 'service',
      service_profile: 'B2C_DELIVERY', delivery_model: 'instant', marketplace_listed: true },
    { id: 'parcel-request-http', name: 'Request Parcel Delivery', price: 10000, currency: 'ETB', item_type: 'service',
      service_profile: 'P2P_DELIVERY', delivery_model: 'request', marketplace_listed: true },
    // Seed stock explicitly below so the catalog's legacy opening-balance migration cannot double-count it.
    { id: 'soap-http', name: 'Soap', price: 5000, currency: 'ETB', stock: null, item_type: 'product', marketplace_listed: true },
  ];

  const writeResponse = await fetch(baseUrl + '/catalog/' + encodeURIComponent(tenant.chatId), {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ products }),
  });
  assert.equal(writeResponse.status, 200, 'authenticated catalog write should succeed');
  const writeBody = await writeResponse.json();
  assert.equal(writeBody.products.find(item => item.id === 'consultation-http')?.item_type, 'service');
  assert.equal(writeBody.products.find(item => item.id === 'soap-http')?.item_type, 'product');

  const lockedCurrencyWrite = await fetch(baseUrl + tenantPath, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ branding: { currency: 'USD' } }),
  });
  assert.equal(lockedCurrencyWrite.status, 409,
    'currency changes must be rejected once catalog monetary records exist');
  assert.equal((await lockedCurrencyWrite.json()).error.code, 'CURRENCY_LOCKED');
  const currencyAfterLock = await fetch(baseUrl + tenantPath, { headers: authHeaders });
  assert.equal((await currencyAfterLock.json()).tenant.currency, 'ETB',
    'a rejected currency change must leave the canonical organization currency unchanged');

  // The storefront read path must expose the persisted item type, not merely
  // echo the submitted request payload.
  const readResponse = await fetch(baseUrl + '/catalog/' + encodeURIComponent(tenant.chatId));
  assert.equal(readResponse.status, 200);
  const readBody = await readResponse.json();
  assert.equal(readBody.products.find(item => item.id === 'consultation-http')?.item_type, 'service');
  assert.equal(readBody.products.find(item => item.id === 'parcel-instant-http')?.delivery_model, 'instant');
  assert.equal(readBody.products.find(item => item.id === 'parcel-request-http')?.delivery_model, 'request');
  assert.equal(readBody.products.find(item => item.id === 'soap-http')?.item_type, 'product');

  // Marketplace response-loss recovery: the first request commits, but the
  // caller deliberately discards its response. An exact retry with the same
  // idempotency key must replay the same canonical marketplace order.
  const marketplaceRequest = {
    buyer_id: 'service-marketplace-buyer-http',
    customer_name: 'Marketplace Recovery Buyer',
    items: [{ seller_id: tenant.chatId, item_id: 'consultation-http', qty: 1 }],
  };
  const marketplaceHeaders = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'service-marketplace-lost-response-http-1',
  };
  const checkoutUrl = baseUrl + '/api/marketplace/checkout';
  const committedMarketplaceResponse = await fetch(checkoutUrl, {
    method: 'POST',
    headers: marketplaceHeaders,
    body: JSON.stringify(marketplaceRequest),
  });
  assert.equal(committedMarketplaceResponse.status, 200, 'first marketplace checkout should commit');
  const committedMarketplaceBody = await committedMarketplaceResponse.json();
  assert.ok(committedMarketplaceBody.marketplace_order_id);
  // Intentionally do not deliver committedMarketplaceBody to a client handler.
  const replayResponse = await fetch(checkoutUrl, {
    method: 'POST',
    headers: marketplaceHeaders,
    body: JSON.stringify(marketplaceRequest),
  });
  assert.equal(replayResponse.status, 200, 'retry after lost response should succeed');
  const replayBody = await replayResponse.json();
  assert.equal(replayBody.marketplace_order_id, committedMarketplaceBody.marketplace_order_id,
    'marketplace checkout retry must return the same canonical marketplace order');
  assert.deepEqual(replayBody.sub_orders, committedMarketplaceBody.sub_orders,
    'marketplace checkout retry must replay the original seller-order identities');

  // Service booking must work through the authenticated HTTP surface and remain
  // linked to the canonical seller order created by marketplace checkout.
  const serviceOrder = (await store.getOrders(tenant.chatId)).find(item =>
    item.items?.some(line => String(line.item_id || line.id || '') === 'consultation-http'));
  assert.ok(serviceOrder?.server_order_id, 'marketplace service order must expose its canonical seller-order ID');
  const bookingsUrl = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/' + encodeURIComponent(serviceOrder.server_order_id) + '/service-bookings';
  const bookingRequest = {
    service_item_id: 'consultation-http',
    requested_start: '2026-11-02T09:00:00+03:00',
    requested_end: '2026-11-02T10:00:00+03:00',
    appointment_mode: 'REMOTE',
    customer_note: 'HTTP lifecycle regression',
  };
  const bookingCreate = await fetch(bookingsUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-create-1' },
    body: JSON.stringify(bookingRequest),
  });
  assert.equal(bookingCreate.status, 201, 'authenticated service booking request should persist');
  const bookingCreatedBody = await bookingCreate.json();
  assert.equal(bookingCreatedBody.booking?.status, 'REQUESTED');
  assert.equal(bookingCreatedBody.booking?.service_item_id, 'consultation-http');

  const bookingList = await fetch(bookingsUrl, { headers: authHeaders });
  assert.equal(bookingList.status, 200, 'booking list should require and accept view authorization');
  const bookingListBody = await bookingList.json();
  assert.ok(bookingListBody.bookings.some(item => item.id === bookingCreatedBody.booking.id));

  const bookingAccept = await fetch(bookingsUrl + '/' + encodeURIComponent(bookingCreatedBody.booking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-accept-1' },
    body: JSON.stringify({ status: 'ACCEPTED', expected_version: 1 }),
  });
  assert.equal(bookingAccept.status, 200, 'authorized merchant should accept the booking request');
  const bookingAcceptBody = await bookingAccept.json();
  assert.equal(bookingAcceptBody.booking.status, 'ACCEPTED');
  assert.equal(bookingAcceptBody.booking.version, 2);

  const bookingConfirm = await fetch(bookingsUrl + '/' + encodeURIComponent(bookingCreatedBody.booking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-confirm-1' },
    body: JSON.stringify({ status: 'CONFIRMED', expected_version: 2 }),
  });
  assert.equal(bookingConfirm.status, 200, 'authorized merchant should confirm an accepted appointment');
  const bookingConfirmBody = await bookingConfirm.json();
  assert.equal(bookingConfirmBody.booking.status, 'CONFIRMED');
  assert.equal(bookingConfirmBody.booking.version, 3);

  // Exact HTTP replay returns the durable transition result; the same key
  // with a different target must conflict rather than conceal a second command.
  const bookingConfirmReplay = await fetch(bookingsUrl + '/' + encodeURIComponent(bookingCreatedBody.booking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-confirm-1' },
    body: JSON.stringify({ status: 'CONFIRMED', expected_version: 2 }),
  });
  assert.equal(bookingConfirmReplay.status, 200, 'exact confirmation retry should replay successfully');
  const bookingConfirmReplayBody = await bookingConfirmReplay.json();
  assert.equal(bookingConfirmReplayBody.replayed, true, 'exact confirmation retry must be marked as replayed');
  assert.equal(bookingConfirmReplayBody.booking.version, 3, 'confirmation replay must not increment the version');
  const bookingConfirmKeyConflict = await fetch(bookingsUrl + '/' + encodeURIComponent(bookingCreatedBody.booking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-confirm-1' },
    body: JSON.stringify({ status: 'CANCELLED', expected_version: 3 }),
  });
  assert.equal(bookingConfirmKeyConflict.status, 409, 'reusing a booking key for a different transition must conflict');
  assert.equal((await bookingConfirmKeyConflict.json()).error?.code, 'SERVICE_BOOKING_IDEMPOTENCY_CONFLICT');

  // A delayed retry must remain a no-op even after the booking has advanced.
  // This catches replay implementations that accidentally reapply an old command.
  const bookingAuditCount = () => store.getDatabaseForTests().prepare(
    "SELECT COUNT(*) AS count FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ?"
  ).get(bookingCreatedBody.booking.id).count;
  const bookingStart = await fetch(bookingsUrl + '/' + encodeURIComponent(bookingCreatedBody.booking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-start-after-confirm-1' },
    body: JSON.stringify({ status: 'IN_PROGRESS', expected_version: 3 }),
  });
  assert.equal(bookingStart.status, 200, 'confirmed booking should start execution');
  const bookingStartBody = await bookingStart.json();
  assert.equal(bookingStartBody.booking.status, 'IN_PROGRESS');
  assert.equal(bookingStartBody.booking.version, 4);
  const auditCountAfterStart = bookingAuditCount();
  const delayedConfirmReplay = await fetch(bookingsUrl + '/' + encodeURIComponent(bookingCreatedBody.booking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-confirm-1' },
    body: JSON.stringify({ status: 'CONFIRMED', expected_version: 2 }),
  });
  assert.equal(delayedConfirmReplay.status, 200, 'delayed exact retry should remain idempotent after later transitions');
  const delayedConfirmReplayBody = await delayedConfirmReplay.json();
  assert.equal(delayedConfirmReplayBody.replayed, true);
  assert.equal(delayedConfirmReplayBody.booking.status, 'IN_PROGRESS',
    'replay should return current canonical state, not roll the booking back to the old result');
  assert.equal(delayedConfirmReplayBody.booking.version, 4, 'delayed replay must not increment the version');
  assert.equal(bookingAuditCount(), auditCountAfterStart, 'delayed replay must not append duplicate audit evidence');

  // Rejection is validated and persisted at the authenticated HTTP boundary.
  // A client-provided status_reason is not a substitute for the canonical reason.
  const rejectedBookingCreate = await fetch(bookingsUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-reject-create-1' },
    body: JSON.stringify({ ...bookingRequest, requested_start: '2026-11-04T09:00:00+03:00', requested_end: '2026-11-04T10:00:00+03:00' }),
  });
  assert.equal(rejectedBookingCreate.status, 201);
  const rejectedBooking = (await rejectedBookingCreate.json()).booking;
  const rejectedWithoutReason = await fetch(bookingsUrl + '/' + encodeURIComponent(rejectedBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-reject-1' },
    body: JSON.stringify({ status: 'REJECTED', expected_version: 1, status_reason: 'forged client reason' }),
  });
  assert.equal(rejectedWithoutReason.status, 400, 'HTTP rejection must require the canonical reason field');
  assert.equal((await rejectedWithoutReason.json()).error?.code, 'SERVICE_BOOKING_REASON_REQUIRED');
  const rejectedAfterValidation = (await (await fetch(bookingsUrl, { headers: authHeaders })).json())
    .bookings.find(item => item.id === rejectedBooking.id);
  assert.equal(rejectedAfterValidation.status, 'REQUESTED', 'reason validation failure must not mutate booking state');
  assert.equal(rejectedAfterValidation.version, 1, 'reason validation failure must not increment booking version');
  const rejectedResponse = await fetch(bookingsUrl + '/' + encodeURIComponent(rejectedBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-reject-1' },
    body: JSON.stringify({ status: 'REJECTED', expected_version: 1, reason: 'Customer request is outside the service area', status_reason: 'forged client reason' }),
  });
  assert.equal(rejectedResponse.status, 200, 'rejection with a reason should persist');
  const rejectedBody = await rejectedResponse.json();
  assert.equal(rejectedBody.booking.status, 'REJECTED');
  assert.equal(rejectedBody.booking.status_reason, 'Customer request is outside the service area',
    'server must persist the validated reason rather than a client-supplied status_reason');
  const rejectedReplay = await fetch(bookingsUrl + '/' + encodeURIComponent(rejectedBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-reject-1' },
    body: JSON.stringify({ status: 'REJECTED', expected_version: 1, reason: 'Customer request is outside the service area', status_reason: 'forged client reason' }),
  });
  assert.equal(rejectedReplay.status, 200);
  assert.equal((await rejectedReplay.json()).replayed, true, 'rejection replay should not create a second lifecycle event');
  const rejectedKeyConflict = await fetch(bookingsUrl + '/' + encodeURIComponent(rejectedBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-reject-1' },
    body: JSON.stringify({ status: 'REJECTED', expected_version: 1, reason: 'Different reason' }),
  });
  assert.equal(rejectedKeyConflict.status, 409, 'same rejection key with a different reason must conflict');
  assert.equal((await rejectedKeyConflict.json()).error?.code, 'SERVICE_BOOKING_IDEMPOTENCY_CONFLICT');

  // Cancellation is a canonical terminal transition. Verify reason persistence,
  // idempotent retry, and that a later command cannot resurrect the booking.
  const cancelledBookingCreate = await fetch(bookingsUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-cancel-create-1' },
    body: JSON.stringify({ ...bookingRequest, requested_start: '2026-11-06T09:00:00+03:00', requested_end: '2026-11-06T10:00:00+03:00' }),
  });
  assert.equal(cancelledBookingCreate.status, 201);
  const cancelledBooking = (await cancelledBookingCreate.json()).booking;
  const cancelledBookingAuditCount = () => store.getDatabaseForTests().prepare(
    "SELECT COUNT(*) AS count FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ?"
  ).get(cancelledBooking.id).count;
  const cancelReason = 'Customer no longer needs the appointment';
  const cancellation = await fetch(bookingsUrl + '/' + encodeURIComponent(cancelledBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-cancel-1' },
    body: JSON.stringify({ status: 'CANCELLED', expected_version: 1, reason: cancelReason }),
  });
  assert.equal(cancellation.status, 200, 'authorized merchant should cancel a requested booking');
  const cancellationBody = await cancellation.json();
  assert.equal(cancellationBody.booking.status, 'CANCELLED');
  assert.equal(cancellationBody.booking.status_reason, cancelReason);
  assert.equal(cancellationBody.booking.version, 2);
  const cancellationAuditCount = cancelledBookingAuditCount();
  const cancellationReplay = await fetch(bookingsUrl + '/' + encodeURIComponent(cancelledBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-cancel-1' },
    body: JSON.stringify({ status: 'CANCELLED', expected_version: 1, reason: cancelReason }),
  });
  assert.equal(cancellationReplay.status, 200, 'exact cancellation retry should replay');
  assert.equal((await cancellationReplay.json()).replayed, true);
  assert.equal(cancelledBookingAuditCount(), cancellationAuditCount, 'cancellation replay must not append audit evidence');
  const cancelResurrection = await fetch(bookingsUrl + '/' + encodeURIComponent(cancelledBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-cancel-resurrect-1' },
    body: JSON.stringify({ status: 'ACCEPTED', expected_version: 2 }),
  });
  assert.equal(cancelResurrection.status, 409, 'a cancelled booking must not be resurrected');
  assert.equal((await cancelResurrection.json()).error?.code, 'SERVICE_BOOKING_TRANSITION_INVALID');
  assert.equal(cancelledBookingAuditCount(), cancellationAuditCount,
    'invalid transition from terminal cancellation must not append audit evidence');

  // Exercise failure after service execution begins. Caller-supplied execution
  // evidence is ignored; failure reason is server-validated and durable.
  const failedBookingCreate = await fetch(bookingsUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-fail-create-1' },
    body: JSON.stringify({ ...bookingRequest, requested_start: '2026-11-05T09:00:00+03:00', requested_end: '2026-11-05T10:00:00+03:00' }),
  });
  assert.equal(failedBookingCreate.status, 201);
  const failedBooking = (await failedBookingCreate.json()).booking;
  for (const step of [
    { status: 'ACCEPTED', expected_version: 1, key: 'service-booking-http-fail-accept-1' },
    { status: 'CONFIRMED', expected_version: 2, key: 'service-booking-http-fail-confirm-1' },
    {
      status: 'IN_PROGRESS',
      expected_version: 3,
      key: 'service-booking-http-fail-start-1',
      started_at: '2000-01-01T00:00:00.000Z',
      started_by: 'forged-client-actor',
    },
  ]) {
    const response = await fetch(bookingsUrl + '/' + encodeURIComponent(failedBooking.id), {
      method: 'PATCH',
      headers: { ...authHeaders, 'Idempotency-Key': step.key },
      body: JSON.stringify(step),
    });
    assert.equal(response.status, 200, `booking should transition to ${step.status}`);
  }
  const failedBefore = (await (await fetch(bookingsUrl, { headers: authHeaders })).json())
    .bookings.find(item => item.id === failedBooking.id);
  assert.equal(failedBefore.status, 'IN_PROGRESS');
  assert.notEqual(failedBefore.started_by, 'forged-client-actor', 'HTTP client must not forge execution actor');
  assert.notEqual(failedBefore.started_at, '2000-01-01T00:00:00.000Z', 'HTTP client must not forge execution timestamp');
  const failedWithoutReason = await fetch(bookingsUrl + '/' + encodeURIComponent(failedBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-fail-1' },
    body: JSON.stringify({ status: 'FAILED', expected_version: 4, status_reason: 'forged failure reason' }),
  });
  assert.equal(failedWithoutReason.status, 400, 'HTTP failure must require a canonical reason');
  assert.equal((await failedWithoutReason.json()).error?.code, 'SERVICE_BOOKING_REASON_REQUIRED');
  const failedResponse = await fetch(bookingsUrl + '/' + encodeURIComponent(failedBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-fail-1' },
    body: JSON.stringify({ status: 'FAILED', expected_version: 4, reason: 'Required specialist is unavailable', status_reason: 'forged failure reason' }),
  });
  assert.equal(failedResponse.status, 200, 'failure with a reason should persist');
  const failedBody = await failedResponse.json();
  assert.equal(failedBody.booking.status, 'FAILED');
  assert.equal(failedBody.booking.status_reason, 'Required specialist is unavailable');
  const failedReplay = await fetch(bookingsUrl + '/' + encodeURIComponent(failedBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-fail-1' },
    body: JSON.stringify({ status: 'FAILED', expected_version: 4, reason: 'Required specialist is unavailable', status_reason: 'forged failure reason' }),
  });
  assert.equal(failedReplay.status, 200);
  assert.equal((await failedReplay.json()).replayed, true, 'failure replay should return the durable command result');
  const failedRestart = await fetch(bookingsUrl + '/' + encodeURIComponent(failedBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-fail-restart-1' },
    body: JSON.stringify({ status: 'IN_PROGRESS', expected_version: 5 }),
  });
  assert.equal(failedRestart.status, 409, 'failed booking must not be restarted through the lifecycle API');
  assert.equal((await failedRestart.json()).error?.code, 'SERVICE_BOOKING_TRANSITION_INVALID');

  // Stale-version commands must fail without changing booking or audit state.
  const staleBookingCreate = await fetch(bookingsUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-stale-create-1' },
    body: JSON.stringify({ ...bookingRequest, requested_start: '2026-11-07T09:00:00+03:00', requested_end: '2026-11-07T10:00:00+03:00' }),
  });
  assert.equal(staleBookingCreate.status, 201);
  const staleBooking = (await staleBookingCreate.json()).booking;
  const staleAuditCount = () => store.getDatabaseForTests().prepare(
    "SELECT COUNT(*) AS count FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ?"
  ).get(staleBooking.id).count;
  const staleAccept = await fetch(bookingsUrl + '/' + encodeURIComponent(staleBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-stale-accept-1' },
    body: JSON.stringify({ status: 'ACCEPTED', expected_version: 1 }),
  });
  assert.equal(staleAccept.status, 200);
  const staleAuditBefore = staleAuditCount();
  const staleResponse = await fetch(bookingsUrl + '/' + encodeURIComponent(staleBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-stale-transition-1' },
    body: JSON.stringify({ status: 'CONFIRMED', expected_version: 1 }),
  });
  assert.equal(staleResponse.status, 409, 'stale expected_version must conflict');
  const staleState = (await (await fetch(bookingsUrl, { headers: authHeaders })).json()).bookings
    .find(item => item.id === staleBooking.id);
  assert.equal(staleState.status, 'ACCEPTED');
  assert.equal(staleState.version, 2);
  assert.equal(staleAuditCount(), staleAuditBefore, 'stale command must not append lifecycle audit evidence');

  // Tenant and canonical-order scope are checked on the actual HTTP route.
  const foreignUser = await store.getOrCreateUserByTelegram('service-booking-foreign-' + Date.now(), 'Foreign Service Booking Tenant');
  const foreignTenant = await store.createTenantForUser({
    userId: foreignUser.id, sellerName: 'Foreign Service Booking Store', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const foreignTenantUrl = baseUrl + '/tenants/' + encodeURIComponent(foreignTenant.chatId)
    + '/orders/' + encodeURIComponent(serviceOrder.server_order_id) + '/service-bookings/'
    + encodeURIComponent(staleBooking.id);
  const crossTenantResponse = await fetch(foreignTenantUrl, {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-cross-tenant-1' },
    body: JSON.stringify({ status: 'ACCEPTED', expected_version: 1 }),
  });
  assert.ok([403, 404].includes(crossTenantResponse.status), 'cross-tenant route must fail closed');
  const crossTenantRead = await fetch(foreignTenantUrl, { headers: authHeaders });
  assert.ok([403, 404].includes(crossTenantRead.status),
    'a session for the source tenant must not read a booking through another tenant route');
  const foreignTenantBookingsUrl = baseUrl + '/tenants/' + encodeURIComponent(foreignTenant.chatId)
    + '/orders/' + encodeURIComponent(serviceOrder.server_order_id) + '/service-bookings';
  const crossTenantCreate = await fetch(foreignTenantBookingsUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-cross-tenant-create-1' },
    body: JSON.stringify(bookingRequest),
  });
  assert.ok([403, 404].includes(crossTenantCreate.status),
    'a session for the source tenant must not create a booking through another tenant route');
  const wrongOrderUrl = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/not-the-canonical-order/service-bookings/' + encodeURIComponent(staleBooking.id);
  const crossOrderResponse = await fetch(wrongOrderUrl, {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-cross-order-1' },
    body: JSON.stringify({ status: 'ACCEPTED', expected_version: 1 }),
  });
  assert.equal(crossOrderResponse.status, 404, 'booking must not be reachable through a different canonical order');
  const staleStateAfterScopeDenials = (await (await fetch(bookingsUrl, { headers: authHeaders })).json()).bookings
    .find(item => item.id === staleBooking.id);
  assert.equal(staleStateAfterScopeDenials.status, 'ACCEPTED');
  assert.equal(staleStateAfterScopeDenials.version, 2);
  assert.equal(staleAuditCount(), staleAuditBefore, 'scope denials must not mutate booking or audit state');

  // Authenticated staff without scheduling permissions must be denied at the
  // HTTP boundary, with no booking mutation or lifecycle audit append.
  const staffUser = await store.getOrCreateUserByTelegram('service-booking-staff-' + Date.now(), 'Service Booking Staff');
  await store.ensureMembership(staffUser.id, tenant.chatId, 'staff');
  const staffSession = await store.createSession({
    userId: staffUser.id, chatId: tenant.chatId, deviceName: 'Service Booking Unauthorized Staff',
  });
  const staffHeaders = {
    Authorization: 'Bearer ' + staffSession.token,
    'Content-Type': 'application/json',
    'Idempotency-Key': 'service-booking-http-permission-denied-1',
  };
  const deniedTransition = await fetch(bookingsUrl + '/' + encodeURIComponent(staleBooking.id), {
    method: 'PATCH',
    headers: staffHeaders,
    body: JSON.stringify({ status: 'CONFIRMED', expected_version: 2 }),
  });
  assert.equal(deniedTransition.status, 403, 'staff without scheduling:manage must be denied');
  const stateAfterPermissionDenial = (await (await fetch(bookingsUrl, { headers: authHeaders })).json()).bookings
    .find(item => item.id === staleBooking.id);
  assert.equal(stateAfterPermissionDenial.status, 'ACCEPTED');
  assert.equal(stateAfterPermissionDenial.version, 2);
  assert.equal(staleAuditCount(), staleAuditBefore, 'permission denial must not append lifecycle audit evidence');

  // A contextual manager role scoped to a different location must not become
  // tenant-wide scheduling authority when the booking route resolves its
  // canonical order location. Exercise the real session + HTTP authorization path.
  const locationScopedMembership = await store.ensureMembership(staffUser.id, tenant.chatId, 'staff');
  const wrongScopeLocation = await store.createOrganizationLocation(tenant.chatId, {
    code: 'SERVICE-BOOKING-WRONG-SCOPE', name: 'Wrong Scope Location', type: 'STORE',
  });
  store.getDatabaseForTests().prepare(
    "INSERT INTO membership_roles (id, membership_id, role_id, status, scope_type, scope_id, source, created_at) VALUES (?, ?, 'manager', 'active', 'LOCATION', ?, 'TEST_FIXTURE', ?)"
  ).run('service-booking-wrong-location-manager', locationScopedMembership.id, String(wrongScopeLocation.id), new Date().toISOString());
  const locationScopedSession = await store.createSession({
    userId: staffUser.id, chatId: tenant.chatId, deviceName: 'Wrong-location service booking manager',
  });
  const wrongLocationScopedResponse = await fetch(bookingsUrl + '/' + encodeURIComponent(staleBooking.id), {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + locationScopedSession.token,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'service-booking-http-wrong-location-scope-1',
    },
    body: JSON.stringify({ status: 'CONFIRMED', expected_version: 2 }),
  });
  assert.equal(wrongLocationScopedResponse.status, 403,
    'manager authority scoped to another location must not authorize booking lifecycle changes');
  const stateAfterWrongLocationDenial = (await (await fetch(bookingsUrl, { headers: authHeaders })).json()).bookings
    .find(item => item.id === staleBooking.id);
  assert.equal(stateAfterWrongLocationDenial.status, 'ACCEPTED');
  assert.equal(stateAfterWrongLocationDenial.version, 2);
  assert.equal(staleAuditCount(), staleAuditBefore,
    'wrong-location scope denial must not mutate booking or append lifecycle audit evidence');

  // Idempotency keys are tenant-scoped across booking commands, not silently
  // reusable for another booking. A collision must not mutate the second row.
  const conflictScopeCreate = await fetch(bookingsUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-conflict-scope-create-1' },
    body: JSON.stringify({ ...bookingRequest, requested_start: '2026-11-09T09:00:00+03:00', requested_end: '2026-11-09T10:00:00+03:00' }),
  });
  assert.equal(conflictScopeCreate.status, 201);
  const conflictScopeBooking = (await conflictScopeCreate.json()).booking;
  const conflictScopeAuditCount = () => store.getDatabaseForTests().prepare(
    "SELECT COUNT(*) AS count FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ?"
  ).get(conflictScopeBooking.id).count;
  const conflictScopeAuditBefore = conflictScopeAuditCount();
  const crossBookingKeyConflict = await fetch(bookingsUrl + '/' + encodeURIComponent(conflictScopeBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-stale-accept-1' },
    body: JSON.stringify({ status: 'ACCEPTED', expected_version: 1 }),
  });
  assert.equal(crossBookingKeyConflict.status, 409, 'a tenant-scoped key cannot be reused for a different booking');
  assert.equal((await crossBookingKeyConflict.json()).error?.code, 'SERVICE_BOOKING_IDEMPOTENCY_CONFLICT');
  const conflictScopeAfter = (await (await fetch(bookingsUrl, { headers: authHeaders })).json()).bookings
    .find(item => item.id === conflictScopeBooking.id);
  assert.equal(conflictScopeAfter.status, 'REQUESTED');
  assert.equal(conflictScopeAfter.version, 1);
  assert.equal(conflictScopeAuditCount(), conflictScopeAuditBefore,
    'cross-booking idempotency conflict must not mutate booking or audit state');

  // Completion actor/timestamp are server-authored even when submitted at the
  // HTTP boundary; completion notes are the only caller-authored completion evidence.
  const completedBookingCreate = await fetch(bookingsUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-complete-create-1' },
    body: JSON.stringify({ ...bookingRequest, requested_start: '2026-11-08T09:00:00+03:00', requested_end: '2026-11-08T10:00:00+03:00' }),
  });
  assert.equal(completedBookingCreate.status, 201);
  const completedBooking = (await completedBookingCreate.json()).booking;
  for (const step of [
    { status: 'ACCEPTED', expected_version: 1, key: 'service-booking-http-complete-accept-1' },
    { status: 'CONFIRMED', expected_version: 2, key: 'service-booking-http-complete-confirm-1' },
    { status: 'IN_PROGRESS', expected_version: 3, key: 'service-booking-http-complete-start-1' },
  ]) {
    const response = await fetch(bookingsUrl + '/' + encodeURIComponent(completedBooking.id), {
      method: 'PATCH', headers: { ...authHeaders, 'Idempotency-Key': step.key }, body: JSON.stringify(step),
    });
    assert.equal(response.status, 200, 'booking should transition to ' + step.status);
  }
  const completionResponse = await fetch(bookingsUrl + '/' + encodeURIComponent(completedBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-complete-final-1' },
    body: JSON.stringify({
      status: 'COMPLETED', expected_version: 4, completion_note: 'Service delivered',
      completed_at: '2000-01-01T00:00:00.000Z', completed_by: 'forged-client-completer',
    }),
  });
  assert.equal(completionResponse.status, 200);
  const completionBody = await completionResponse.json();
  assert.equal(completionBody.booking.status, 'COMPLETED');
  assert.notEqual(completionBody.booking.completed_at, '2000-01-01T00:00:00.000Z');
  assert.notEqual(completionBody.booking.completed_by, 'forged-client-completer');
  assert.equal(completionBody.booking.completed_by, user.id);
  const completionAudit = store.getDatabaseForTests().prepare(
    "SELECT action, metadata_json FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ? ORDER BY id"
  ).all(completedBooking.id);
  assert.deepEqual(completionAudit.map(row => row.action), [
    'services.booking.requested', 'services.booking.accepted', 'services.booking.confirmed',
    'services.booking.in_progress', 'services.booking.completed',
  ], 'each successful lifecycle transition must have exactly one audit event');
  const completionReplay = await fetch(bookingsUrl + '/' + encodeURIComponent(completedBooking.id), {
    method: 'PATCH',
    headers: { ...authHeaders, 'Idempotency-Key': 'service-booking-http-complete-final-1' },
    body: JSON.stringify({
      status: 'COMPLETED', expected_version: 4, completion_note: 'Service delivered',
      completed_at: '2000-01-01T00:00:00.000Z', completed_by: 'forged-client-completer',
    }),
  });
  assert.equal(completionReplay.status, 200);
  assert.equal((await completionReplay.json()).replayed, true);
  assert.equal(store.getDatabaseForTests().prepare(
    "SELECT COUNT(*) AS count FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ?"
  ).get(completedBooking.id).count, 5, 'completion replay must not duplicate audit evidence');

  const missingBookingKey = await fetch(bookingsUrl, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ...bookingRequest, requested_start: '2026-11-03T09:00:00+03:00' }),
  });
  assert.equal(missingBookingKey.status, 400, 'booking mutation must reject a missing idempotency key');


  // Logistics service checkout requires customer pickup/destination details,
  // stores only a truthful intake state, and never claims a courier assignment.
  const missingDeliveryDetails = await fetch(checkoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'parcel-missing-details-http-1' },
    body: JSON.stringify({
      buyer_id: 'parcel-buyer-http',
      customer_name: 'Parcel Buyer',
      items: [{ seller_id: tenant.chatId, item_id: 'parcel-instant-http', qty: 1 }],
    }),
  });
  assert.equal(missingDeliveryDetails.status, 400, 'logistics delivery service must reject missing pickup/destination');
  const missingDeliveryBody = await missingDeliveryDetails.json();
  assert.equal(missingDeliveryBody.error?.code, 'LOGISTICS_SERVICE_DELIVERY_DETAILS_REQUIRED');

  const parcelRequest = {
    buyer_id: 'parcel-buyer-http',
    customer_name: 'Parcel Buyer',
    customer_phone: '+251900000000',
    items: [{ seller_id: tenant.chatId, item_id: 'parcel-instant-http', qty: 1 }],
    service_delivery: {
      pickup_details: 'Bole Medhanialem, Addis Ababa',
      destination_details: 'CMC, Addis Ababa',
      customer_note: 'Call on arrival',
    },
  };
  const parcelHeaders = { 'Content-Type': 'application/json', 'Idempotency-Key': 'parcel-intake-http-1' };
  const parcelFirstResponse = await fetch(checkoutUrl, {
    method: 'POST', headers: parcelHeaders, body: JSON.stringify(parcelRequest),
  });
  assert.equal(parcelFirstResponse.status, 200, 'valid logistics service request should create canonical marketplace order');
  const parcelFirst = await parcelFirstResponse.json();
  assert.equal(parcelFirst.sub_orders[0]?.service_delivery?.delivery_model, 'instant');
  assert.equal(parcelFirst.sub_orders[0]?.service_delivery?.assessment_status, 'ELIGIBILITY_CHECK_REQUIRED');
  assert.equal(parcelFirst.sub_orders[0]?.service_delivery?.assignment_status, 'NOT_ASSIGNED');
  const parcelRetryResponse = await fetch(checkoutUrl, {
    method: 'POST', headers: parcelHeaders, body: JSON.stringify(parcelRequest),
  });
  assert.equal(parcelRetryResponse.status, 200);
  const parcelRetry = await parcelRetryResponse.json();
  assert.equal(parcelRetry.marketplace_order_id, parcelFirst.marketplace_order_id,
    'service request idempotent retry must replay same canonical marketplace order');
  const parcelStoredOrder = (await store.getOrders(tenant.chatId)).find(order => order.id === parcelFirst.sub_orders[0].seller_order_id || order.marketplace_order_id === parcelFirst.marketplace_order_id);
  assert.ok(parcelStoredOrder, 'canonical seller order should persist');
  assert.equal(parcelStoredOrder.service_delivery_request?.pickup_details, 'Bole Medhanialem, Addis Ababa');
  assert.equal(parcelStoredOrder.service_delivery_request?.destination_details, 'CMC, Addis Ababa');
  assert.equal(parcelStoredOrder.service_delivery_request?.assignment_status, 'NOT_ASSIGNED');

  const requestedAssessmentResponse = await fetch(checkoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'parcel-request-model-http-1' },
    body: JSON.stringify({
      buyer_id: 'parcel-request-buyer-http',
      customer_name: 'Parcel Request Buyer',
      items: [{ seller_id: tenant.chatId, item_id: 'parcel-request-http', qty: 1 }],
      service_delivery: {
        pickup_details: 'Piassa, Addis Ababa',
        destination_details: 'Sar Bet, Addis Ababa',
      },
    }),
  });
  assert.equal(requestedAssessmentResponse.status, 200);
  const requestedAssessment = await requestedAssessmentResponse.json();
  assert.equal(requestedAssessment.sub_orders[0]?.service_delivery?.delivery_model, 'request');
  assert.equal(requestedAssessment.sub_orders[0]?.service_delivery?.assessment_status, 'ASSESSMENT_REQUIRED',
    'request delivery model must require assessment before confirmation');
  assert.equal(requestedAssessment.sub_orders[0]?.service_delivery?.assignment_status, 'NOT_ASSIGNED');

  // A visible assessment status is not sufficient on its own: canonical
  // fulfillment transitions must reject the request until assessment and
  // customer acceptance have explicitly moved it to READY_FOR_FULFILLMENT.
  const requestOrder = (await store.getOrders(tenant.chatId)).find(order =>
    order.marketplace_order_id === requestedAssessment.marketplace_order_id
    || order.id === requestedAssessment.sub_orders[0]?.seller_order_id
  );
  assert.ok(requestOrder?.server_order_id, 'service request must retain its canonical server order identity');
  await assert.rejects(
    () => store.transitionOrderFulfillment(tenant.chatId, requestOrder.server_order_id, 'out_for_delivery', null, {
      idempotencyKey: 'parcel-request-before-assessment',
    }),
    error => error?.code === 'LOGISTICS_SERVICE_ASSESSMENT_REQUIRED' && error?.statusCode === 409,
    'unassessed service requests must not enter canonical fulfillment'
  );
  const logisticsActor = { userId: user.id, organizationId: session.organizationId, role: 'owner' };
  // Activate the canonical Logistics Pack through its lifecycle contract before
  // assigning a logistics role; the role guard intentionally rejects inactive packs.
  await store.transitionPackLifecycle(tenant.chatId, 'logistics', 'INSTALLED', logisticsActor);
  await store.transitionPackLifecycle(tenant.chatId, 'logistics', 'ELIGIBLE', logisticsActor);
  await store.transitionPackLifecycle(tenant.chatId, 'logistics', 'ACTIVE', logisticsActor);

  const tenantMemberships = await store.listTenantMemberships(tenant.chatId);
  const ownerMembership = tenantMemberships.find(membership => String(membership.user_id || membership.userId) === String(user.id));
  assert.ok(ownerMembership?.id, 'test owner membership must be available for scoped logistics role setup');
  await store.assignMembershipContextualRole({
    actorUserId: user.id,
    chatId: tenant.chatId,
    membershipId: ownerMembership.id,
    role: 'logistics_manager',
  });
  // Session authorization claims are a snapshot. Reissue the test session
  // after the contextual role change so the HTTP journey tests current scope.
  const assessmentSession = await store.createSession({
    userId: user.id,
    chatId: tenant.chatId,
    deviceName: 'Service Catalog HTTP assessment regression',
  });
  authHeaders.Authorization = 'Bearer ' + assessmentSession.token;
  await assert.rejects(
    () => store.assignDeliveryCourier(tenant.chatId, requestOrder.server_order_id, '', logisticsActor, {
      assignmentKey: 'parcel-request-before-assessment',
    }),
    error => {
      assert.equal(error?.code, 'LOGISTICS_SERVICE_ASSESSMENT_REQUIRED',
        `unexpected assignment rejection: code=${error?.code || 'none'} status=${error?.statusCode || 'none'} message=${error?.message || error}`);
      assert.equal(error?.statusCode, 409);
      return true;
    },
    'unassessed service requests must not be assigned to a courier'
  );

  const assessmentUrl = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/' + encodeURIComponent(requestOrder.server_order_id) + '/service-delivery-assessment';

  const unauthenticatedAssessmentResponse = await fetch(assessmentUrl, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'parcel-request-assessment-unauthenticated' },
    body: JSON.stringify({ assessment_outcome: 'INELIGIBLE' }),
  });
  assert.equal(unauthenticatedAssessmentResponse.status, 401,
    'assessment endpoint must reject requests without an authenticated session');

  if (requestOrder.location_id) {
    const wrongLocationResponse = await fetch(assessmentUrl, {
      method: 'POST',
      headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-wrong-location' },
      body: JSON.stringify({
        assessment_outcome: 'INELIGIBLE',
        locationId: 'not-the-canonical-order-location',
      }),
    });
    assert.equal(wrongLocationResponse.status, 403,
      'assessment must not authorize against a caller-selected location different from the order location');
    assert.equal((await wrongLocationResponse.json()).error?.code,
      'LOGISTICS_ASSESSMENT_LOCATION_MISMATCH');
  }

  const assessmentPayload = {
    assessment_outcome: 'ELIGIBLE',
    // These client-supplied identity/authority claims must never override the authenticated session.
    organization_id: 'attacker-controlled-organization',
    actor_user_id: 'attacker-controlled-user',
    assessed_by_user_id: 'attacker-controlled-user',
    customer_acceptance: {
      accepted: true,
      evidence_type: 'telegram_confirmation',
      evidence_reference: 'buyer-chat-confirmation-123',
    },
  };
  const serviceRequestBeforeInvalidAssessments = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === requestOrder.server_order_id)?.service_delivery_request;
  assert.ok(serviceRequestBeforeInvalidAssessments,
    'canonical service request must exist before assessment attempts');

  const missingAcceptanceResponse = await fetch(assessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-missing-acceptance' },
    body: JSON.stringify({ assessment_outcome: 'ELIGIBLE' }),
  });
  const missingAcceptanceBody = await missingAcceptanceResponse.json();
  assert.equal(missingAcceptanceResponse.status, 400,
    `an eligible assessment must fail closed without explicit customer acceptance evidence; got status=${missingAcceptanceResponse.status} body=${JSON.stringify(missingAcceptanceBody)}`);
  assert.equal(missingAcceptanceBody.error?.code, 'LOGISTICS_CUSTOMER_ACCEPTANCE_REQUIRED');

  const overlongEvidenceResponse = await fetch(assessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-overlong-evidence' },
    body: JSON.stringify({
      ...assessmentPayload,
      customer_acceptance: {
        ...assessmentPayload.customer_acceptance,
        evidence_reference: 'x'.repeat(201),
      },
    }),
  });
  assert.equal(overlongEvidenceResponse.status, 400,
    'overlong evidence references must be rejected rather than silently truncated');
  assert.equal((await overlongEvidenceResponse.json()).error?.code,
    'LOGISTICS_CUSTOMER_ACCEPTANCE_EVIDENCE_INVALID');

  const serviceRequestAfterInvalidAssessments = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === requestOrder.server_order_id)?.service_delivery_request;
  assert.deepEqual(serviceRequestAfterInvalidAssessments, serviceRequestBeforeInvalidAssessments,
    'rejected assessment payloads must leave canonical service request state unchanged');

  const assessmentResponse = await fetch(assessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-accepted-1' },
    body: JSON.stringify(assessmentPayload),
  });
  assert.equal(assessmentResponse.status, 200, 'authorized assessment and recorded customer acceptance should enable fulfillment');
  const assessmentResult = await assessmentResponse.json();
  assert.equal(assessmentResult.service_delivery?.assessment_status, 'READY_FOR_FULFILLMENT');
  assert.equal(assessmentResult.service_delivery?.assessment?.outcome, 'ELIGIBLE');
  assert.equal(assessmentResult.service_delivery?.assessment?.assessed_by_user_id, String(user.id),
    'recorded assessment actor must come from the authenticated session, not client-supplied identity fields');
  assert.equal(assessmentResult.service_delivery?.assessment?.customer_acceptance?.evidence_reference, 'buyer-chat-confirmation-123');
  assert.equal(assessmentResult.service_delivery?.assignment_status, 'NOT_ASSIGNED',
    'customer acceptance must not automatically assign a courier');

  // Tenant A's service-delivery assessment must not be reachable through
  // Tenant B's route, even when the caller has a valid Tenant A session.
  const crossTenantAssessmentBefore = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === requestOrder.server_order_id)?.service_delivery_request;
  const crossTenantAssessmentUrl = baseUrl + '/tenants/' + encodeURIComponent(otherTenant.chatId)
    + '/orders/' + encodeURIComponent(requestOrder.server_order_id) + '/service-delivery-assessment';
  const crossTenantAssessmentResponse = await fetch(crossTenantAssessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'cross-tenant-service-assessment-denied-1' },
    body: JSON.stringify(assessmentPayload),
  });
  assert.equal(crossTenantAssessmentResponse.status, 403,
    'a session scoped to one tenant must not assess a service order through another tenant route');
  const crossTenantAssessmentAfter = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === requestOrder.server_order_id)?.service_delivery_request;
  assert.deepEqual(crossTenantAssessmentAfter, crossTenantAssessmentBefore,
    'cross-tenant assessment denial must leave the canonical service request unchanged');

  // Assessment idempotency keys are organization-scoped, not merely embedded
  // in one order's JSON. Reusing a committed key against another order must
  // conflict before validating that second order's assessment payload.
  const crossOrderAssessmentUrl = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/' + encodeURIComponent(parcelStoredOrder.server_order_id) + '/service-delivery-assessment';
  const crossOrderTargetBefore = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === parcelStoredOrder.server_order_id)?.service_delivery_request;
  const crossOrderAssessmentReplay = await fetch(crossOrderAssessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-accepted-1' },
    body: JSON.stringify(assessmentPayload),
  });
  assert.equal(crossOrderAssessmentReplay.status, 409,
    'an assessment idempotency key must not be reused across canonical orders');
  assert.equal((await crossOrderAssessmentReplay.json()).error?.code,
    'LOGISTICS_ASSESSMENT_IDEMPOTENCY_CONFLICT');
  const crossOrderTargetAfter = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === parcelStoredOrder.server_order_id)?.service_delivery_request;
  assert.deepEqual(crossOrderTargetAfter, crossOrderTargetBefore,
    'cross-order idempotency conflict must not mutate the target order');

  assert.ok(parcelStoredOrder.server_order_id,
    'instant service request must retain its canonical server order identity');
  const instantAssessmentUrl = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/' + encodeURIComponent(parcelStoredOrder.server_order_id) + '/service-delivery-assessment';
  const instantAcceptance = {
    accepted: true,
    evidence_type: 'telegram_confirmation',
    evidence_reference: 'instant-buyer-confirmation-123',
  };
  const instantMissingAvailabilityResponse = await fetch(instantAssessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'parcel-instant-assessment-missing-availability' },
    body: JSON.stringify({
      assessment_outcome: 'ELIGIBLE',
      customer_acceptance: instantAcceptance,
    }),
  });
  assert.equal(instantMissingAvailabilityResponse.status, 400,
    'instant delivery cannot become ready without an explicit availability result');
  assert.equal((await instantMissingAvailabilityResponse.json()).error?.code,
    'LOGISTICS_AVAILABILITY_CONFIRMATION_REQUIRED');
  const instantRequestAfterMissingAvailability = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === parcelStoredOrder.server_order_id)?.service_delivery_request;
  assert.equal(instantRequestAfterMissingAvailability?.assessment, undefined,
    'failed instant availability checks must not persist an assessment');
  assert.notEqual(instantRequestAfterMissingAvailability?.assessment_status, 'READY_FOR_FULFILLMENT',
    'failed instant availability checks must not advance the request lifecycle');

  const instantAssessmentResponse = await fetch(instantAssessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'parcel-instant-assessment-eligible' },
    body: JSON.stringify({
      assessment_outcome: 'ELIGIBLE',
      availability_confirmed: true,
      customer_acceptance: instantAcceptance,
    }),
  });
  assert.equal(instantAssessmentResponse.status, 200,
    'instant delivery can become ready after eligibility, availability, and acceptance are recorded');
  const instantAssessmentResult = await instantAssessmentResponse.json();
  assert.equal(instantAssessmentResult.service_delivery?.assessment_status, 'READY_FOR_FULFILLMENT');
  assert.equal(instantAssessmentResult.service_delivery?.assessment?.availability_confirmed, true);
  assert.equal(instantAssessmentResult.service_delivery?.assessment?.availability_confirmation?.source,
    'authorized_operator_recorded',
    'recorded availability must not be represented as externally verified');
  assert.equal(instantAssessmentResult.service_delivery?.assessment?.availability_confirmation?.recorded_by_user_id,
    String(user.id));
  assert.equal(instantAssessmentResult.service_delivery?.assignment_status, 'NOT_ASSIGNED',
    'instant eligibility must not automatically assign a courier');

  if (requestOrder.location_id) {
    await assert.rejects(
      () => store.assignDeliveryCourier(
        tenant.chatId,
        requestOrder.server_order_id,
        'not-a-courier',
        session,
        {
          locationId: 'not-the-canonical-order-location',
          assignmentKey: 'parcel-request-assignment-wrong-location',
        }
      ),
      error => error?.code === 'LOGISTICS_ASSIGNMENT_LOCATION_MISMATCH' && error?.statusCode === 403,
      'courier assignment must not authorize against a caller-selected location different from the order location'
    );
  }

  // Existing fulfillment rows must not let courier assignment drift from
  // the canonical order's location. Seed a deliberately inconsistent row and
  // assert the service rejects it before validating/creating an assignment.
  if (requestOrder.location_id) {
    const seededFulfillmentDb = new DatabaseSync(dbPath);
    try {
      seededFulfillmentDb.prepare(`
        INSERT INTO fulfillments
          (id, server_order_id, organization_id, location_id, fulfillment_type, status,
           destination_json, scheduled_at, tracking_reference, proof_json, last_command_key,
           created_by_user_id, updated_by_user_id, created_at, updated_at, version)
        VALUES (?, ?, ?, ?, 'delivery', 'pending', NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, 1)
      `).run(
        'test-mismatched-fulfillment-location',
        requestOrder.server_order_id,
        String(session.organizationId),
        'not-the-canonical-order-location',
        String(user.id),
        String(user.id),
        new Date().toISOString(),
        new Date().toISOString(),
      );
    } finally {
      seededFulfillmentDb.close();
    }
    await assert.rejects(
      () => store.assignDeliveryCourier(
        tenant.chatId,
        requestOrder.server_order_id,
        'not-a-courier',
        session,
        { assignmentKey: 'parcel-request-assignment-existing-fulfillment-location-mismatch' }
      ),
      error => error?.code === 'LOGISTICS_FULFILLMENT_LOCATION_MISMATCH' && error?.statusCode === 409,
      'assignment must reject an existing fulfillment whose location differs from the canonical order'
    );
  }

  // Assignment command keys are organization-scoped. Seed a prior committed
  // assignment to exercise retry behavior without depending on courier selection.
  const assignmentReplayDb = new DatabaseSync(dbPath);
  let seededAssignmentId;
  try {
    const matchingFulfillment = assignmentReplayDb.prepare(
      'SELECT * FROM fulfillments WHERE server_order_id = ? AND organization_id = ?'
    ).get(String(requestOrder.server_order_id), String(session.organizationId));
    // Keep the seeded fulfillment consistent with the location resolution used
    // by direct transitions when the order has no explicit location.
    const replayLocationId = requestOrder.location_id
      ? String(requestOrder.location_id)
      : (session.locationId ? String(session.locationId) : null);
    if (matchingFulfillment) {
      assignmentReplayDb.prepare('UPDATE fulfillments SET location_id = ? WHERE id = ?').run(
        replayLocationId, matchingFulfillment.id
      );
    } else {
      const now = new Date().toISOString();
      assignmentReplayDb.prepare(`
        INSERT INTO fulfillments
          (id, server_order_id, organization_id, location_id, fulfillment_type, status,
           destination_json, scheduled_at, tracking_reference, proof_json, last_command_key,
           created_by_user_id, updated_by_user_id, created_at, updated_at, version)
        VALUES (?, ?, ?, ?, 'delivery', 'pending', NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, 1)
      `).run(
        'test-assignment-replay-fulfillment', String(requestOrder.server_order_id),
        String(session.organizationId), replayLocationId,
        String(user.id), String(user.id), now, now
      );
    }
    const fulfillmentRow = assignmentReplayDb.prepare(
      'SELECT * FROM fulfillments WHERE server_order_id = ? AND organization_id = ?'
    ).get(String(requestOrder.server_order_id), String(session.organizationId));
    seededAssignmentId = 'test-assignment-replay-existing';
    const now = new Date().toISOString();
    assignmentReplayDb.prepare(`
      INSERT INTO delivery_assignments
        (id, fulfillment_id, organization_id, location_id, courier_user_id, status,
         assignment_key, assigned_by_user_id, assigned_at, updated_at, version, last_command_key)
      VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, ?, ?, 1, ?)
    `).run(
      seededAssignmentId, fulfillmentRow.id, String(session.organizationId),
      replayLocationId,
      String(user.id), 'parcel-assignment-idempotency-key-replay',
      String(user.id), now, now, 'parcel-assignment-idempotency-key-replay'
    );
    const assignmentFingerprint = createHash('sha256').update(JSON.stringify({
      action: 'ASSIGN',
      requested_courier_user_id: String(user.id),
    })).digest('hex');
    assignmentReplayDb.prepare(`
      INSERT INTO delivery_assignment_commands
        (organization_id, command_key, server_order_id, command_fingerprint, result_assignment_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      String(session.organizationId), 'parcel-assignment-idempotency-key-replay',
      String(requestOrder.server_order_id), assignmentFingerprint, seededAssignmentId, now
    );
  } finally {
    assignmentReplayDb.close();
  }
  const replayedAssignment = await store.assignDeliveryCourier(
    tenant.chatId, requestOrder.server_order_id, String(user.id), session,
    { assignmentKey: 'parcel-assignment-idempotency-key-replay' }
  );
  assert.equal(replayedAssignment.id, seededAssignmentId,
    'exact assignment retry must replay the original assignment');
  let assignmentKeyConflictError = null;
  try {
    await store.assignDeliveryCourier(
      tenant.chatId, requestOrder.server_order_id, 'different-courier-user', session,
      { assignmentKey: 'parcel-assignment-idempotency-key-replay' }
    );
  } catch (error) {
    assignmentKeyConflictError = error;
  }
  assert.ok(
    assignmentKeyConflictError?.code === 'IDEMPOTENCY_KEY_REUSE_CONFLICT'
      && assignmentKeyConflictError?.statusCode === 409,
    `reusing an assignment key with a different courier must conflict; got code=${assignmentKeyConflictError?.code} status=${assignmentKeyConflictError?.statusCode} message=${assignmentKeyConflictError?.message}`
  );

  let directTransitionError = null;
  try {
    await store.transitionOrderFulfillment(
      tenant.chatId, requestOrder.server_order_id, 'out_for_delivery', session,
      { idempotencyKey: 'parcel-direct-transition-bypasses-assignment' }
    );
  } catch (error) {
    directTransitionError = error;
  }
  assert.ok(
    directTransitionError?.code === 'DELIVERY_ASSIGNMENT_LIFECYCLE_REQUIRED'
      && directTransitionError?.statusCode === 409,
    `an active courier assignment must advance through its own lifecycle; got code=${directTransitionError?.code} status=${directTransitionError?.statusCode} message=${directTransitionError?.message}`
  );
  let missingReassignmentTargetError = null;
  try {
    await store.transitionDeliveryAssignment(
      tenant.chatId, requestOrder.server_order_id, 'REASSIGN_EXCEPTION', session,
      { idempotencyKey: 'parcel-assignment-reassign-missing-target' }
    );
  } catch (error) {
    missingReassignmentTargetError = error;
  }
  assert.ok(
    missingReassignmentTargetError?.code === 'REASSIGNMENT_TARGET_REQUIRED'
      && missingReassignmentTargetError?.statusCode === 400,
    `reassignment without a target must return a validation error after loading the active assignment; got code=${missingReassignmentTargetError?.code} status=${missingReassignmentTargetError?.statusCode} message=${missingReassignmentTargetError?.message}`
  );
  // A stale or corrupted assignment location must not advance even when the
  // tenant and order still belong to the expected organization.
  const assignmentLocationGuardDb = new DatabaseSync(dbPath);
  let originalAssignmentLocationId;
  let originalAssignmentUpdatedAt;
  try {
    const currentAssignment = assignmentLocationGuardDb.prepare(
      "SELECT id, location_id, updated_at FROM delivery_assignments WHERE id = ?"
    ).get(seededAssignmentId);
    assert.ok(currentAssignment, 'seeded assignment should exist for location guard regression');
    originalAssignmentLocationId = currentAssignment.location_id;
    originalAssignmentUpdatedAt = currentAssignment.updated_at;
    // Use NULL to model a corrupted/missing assignment location without
    // violating the locations foreign key; the canonical order still has one.
    assignmentLocationGuardDb.prepare(
      "UPDATE delivery_assignments SET location_id = ?, updated_at = ? WHERE id = ?"
    ).run(null, '9999-12-31T23:59:59.999Z', seededAssignmentId);
  } finally {
    assignmentLocationGuardDb.close();
  }
  await assert.rejects(
    () => store.transitionDeliveryAssignment(
      tenant.chatId, requestOrder.server_order_id, 'ACCEPTED', session,
      { idempotencyKey: 'parcel-assignment-stale-location-must-fail' }
    ),
    error => error?.code === 'DELIVERY_ASSIGNMENT_LOCATION_MISMATCH' && error?.statusCode === 409,
    'assignment transition must reject a persisted location that differs from the canonical order'
  );
  const restoreAssignmentLocationDb = new DatabaseSync(dbPath);
  try {
    restoreAssignmentLocationDb.prepare(
      "UPDATE delivery_assignments SET location_id = ?, updated_at = ? WHERE id = ?"
    ).run(originalAssignmentLocationId, originalAssignmentUpdatedAt, seededAssignmentId);
  } finally {
    restoreAssignmentLocationDb.close();
  }

  const acceptedAssignment = await store.transitionDeliveryAssignment(
    tenant.chatId, requestOrder.server_order_id, 'ACCEPTED', session,
    { idempotencyKey: 'parcel-assignment-accept-transition' }
  );
  assert.equal(acceptedAssignment.status, 'ACCEPTED',
    'courier assignment should accept before dispatch');
  await assert.rejects(
    () => store.transitionDeliveryAssignment(
      tenant.chatId, requestOrder.server_order_id, 'DELIVERED', session,
      { idempotencyKey: 'parcel-assignment-delivered-without-proof' }
    ),
    error => error?.code === 'DELIVERY_PROOF_REQUIRED' && error?.statusCode === 400,
    'assignment cannot complete delivery without proof'
  );
  const outboundAssignment = await store.transitionDeliveryAssignment(
    tenant.chatId, requestOrder.server_order_id, 'OUT_FOR_DELIVERY', session,
    { idempotencyKey: 'parcel-assignment-outbound-transition' }
  );
  assert.equal(outboundAssignment.status, 'OUT_FOR_DELIVERY',
    'assignment and fulfillment should advance together through the canonical lifecycle');
  assert.equal(
    (await store.transitionOrderFulfillment(
      tenant.chatId, requestOrder.server_order_id, 'delivered', session,
      { idempotencyKey: 'parcel-direct-delivery-completion' }
    ).catch(error => ({ error }))).error?.code,
    'DELIVERY_ASSIGNMENT_LIFECYCLE_REQUIRED',
    'direct completion must not bypass the active assignment lifecycle'
  );

  // A retry after the original response has been consumed must replay the
  // committed command without appending another command or audit event.
  const assessmentDb = new DatabaseSync(dbPath);
  let commandCountBeforeRetry;
  let auditCountBeforeRetry;
  try {
    commandCountBeforeRetry = assessmentDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE command_key = ?'
    ).get('parcel-request-assessment-accepted-1').count;
    auditCountBeforeRetry = assessmentDb.prepare(
      'SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ?'
    ).get(tenant.chatId).count;
  } finally {
    assessmentDb.close();
  }
  assert.equal(commandCountBeforeRetry, 1,
    'the accepted assessment must have exactly one durable command record before replay');

  // This retry happens after the request has advanced through courier assignment
  // and OUT_FOR_DELIVERY. Replaying the old assessment must not restore its
  // historical NOT_ASSIGNED snapshot or overwrite current fulfillment state.
  const assessmentStateBeforeRetry = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === requestOrder.server_order_id)?.service_delivery_request;
  assert.equal(assessmentStateBeforeRetry?.assignment_status, 'OUT_FOR_DELIVERY',
    'the delayed assessment replay fixture must already be assigned and outbound');

  const assessmentRetry = await fetch(assessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-accepted-1' },
    body: JSON.stringify(assessmentPayload),
  });
  assert.equal(assessmentRetry.status, 200, 'assessment idempotent retry should succeed');
  const assessmentRetryBody = await assessmentRetry.json();
  assert.equal(assessmentRetryBody.replayed, true, 'assessment retry should be reported as replayed');

  // Two simultaneous retries of the already committed command must both replay,
  // not race into duplicate command/audit writes.
  const concurrentAssessmentRetries = await Promise.all([
    fetch(assessmentUrl, {
      method: 'POST',
      headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-accepted-1' },
      body: JSON.stringify(assessmentPayload),
    }),
    fetch(assessmentUrl, {
      method: 'POST',
      headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-accepted-1' },
      body: JSON.stringify(assessmentPayload),
    }),
  ]);
  assert.deepEqual(concurrentAssessmentRetries.map(response => response.status), [200, 200],
    'concurrent exact assessment retries must both resolve successfully');
  const concurrentAssessmentBodies = await Promise.all(concurrentAssessmentRetries.map(response => response.json()));
  assert.ok(concurrentAssessmentBodies.every(body => body.replayed === true),
    'concurrent retries of a committed assessment must both be marked replayed');

  const assessmentDbAfterRetry = new DatabaseSync(dbPath);
  try {
    const commandCountAfterRetry = assessmentDbAfterRetry.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE command_key = ?'
    ).get('parcel-request-assessment-accepted-1').count;
    const auditCountAfterRetry = assessmentDbAfterRetry.prepare(
      'SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ?'
    ).get(tenant.chatId).count;
    assert.equal(commandCountAfterRetry, commandCountBeforeRetry,
      'assessment replay must not append a duplicate durable command');
    assert.equal(auditCountAfterRetry, auditCountBeforeRetry,
      'assessment replay must not append a duplicate audit event');
  } finally {
    assessmentDbAfterRetry.close();
  }
  const assessmentStateAfterRetry = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === requestOrder.server_order_id)?.service_delivery_request;
  assert.deepEqual(assessmentStateAfterRetry, assessmentStateBeforeRetry,
    'single and concurrent delayed assessment replays must preserve later assignment and fulfillment state');

  const conflictingAssessmentResponse = await fetch(assessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-accepted-1' },
    body: JSON.stringify({
      ...assessmentPayload,
      customer_acceptance: {
        ...assessmentPayload.customer_acceptance,
        evidence_reference: 'different-buyer-confirmation-456',
      },
    }),
  });
  assert.equal(conflictingAssessmentResponse.status, 409,
    'reusing an assessment idempotency key with changed evidence must conflict');
  assert.equal((await conflictingAssessmentResponse.json()).error?.code,
    'LOGISTICS_ASSESSMENT_IDEMPOTENCY_CONFLICT');

  const conflictingInvalidAssessmentResponse = await fetch(assessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-accepted-1' },
    body: JSON.stringify({ assessment_outcome: 'NOT_A_VALID_OUTCOME' }),
  });
  assert.equal(conflictingInvalidAssessmentResponse.status, 409,
    'reusing a recorded assessment key with an invalid changed payload must still conflict');
  assert.equal((await conflictingInvalidAssessmentResponse.json()).error?.code,
    'LOGISTICS_ASSESSMENT_IDEMPOTENCY_CONFLICT');

  const secondAssessmentResponse = await fetch(assessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-second-distinct-command' },
    body: JSON.stringify({
      assessment_outcome: 'INELIGIBLE',
    }),
  });
  assert.equal(secondAssessmentResponse.status, 409,
    'a distinct command must not overwrite an already recorded assessment');
  assert.equal((await secondAssessmentResponse.json()).error?.code,
    'LOGISTICS_ASSESSMENT_ALREADY_RECORDED');

  const assessedStoredOrder = (await store.getOrders(tenant.chatId)).find(order => order.server_order_id === requestOrder.server_order_id);
  assert.equal(assessedStoredOrder.service_delivery_request.assessment_status, 'READY_FOR_FULFILLMENT',
    'the canonical seller order must persist the authoritative readiness state');

  if (requestOrder.location_id) {
    await assert.rejects(
      () => store.transitionOrderFulfillment(
        tenant.chatId, requestOrder.server_order_id, 'out_for_delivery', session,
        {
          locationId: 'not-the-canonical-order-location',
          idempotencyKey: 'parcel-fulfillment-wrong-location-must-fail',
        }
      ),
      error => error?.code === 'FULFILLMENT_LOCATION_MISMATCH' && error?.statusCode === 403,
      'fulfillment transition must reject a caller-selected location that differs from the canonical order'
    );
  }

  // A negative assessment must remain terminal for this lifecycle and must
  // not permit fulfillment transitions or courier assignment.
  const rejectedCheckoutResponse = await fetch(checkoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'parcel-request-rejected-http-1' },
    body: JSON.stringify({
      buyer_id: 'parcel-request-rejected-buyer-http',
      customer_name: 'Parcel Request Rejected Buyer',
      items: [{ seller_id: tenant.chatId, item_id: 'parcel-request-http', qty: 1 }],
      service_delivery: {
        pickup_details: 'Piassa, Addis Ababa',
        destination_details: 'Sar Bet, Addis Ababa',
      },
    }),
  });
  assert.equal(rejectedCheckoutResponse.status, 200, 'second service request should be created for negative assessment coverage');
  const rejectedCheckout = await rejectedCheckoutResponse.json();
  const rejectedOrder = (await store.getOrders(tenant.chatId)).find(order =>
    order.marketplace_order_id === rejectedCheckout.marketplace_order_id
    || order.id === rejectedCheckout.sub_orders?.[0]?.seller_order_id);
  assert.ok(rejectedOrder?.server_order_id, 'negative-assessment fixture must retain canonical order identity');

  // Inject a durable-command write failure after the assessment handler has
  // updated the order JSON. The surrounding transaction must roll back both
  // the order mutation and any command/audit evidence.
  const rollbackCommandKey = 'parcel-assessment-rollback-injected';
  const rollbackBefore = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === rejectedOrder.server_order_id)?.service_delivery_request;
  const rollbackSetupDb = new DatabaseSync(dbPath);
  try {
    rollbackSetupDb.exec(`
      CREATE TRIGGER fail_service_assessment_command_insert
      BEFORE INSERT ON service_delivery_assessment_commands
      WHEN NEW.command_key = '${rollbackCommandKey}'
      BEGIN
        SELECT RAISE(ABORT, 'injected service assessment command failure');
      END;
    `);
  } finally {
    rollbackSetupDb.close();
  }
  let rollbackResponse;
  try {
    rollbackResponse = await fetch(
      baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
        + '/orders/' + encodeURIComponent(rejectedOrder.server_order_id) + '/service-delivery-assessment',
      {
        method: 'POST',
        headers: { ...authHeaders, 'Idempotency-Key': rollbackCommandKey },
        body: JSON.stringify({ assessment_outcome: 'INELIGIBLE' }),
      }
    );
  } finally {
    const rollbackCleanupDb = new DatabaseSync(dbPath);
    try {
      rollbackCleanupDb.exec('DROP TRIGGER IF EXISTS fail_service_assessment_command_insert');
    } finally {
      rollbackCleanupDb.close();
    }
  }
  assert.equal(rollbackResponse.status, 500,
    'an injected command persistence failure should fail the assessment request');
  const rollbackAfter = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === rejectedOrder.server_order_id)?.service_delivery_request;
  assert.deepEqual(rollbackAfter, rollbackBefore,
    'failed assessment transaction must roll back the canonical order mutation');
  const rollbackVerifyDb = new DatabaseSync(dbPath);
  try {
    assert.equal(rollbackVerifyDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE command_key = ?'
    ).get(rollbackCommandKey).count, 0,
    'failed assessment transaction must not leave a durable command record');
    assert.equal(rollbackVerifyDb.prepare(`
      SELECT COUNT(*) AS count FROM audit_events
      WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?
    `).get(tenant.chatId, rejectedOrder.server_order_id).count, 0,
    'failed assessment transaction must not leave an assessment audit event');
  } finally {
    rollbackVerifyDb.close();
  }

// Recovery boundary: after an injected persistence failure is removed, the
  // same idempotency key must be usable for a legitimate retry. Use a separate
  // fresh order so the following concurrency tests still start unassessed.
  const assessmentRecoveryCheckoutResponse = await fetch(checkoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'parcel-assessment-recovery-checkout' },
    body: JSON.stringify({
      buyer_id: 'parcel-assessment-recovery-buyer',
      customer_name: 'Parcel Assessment Recovery Buyer',
      items: [{ seller_id: tenant.chatId, item_id: 'parcel-request-http', qty: 1 }],
      service_delivery: {
        pickup_details: 'Piassa, Addis Ababa',
        destination_details: 'Sar Bet, Addis Ababa',
      },
    }),
  });
  assert.equal(assessmentRecoveryCheckoutResponse.status, 200,
    'assessment-recovery service order should be created');
  const assessmentRecoveryCheckout = await assessmentRecoveryCheckoutResponse.json();
  const assessmentRecoveryOrder = (await store.getOrders(tenant.chatId)).find(order =>
    order.marketplace_order_id === assessmentRecoveryCheckout.marketplace_order_id
      || order.id === assessmentRecoveryCheckout.sub_orders?.[0]?.seller_order_id);
  assert.ok(assessmentRecoveryOrder?.server_order_id,
    'assessment-recovery fixture must retain canonical order identity');
  const assessmentRecoveryKey = 'parcel-assessment-retry-after-persistence-failure';
  const assessmentRecoveryUrl = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/' + encodeURIComponent(assessmentRecoveryOrder.server_order_id) + '/service-delivery-assessment';
  const assessmentRecoveryTriggerDb = new DatabaseSync(dbPath);
  try {
    assessmentRecoveryTriggerDb.exec(`CREATE TRIGGER fail_service_assessment_recovery_insert
      BEFORE INSERT ON service_delivery_assessment_commands
      WHEN NEW.command_key = '${assessmentRecoveryKey}'
      BEGIN SELECT RAISE(ABORT, 'injected assessment recovery persistence failure'); END;`);
  } finally {
    assessmentRecoveryTriggerDb.close();
  }
  let assessmentRecoveryFailureResponse;
  try {
    assessmentRecoveryFailureResponse = await fetch(assessmentRecoveryUrl, {
      method: 'POST',
      headers: { ...authHeaders, 'Idempotency-Key': assessmentRecoveryKey },
      body: JSON.stringify({ assessment_outcome: 'INELIGIBLE' }),
    });
  } finally {
    const cleanupDb = new DatabaseSync(dbPath);
    try {
      cleanupDb.exec('DROP TRIGGER IF EXISTS fail_service_assessment_recovery_insert');
    } finally {
      cleanupDb.close();
    }
  }
  assert.equal(assessmentRecoveryFailureResponse.status, 500,
    'injected recovery attempt must fail before durable assessment command persistence');
  const assessmentRecoveryAfterFailure = (await store.getOrders(tenant.chatId)).find(order =>
    order.server_order_id === assessmentRecoveryOrder.server_order_id)?.service_delivery_request;
  assert.deepEqual(assessmentRecoveryAfterFailure, assessmentRecoveryOrder.service_delivery_request,
    'failed recovery attempt must leave canonical service request unchanged');
  const assessmentRecoveryRetryResponse = await fetch(assessmentRecoveryUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': assessmentRecoveryKey },
    body: JSON.stringify({ assessment_outcome: 'INELIGIBLE' }),
  });
  assert.equal(assessmentRecoveryRetryResponse.status, 200,
    'same-key retry must succeed once the injected persistence failure is removed');
  const assessmentRecoveryRetryBody = await assessmentRecoveryRetryResponse.json();
  assert.equal(assessmentRecoveryRetryBody.service_delivery?.assessment_status, 'ASSESSMENT_REJECTED');
  const assessmentRecoveryReplayResponse = await fetch(assessmentRecoveryUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': assessmentRecoveryKey },
    body: JSON.stringify({ assessment_outcome: 'INELIGIBLE' }),
  });
  assert.equal(assessmentRecoveryReplayResponse.status, 200,
    'a retry after successful recovery must replay the committed assessment');
  const assessmentRecoveryReplayBody = await assessmentRecoveryReplayResponse.json();
  assert.equal(assessmentRecoveryReplayBody.service_delivery?.assessment_status, 'ASSESSMENT_REJECTED');
  // Once the recovery retry commits, the same key is bound to that exact
  // payload. A changed payload must conflict and must not alter canonical state.
  const assessmentRecoveryCanonicalBeforeConflict = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === assessmentRecoveryOrder.server_order_id)?.service_delivery_request;
  const assessmentRecoveryConflictResponse = await fetch(assessmentRecoveryUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': assessmentRecoveryKey },
    body: JSON.stringify({
      assessment_outcome: 'ELIGIBLE',
      customer_acceptance: {
        accepted: true,
        evidence_type: 'telegram_confirmation',
        evidence_reference: 'changed-payload-must-not-replace-original',
      },
    }),
  });
  assert.equal(assessmentRecoveryConflictResponse.status, 409,
    'a committed assessment key reused with a different payload must conflict');
  const assessmentRecoveryConflictBody = await assessmentRecoveryConflictResponse.json();
  assert.ok(assessmentRecoveryConflictBody.error,
    'changed-payload retry must return a structured conflict error');
  const assessmentRecoveryCanonicalAfterConflict = (await store.getOrders(tenant.chatId))
    .find(order => order.server_order_id === assessmentRecoveryOrder.server_order_id)?.service_delivery_request;
  assert.deepEqual(assessmentRecoveryCanonicalAfterConflict, assessmentRecoveryCanonicalBeforeConflict,
    'changed-payload conflict must not replace the committed assessment');

  const assessmentRecoveryVerifyDb = new DatabaseSync(dbPath);
  try {
    assert.equal(assessmentRecoveryVerifyDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key = ?'
    ).get(String(assessmentSession.organizationId), assessmentRecoveryKey).count, 1,
    'failed attempt followed by retry and replay must leave exactly one durable command');
    assert.equal(assessmentRecoveryVerifyDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, assessmentRecoveryOrder.server_order_id).count, 1,
    'failed attempt followed by retry and replay must append exactly one assessment audit event');
  } finally {
    assessmentRecoveryVerifyDb.close();
  }

  // Concurrent persistence-failure recovery: both same-key submissions hit an
  // injected durable-command failure. Neither may leave a partial assessment or
  // stale idempotency record; after removing the fault, a fresh retry must commit once.
  const concurrentFailureCheckoutResponse = await fetch(checkoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'parcel-assessment-concurrent-failure-checkout' },
    body: JSON.stringify({
      buyer_id: 'parcel-assessment-concurrent-failure-buyer',
      customer_name: 'Parcel Assessment Concurrent Failure Buyer',
      items: [{ seller_id: tenant.chatId, item_id: 'parcel-request-http', qty: 1 }],
      service_delivery: {
        pickup_details: 'Bole, Addis Ababa',
        destination_details: 'Mexico, Addis Ababa',
      },
    }),
  });
  assert.equal(concurrentFailureCheckoutResponse.status, 200,
    'concurrent-failure service order should be created');
  const concurrentFailureCheckout = await concurrentFailureCheckoutResponse.json();
  const concurrentFailureOrder = (await store.getOrders(tenant.chatId)).find(order =>
    order.marketplace_order_id === concurrentFailureCheckout.marketplace_order_id
      || order.id === concurrentFailureCheckout.sub_orders?.[0]?.seller_order_id);
  assert.ok(concurrentFailureOrder?.server_order_id,
    'concurrent-failure fixture must retain canonical order identity');
  const concurrentFailureKey = 'parcel-assessment-concurrent-failure-recovery';
  const concurrentFailureUrl = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/' + encodeURIComponent(concurrentFailureOrder.server_order_id) + '/service-delivery-assessment';
  const concurrentFailurePayload = { assessment_outcome: 'INELIGIBLE' };
  const concurrentFailureTriggerDb = new DatabaseSync(dbPath);
  try {
    concurrentFailureTriggerDb.exec(`CREATE TRIGGER fail_service_assessment_concurrent_insert
      BEFORE INSERT ON service_delivery_assessment_commands
      WHEN NEW.command_key = '${concurrentFailureKey}'
      BEGIN SELECT RAISE(ABORT, 'injected concurrent assessment persistence failure'); END;`);
  } finally {
    concurrentFailureTriggerDb.close();
  }
  let concurrentFailureResponses;
  try {
    concurrentFailureResponses = await Promise.all([
      fetch(concurrentFailureUrl, {
        method: 'POST',
        headers: { ...authHeaders, 'Idempotency-Key': concurrentFailureKey },
        body: JSON.stringify(concurrentFailurePayload),
      }),
      fetch(concurrentFailureUrl, {
        method: 'POST',
        headers: { ...authHeaders, 'Idempotency-Key': concurrentFailureKey },
        body: JSON.stringify(concurrentFailurePayload),
      }),
    ]);
  } finally {
    const cleanupDb = new DatabaseSync(dbPath);
    try {
      cleanupDb.exec('DROP TRIGGER IF EXISTS fail_service_assessment_concurrent_insert');
    } finally {
      cleanupDb.close();
    }
  }
  assert.deepEqual(concurrentFailureResponses.map(response => response.status), [500, 500],
    'both concurrent requests must fail while durable assessment persistence is faulted');
  const concurrentFailureAfterRequests = (await store.getOrders(tenant.chatId)).find(order =>
    order.server_order_id === concurrentFailureOrder.server_order_id)?.service_delivery_request;
  assert.deepEqual(concurrentFailureAfterRequests, concurrentFailureOrder.service_delivery_request,
    'concurrent failed requests must leave canonical service request unchanged');
  const concurrentFailureVerifyDb = new DatabaseSync(dbPath);
  try {
    assert.equal(concurrentFailureVerifyDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key = ?'
    ).get(String(assessmentSession.organizationId), concurrentFailureKey).count, 0,
    'concurrent failed requests must not leave a durable idempotency command');
    assert.equal(concurrentFailureVerifyDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, concurrentFailureOrder.server_order_id).count, 0,
    'concurrent failed requests must not append assessment audit events');
  } finally {
    concurrentFailureVerifyDb.close();
  }
  const concurrentFailureRecoveryResponse = await fetch(concurrentFailureUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': concurrentFailureKey },
    body: JSON.stringify(concurrentFailurePayload),
  });
  assert.equal(concurrentFailureRecoveryResponse.status, 200,
    'same-key retry must recover after concurrent persistence failures are removed');
  const concurrentFailureRecoveryBody = await concurrentFailureRecoveryResponse.json();
  assert.equal(concurrentFailureRecoveryBody.service_delivery?.assessment_status, 'ASSESSMENT_REJECTED');
  const concurrentFailureRecoveryReplay = await fetch(concurrentFailureUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': concurrentFailureKey },
    body: JSON.stringify(concurrentFailurePayload),
  });
  assert.equal(concurrentFailureRecoveryReplay.status, 200,
    'recovered concurrent-failure request must replay successfully');
  const concurrentFailureFinalDb = new DatabaseSync(dbPath);
  try {
    assert.equal(concurrentFailureFinalDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key = ?'
    ).get(String(assessmentSession.organizationId), concurrentFailureKey).count, 1,
    'concurrent failures followed by recovery must leave exactly one durable command');
    assert.equal(concurrentFailureFinalDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, concurrentFailureOrder.server_order_id).count, 1,
    'concurrent failures followed by recovery must append exactly one audit event');
  } finally {
    concurrentFailureFinalDb.close();
  }

  // Race two first-time submissions before either response can be observed. Both
  // requests use the same fresh key and identical negative-assessment payload;
  // canonical state, command history, and audit evidence must commit exactly once.
  const firstAssessmentRaceKey = 'parcel-request-assessment-ineligible-1';
  const firstAssessmentRacePayload = { assessment_outcome: 'INELIGIBLE' };
  const firstAssessmentRaceDb = new DatabaseSync(dbPath);
  let firstAssessmentRaceCommandsBefore;
  let firstAssessmentRaceAuditsBefore;
  try {
    firstAssessmentRaceCommandsBefore = firstAssessmentRaceDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key = ?'
    ).get(String(assessmentSession.organizationId), firstAssessmentRaceKey).count;
    firstAssessmentRaceAuditsBefore = firstAssessmentRaceDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, rejectedOrder.server_order_id).count;
  } finally {
    firstAssessmentRaceDb.close();
  }
  assert.equal(firstAssessmentRaceCommandsBefore, 0,
    'first-time assessment race must begin without a durable command for its fresh key');
  const firstAssessmentRaceResponses = await Promise.all([
    fetch(
      baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
        + '/orders/' + encodeURIComponent(rejectedOrder.server_order_id) + '/service-delivery-assessment',
      {
        method: 'POST',
        headers: { ...authHeaders, 'Idempotency-Key': firstAssessmentRaceKey },
        body: JSON.stringify(firstAssessmentRacePayload),
      }
    ),
    fetch(
      baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
        + '/orders/' + encodeURIComponent(rejectedOrder.server_order_id) + '/service-delivery-assessment',
      {
        method: 'POST',
        headers: { ...authHeaders, 'Idempotency-Key': firstAssessmentRaceKey },
        body: JSON.stringify(firstAssessmentRacePayload),
      }
    ),
  ]);
  assert.deepEqual(firstAssessmentRaceResponses.map(response => response.status), [200, 200],
    'concurrent first-time identical assessment submissions must both resolve successfully');
  const firstAssessmentRaceBodies = await Promise.all(
    firstAssessmentRaceResponses.map(response => response.json()),
  );
  assert.ok(firstAssessmentRaceBodies.every(body =>
    body.service_delivery?.assessment_status === 'ASSESSMENT_REJECTED'
      && body.service_delivery?.assessment?.outcome === 'INELIGIBLE'),
  'both first-time race responses must resolve to the same canonical terminal assessment');
  const firstAssessmentRaceDbAfter = new DatabaseSync(dbPath);
  try {
    assert.equal(firstAssessmentRaceDbAfter.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key = ?'
    ).get(String(assessmentSession.organizationId), firstAssessmentRaceKey).count, 1,
    'concurrent first-time identical submissions must create exactly one durable command');
    assert.equal(firstAssessmentRaceDbAfter.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, rejectedOrder.server_order_id).count, firstAssessmentRaceAuditsBefore + 1,
    'concurrent first-time identical submissions must append exactly one assessment audit event');
  } finally {
    firstAssessmentRaceDbAfter.close();
  }

  // Different idempotency keys must not permit two competing first-time
  // assessments to overwrite one another on the same canonical service request.
  const competingAssessmentCheckout = await fetch(checkoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'parcel-request-competing-assessment-checkout' },
    body: JSON.stringify({
      buyer_id: 'parcel-request-competing-assessment-buyer',
      customer_name: 'Parcel Request Competing Assessment Buyer',
      items: [{ seller_id: tenant.chatId, item_id: 'parcel-request-http', qty: 1 }],
      service_delivery: {
        pickup_details: 'Piassa, Addis Ababa',
        destination_details: 'Sar Bet, Addis Ababa',
      },
    }),
  });
  assert.equal(competingAssessmentCheckout.status, 200,
    'competing-assessment service request fixture should be created');
  const competingAssessmentCheckoutBody = await competingAssessmentCheckout.json();
  const competingAssessmentOrder = (await store.getOrders(tenant.chatId)).find(order =>
    order.marketplace_order_id === competingAssessmentCheckoutBody.marketplace_order_id
      || order.id === competingAssessmentCheckoutBody.sub_orders?.[0]?.seller_order_id);
  assert.ok(competingAssessmentOrder?.server_order_id,
    'competing-assessment fixture must retain canonical order identity');
  const competingAssessmentUrl = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/' + encodeURIComponent(competingAssessmentOrder.server_order_id) + '/service-delivery-assessment';
  const competingAssessmentDb = new DatabaseSync(dbPath);
  let competingAssessmentAuditsBefore;
  try {
    competingAssessmentAuditsBefore = competingAssessmentDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, competingAssessmentOrder.server_order_id).count;
  } finally {
    competingAssessmentDb.close();
  }
  const competingAssessmentRequests = await Promise.all([
    fetch(competingAssessmentUrl, {
      method: 'POST',
      headers: { ...authHeaders, 'Idempotency-Key': 'parcel-competing-assessment-eligible' },
      body: JSON.stringify({
        assessment_outcome: 'ELIGIBLE',
        customer_acceptance: {
          accepted: true,
          evidence_type: 'telegram_confirmation',
          evidence_reference: 'competing-assessment-acceptance-evidence',
        },
      }),
    }),
    fetch(competingAssessmentUrl, {
      method: 'POST',
      headers: { ...authHeaders, 'Idempotency-Key': 'parcel-competing-assessment-ineligible' },
      body: JSON.stringify({ assessment_outcome: 'INELIGIBLE' }),
    }),
  ]);
  assert.deepEqual(competingAssessmentRequests.map(response => response.status).sort(), [200, 409],
    'only one of two competing first-time assessments with distinct keys may commit');
  const competingAssessmentBodies = await Promise.all(
    competingAssessmentRequests.map(response => response.json()),
  );
  const competingAssessmentWinnerIndex = competingAssessmentRequests.findIndex(response => response.status === 200);
  const competingAssessmentConflictIndex = competingAssessmentRequests.findIndex(response => response.status === 409);
  assert.equal(competingAssessmentBodies[competingAssessmentConflictIndex].error?.code,
    'LOGISTICS_ASSESSMENT_ALREADY_RECORDED',
    'the losing competing assessment must report that canonical assessment is already recorded');
  const competingAssessmentWinner = competingAssessmentBodies[competingAssessmentWinnerIndex];
  const competingAssessmentCanonical = (await store.getOrders(tenant.chatId)).find(order =>
    order.server_order_id === competingAssessmentOrder.server_order_id)?.service_delivery_request;
  assert.equal(competingAssessmentCanonical?.assessment?.outcome,
    competingAssessmentWinner.service_delivery?.assessment?.outcome,
    'canonical assessment must match the single successful competing request');
  const competingAssessmentVerifyDb = new DatabaseSync(dbPath);
  try {
    assert.equal(competingAssessmentVerifyDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key IN (?, ?)'
    ).get(String(assessmentSession.organizationId), 'parcel-competing-assessment-eligible', 'parcel-competing-assessment-ineligible').count, 1,
    'competing distinct-key assessments must persist exactly one durable command');
    assert.equal(competingAssessmentVerifyDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, competingAssessmentOrder.server_order_id).count, competingAssessmentAuditsBefore + 1,
    'competing distinct-key assessments must append exactly one audit event');
  } finally {
    competingAssessmentVerifyDb.close();
  }

  // Same-key competing payloads are a distinct race from competing command keys:
  // exactly one payload may bind the idempotency key, and the other must conflict.
  const sameKeyRaceCheckout = await fetch(checkoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'parcel-same-key-assessment-race-checkout' },
    body: JSON.stringify({
      buyer_id: 'parcel-same-key-assessment-race-buyer',
      customer_name: 'Parcel Same-Key Assessment Race Buyer',
      items: [{ seller_id: tenant.chatId, item_id: 'parcel-request-http', qty: 1 }],
      service_delivery: {
        pickup_details: 'Bole, Addis Ababa',
        destination_details: 'Arat Kilo, Addis Ababa',
      },
    }),
  });
  assert.equal(sameKeyRaceCheckout.status, 200,
    'same-key race fixture should create a fresh service request');
  const sameKeyRaceCheckoutBody = await sameKeyRaceCheckout.json();
  const sameKeyRaceOrder = (await store.getOrders(tenant.chatId)).find(order =>
    order.marketplace_order_id === sameKeyRaceCheckoutBody.marketplace_order_id
      || order.id === sameKeyRaceCheckoutBody.sub_orders?.[0]?.seller_order_id);
  assert.ok(sameKeyRaceOrder?.server_order_id,
    'same-key race fixture must retain canonical order identity');
  const sameKeyRaceUrl = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/' + encodeURIComponent(sameKeyRaceOrder.server_order_id) + '/service-delivery-assessment';
  const sameKeyRaceKey = 'parcel-same-key-different-payload-race';
  const sameKeyRacePayloads = [
    { assessment_outcome: 'INELIGIBLE' },
    {
      assessment_outcome: 'ELIGIBLE',
      customer_acceptance: {
        accepted: true,
        evidence_type: 'telegram_confirmation',
        evidence_reference: 'same-key-race-eligible-acceptance',
      },
    },
  ];
  const sameKeyRaceDb = new DatabaseSync(dbPath);
  let sameKeyRaceAuditsBefore;
  try {
    sameKeyRaceAuditsBefore = sameKeyRaceDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, sameKeyRaceOrder.server_order_id).count;
    assert.equal(sameKeyRaceDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key = ?'
    ).get(String(assessmentSession.organizationId), sameKeyRaceKey).count, 0,
    'same-key race must begin without a durable command');
  } finally {
    sameKeyRaceDb.close();
  }
  const sameKeyRaceResponses = await Promise.all(sameKeyRacePayloads.map(payload => fetch(sameKeyRaceUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': sameKeyRaceKey },
    body: JSON.stringify(payload),
  })));
  assert.deepEqual(sameKeyRaceResponses.map(response => response.status).sort(), [200, 409],
    'concurrent different payloads sharing one new idempotency key must yield one success and one conflict');
  const sameKeyRaceBodies = await Promise.all(sameKeyRaceResponses.map(response => response.json()));
  const sameKeyRaceWinnerIndex = sameKeyRaceResponses.findIndex(response => response.status === 200);
  const sameKeyRaceLoserIndex = sameKeyRaceResponses.findIndex(response => response.status === 409);
  assert.equal(sameKeyRaceBodies[sameKeyRaceLoserIndex].error?.code,
    'LOGISTICS_ASSESSMENT_IDEMPOTENCY_CONFLICT',
    'same-key/different-payload race loser must receive the idempotency conflict, not an already-assessed result');
  const sameKeyRaceWinnerPayload = sameKeyRacePayloads[sameKeyRaceWinnerIndex];
  const sameKeyRaceWinnerBody = sameKeyRaceBodies[sameKeyRaceWinnerIndex];
  assert.equal(sameKeyRaceWinnerBody.service_delivery?.assessment?.outcome,
    sameKeyRaceWinnerPayload.assessment_outcome,
    'successful response must correspond to its submitted payload');
  const sameKeyRaceCanonical = (await store.getOrders(tenant.chatId)).find(order =>
    order.server_order_id === sameKeyRaceOrder.server_order_id)?.service_delivery_request;
  assert.equal(sameKeyRaceCanonical?.assessment?.outcome, sameKeyRaceWinnerPayload.assessment_outcome,
    'canonical assessment must remain bound to the single winning payload');
  assert.equal(sameKeyRaceCanonical?.assessment_status,
    sameKeyRaceWinnerPayload.assessment_outcome === 'ELIGIBLE' ? 'READY_FOR_FULFILLMENT' : 'ASSESSMENT_REJECTED',
    'canonical status must match the winning assessment outcome');
  // The same-key loser remains a conflict after the race, while the winner replays.
  const sameKeyRaceWinnerReplay = await fetch(sameKeyRaceUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': sameKeyRaceKey },
    body: JSON.stringify(sameKeyRaceWinnerPayload),
  });
  assert.equal(sameKeyRaceWinnerReplay.status, 200,
    'retry of the winning same-key payload must replay successfully');
  assert.equal((await sameKeyRaceWinnerReplay.json()).replayed, true);
  const sameKeyRaceLoserReplay = await fetch(sameKeyRaceUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': sameKeyRaceKey },
    body: JSON.stringify(sameKeyRacePayloads[1 - sameKeyRaceWinnerIndex]),
  });
  assert.equal(sameKeyRaceLoserReplay.status, 409,
    'retry of the losing payload must not overwrite or masquerade as a replay');
  assert.equal((await sameKeyRaceLoserReplay.json()).error?.code,
    'LOGISTICS_ASSESSMENT_IDEMPOTENCY_CONFLICT');
  const sameKeyRaceVerifyDb = new DatabaseSync(dbPath);
  try {
    assert.equal(sameKeyRaceVerifyDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key = ?'
    ).get(String(assessmentSession.organizationId), sameKeyRaceKey).count, 1,
    'same-key competing payloads must persist exactly one durable command');
    assert.equal(sameKeyRaceVerifyDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, sameKeyRaceOrder.server_order_id).count, sameKeyRaceAuditsBefore + 1,
    'same-key competing payloads must append exactly one assessment audit event');
  } finally {
    sameKeyRaceVerifyDb.close();
  }

  // Fail the audit insert after assessment processing has begun. Canonical order,
  // command idempotency record, and audit evidence must remain atomic; same-key
  // retry must be able to commit after the audit fault is removed.
  const auditFailureCheckout = await fetch(checkoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'parcel-assessment-audit-failure-checkout' },
    body: JSON.stringify({
      buyer_id: 'parcel-assessment-audit-failure-buyer',
      customer_name: 'Parcel Assessment Audit Failure Buyer',
      items: [{ seller_id: tenant.chatId, item_id: 'parcel-request-http', qty: 1 }],
      service_delivery: {
        pickup_details: 'Mexico, Addis Ababa',
        destination_details: 'CMC, Addis Ababa',
      },
    }),
  });
  assert.equal(auditFailureCheckout.status, 200,
    'audit-failure fixture should create a fresh service request');
  const auditFailureCheckoutBody = await auditFailureCheckout.json();
  const auditFailureOrder = (await store.getOrders(tenant.chatId)).find(order =>
    order.marketplace_order_id === auditFailureCheckoutBody.marketplace_order_id
      || order.id === auditFailureCheckoutBody.sub_orders?.[0]?.seller_order_id);
  assert.ok(auditFailureOrder?.server_order_id,
    'audit-failure fixture must retain canonical order identity');
  const auditFailureUrl = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/' + encodeURIComponent(auditFailureOrder.server_order_id) + '/service-delivery-assessment';
  const auditFailureKey = 'parcel-assessment-audit-insert-failure';
  const auditFailurePayload = { assessment_outcome: 'INELIGIBLE' };
  const auditFailureBefore = (await store.getOrders(tenant.chatId)).find(order =>
    order.server_order_id === auditFailureOrder.server_order_id)?.service_delivery_request;
  const auditFailureTriggerDb = new DatabaseSync(dbPath);
  try {
    auditFailureTriggerDb.exec(`CREATE TRIGGER fail_service_assessment_audit_insert
      BEFORE INSERT ON audit_events
      WHEN NEW.action = 'logistics.service_request.assessed'
        AND NEW.entity_id = '${auditFailureOrder.server_order_id}'
      BEGIN SELECT RAISE(ABORT, 'injected service assessment audit persistence failure'); END;`);
  } finally {
    auditFailureTriggerDb.close();
  }
  let auditFailureResponse;
  try {
    auditFailureResponse = await fetch(auditFailureUrl, {
      method: 'POST',
      headers: { ...authHeaders, 'Idempotency-Key': auditFailureKey },
      body: JSON.stringify(auditFailurePayload),
    });
  } finally {
    const cleanupDb = new DatabaseSync(dbPath);
    try {
      cleanupDb.exec('DROP TRIGGER IF EXISTS fail_service_assessment_audit_insert');
    } finally {
      cleanupDb.close();
    }
  }
  assert.equal(auditFailureResponse.status, 500,
    'assessment must fail when its required audit evidence cannot be persisted');
  const auditFailureAfter = (await store.getOrders(tenant.chatId)).find(order =>
    order.server_order_id === auditFailureOrder.server_order_id)?.service_delivery_request;
  assert.deepEqual(auditFailureAfter, auditFailureBefore,
    'audit persistence failure must roll back the canonical assessment mutation');
  const auditFailureVerifyDb = new DatabaseSync(dbPath);
  try {
    assert.equal(auditFailureVerifyDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key = ?'
    ).get(String(assessmentSession.organizationId), auditFailureKey).count, 0,
    'audit persistence failure must not leave a durable assessment command');
    assert.equal(auditFailureVerifyDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, auditFailureOrder.server_order_id).count, 0,
    'failed audit insert must leave no assessment audit event');
  } finally {
    auditFailureVerifyDb.close();
  }
  const auditFailureRetry = await fetch(auditFailureUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': auditFailureKey },
    body: JSON.stringify(auditFailurePayload),
  });
  assert.equal(auditFailureRetry.status, 200,
    'same-key assessment retry must succeed after audit persistence recovers');
  assert.equal((await auditFailureRetry.json()).service_delivery?.assessment_status, 'ASSESSMENT_REJECTED');
  const auditFailureReplay = await fetch(auditFailureUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': auditFailureKey },
    body: JSON.stringify(auditFailurePayload),
  });
  assert.equal(auditFailureReplay.status, 200,
    'retry after audit recovery must replay the committed assessment');
  assert.equal((await auditFailureReplay.json()).replayed, true);
  const auditFailureFinalDb = new DatabaseSync(dbPath);
  try {
    assert.equal(auditFailureFinalDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key = ?'
    ).get(String(assessmentSession.organizationId), auditFailureKey).count, 1,
    'audit failure followed by retry and replay must leave exactly one durable command');
    assert.equal(auditFailureFinalDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, auditFailureOrder.server_order_id).count, 1,
    'audit failure followed by retry and replay must append exactly one assessment audit event');
  } finally {
    auditFailureFinalDb.close();
  }

  // Concurrent audit-persistence failure: two identical requests must both fail
  // atomically while required audit evidence is unavailable. Recovery must still
  // produce one canonical assessment, one command, and one audit event.
  const concurrentAuditFailureCheckoutResponse = await fetch(checkoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'parcel-assessment-concurrent-audit-checkout' },
    body: JSON.stringify({
      buyer_id: 'parcel-assessment-concurrent-audit-buyer',
      customer_name: 'Parcel Assessment Concurrent Audit Buyer',
      items: [{ seller_id: tenant.chatId, item_id: 'parcel-request-http', qty: 1 }],
      service_delivery: {
        pickup_details: 'Arat Kilo, Addis Ababa',
        destination_details: 'Megenagna, Addis Ababa',
      },
    }),
  });
  assert.equal(concurrentAuditFailureCheckoutResponse.status, 200,
    'concurrent-audit-failure fixture should create a fresh service request');
  const concurrentAuditFailureCheckout = await concurrentAuditFailureCheckoutResponse.json();
  const concurrentAuditFailureOrder = (await store.getOrders(tenant.chatId)).find(order =>
    order.marketplace_order_id === concurrentAuditFailureCheckout.marketplace_order_id
      || order.id === concurrentAuditFailureCheckout.sub_orders?.[0]?.seller_order_id);
  assert.ok(concurrentAuditFailureOrder?.server_order_id,
    'concurrent-audit-failure fixture must retain canonical order identity');
  const concurrentAuditFailureUrl = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/' + encodeURIComponent(concurrentAuditFailureOrder.server_order_id) + '/service-delivery-assessment';
  const concurrentAuditFailureKey = 'parcel-assessment-concurrent-audit-insert-failure';
  const concurrentAuditFailurePayload = { assessment_outcome: 'INELIGIBLE' };
  const concurrentAuditFailureBefore = (await store.getOrders(tenant.chatId)).find(order =>
    order.server_order_id === concurrentAuditFailureOrder.server_order_id)?.service_delivery_request;
  const concurrentAuditFailureTriggerDb = new DatabaseSync(dbPath);
  try {
    concurrentAuditFailureTriggerDb.exec(`CREATE TRIGGER fail_service_assessment_concurrent_audit_insert
      BEFORE INSERT ON audit_events
      WHEN NEW.action = 'logistics.service_request.assessed'
        AND NEW.entity_id = '${concurrentAuditFailureOrder.server_order_id}'
      BEGIN SELECT RAISE(ABORT, 'injected concurrent service assessment audit persistence failure'); END;`);
  } finally {
    concurrentAuditFailureTriggerDb.close();
  }
  let concurrentAuditFailureResponses;
  try {
    concurrentAuditFailureResponses = await Promise.all([
      fetch(concurrentAuditFailureUrl, {
        method: 'POST',
        headers: { ...authHeaders, 'Idempotency-Key': concurrentAuditFailureKey },
        body: JSON.stringify(concurrentAuditFailurePayload),
      }),
      fetch(concurrentAuditFailureUrl, {
        method: 'POST',
        headers: { ...authHeaders, 'Idempotency-Key': concurrentAuditFailureKey },
        body: JSON.stringify(concurrentAuditFailurePayload),
      }),
    ]);
  } finally {
    const cleanupDb = new DatabaseSync(dbPath);
    try {
      cleanupDb.exec('DROP TRIGGER IF EXISTS fail_service_assessment_concurrent_audit_insert');
    } finally {
      cleanupDb.close();
    }
  }
  assert.deepEqual(concurrentAuditFailureResponses.map(response => response.status), [500, 500],
    'both concurrent same-key submissions must fail while required audit persistence is unavailable');
  const concurrentAuditFailureAfter = (await store.getOrders(tenant.chatId)).find(order =>
    order.server_order_id === concurrentAuditFailureOrder.server_order_id)?.service_delivery_request;
  assert.deepEqual(concurrentAuditFailureAfter, concurrentAuditFailureBefore,
    'concurrent audit persistence failures must roll back canonical assessment state');
  const concurrentAuditFailureVerifyDb = new DatabaseSync(dbPath);
  try {
    assert.equal(concurrentAuditFailureVerifyDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key = ?'
    ).get(String(assessmentSession.organizationId), concurrentAuditFailureKey).count, 0,
    'concurrent audit persistence failures must leave no durable idempotency command');
    assert.equal(concurrentAuditFailureVerifyDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, concurrentAuditFailureOrder.server_order_id).count, 0,
    'concurrent audit persistence failures must leave no assessment audit event');
  } finally {
    concurrentAuditFailureVerifyDb.close();
  }
  const concurrentAuditFailureRetry = await fetch(concurrentAuditFailureUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': concurrentAuditFailureKey },
    body: JSON.stringify(concurrentAuditFailurePayload),
  });
  assert.equal(concurrentAuditFailureRetry.status, 200,
    'same-key assessment retry must recover after concurrent audit persistence failures');
  assert.equal((await concurrentAuditFailureRetry.json()).service_delivery?.assessment_status, 'ASSESSMENT_REJECTED');
  const concurrentAuditFailureReplay = await fetch(concurrentAuditFailureUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': concurrentAuditFailureKey },
    body: JSON.stringify(concurrentAuditFailurePayload),
  });
  assert.equal(concurrentAuditFailureReplay.status, 200,
    'recovered concurrent audit-failure request must replay successfully');
  assert.equal((await concurrentAuditFailureReplay.json()).replayed, true,
    'recovered concurrent audit-failure request must be marked as replayed');
  const concurrentAuditFailureFinalDb = new DatabaseSync(dbPath);
  try {
    assert.equal(concurrentAuditFailureFinalDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key = ?'
    ).get(String(assessmentSession.organizationId), concurrentAuditFailureKey).count, 1,
    'concurrent audit failures followed by recovery must leave exactly one durable command');
    assert.equal(concurrentAuditFailureFinalDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, concurrentAuditFailureOrder.server_order_id).count, 1,
    'concurrent audit failures followed by recovery must append exactly one assessment audit event');
  } finally {
    concurrentAuditFailureFinalDb.close();
  }

  // Response-loss boundary: wait until the server starts writing the response
  // (which follows request processing/commit), then destroy the client socket before
  // consuming the response. The same-key retry must recover the committed result.
  const assessmentResponseLossCheckoutResponse = await fetch(checkoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'parcel-assessment-response-loss-checkout' },
    body: JSON.stringify({
      buyer_id: 'parcel-assessment-response-loss-buyer',
      customer_name: 'Parcel Assessment Response Loss Buyer',
      items: [{ seller_id: tenant.chatId, item_id: 'parcel-request-http', qty: 1 }],
      service_delivery: {
        pickup_details: 'Kazanchis, Addis Ababa',
        destination_details: 'Lideta, Addis Ababa',
      },
    }),
  });
  assert.equal(assessmentResponseLossCheckoutResponse.status, 200,
    'response-loss fixture should create a fresh service request');
  const assessmentResponseLossCheckout = await assessmentResponseLossCheckoutResponse.json();
  const assessmentResponseLossOrder = (await store.getOrders(tenant.chatId)).find(order =>
    order.marketplace_order_id === assessmentResponseLossCheckout.marketplace_order_id
      || order.id === assessmentResponseLossCheckout.sub_orders?.[0]?.seller_order_id);
  assert.ok(assessmentResponseLossOrder?.server_order_id,
    'response-loss fixture must retain canonical order identity');
  const assessmentResponseLossPath = '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/' + encodeURIComponent(assessmentResponseLossOrder.server_order_id) + '/service-delivery-assessment';
  const assessmentResponseLossUrl = baseUrl + assessmentResponseLossPath;
  const assessmentResponseLossKey = 'parcel-assessment-response-lost-after-commit';
  const assessmentResponseLossPayload = { assessment_outcome: 'INELIGIBLE' };
  const assessmentResponseLossBefore = (await store.getOrders(tenant.chatId)).find(order =>
    order.server_order_id === assessmentResponseLossOrder.server_order_id)?.service_delivery_request;
  const assessmentResponseLossBody = JSON.stringify(assessmentResponseLossPayload);
  const assessmentResponseLossRawRequest = [
    'POST ' + assessmentResponseLossPath + ' HTTP/1.1',
    'Host: 127.0.0.1:' + port,
    'Authorization: Bearer ' + session.token,
    'Content-Type: application/json',
    'Idempotency-Key: ' + assessmentResponseLossKey,
    'Content-Length: ' + Buffer.byteLength(assessmentResponseLossBody),
    'Connection: close',
    '',
    assessmentResponseLossBody,
  ].join('\r\n');
  await new Promise((resolve, reject) => {
    let receivedResponseBytes = false;
    const socket = createConnection({ host: '127.0.0.1', port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('timed out waiting for assessment response bytes before simulated response loss'));
    }, 5000);
    socket.once('connect', () => socket.write(assessmentResponseLossRawRequest));
    socket.on('data', () => {
      receivedResponseBytes = true;
      clearTimeout(timeout);
      socket.destroy();
      resolve();
    });
    socket.once('error', error => {
      clearTimeout(timeout);
      if (receivedResponseBytes) resolve();
      else reject(error);
    });
    socket.once('close', () => {
      clearTimeout(timeout);
      if (!receivedResponseBytes) reject(new Error('assessment response connection closed before any response bytes were observed'));
    });
  });
  const assessmentResponseLossCommitted = (await store.getOrders(tenant.chatId)).find(order =>
    order.server_order_id === assessmentResponseLossOrder.server_order_id);
  assert.equal(assessmentResponseLossCommitted?.service_delivery_request?.assessment_status, 'ASSESSMENT_REJECTED',
    'server must have committed the assessment before response-loss retry');
  const assessmentResponseLossRetry = await fetch(assessmentResponseLossUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': assessmentResponseLossKey },
    body: JSON.stringify(assessmentResponseLossPayload),
  });
  assert.equal(assessmentResponseLossRetry.status, 200,
    'same-key retry must recover after the committed response is lost');
  const assessmentResponseLossRetryBody = await assessmentResponseLossRetry.json();
  assert.equal(assessmentResponseLossRetryBody.replayed, true,
    'response-loss retry must return the already committed assessment as a replay');
  assert.equal(assessmentResponseLossRetryBody.service_delivery?.assessment_status, 'ASSESSMENT_REJECTED');
  const assessmentResponseLossDifferentPayload = await fetch(assessmentResponseLossUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': assessmentResponseLossKey },
    body: JSON.stringify({ assessment_outcome: 'ELIGIBLE' }),
  });
  assert.equal(assessmentResponseLossDifferentPayload.status, 409,
    'response-loss idempotency key must reject a different assessment payload');
  assert.deepEqual(
    (await store.getOrders(tenant.chatId)).find(order =>
      order.server_order_id === assessmentResponseLossOrder.server_order_id)?.service_delivery_request,
    assessmentResponseLossCommitted.service_delivery_request,
    'different-payload retry must not overwrite the committed assessment after response loss'
  );
  assert.notEqual(assessmentResponseLossBefore?.assessment_status, 'ASSESSMENT_REJECTED',
    'response-loss fixture must begin without the final rejected assessment');
  const assessmentResponseLossFinalDb = new DatabaseSync(dbPath);
  try {
    assert.equal(assessmentResponseLossFinalDb.prepare(
      'SELECT COUNT(*) AS count FROM service_delivery_assessment_commands WHERE organization_id = ? AND command_key = ?'
    ).get(String(assessmentSession.organizationId), assessmentResponseLossKey).count, 1,
    'response-loss recovery must retain exactly one durable assessment command');
    assert.equal(assessmentResponseLossFinalDb.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'logistics.service_request.assessed' AND entity_id = ?"
    ).get(tenant.chatId, assessmentResponseLossOrder.server_order_id).count, 1,
    'response-loss recovery must retain exactly one assessment audit event');
  } finally {
    assessmentResponseLossFinalDb.close();
  }

  const rejectedAssessmentResponse = await fetch(
    baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
      + '/orders/' + encodeURIComponent(rejectedOrder.server_order_id) + '/service-delivery-assessment',
    {
      method: 'POST',
      headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-ineligible-1' },
      body: JSON.stringify({ assessment_outcome: 'INELIGIBLE' }),
    }
  );
  assert.equal(rejectedAssessmentResponse.status, 200, 'authorized negative assessment should be recorded');
  const rejectedAssessment = await rejectedAssessmentResponse.json();
  assert.equal(rejectedAssessment.service_delivery?.assessment_status, 'ASSESSMENT_REJECTED');
  assert.equal(rejectedAssessment.service_delivery?.assignment_status, 'NOT_ASSIGNED');
  await assert.rejects(
    () => store.transitionDeliveryAssignment(
      tenant.chatId, rejectedOrder.server_order_id, 'OUT_FOR_DELIVERY', session,
      { idempotencyKey: 'parcel-assignment-outbound-transition' }
    ),
    error => error?.code === 'IDEMPOTENCY_KEY_REUSE_CONFLICT' && error?.statusCode === 409,
    'an assignment idempotency key from another order must not replay across canonical orders'
  );
  await assert.rejects(
    () => store.transitionOrderFulfillment(tenant.chatId, rejectedOrder.server_order_id, 'out_for_delivery', session, {
      idempotencyKey: 'parcel-rejected-order-fulfillment-must-fail',
    }),
    error => error?.code === 'LOGISTICS_SERVICE_ASSESSMENT_REQUIRED' && error?.statusCode === 409,
    'rejected service requests must not enter canonical fulfillment'
  );
  await assert.rejects(
    () => store.assignDeliveryCourier(tenant.chatId, rejectedOrder.server_order_id, '', logisticsActor, {
      assignmentKey: 'parcel-rejected-order-assignment-must-fail',
    }),
    error => {
      assert.equal(error?.code, 'LOGISTICS_SERVICE_ASSESSMENT_REQUIRED',
        `rejected service requests must not be assigned to a courier; got code=${error?.code} status=${error?.statusCode} message=${error?.message}`);
      assert.equal(error?.statusCode, 409);
      return true;
    },
    'rejected service requests must not be assigned to a courier'
  );

  const verificationDb = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const marketplaceOrderId = committedMarketplaceBody.marketplace_order_id;
    assert.equal(verificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_orders WHERE id = ?').get(marketplaceOrderId).n, 1);
    assert.equal(verificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_seller_orders WHERE marketplace_order_id = ?').get(marketplaceOrderId).n, 1,
      'retry must not duplicate canonical seller orders');
    assert.equal(verificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_payment_allocations WHERE marketplace_order_id = ?').get(marketplaceOrderId).n, 1,
      'retry must not duplicate payment allocations');
    assert.equal(verificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_settlements WHERE marketplace_order_id = ?').get(marketplaceOrderId).n, 1,
      'retry must not duplicate settlement records');
    assert.equal(verificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_inventory_reservations WHERE marketplace_order_id = ?').get(marketplaceOrderId).n, 0,
      'service checkout must not create physical inventory reservations');
    assert.equal(verificationDb.prepare("SELECT COUNT(*) AS n FROM inventory_movements WHERE reference_type = 'marketplace_order' AND reference_id = ?").get(marketplaceOrderId).n, 0,
      'service checkout must not create physical inventory movements');
  } finally {
    verificationDb.close();
  }

  // Repeat the same committed-but-unacknowledged scenario with a physical
  // product alongside a service. The canonical stock ledger must decrement
  // once, and the service line must never create a physical movement/reservation.
  const tenantLocations = await store.listOrganizationLocations(tenant.chatId);
  let defaultLocationId = tenantLocations?.find(location => location.code === 'DEFAULT')?.id;
  if (!defaultLocationId) {
    const createdLocation = await store.createOrganizationLocation(tenant.chatId, {
      code: 'DEFAULT', name: 'Default Inventory Location', type: 'STORE',
    });
    defaultLocationId = createdLocation.id;
  }
  assert.ok(defaultLocationId, 'test fixture should provide the canonical default inventory location');
  await store.appendInventoryMovement(tenant.chatId, {
    productId: 'soap-http',
    locationId: String(defaultLocationId),
    quantity: 8,
    movementType: 'OPENING_BALANCE',
    referenceType: 'service-catalog-http-test',
    referenceId: 'soap-opening-stock',
    eventId: 'service-catalog-http-soap-opening-stock',
    reason: 'Seed marketplace checkout regression stock',
  });

  const mixedMarketplaceRequest = {
    buyer_id: 'mixed-marketplace-recovery-buyer-http',
    customer_name: 'Mixed Marketplace Recovery Buyer',
    items: [
      { seller_id: tenant.chatId, item_id: 'consultation-http', qty: 1 },
      { seller_id: tenant.chatId, item_id: 'soap-http', qty: 2 },
    ],
  };
  const mixedMarketplaceHeaders = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'mixed-marketplace-lost-response-http-1',
  };
  const mixedCommittedResponse = await fetch(checkoutUrl, {
    method: 'POST', headers: mixedMarketplaceHeaders, body: JSON.stringify(mixedMarketplaceRequest),
  });
  assert.equal(mixedCommittedResponse.status, 200, 'mixed product/service checkout should commit');
  const mixedCommittedBody = await mixedCommittedResponse.json();
  assert.ok(mixedCommittedBody.marketplace_order_id);
  // Simulate loss after commit: deliberately do not pass the first response to
  // the checkout caller; retry the identical request with the same key.
  const mixedReplayResponse = await fetch(checkoutUrl, {
    method: 'POST', headers: mixedMarketplaceHeaders, body: JSON.stringify(mixedMarketplaceRequest),
  });
  assert.equal(mixedReplayResponse.status, 200);
  const mixedReplayBody = await mixedReplayResponse.json();
  assert.equal(mixedReplayBody.marketplace_order_id, mixedCommittedBody.marketplace_order_id,
    'mixed checkout retry must replay the original canonical marketplace order');
  assert.deepEqual(mixedReplayBody.sub_orders, mixedCommittedBody.sub_orders,
    'mixed checkout retry must replay the original canonical seller-order identities');

  const alteredMarketplaceRequest = {
    ...mixedMarketplaceRequest,
    items: mixedMarketplaceRequest.items.map(item => item.item_id === 'soap-http' ? { ...item, qty: 3 } : item),
  };
  const alteredMarketplaceResponse = await fetch(checkoutUrl, {
    method: 'POST', headers: mixedMarketplaceHeaders, body: JSON.stringify(alteredMarketplaceRequest),
  });
  assert.equal(alteredMarketplaceResponse.status, 409, 'same key with changed intent must conflict');
  const alteredMarketplaceBody = await alteredMarketplaceResponse.json();
  assert.equal(alteredMarketplaceBody.error?.code, 'IDEMPOTENCY_KEY_REUSED');

  const mixedVerificationDb = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const mixedOrderId = mixedCommittedBody.marketplace_order_id;
    assert.equal(mixedVerificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_orders WHERE id = ?').get(mixedOrderId).n, 1);
    assert.equal(mixedVerificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_seller_orders WHERE marketplace_order_id = ?').get(mixedOrderId).n, 1,
      'mixed checkout retry must not duplicate seller orders');
    assert.equal(mixedVerificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_payment_allocations WHERE marketplace_order_id = ?').get(mixedOrderId).n, 1,
      'mixed checkout retry must not duplicate payment allocations');
    assert.equal(mixedVerificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_settlements WHERE marketplace_order_id = ?').get(mixedOrderId).n, 1,
      'mixed checkout retry must not duplicate settlements');
    assert.equal(mixedVerificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_inventory_reservations WHERE marketplace_order_id = ?').get(mixedOrderId).n, 1,
      'only the product line should create a physical inventory reservation');
    assert.equal(mixedVerificationDb.prepare("SELECT COUNT(*) AS n FROM inventory_movements WHERE reference_type = 'marketplace_order' AND reference_id = ?").get(mixedOrderId).n, 1,
      'product stock should be decremented once despite retry');
    const balance = mixedVerificationDb.prepare(`SELECT COALESCE(SUM(quantity), 0) AS quantity
      FROM inventory_movements WHERE organization_id = ? AND location_id = ? AND product_id = ?`).get(
      String(session.organizationId), String(defaultLocationId), 'soap-http');
    assert.equal(Number(balance.quantity), 6, 'product stock should move from 8 to 6 exactly once');
    const serviceReservation = mixedVerificationDb.prepare(`SELECT COUNT(*) AS n FROM marketplace_inventory_reservations
      WHERE marketplace_order_id = ? AND product_id = ?`).get(mixedOrderId, 'consultation-http');
    assert.equal(serviceReservation.n, 0, 'service line must not create a physical reservation');
  } finally {
    mixedVerificationDb.close();
  }

  const order = {
    id: 'service-http-order-1',
    currency: 'ETB',
    customer_name: 'HTTP Journey Buyer',
    items: [
      { id: 'consultation-http', name: 'Consultation', price: 25000, qty: 1, currency: 'ETB', item_type: 'service' },
    ],
  };
  const syncUrl = baseUrl + '/sync/' + encodeURIComponent(tenant.chatId);
  const submitOrder = () => fetch(syncUrl, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ orders: [order] }),
  });
  const firstResponse = await submitOrder();
  assert.equal(firstResponse.status, 200, 'authenticated order sync should succeed');
  const firstBody = await firstResponse.json();
  assert.equal(firstBody.results.length, 1);
  assert.equal(firstBody.results[0].status, 'synced');
  assert.ok(firstBody.results[0].order_id, 'sync should return canonical order identity');
  assert.ok(firstBody.results[0].payment_id, 'sync should return canonical payment identity');

  const retryResponse = await submitOrder();
  assert.equal(retryResponse.status, 200);
  const retryBody = await retryResponse.json();
  assert.equal(retryBody.results[0].status, 'synced');
  assert.equal(retryBody.results[0].order_id, firstBody.results[0].order_id,
    'exact retry must resolve to the same canonical order');
  assert.equal(retryBody.results[0].payment_id, firstBody.results[0].payment_id,
    'exact retry must resolve to the same canonical payment');

  const alteredOrder = { ...order, items: [{ id: 'consultation-http', name: 'Consultation', price: 25000, qty: 2, currency: 'ETB', item_type: 'service' }] };
  const alteredResponse = await fetch(syncUrl, { method: 'POST', headers: authHeaders, body: JSON.stringify({ orders: [alteredOrder] }) });
  assert.equal(alteredResponse.status, 200);
  const alteredBody = await alteredResponse.json();
  assert.equal(alteredBody.results[0].status, 'rejected');
  assert.equal(alteredBody.results[0].code, 'ORDER_IDEMPOTENCY_CONFLICT');

  const canonicalOrders = await store.getOrders(tenant.chatId);
  assert.equal(canonicalOrders.filter(item => item.id === order.id).length, 1,
    'HTTP retries must not create duplicate canonical orders');
  const canonicalPayments = await store.listPayments(tenant.chatId);
  assert.equal(canonicalPayments.filter(item => item.id === firstBody.results[0].payment_id).length, 1,
    'HTTP retries must not create duplicate canonical payments');

  // End-to-end client recovery: run the real syncOrders implementation
  // against this live backend. The first POST is committed and its response
  // is deliberately discarded; retry must recover the same order/payment IDs.
  const ordersSource = await readFile(new URL('../app/src/sync/orders.js', import.meta.url), 'utf8');
  const executableOrdersSource = ordersSource
    .replace(/^import.*;$/gm, '')
    .replace('export async function syncOrders()', 'async function syncOrders()')
    + '\nglobalThis.__syncOrders = syncOrders;';

  const lostResponseOrder = {
    id: 'service-http-lost-response-order',
    status: 'queued',
    currency: 'ETB',
    items: [{ id: 'consultation-http', name: 'Consultation', price: 25000, qty: 1, currency: 'ETB', item_type: 'service' }],
  };
  let runtimeOrders = [lostResponseOrder];
  const persistedOrders = [];
  let postAttempts = 0;
  let firstCommittedIdentity = null;
  const runtimeContext = {
    STORAGE_KEYS: { orders: 'orders' },
    config: { syncUrl: baseUrl, chatId: tenant.chatId, sessionToken: session.token },
    get orders() { return runtimeOrders; },
    set orders(next) { runtimeOrders = next; },
    setOrders(next) { runtimeOrders = next; },
    saveJSON(key, value) { if (key === 'orders') persistedOrders.push(structuredClone(value)); },
    tenantAuthHeaders() { return authHeaders; },
    applyStoreBranding() {},
    t(key) { return key; },
    renderAll() {},
    refreshPaymentProjection: async () => {},
    ensurePaymentForSyncedOrder: async () => {},
    console: { error() {}, warn() {}, log() {} },
    Date,
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {
        postAttempts += 1;
        const response = await fetch(url, options);
        if (!response.ok) throw new Error('Unexpected HTTP failure: ' + response.status);
        const body = await response.json();
        if (postAttempts === 1) {
          // The backend has committed and returned canonical identities, but
          // the client loses the response before syncOrders can consume it.
          firstCommittedIdentity = body.results[0];
          throw new Error('simulated connection loss after committed HTTP response');
        }
        return { ok: true, json: async () => body };
      }
      // Pulls are not part of this focused push/recovery assertion.
      return { ok: true, json: async () => url.includes('/orders/') ? { orders: [] } : { new_orders: [] } };
    },
  };
  vm.runInNewContext(executableOrdersSource, runtimeContext, { timeout: 1000 });
  const syncOrdersRuntime = runtimeContext.__syncOrders;
  assert.equal(await syncOrdersRuntime(), 'orderSyncFailed');
  assert.equal(runtimeOrders[0].status, 'queued', 'lost response must leave local order retryable');
  assert.equal(runtimeOrders[0].sync_attempts, 1);
  assert.equal(persistedOrders.at(-1)[0].status, 'queued');
  assert.equal(firstCommittedIdentity?.status, 'synced', 'first server request must really commit');
  assert.ok(firstCommittedIdentity?.order_id);
  assert.ok(firstCommittedIdentity?.payment_id);

  assert.match(await syncOrdersRuntime(), /orderSyncedMsg/);
  assert.equal(postAttempts, 2);
  assert.equal(runtimeOrders[0].status, 'synced');
  assert.equal(runtimeOrders[0].server_order_id, firstCommittedIdentity.order_id);
  assert.equal(persistedOrders.at(-1)[0].status, 'synced');
  const recoveredPayment = (await store.listPayments(tenant.chatId))
    .filter(payment => payment.id === firstCommittedIdentity.payment_id);
  assert.equal(recoveredPayment.length, 1, 'response-loss retry must not duplicate canonical payment');
  assert.equal((await store.getOrders(tenant.chatId))
    .filter(item => item.id === lostResponseOrder.id).length, 1,
  'response-loss retry must not duplicate canonical order');

  // Complete the existing canonical delivery and prove Telegram buyer tracking
  // projects that state instead of showing the stale marketplace fulfillment row.
  const deliveredAssignment = await store.transitionDeliveryAssignment(
    tenant.chatId,
    requestOrder.server_order_id,
    'DELIVERED',
    session,
    {
      idempotencyKey: 'parcel-assignment-delivered-canonical-projection',
      proof: { type: 'photo', reference: 'proof://parcel-request-delivered-1' },
    },
  );
  assert.equal(deliveredAssignment.status, 'DELIVERED',
    'canonical delivery assignment should complete with valid evidence');
  // Deliberately retain multiple legacy rows beside canonical fulfillment.
  // They must not multiply the canonical tracking projection.
  const canonicalProjectionDb = store.getDatabaseForTests();
  const canonicalProjectionSellerOrder = canonicalProjectionDb.prepare(
    'SELECT id FROM marketplace_seller_orders WHERE marketplace_order_id = ? AND seller_id = ?'
  ).get(requestedAssessment.marketplace_order_id, String(tenant.chatId));
  assert.ok(canonicalProjectionSellerOrder?.id,
    'canonical tracking fixture should have a seller-order row');
  const projectionLegacyNow = new Date().toISOString();
  for (const suffix of ['a', 'b']) {
    canonicalProjectionDb.prepare(
      'INSERT INTO marketplace_fulfillments (id,seller_order_id,status,fulfillment_type,tracking_reference,created_at,updated_at) VALUES (?,?,?,?,?,?,?)'
    ).run(
      'stale-canonical-projection-' + suffix,
      canonicalProjectionSellerOrder.id,
      'out_for_delivery',
      'delivery',
      'STALE-CANONICAL-' + suffix,
      projectionLegacyNow,
      projectionLegacyNow,
    );
  }
  const buyerFulfillmentExperience = await store.getTelegramBuyerFulfillmentExperience(
    tenant.chatId,
    'parcel-request-buyer-http',
    requestedAssessment.marketplace_order_id,
  );
  assert.ok(buyerFulfillmentExperience.fulfillments.length > 0,
    'Telegram buyer tracking should expose the canonical fulfillment');
  const canonicalFulfillmentCount = canonicalProjectionDb.prepare(
    'SELECT COUNT(*) AS count FROM fulfillments WHERE server_order_id = ? AND organization_id = ?'
  ).get(String(requestOrder.server_order_id), String(session.organizationId)).count;
  assert.equal(buyerFulfillmentExperience.fulfillments.length, canonicalFulfillmentCount,
    'canonical tracking must not multiply canonical fulfillments by joining legacy marketplace rows');
  assert.ok(buyerFulfillmentExperience.fulfillments.some(item =>
    item.status === 'delivered'
      && item.proof?.type === 'photo'
      && item.proof?.reference === 'proof://parcel-request-delivered-1'
  ), 'Telegram buyer tracking must project canonical delivered status and completion proof');
  assert.equal(
    buyerFulfillmentExperience.authority.fulfillment,
    'canonical_logistics_with_legacy_marketplace_fallback',
    'buyer tracking must declare canonical Logistics as the operational authority',
  );

  // Legacy compatibility: when this seller order has no canonical commerce
  // fulfillment, the established marketplace fulfillment remains visible.
  const legacyMarketplaceOrderId = 'legacy-tracking-' + Date.now().toString(36);
  const legacySellerOrderRowId = 'legacy-seller-row-' + Date.now().toString(36);
  const legacySellerOrderId = 'legacy-seller-order-' + Date.now().toString(36);
  const legacyTrackingReference = 'LEGACY-TRACK-' + Date.now().toString(36);
  const legacyProofReference = 'proof://legacy-tracking-' + Date.now().toString(36);
  const legacyNow = new Date().toISOString();
  const trackingDb = store.getDatabaseForTests();
  trackingDb.prepare(
    "INSERT INTO marketplace_orders (id,buyer_identity,customer_name,currency,total_minor,status,tracking_token_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(legacyMarketplaceOrderId, 'parcel-request-buyer-http', 'Parcel Buyer', 'ETB', 10000,
    'confirmed', 'legacy-tracking-hash', legacyNow, legacyNow);
  trackingDb.prepare(
    "INSERT INTO marketplace_seller_orders (id,marketplace_order_id,seller_id,seller_order_id,organization_id,currency,subtotal_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).run(legacySellerOrderRowId, legacyMarketplaceOrderId, tenant.chatId, legacySellerOrderId,
    String(session.organizationId), 'ETB', 10000, 'confirmed', legacyNow, legacyNow);
  trackingDb.prepare(
    "INSERT INTO marketplace_fulfillments (id,seller_order_id,status,fulfillment_type,tracking_reference,proof_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)"
  ).run('legacy-fulfillment-' + Date.now().toString(36), legacySellerOrderRowId, 'out_for_delivery',
    'delivery', legacyTrackingReference, JSON.stringify({ type: 'photo', reference: legacyProofReference }), legacyNow, legacyNow);

  const legacyExperience = await store.getTelegramBuyerFulfillmentExperience(
    tenant.chatId, 'parcel-request-buyer-http', legacyMarketplaceOrderId,
  );
  assert.equal(legacyExperience.fulfillments.length, 1,
    'legacy order without canonical fulfillment should retain one marketplace fulfillment');
  assert.equal(legacyExperience.fulfillments[0].status, 'out_for_delivery',
    'legacy marketplace status should be used only when canonical fulfillment is absent');
  assert.equal(legacyExperience.fulfillments[0].trackingReference, legacyTrackingReference);
  assert.equal(legacyExperience.fulfillments[0].proof.reference, legacyProofReference);

  // A different tenant/seller must not read the original seller's order even
  // when the caller supplies a valid buyer identity and marketplace order ID.
  const otherSeller = await store.getOrCreateUserByTelegram(
    'tracking-isolation-' + Date.now().toString(36), 'Tracking Isolation Seller',
  );
  const otherSellerTenant = await store.createTenantForUser({
    userId: otherSeller.id,
    sellerName: 'Tracking Isolation Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  await assert.rejects(
    () => store.getTelegramBuyerFulfillmentExperience(
      otherSellerTenant.chatId, 'parcel-request-buyer-http', requestedAssessment.marketplace_order_id,
    ),
    error => error?.code === 'ORDER_NOT_FOUND',
    'cross-seller/tenant tracking access must fail closed',
  );

  console.log('PASS: canonical Telegram fulfillment projection, legacy fallback, tenant/seller isolation, service catalog HTTP journey, frontend sync recovery, and idempotent order sync');
} catch (error) {
  console.error(error);
  if (childOutput) console.error('Backend output:\n' + childOutput);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
  await rm(tempDir, { recursive: true, force: true });
}

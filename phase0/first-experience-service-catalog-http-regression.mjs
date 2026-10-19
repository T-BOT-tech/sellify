import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

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
  const logisticsActor = { userId: user.id, organizationId: tenant.organizationId || tenant.organization_id, role: 'owner' };
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
  await assert.rejects(
    () => store.assignDeliveryCourier(tenant.chatId, requestOrder.server_order_id, '', logisticsActor, {
      assignmentKey: 'parcel-request-before-assessment',
    }),
    error => error?.code === 'LOGISTICS_SERVICE_ASSESSMENT_REQUIRED' && error?.statusCode === 409,
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
  assert.equal(missingAcceptanceResponse.status, 400,
    'an eligible assessment must fail closed without explicit customer acceptance evidence');
  assert.equal((await missingAcceptanceResponse.json()).error?.code,
    'LOGISTICS_CUSTOMER_ACCEPTANCE_REQUIRED');

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

  // Assessment idempotency keys are organization-scoped, not merely embedded
  // in one order's JSON. Reusing a committed key against another order must
  // conflict before validating that second order's assessment payload.
  const crossOrderAssessmentUrl = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/orders/' + encodeURIComponent(parcelStoredOrder.server_order_id) + '/service-delivery-assessment';
  const crossOrderAssessmentReplay = await fetch(crossOrderAssessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-accepted-1' },
    body: JSON.stringify(assessmentPayload),
  });
  assert.equal(crossOrderAssessmentReplay.status, 409,
    'an assessment idempotency key must not be reused across canonical orders');
  assert.equal((await crossOrderAssessmentReplay.json()).error?.code,
    'LOGISTICS_ASSESSMENT_IDEMPOTENCY_CONFLICT');

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
    if (matchingFulfillment) {
      assignmentReplayDb.prepare('UPDATE fulfillments SET location_id = ? WHERE id = ?').run(
        requestOrder.location_id ? String(requestOrder.location_id) : null, matchingFulfillment.id
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
        String(session.organizationId), requestOrder.location_id ? String(requestOrder.location_id) : null,
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
      requestOrder.location_id ? String(requestOrder.location_id) : null,
      String(user.id), 'parcel-assignment-idempotency-key-replay',
      String(user.id), now, now, 'parcel-assignment-idempotency-key-replay'
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
  await assert.rejects(
    () => store.assignDeliveryCourier(
      tenant.chatId, requestOrder.server_order_id, 'different-courier-user', session,
      { assignmentKey: 'parcel-assignment-idempotency-key-replay' }
    ),
    error => error?.code === 'IDEMPOTENCY_KEY_REUSE_CONFLICT' && error?.statusCode === 409,
    'reusing an assignment key with a different courier must conflict'
  );

  await assert.rejects(
    () => store.transitionOrderFulfillment(
      tenant.chatId, requestOrder.server_order_id, 'out_for_delivery', session,
      { idempotencyKey: 'parcel-direct-transition-bypasses-assignment' }
    ),
    error => error?.code === 'DELIVERY_ASSIGNMENT_LIFECYCLE_REQUIRED' && error?.statusCode === 409,
    'an active courier assignment must advance through its own lifecycle'
  );
  await assert.rejects(
    () => store.transitionDeliveryAssignment(
      tenant.chatId, requestOrder.server_order_id, 'REASSIGNED', session,
      { idempotencyKey: 'parcel-assignment-reassign-missing-target' }
    ),
    error => error?.code === 'REASSIGNMENT_TARGET_REQUIRED' && error?.statusCode === 400,
    'reassignment without a target must return a validation error after loading the active assignment'
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
    assignmentLocationGuardDb.prepare(
      "UPDATE delivery_assignments SET location_id = ?, updated_at = ? WHERE id = ?"
    ).run('stale-assignment-location', '9999-12-31T23:59:59.999Z', seededAssignmentId);
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

  const assessmentRetry = await fetch(assessmentUrl, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': 'parcel-request-assessment-accepted-1' },
    body: JSON.stringify(assessmentPayload),
  });
  assert.equal(assessmentRetry.status, 200, 'assessment idempotent retry should succeed');
  assert.equal((await assessmentRetry.json()).replayed, true, 'assessment retry should be reported as replayed');

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
    () => store.assignDeliveryCourier(tenant.chatId, rejectedOrder.server_order_id, '', session, {
      assignmentKey: 'parcel-rejected-order-assignment-must-fail',
    }),
    error => error?.code === 'LOGISTICS_SERVICE_ASSESSMENT_REQUIRED' && error?.statusCode === 409,
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
  const canonicalFulfillmentCount = trackingDb.prepare(
    'SELECT COUNT(*) AS count FROM fulfillments WHERE server_order_id = ? AND organization_id = ?'
  ).get(String(requestOrder.server_order_id), String(session.organizationId)).count;
  assert.equal(buyerFulfillmentExperience.fulfillments.length, canonicalFulfillmentCount,
    'canonical tracking must not multiply canonical fulfillments by joining legacy marketplace rows');
  assert.ok(buyerFulfillmentExperience.fulfillments.some(item =>
    item.status === 'DELIVERED'
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
  const otherTenant = await store.createTenantForUser({
    userId: otherSeller.id,
    sellerName: 'Tracking Isolation Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  await assert.rejects(
    () => store.getTelegramBuyerFulfillmentExperience(
      otherTenant.chatId, 'parcel-request-buyer-http', requestedAssessment.marketplace_order_id,
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

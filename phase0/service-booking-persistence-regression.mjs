import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-service-booking-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('booking-owner-' + suffix, 'Booking Owner');
  const seller = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Booking Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(seller.chatId, [{
    id: 'consultation', name: 'Consultation', price: 25000, item_type: 'service', marketplace_listed: true,
  }]);
  const checkout = await store.createMarketplaceOrder({
    buyer_id: 'booking-buyer-' + suffix, customer_name: 'Booking Buyer',
    items: [{ seller_id: seller.chatId, item_id: 'consultation', qty: 1 }],
    idempotency_key: 'booking-checkout-' + suffix,
  });
  assert.ok(checkout.marketplace_order_id);
  const order = (await store.getOrders(seller.chatId)).find(item =>
    item.is_marketplace && item.items?.some(line => line.item_id === 'consultation'));
  assert.ok(order?.server_order_id, 'service booking must link to the canonical seller order');
  const canonicalOrderStateBefore = {
    status: order.status ?? null,
    payment_status: order.payment_status ?? null,
    paymentStatus: order.paymentStatus ?? null,
    fulfillment_status: order.fulfillment_status ?? null,
  };

  const request = {
    service_item_id: 'consultation',
    requested_start: '2026-11-01T09:00:00+03:00',
    requested_end: '2026-11-01T10:00:00+03:00',
    appointment_mode: 'REMOTE',
    customer_note: 'Please call first.',
    idempotency_key: 'booking-create-' + suffix,
  };
  await assert.rejects(
    store.createServiceBooking(seller.chatId, order.server_order_id, {
      ...request, payment_id: 'caller-controlled', idempotency_key: 'booking-forbidden-authority-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_AUTHORITY_FIELD_FORBIDDEN',
    'service booking must reject caller-supplied payment authority fields',
  );
  const created = await store.createServiceBooking(seller.chatId, order.server_order_id, request, { userId: owner.id });
  assert.equal(created.replayed, false);
  assert.equal(created.booking.status, 'REQUESTED');
  assert.equal(created.booking.version, 1);
  assert.equal(created.booking.requested_start, '2026-11-01T06:00:00.000Z');

  const replay = await store.createServiceBooking(seller.chatId, order.server_order_id, request, { userId: owner.id });
  assert.equal(replay.replayed, true);
  assert.equal(replay.booking.id, created.booking.id);
  await assert.rejects(
    store.createServiceBooking(seller.chatId, order.server_order_id, {
      ...request, requested_end: '2026-11-01T11:00:00+03:00',
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_IDEMPOTENCY_CONFLICT',
  );
  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
      status: 'ACCEPTED', expected_version: 1, payment_id: 'caller-controlled',
      idempotency_key: 'booking-transition-forbidden-authority-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_AUTHORITY_FIELD_FORBIDDEN',
    'service booking transitions must reject caller-supplied payment authority fields',
  );

  const accepted = await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
    status: 'ACCEPTED', expected_version: 1, idempotency_key: 'booking-accept-' + suffix,
  }, { userId: owner.id });
  assert.equal(accepted.booking.status, 'ACCEPTED');
  assert.equal(accepted.booking.version, 2);
  const acceptedReplay = await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
    status: 'ACCEPTED', expected_version: 1, idempotency_key: 'booking-accept-' + suffix,
  }, { userId: owner.id });
  assert.equal(acceptedReplay.replayed, true);
  assert.equal(acceptedReplay.booking.status, 'ACCEPTED');

  const resourceResult = await store.createServiceResource(seller.chatId, {
    name: 'Consultation Room', resourceType: 'FACILITY', serviceItemId: 'consultation',
    idempotency_key: 'booking-resource-' + suffix,
  }, { userId: owner.id });
  const serviceResourceId = resourceResult.resource.id;

  // ON_SITE appointments must not commit a branch-bound resource against a
  // different canonical seller-order location.
  const locationDb = store.getDatabaseForTests();
  const canonicalOrderRow = locationDb.prepare('SELECT order_json FROM orders WHERE chat_id=? AND server_order_id=?')
    .get(seller.chatId, order.server_order_id);
  const canonicalOrder = JSON.parse(canonicalOrderRow.order_json);
  const sellerOrganizationId = locationDb.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(seller.chatId)?.organization_id;
  assert.ok(sellerOrganizationId, 'seller tenant must resolve its canonical organization');
  const defaultLocation = locationDb.prepare("SELECT id FROM locations WHERE organization_id=? AND code='DEFAULT'")
    .get(sellerOrganizationId);
  assert.ok(defaultLocation?.id, 'seller must have its canonical default location');
  const alternateLocationId = 'booking-alt-location-' + suffix;
  locationDb.prepare('INSERT INTO locations (id,organization_id,code,name,type,status,created_at) VALUES (?,?,?,\'Alternate Branch\',\'STORE\',\'active\',?)')
    .run(alternateLocationId, sellerOrganizationId, 'ALT-' + suffix, new Date().toISOString());
  canonicalOrder.location_id = defaultLocation.id;
  locationDb.prepare('UPDATE orders SET order_json=? WHERE chat_id=? AND server_order_id=?')
    .run(JSON.stringify(canonicalOrder), seller.chatId, order.server_order_id);
  const branchResource = await store.createServiceResource(seller.chatId, {
    name: 'Alternate Branch Room', resourceType: 'FACILITY', serviceItemId: 'consultation',
    location_id: alternateLocationId,
    idempotency_key: 'booking-branch-resource-' + suffix,
  }, { userId: owner.id });
  await store.setServiceResourceAvailability(seller.chatId, branchResource.resource.id, {
    expected_version: 0, idempotency_key: 'booking-branch-resource-hours-' + suffix,
    workingHours: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, startTime: '08:00', endTime: '18:00' })),
    exceptions: [],
  }, { userId: owner.id });
  const onSiteBooking = await store.createServiceBooking(seller.chatId, order.server_order_id, {
    ...request, appointment_mode: 'ON_SITE',
    requested_start: '2026-11-09T09:00:00+03:00',
    requested_end: '2026-11-09T10:00:00+03:00',
    idempotency_key: 'booking-onsite-location-create-' + suffix,
  }, { userId: owner.id });
  const onSiteAccepted = await store.transitionServiceBooking(seller.chatId, order.server_order_id, onSiteBooking.booking.id, {
    status: 'ACCEPTED', expected_version: 1, idempotency_key: 'booking-onsite-location-accept-' + suffix,
  }, { userId: owner.id });
  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, onSiteBooking.booking.id, {
      status: 'CONFIRMED', expected_version: onSiteAccepted.booking.version,
      service_resource_id: branchResource.resource.id,
      idempotency_key: 'booking-onsite-location-confirm-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_RESOURCE_LOCATION_MISMATCH',
    'on-site appointment must not commit a resource assigned to another canonical location',
  );
  assert.equal(locationDb.prepare('SELECT COUNT(*) AS count FROM service_resource_commitments WHERE booking_id=?')
    .get(onSiteBooking.booking.id).count, 0, 'location mismatch must not create a resource commitment');

  await store.setServiceResourceAvailability(seller.chatId, serviceResourceId, {
    expected_version: 0, idempotency_key: 'booking-resource-hours-' + suffix,
    workingHours: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, startTime: '08:00', endTime: '18:00' })),
    exceptions: [],
  }, { userId: owner.id });

  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
      status: 'CONFIRMED', expected_version: 2, idempotency_key: 'booking-confirm-no-resource-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_RESOURCE_REQUIRED',
  );

  const confirmed = await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
    status: 'CONFIRMED', expected_version: 2, service_resource_id: serviceResourceId,
    idempotency_key: 'booking-confirm-' + suffix,
  }, { userId: owner.id });
  assert.equal(confirmed.booking.version, 3);
  assert.equal(confirmed.booking.service_resource_id, serviceResourceId);
  const commitment = store.getDatabaseForTests().prepare(
    "SELECT * FROM service_resource_commitments WHERE booking_id = ? AND state = 'COMMITTED'"
  ).get(created.booking.id);
  assert.equal(commitment.resource_id, serviceResourceId);
  assert.equal(commitment.starts_at, created.booking.requested_start);
  assert.equal(commitment.ends_at, created.booking.requested_end);
  await assert.rejects(
    store.setServiceResourceAvailability(seller.chatId, serviceResourceId, {
      expected_version: 1, idempotency_key: 'booking-resource-hours-invalid-edit-' + suffix,
      workingHours: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, startTime: '10:00', endTime: '18:00' })),
      exceptions: [],
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_AVAILABILITY_CONFLICTS_WITH_COMMITMENTS',
    'schedule edits must not invalidate a committed appointment',
  );
  const confirmedReplay = await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
    status: 'CONFIRMED', expected_version: 2, service_resource_id: serviceResourceId,
    idempotency_key: 'booking-confirm-' + suffix,
  }, { userId: owner.id });
  assert.equal(confirmedReplay.replayed, true);
  assert.equal(confirmedReplay.booking.version, 3);
  assert.equal(store.getDatabaseForTests().prepare(
    'SELECT COUNT(*) AS count FROM service_resource_commitments WHERE booking_id = ?'
  ).get(created.booking.id).count, 1, 'confirmation replay must not create a second resource commitment');

  const overlappingRequest = await store.createServiceBooking(seller.chatId, order.server_order_id, {
    ...request, customer_note: 'Overlapping appointment',
    idempotency_key: 'booking-overlap-create-' + suffix,
  }, { userId: owner.id });
  const overlappingAccept = await store.transitionServiceBooking(seller.chatId, order.server_order_id, overlappingRequest.booking.id, {
    status: 'ACCEPTED', expected_version: 1, idempotency_key: 'booking-overlap-accept-' + suffix,
  }, { userId: owner.id });
  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, overlappingRequest.booking.id, {
      status: 'CONFIRMED', expected_version: overlappingAccept.booking.version,
      service_resource_id: serviceResourceId, idempotency_key: 'booking-overlap-confirm-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_RESOURCE_CONFLICT',
    'overlapping appointments must not commit to the same resource',
  );

  // Two concurrent confirmations for the same free interval must serialize:
  // exactly one transaction wins and the other observes the committed overlap.
  const raceBookings = await Promise.all(['A', 'B'].map(async label => store.createServiceBooking(
    seller.chatId, order.server_order_id, {
      ...request,
      requested_start: '2026-11-08T13:00:00+03:00',
      requested_end: '2026-11-08T14:00:00+03:00',
      idempotency_key: 'booking-race-create-' + label + '-' + suffix,
    }, { userId: owner.id },
  )));
  const raceAccepted = await Promise.all(raceBookings.map((entry, index) => store.transitionServiceBooking(
    seller.chatId, order.server_order_id, entry.booking.id, {
      status: 'ACCEPTED', expected_version: 1,
      idempotency_key: 'booking-race-accept-' + index + '-' + suffix,
    }, { userId: owner.id },
  )));
  const raceResults = await Promise.allSettled(raceBookings.map((entry, index) => store.transitionServiceBooking(
    seller.chatId, order.server_order_id, entry.booking.id, {
      status: 'CONFIRMED', expected_version: raceAccepted[index].booking.version,
      service_resource_id: serviceResourceId,
      idempotency_key: 'booking-race-confirm-' + index + '-' + suffix,
    }, { userId: owner.id },
  )));
  assert.equal(raceResults.filter(result => result.status === 'fulfilled').length, 1,
    'exactly one concurrent appointment confirmation may commit');
  const raceRejected = raceResults.find(result => result.status === 'rejected');
  assert.equal(raceRejected.reason?.code, 'SERVICE_BOOKING_RESOURCE_CONFLICT',
    'losing concurrent confirmation must return a resource conflict');
  
  // Booking lifecycle is not authority to mutate canonical order, payment, or
  // fulfillment state, and must not manufacture a logistics activity.
  const canonicalOrderAfterConfirmation = (await store.getOrders(seller.chatId)).find(item =>
    String(item.server_order_id || '') === String(order.server_order_id));
  assert.ok(canonicalOrderAfterConfirmation, 'canonical order must remain available after booking confirmation');
  assert.deepEqual({
    status: canonicalOrderAfterConfirmation.status ?? null,
    payment_status: canonicalOrderAfterConfirmation.payment_status ?? null,
    paymentStatus: canonicalOrderAfterConfirmation.paymentStatus ?? null,
    fulfillment_status: canonicalOrderAfterConfirmation.fulfillment_status ?? null,
  }, canonicalOrderStateBefore, 'booking confirmation must not mutate canonical order/payment/fulfillment lifecycle');

  const schedulingRows = store.getDatabaseForTests().prepare(
    'SELECT id FROM logistics_scheduling_activities WHERE organization_id = ? AND related_order_id = ?'
  ).all(String(seller.organizationId), String(order.server_order_id));
  assert.equal(schedulingRows.length, 0,
    'service booking must not create a logistics scheduling activity without an applicable canonical logistics reference');
  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
      status: 'IN_PROGRESS', expected_version: 2, idempotency_key: 'booking-stale-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_VERSION_CONFLICT',
  );
  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
      status: 'REQUESTED', expected_version: 3, idempotency_key: 'booking-invalid-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_TRANSITION_INVALID',
  );

  const listed = await store.listServiceBookings(seller.chatId, order.server_order_id);
  assert.equal(listed.length, 5, 'all requested appointments remain visible, including the rejected location mismatch, uncommitted overlap, and concurrent race loser');
  for (const expectedId of [created.booking.id, overlappingRequest.booking.id, ...raceBookings.map(entry => entry.booking.id)]) {
    assert.ok(listed.some(item => item.id === expectedId), 'booking list must include ' + expectedId);
  }

  const secondUser = await store.getOrCreateUserByTelegram('booking-other-' + suffix, 'Other Seller');
  const secondSeller = await store.createTenantForUser({
    userId: secondUser.id, sellerName: 'Other Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await assert.rejects(
    store.transitionServiceBooking(secondSeller.chatId, order.server_order_id, created.booking.id, {
      status: 'IN_PROGRESS', expected_version: 3, idempotency_key: 'cross-tenant-' + suffix,
    }, { userId: secondUser.id }),
    error => error?.code === 'SERVICE_BOOKING_NOT_FOUND' || error?.code === 'ORDER_ORGANIZATION_REQUIRED',
  );

  const db = store.getDatabaseForTests();
  const audit = db.prepare("SELECT action FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ? ORDER BY id").all(created.booking.id);
  assert.deepEqual(audit.map(row => row.action), [
    'services.booking.requested', 'services.booking.accepted', 'services.booking.confirmed',
  ], 'booking mutations and audit evidence must be committed together');

  // Execution evidence is server-authored and follows the booking lifecycle.
  const executionBooking = await store.createServiceBooking(seller.chatId, order.server_order_id, {
    ...request,
    requested_start: '2026-11-05T09:00:00+03:00',
    requested_end: '2026-11-05T10:00:00+03:00',
    idempotency_key: 'booking-create-execution-' + suffix,
  }, { userId: owner.id });
  const executionAccept = await store.transitionServiceBooking(seller.chatId, order.server_order_id, executionBooking.booking.id, {
    status: 'ACCEPTED', expected_version: 1, idempotency_key: 'booking-execution-accept-' + suffix,
  }, { userId: owner.id });
  const executionConfirm = await store.transitionServiceBooking(seller.chatId, order.server_order_id, executionBooking.booking.id, {
    status: 'CONFIRMED', expected_version: 2, service_resource_id: serviceResourceId,
    idempotency_key: 'booking-execution-confirm-' + suffix,
  }, { userId: owner.id });
  assert.equal(executionConfirm.booking.status, 'CONFIRMED');
  const started = await store.transitionServiceBooking(seller.chatId, order.server_order_id, executionBooking.booking.id, {
    status: 'IN_PROGRESS', expected_version: 3, idempotency_key: 'booking-execution-start-' + suffix,
    started_by: 'caller-controlled', started_at: '1999-01-01T00:00:00.000Z',
  }, { userId: owner.id });
  assert.equal(started.booking.status, 'IN_PROGRESS');
  assert.ok(started.booking.started_at, 'service start time must be generated by the server');
  assert.notEqual(started.booking.started_at, '1999-01-01T00:00:00.000Z');
  assert.equal(started.booking.started_by, owner.id, 'service starter must come from authenticated actor context');
  const startedReplay = await store.transitionServiceBooking(seller.chatId, order.server_order_id, executionBooking.booking.id, {
    status: 'IN_PROGRESS', expected_version: 3, idempotency_key: 'booking-execution-start-' + suffix,
  }, { userId: owner.id });
  assert.equal(startedReplay.replayed, true);
  assert.equal(startedReplay.booking.started_at, started.booking.started_at);
  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, executionBooking.booking.id, {
      status: 'IN_PROGRESS', expected_version: 4, completion_note: 'not a completion', idempotency_key: 'booking-invalid-completion-note-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_COMPLETION_NOTE_INVALID',
  );
  const completed = await store.transitionServiceBooking(seller.chatId, order.server_order_id, executionBooking.booking.id, {
    status: 'COMPLETED', expected_version: 4, completion_note: 'Consultation completed; follow-up plan provided.',
    idempotency_key: 'booking-execution-complete-' + suffix,
    completed_by: 'caller-controlled', completed_at: '1999-01-01T00:00:00.000Z',
  }, { userId: owner.id });
  assert.equal(completed.booking.status, 'COMPLETED');
  assert.ok(completed.booking.completed_at, 'service completion time must be generated by the server');
  assert.notEqual(completed.booking.completed_at, '1999-01-01T00:00:00.000Z');
  assert.equal(completed.booking.completed_by, owner.id, 'service completer must come from authenticated actor context');
  assert.equal(completed.booking.completion_note, 'Consultation completed; follow-up plan provided.');
  const completedReplay = await store.transitionServiceBooking(seller.chatId, order.server_order_id, executionBooking.booking.id, {
    status: 'COMPLETED', expected_version: 4, completion_note: 'Consultation completed; follow-up plan provided.',
    idempotency_key: 'booking-execution-complete-' + suffix,
  }, { userId: owner.id });
  assert.equal(completedReplay.replayed, true);
  assert.equal(completedReplay.booking.completed_at, completed.booking.completed_at);
  assert.equal(completedReplay.booking.completion_note, completed.booking.completion_note);
  const completedCommitment = db.prepare(
    'SELECT state, released_by, released_at FROM service_resource_commitments WHERE booking_id = ?'
  ).get(executionBooking.booking.id);
  assert.equal(completedCommitment?.state, 'RELEASED',
    'completed appointment must release its committed resource interval');
  assert.equal(completedCommitment?.released_by, owner.id,
    'resource release actor must come from authenticated actor context');
  assert.ok(completedCommitment?.released_at,
    'resource release timestamp must be generated by the server');
  const completionAuditRow = db.prepare(
    "SELECT metadata_json FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ? AND action = 'services.booking.completed'"
  ).get(executionBooking.booking.id);
  assert.equal(JSON.parse(completionAuditRow.metadata_json).resource_commitment_released, true,
    'completion audit must record the actual resource commitment release');

  // A completed appointment must no longer block the same resource/time slot.
  const slotReuseBooking = await store.createServiceBooking(seller.chatId, order.server_order_id, {
    ...request,
    requested_start: '2026-11-05T09:00:00+03:00',
    requested_end: '2026-11-05T10:00:00+03:00',
    idempotency_key: 'booking-create-slot-reuse-' + suffix,
  }, { userId: owner.id });
  await store.transitionServiceBooking(seller.chatId, order.server_order_id, slotReuseBooking.booking.id, {
    status: 'ACCEPTED', expected_version: 1,
    idempotency_key: 'booking-slot-reuse-accept-' + suffix,
  }, { userId: owner.id });
  const slotReuseConfirmed = await store.transitionServiceBooking(
    seller.chatId, order.server_order_id, slotReuseBooking.booking.id, {
      status: 'CONFIRMED', expected_version: 2, service_resource_id: serviceResourceId,
      idempotency_key: 'booking-slot-reuse-confirm-' + suffix,
    }, { userId: owner.id },
  );
  assert.equal(slotReuseConfirmed.booking.status, 'CONFIRMED',
    'the same resource/time slot must be reusable after completion releases its commitment');
  assert.equal(db.prepare(
    'SELECT state FROM service_resource_commitments WHERE booking_id = ?'
  ).get(slotReuseBooking.booking.id)?.state, 'COMMITTED',
  'slot reuse must create a fresh canonical commitment');

  await store.transitionServiceBooking(seller.chatId, order.server_order_id, slotReuseBooking.booking.id, {
    status: 'CANCELLED', expected_version: 3, reason: 'Regression cleanup',
    idempotency_key: 'booking-slot-reuse-cleanup-' + suffix,
  }, { userId: owner.id });
  const executionAudit = db.prepare(
    "SELECT action,metadata_json FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ? ORDER BY id"
  ).all(executionBooking.booking.id);
  assert.deepEqual(executionAudit.map(row => row.action), [
    'services.booking.requested', 'services.booking.accepted', 'services.booking.confirmed',
    'services.booking.in_progress', 'services.booking.completed',
  ], 'execution evidence and audit must be committed exactly once per command');
  const completionMetadata = JSON.parse(executionAudit.at(-1).metadata_json);
  assert.equal(completionMetadata.completion_note, 'Consultation completed; follow-up plan provided.');
  assert.equal(completionMetadata.completed_by, owner.id);
  const canonicalOrderAfterCompletion = (await store.getOrders(seller.chatId)).find(item =>
    String(item.server_order_id || '') === String(order.server_order_id));
  assert.deepEqual({
    status: canonicalOrderAfterCompletion.status ?? null,
    payment_status: canonicalOrderAfterCompletion.payment_status ?? null,
    paymentStatus: canonicalOrderAfterCompletion.paymentStatus ?? null,
    fulfillment_status: canonicalOrderAfterCompletion.fulfillment_status ?? null,
  }, canonicalOrderStateBefore, 'service completion must not mutate canonical order/payment/fulfillment lifecycle');

  const rejectionRequest = {
    ...request,
    requested_start: '2026-11-04T09:00:00+03:00',
    requested_end: '2026-11-04T10:00:00+03:00',
    idempotency_key: 'booking-create-rejection-' + suffix,
  };
  const rejectionBooking = await store.createServiceBooking(
    seller.chatId, order.server_order_id, rejectionRequest, { userId: owner.id },
  );
  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, rejectionBooking.booking.id, {
      status: 'REJECTED', expected_version: 1, idempotency_key: 'booking-reject-missing-reason-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_REASON_REQUIRED',
    'rejecting a service booking must include an auditable reason',
  );
  const rejected = await store.transitionServiceBooking(
    seller.chatId, order.server_order_id, rejectionBooking.booking.id, {
      status: 'REJECTED', expected_version: 1, reason: 'Requested time is unavailable',
      idempotency_key: 'booking-reject-with-reason-' + suffix,
    }, { userId: owner.id },
  );
  assert.equal(rejected.booking.status, 'REJECTED');
  const rejectionAudit = db.prepare(
    "SELECT action,reason FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ? ORDER BY id"
  ).all(rejectionBooking.booking.id);
  assert.deepEqual(rejectionAudit.map(row => row.action), [
    'services.booking.requested', 'services.booking.rejected',
  ]);
  assert.equal(rejectionAudit[1].reason, 'Requested time is unavailable');
  assert.equal(rejected.booking.status_reason, 'Requested time is unavailable',
    'rejection rationale must be returned with the durable booking record');

  const cancellationWithoutCommitment = await store.createServiceBooking(seller.chatId, order.server_order_id, {
    ...request,
    requested_start: '2026-11-05T11:00:00+03:00',
    requested_end: '2026-11-05T12:00:00+03:00',
    idempotency_key: 'booking-create-cancel-without-commitment-' + suffix,
  }, { userId: owner.id });
  await store.transitionServiceBooking(seller.chatId, order.server_order_id, cancellationWithoutCommitment.booking.id, {
    status: 'CANCELLED', expected_version: 1,
    idempotency_key: 'booking-cancel-without-commitment-' + suffix,
  }, { userId: owner.id });
  const cancellationAudit = db.prepare(
    "SELECT metadata_json FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ? AND action = 'services.booking.cancelled'"
  ).get(cancellationWithoutCommitment.booking.id);
  assert.equal(JSON.parse(cancellationAudit.metadata_json).resource_commitment_released, false,
    'cancellation audit must not claim a resource commitment was released when none existed');

  const failureBooking = await store.createServiceBooking(seller.chatId, order.server_order_id, {
    ...request,
    requested_start: '2026-11-06T09:00:00+03:00',
    requested_end: '2026-11-06T10:00:00+03:00',
    idempotency_key: 'booking-create-failure-' + suffix,
  }, { userId: owner.id });
  await store.transitionServiceBooking(seller.chatId, order.server_order_id, failureBooking.booking.id, {
    status: 'ACCEPTED', expected_version: 1, idempotency_key: 'booking-failure-accept-' + suffix,
  }, { userId: owner.id });
  await store.transitionServiceBooking(seller.chatId, order.server_order_id, failureBooking.booking.id, {
    status: 'CONFIRMED', expected_version: 2, service_resource_id: serviceResourceId,
    idempotency_key: 'booking-failure-confirm-' + suffix,
  }, { userId: owner.id });
  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, failureBooking.booking.id, {
      status: 'FAILED', expected_version: 3, idempotency_key: 'booking-failure-missing-reason-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_REASON_REQUIRED',
    'failure must not be recorded without a reason',
  );
  const failed = await store.transitionServiceBooking(seller.chatId, order.server_order_id, failureBooking.booking.id, {
    status: 'FAILED', expected_version: 3, reason: 'Required specialist was unavailable',
    idempotency_key: 'booking-failure-with-reason-' + suffix,
  }, { userId: owner.id });
  assert.equal(failed.booking.status, 'FAILED');
  assert.equal(failed.booking.status_reason, 'Required specialist was unavailable');
  assert.equal(store.getDatabaseForTests().prepare(
    'SELECT state FROM service_resource_commitments WHERE booking_id = ?'
  ).get(failureBooking.booking.id).state, 'RELEASED', 'failed appointment must release its committed resource interval');
  const failedReplay = await store.transitionServiceBooking(seller.chatId, order.server_order_id, failureBooking.booking.id, {
    status: 'FAILED', expected_version: 3, reason: 'Required specialist was unavailable',
    idempotency_key: 'booking-failure-with-reason-' + suffix,
  }, { userId: owner.id });
  assert.equal(failedReplay.replayed, true);
  assert.equal(failedReplay.booking.status_reason, 'Required specialist was unavailable');
  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, failureBooking.booking.id, {
      status: 'IN_PROGRESS', expected_version: 4, idempotency_key: 'booking-failure-recovery-invalid-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_TRANSITION_INVALID',
    'FAILED is terminal; recovery requires a new booking rather than rewriting failed history',
  );
  const failureAudit = db.prepare(
    "SELECT action,reason FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ? ORDER BY id"
  ).all(failureBooking.booking.id);
  assert.deepEqual(failureAudit.map(row => row.action), [
    'services.booking.requested', 'services.booking.accepted', 'services.booking.confirmed', 'services.booking.failed',
  ]);
  assert.equal(failureAudit.at(-1).reason, 'Required specialist was unavailable');

  console.log('Service Booking Persistence Regression: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

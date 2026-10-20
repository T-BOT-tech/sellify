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

  const confirmed = await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
    status: 'CONFIRMED', expected_version: 2, idempotency_key: 'booking-confirm-' + suffix,
  }, { userId: owner.id });
  assert.equal(confirmed.booking.version, 3);

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
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, created.booking.id);

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
    status: 'CONFIRMED', expected_version: 2, idempotency_key: 'booking-execution-confirm-' + suffix,
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
    status: 'CONFIRMED', expected_version: 2, idempotency_key: 'booking-failure-confirm-' + suffix,
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

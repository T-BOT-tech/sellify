import assert from 'node:assert/strict';
import {
  SERVICE_BOOKING_STATUSES,
  SERVICE_BOOKING_TRANSITIONS,
  SERVICE_BOOKING_REASON_REQUIRED_STATUSES,
  normalizeServiceBookingRequest,
  canTransitionServiceBooking,
  assertServiceBookingTransition,
  serviceBookingContract,
} from '../app/src/verticals/services/service-booking-contract.js';

const request = normalizeServiceBookingRequest({
  order_id: 'order-service-100',
  service_item_id: 'consultation',
  requested_start: '2026-11-01T09:00:00+03:00',
  requested_end: '2026-11-01T10:00:00+03:00',
  appointment_mode: 'remote',
  customer_note: 'Please call before starting.',
});
assert.equal(request.status, 'REQUESTED');
assert.equal(request.requested_start, '2026-11-01T06:00:00.000Z');
assert.equal(request.requested_end, '2026-11-01T07:00:00.000Z');
assert.equal(request.appointment_mode, 'REMOTE');
assert.equal(request.order_authority, 'canonical_commerce_order');
assert.equal(request.payment_authority, 'payment_core');
assert.equal(request.persistence, 'none');

assert.deepEqual(SERVICE_BOOKING_STATUSES, [
  'REQUESTED', 'ACCEPTED', 'CONFIRMED', 'IN_PROGRESS',
  'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED',
]);
assert.deepEqual(SERVICE_BOOKING_TRANSITIONS.REQUESTED, ['ACCEPTED', 'REJECTED', 'CANCELLED']);
assert.equal(canTransitionServiceBooking('REQUESTED', 'ACCEPTED'), true);
assert.equal(canTransitionServiceBooking('ACCEPTED', 'CONFIRMED'), true);
assert.equal(canTransitionServiceBooking('CONFIRMED', 'IN_PROGRESS'), true);
assert.equal(canTransitionServiceBooking('IN_PROGRESS', 'COMPLETED'), true);
assert.equal(canTransitionServiceBooking('COMPLETED', 'CONFIRMED'), false);
assert.equal(canTransitionServiceBooking('REJECTED', 'ACCEPTED'), false);
assert.deepEqual(assertServiceBookingTransition('CONFIRMED', 'CANCELLED'), {
  from: 'CONFIRMED', to: 'CANCELLED', terminal: true,
});

assert.throws(() => normalizeServiceBookingRequest({
  order_id: 'o1', service_item_id: 's1',
  requested_start: '2026-11-01T09:00:00', requested_end: '2026-11-01T10:00:00',
}), error => error?.code === 'SERVICE_BOOKING_INVALID');

assert.throws(() => normalizeServiceBookingRequest({
  order_id: 'o1', service_item_id: 's1',
  requested_start: '2026-11-01T10:00:00Z', requested_end: '2026-11-01T09:00:00Z',
}), error => error?.code === 'SERVICE_BOOKING_TIME_WINDOW_INVALID');

assert.throws(() => normalizeServiceBookingRequest({
  order_id: 'o1', service_item_id: 's1',
  requested_start: '2026-11-01T09:00:00Z', requested_end: '2026-11-01T10:00:00Z',
  payment_id: 'caller-controlled',
}), error => error?.code === 'SERVICE_BOOKING_AUTHORITY_FIELD_FORBIDDEN');

assert.throws(() => normalizeServiceBookingRequest({
  order_id: 'o1', service_item_id: 's1',
  requested_start: '2026-11-01T09:00:00Z', requested_end: '2026-11-01T10:00:00Z',
  customer_note: 'x'.repeat(501),
}), /customer_note must be at most 500 characters/);

assert.throws(() => assertServiceBookingTransition('REQUESTED', 'COMPLETED'),
  error => error?.code === 'SERVICE_BOOKING_TRANSITION_INVALID');

const contract = serviceBookingContract();
assert.deepEqual(SERVICE_BOOKING_REASON_REQUIRED_STATUSES, ['REJECTED', 'FAILED']);
assert.equal(contract.persists, false);
assert.equal(contract.creates_order, false);
assert.equal(contract.creates_payment, false);
assert.equal(contract.reserves_inventory, false);
assert.equal(contract.assigns_courier, false);
assert.deepEqual(contract.reason_required_statuses, ['REJECTED', 'FAILED']);

console.log('Service Booking Contract Regression: PASS');

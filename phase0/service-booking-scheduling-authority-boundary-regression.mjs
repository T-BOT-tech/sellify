// Cross-capability regression: service bookings must not imply logistics capacity,
// and a scheduling handoff requires explicit canonical context from its authority.
import assert from 'node:assert/strict';
import {
  normalizeServiceBookingRequest,
  serviceBookingContract,
} from '../app/src/verticals/services/service-booking-contract.js';
import {
  normalizeLogisticsSchedulingRequest,
} from '../app/src/verticals/logistics/scheduling-contract.js';
import {
  evaluateLogisticsSchedulingFeasibility,
} from '../app/src/verticals/logistics/scheduling-feasibility-contract.js';

const booking = normalizeServiceBookingRequest({
  order_id: 'order-service-boundary-1',
  service_item_id: 'consultation',
  requested_start: '2026-11-01T09:00:00+03:00',
  requested_end: '2026-11-01T10:00:00+03:00',
  appointment_mode: 'ON_SITE',
});

const bookingContract = serviceBookingContract();
assert.equal(bookingContract.scheduling_authority, 'existing_logistics_scheduling_when_applicable');
assert.equal(booking.persistence, 'none');

// Requested appointment time alone is not an authoritative capacity decision.
const candidate = normalizeLogisticsSchedulingRequest({
  organization_id: 'org-boundary-test',
  activity_type: 'DELIVERY',
  mode: 'SCHEDULED',
  requested_start: booking.requested_start,
  requested_end: booking.requested_end,
  related_order: { id: booking.order_id, authority: 'canonical_commerce_order' },
});
const evaluation = evaluateLogisticsSchedulingFeasibility({ request: candidate });
assert.equal(evaluation.evaluation, 'UNKNOWN');
assert.equal(evaluation.reason, 'NO_AUTHORITATIVE_CAPACITY_DECISION');
assert.equal(evaluation.feasible, false);
assert.equal(evaluation.authorized, false);
assert.equal(evaluation.execution, false);
assert.equal(evaluation.persistence, 'none');
assert.equal(evaluation.mutation, false);

// An unrelated activity with no shared canonical reference is not a conflict;
// the evaluator must still not infer physical capacity from the absence of one.
const unrelated = evaluateLogisticsSchedulingFeasibility({
  request: candidate,
  existingActivities: [{
    id: 'other-activity',
    organization_id: 'org-boundary-test',
    activity_type: 'DELIVERY',
    status: 'CONFIRMED',
    scheduled_start: booking.requested_start,
    scheduled_end: booking.requested_end,
    related_order_id: 'another-order',
  }],
});
assert.equal(unrelated.evaluation, 'UNKNOWN');
assert.equal(unrelated.feasible, false);
assert.equal(unrelated.mutation, false);

// Only an explicit result from an existing authoritative capacity source can
// yield FEASIBLE, and even that is evaluation—not authorization or reservation.
const authoritative = evaluateLogisticsSchedulingFeasibility({
  request: candidate,
  externalEvaluation: {
    outcome: 'FEASIBLE',
    authority: 'existing-capacity-service',
    referenceId: 'capacity-check-1',
  },
});
assert.equal(authoritative.evaluation, 'FEASIBLE');
assert.equal(authoritative.feasible, true);
assert.equal(authoritative.authorized, false);
assert.equal(authoritative.execution, false);
assert.equal(authoritative.persistence, 'none');
assert.equal(authoritative.mutation, false);

console.log('Service Booking ↔ Logistics Scheduling Authority Boundary: PASS');

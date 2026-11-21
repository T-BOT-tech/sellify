// Cross-capability regression: service bookings must not imply logistics capacity,
// and a scheduling handoff requires explicit canonical context from its authority.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { authorize, AUTHZ } from '../backend/lib/authorization.js';
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
const schedulingRequest = {
  organization_id: 'org-boundary-test',
  activity_type: 'DELIVERY',
  mode: 'SCHEDULED',
  timezone: 'Africa/Addis_Ababa',
  requested_start: booking.requested_start,
  requested_end: booking.requested_end,
  scheduled_start: booking.requested_start,
  scheduled_end: booking.requested_end,
  related_order: { id: booking.order_id, authority: 'canonical_commerce_order' },
};
const candidate = normalizeLogisticsSchedulingRequest(schedulingRequest);
assert.equal(candidate.requested_start, booking.requested_start);
const evaluation = evaluateLogisticsSchedulingFeasibility({ request: schedulingRequest });
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
  request: schedulingRequest,
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

// A trusted adapter may represent a sourced capacity result as FEASIBLE only
// when both source identity and a durable reference are present. This pure
// contract does not authenticate those labels; backend request paths discard
// caller-supplied evaluations, and FEASIBLE is not authorization or reservation.
const authoritative = evaluateLogisticsSchedulingFeasibility({
  request: schedulingRequest,
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


const readSource = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [serverSource, authorizationSource, registrySource, uiSource] = await Promise.all([
  readSource('backend/server.js'),
  readSource('backend/lib/authorization.js'),
  readSource('backend/lib/resource-action-registry.js'),
  readSource('app/src/logistics/service-bookings.js'),
]);
const handlerStart = serverSource.indexOf('async function handleServiceBookings');
const handlerEnd = serverSource.indexOf('async function handleServiceDeliveryAssessment', handlerStart);
const handler = serverSource.slice(handlerStart, handlerEnd);
assert.match(handler, /requireAuthorization\(session, tenant, 'service_booking', 'service:service_booking:view'/);
assert.match(handler, /'service:service_booking:request'/);
assert.match(handler, /'service:service_booking:confirm'/);
assert.match(handler, /'service:service_booking:cancel'/);
assert.match(handler, /'service:service_booking:manage'/);
assert.doesNotMatch(handler, /logistics:scheduling:/,
  'Service Booking lifecycle authorization must not borrow Logistics Scheduling permissions');
for (const action of ['view', 'request', 'manage', 'confirm', 'cancel']) {
  assert.match(registrySource, new RegExp("\\['service', 'service_booking', '" + action + "'"));
}
const manager = { userId: 'manager-1', role: 'manager', organizationId: 'org-service-boundary' };
const logisticsManager = { userId: 'logistics-1', role: 'logistics_manager', organizationId: 'org-service-boundary' };
const logisticsDispatcher = { userId: 'dispatcher-1', role: 'logistics_dispatcher', organizationId: 'org-service-boundary' };
for (const action of [
  'service:service_booking:view', 'service:service_booking:request',
  'service:service_booking:manage', 'service:service_booking:confirm',
  'service:service_booking:cancel',
]) {
  assert.equal(authorize(manager, 'org-service-boundary', null, 'service_booking', action), AUTHZ.ALLOW);
  assert.equal(authorize(logisticsManager, 'org-service-boundary', null, 'service_booking', action), AUTHZ.DENY);
  assert.equal(authorize(logisticsDispatcher, 'org-service-boundary', null, 'service_booking', action), AUTHZ.DENY);
}
assert.equal(authorize(logisticsManager, 'org-service-boundary', null, 'scheduling', 'logistics:scheduling:manage'), AUTHZ.ALLOW,
  'Logistics retains its own scheduling authority');
const provider = {
  userId: 'provider-1', role: 'staff', organizationId: 'org-service-boundary',
  contextualRoles: [{ role: 'service_provider', scopeType: 'RESOURCE', scopeId: 'resource-1' }],
};
const providerContext = {
  resourceType: 'service_resource', resourceId: 'resource-1',
  organizationId: 'org-service-boundary', locationId: null,
};
assert.equal(authorize(provider, 'org-service-boundary', null, 'service_resource',
  'service:service_booking:view', providerContext), AUTHZ.ALLOW);
assert.equal(authorize(provider, 'org-service-boundary', null, 'service_resource',
  'service:service_booking:confirm', providerContext), AUTHZ.DENY);
const canOperateStart = uiSource.indexOf('function canOperate()');
const canOperateEnd = uiSource.indexOf('function renderBookingCard', canOperateStart);
const canOperateSource = uiSource.slice(canOperateStart, canOperateEnd);
assert.doesNotMatch(canOperateSource, /logistics_manager|logistics_dispatcher/);
assert.match(uiSource, /const logisticsResourceOnly = hasLogisticsServiceResourceAccess\(\)/);
assert.match(uiSource, /logisticsResourceOnly\s*\?\s*''/,
  'Logistics resource readers must not be shown the Service Booking operator queue');
assert.match(authorizationSource, /'service:service_booking:confirm'/);

console.log('Service Booking ↔ Logistics Scheduling Authority Boundary: PASS');

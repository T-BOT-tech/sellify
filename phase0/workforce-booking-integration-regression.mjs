import assert from 'node:assert/strict';
import { validateWorkforceRecurrenceRule, workforceAvailabilityCoversBooking, workforceAvailabilityOccurrencesInRange } from '../backend/lib/workforce-recurrence-contract.js';
import {
  WORKFORCE_BOOKING_INTEGRATION_VERSION,
  workforceBookingIntegrationContract,
  isEligibleWorkforceMemberForBooking,
  validateWorkforceBookingLinkage,
  canCreateWorkforceCommitment,
  workforceBookingIntegrationDecision,
} from '../backend/lib/workforce-booking-integration.js';

const validWeeklyRule = validateWorkforceRecurrenceRule('FREQ=WEEKLY;BYDAY=TH;COUNT=4');
assert.equal(validWeeklyRule.valid, true);
assert.equal(validWeeklyRule.parsed.frequency, 'WEEKLY');
assert.equal(validateWorkforceRecurrenceRule('FREQ=MONTHLY').valid, false);
assert.equal(validateWorkforceRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,MO').valid, false);
assert.equal(validateWorkforceRecurrenceRule('FREQ=WEEKLY;COUNT=2;UNTIL=20261231').valid, false);

const recurringAvailability = {
  starts_at: '2026-11-19T06:00:00.000Z',
  ends_at: '2026-11-19T15:00:00.000Z',
  timezone: 'Africa/Addis_Ababa',
  effective_from: '2026-11-19',
  recurrence_rule: 'FREQ=WEEKLY;BYDAY=TH;COUNT=4',
};
assert.equal(workforceAvailabilityCoversBooking(recurringAvailability, {
  requested_start: '2026-11-26T07:00:00.000Z',
  requested_end: '2026-11-26T08:00:00.000Z',
}), true, 'a Thursday occurrence must cover a booking in the recurring local-time window');
assert.equal(workforceAvailabilityCoversBooking(recurringAvailability, {
  requested_start: '2026-11-27T07:00:00.000Z',
  requested_end: '2026-11-27T08:00:00.000Z',
}), false, 'a non-matching weekday must not be treated as available');
const matchingOccurrences = workforceAvailabilityOccurrencesInRange(
  recurringAvailability, '2026-11-26T07:00:00.000Z', '2026-11-26T08:00:00.000Z');
assert.equal(matchingOccurrences.valid, true);
assert.equal(matchingOccurrences.occurrences.length, 1);
assert.equal(matchingOccurrences.occurrences[0].starts_at, '2026-11-26T06:00:00.000Z');
assert.equal(matchingOccurrences.occurrences[0].ends_at, '2026-11-26T15:00:00.000Z');
const partialOccurrence = workforceAvailabilityOccurrencesInRange(
  recurringAvailability, '2026-11-26T05:30:00.000Z', '2026-11-26T06:30:00.000Z');
assert.equal(partialOccurrence.valid, true);
assert.equal(partialOccurrence.occurrences.length, 1,
  'occurrence enumeration must retain partial overlaps for blocking-window assessment');
assert.equal(workforceAvailabilityCoversBooking(recurringAvailability, {
  requested_start: '2026-11-26T05:30:00.000Z',
  requested_end: '2026-11-26T06:30:00.000Z',
}), false, 'partial occurrence overlap is not complete availability coverage');
assert.equal(workforceAvailabilityCoversBooking(recurringAvailability, {
  requested_start: '2026-12-17T07:00:00.000Z',
  requested_end: '2026-12-17T08:00:00.000Z',
}), false, 'COUNT must bound the final recurrence occurrence');
assert.equal(workforceAvailabilityCoversBooking({
  ...recurringAvailability, recurrence_rule: 'FREQ=MONTHLY',
}, {
  requested_start: '2026-11-26T07:00:00.000Z',
  requested_end: '2026-11-26T08:00:00.000Z',
}), false, 'unsupported recurrence features must fail closed');

const dailyAvailability = {
  starts_at: '2026-11-24T06:00:00.000Z',
  ends_at: '2026-11-24T15:00:00.000Z',
  timezone: 'Africa/Addis_Ababa',
  effective_from: '2026-11-24',
  effective_until: '2026-11-30',
  recurrence_rule: 'FREQ=DAILY;INTERVAL=2;COUNT=3',
};
assert.equal(workforceAvailabilityCoversBooking(dailyAvailability, {
  requested_start: '2026-11-26T07:00:00.000Z',
  requested_end: '2026-11-26T08:00:00.000Z',
}), true, 'DAILY INTERVAL must select every second local date');
assert.equal(workforceAvailabilityCoversBooking(dailyAvailability, {
  requested_start: '2026-11-27T07:00:00.000Z',
  requested_end: '2026-11-27T08:00:00.000Z',
}), false, 'DAILY INTERVAL must reject intervening dates');
assert.equal(workforceAvailabilityCoversBooking(dailyAvailability, {
  requested_start: '2026-12-01T07:00:00.000Z',
  requested_end: '2026-12-01T08:00:00.000Z',
}), false, 'effective_until and COUNT must bound recurrence dates');

const untilAvailability = {
  ...recurringAvailability,
  recurrence_rule: 'FREQ=WEEKLY;BYDAY=TH;UNTIL=20261203',
};
assert.equal(workforceAvailabilityCoversBooking(untilAvailability, {
  requested_start: '2026-12-03T07:00:00.000Z',
  requested_end: '2026-12-03T08:00:00.000Z',
}), true, 'UNTIL date is inclusive');
assert.equal(workforceAvailabilityCoversBooking(untilAvailability, {
  requested_start: '2026-12-10T07:00:00.000Z',
  requested_end: '2026-12-10T08:00:00.000Z',
}), false, 'occurrences after UNTIL must be rejected');

const effectiveBoundedAvailability = {
  ...recurringAvailability,
  effective_from: '2026-11-26',
  effective_until: '2026-12-03',
  recurrence_rule: 'FREQ=WEEKLY;BYDAY=TH',
};
assert.equal(workforceAvailabilityCoversBooking(effectiveBoundedAvailability, {
  requested_start: '2026-11-19T07:00:00.000Z',
  requested_end: '2026-11-19T08:00:00.000Z',
}), false, 'effective_from excludes earlier recurrence dates');
assert.equal(workforceAvailabilityCoversBooking(effectiveBoundedAvailability, {
  requested_start: '2026-12-10T07:00:00.000Z',
  requested_end: '2026-12-10T08:00:00.000Z',
}), false, 'effective_until excludes later recurrence dates');

const dstAvailability = {
  starts_at: '2026-03-01T14:00:00.000Z',
  ends_at: '2026-03-01T22:00:00.000Z',
  timezone: 'America/New_York',
  effective_from: '2026-03-01',
  recurrence_rule: 'FREQ=WEEKLY;BYDAY=SU;COUNT=2',
};
assert.equal(workforceAvailabilityCoversBooking(dstAvailability, {
  requested_start: '2026-03-08T13:30:00.000Z',
  requested_end: '2026-03-08T14:30:00.000Z',
}), true, 'recurrence must preserve local wall-clock time across daylight-saving changes');

const contract = workforceBookingIntegrationContract();

assert.equal(contract.contract_version, WORKFORCE_BOOKING_INTEGRATION_VERSION);
assert.equal(contract.capability, 'workforce.membership');
assert.equal(contract.integration, 'service_booking');
assert.equal(contract.organization_scoped, true);
assert.equal(contract.member_scoped, true);
assert.equal(contract.resource_scoped, true);
assert.equal(contract.booking_scoped, true);
assert.equal(contract.reuses_existing_service_booking_authority, true);
assert.equal(contract.reuses_existing_resource_commitment_model, true);
assert.equal(contract.creates_duplicate_booking_authority, false);
assert.equal(contract.creates_duplicate_commitment_authority, false);
assert.equal(contract.provider_appointment_isolation, true);
assert.equal(contract.logistics_request_only, true);

const member = {
  id: 'member-1',
  status: 'ACTIVE',
};

const assignment = {
  member_id: 'member-1',
  status: 'ACTIVE',
  resource_id: 'resource-1',
  location_id: 'location-1',
};

const availability = {
  member_id: 'member-1',
  availability: 'AVAILABLE',
  status: 'ACTIVE',
  resource_id: 'resource-1',
  location_id: 'location-1',
};

assert.equal(isEligibleWorkforceMemberForBooking(member, assignment, availability), true);

const scopedMember = {
  ...member, organization_id: 'org-1', tenant_id: 'tenant-1', chat_id: 'chat-1',
};
const scopedAssignment = {
  ...assignment, organization_id: 'org-1', tenant_id: 'tenant-1', chat_id: 'chat-1',
  starts_at: '2026-11-26T06:00:00.000Z', ends_at: '2026-11-26T15:00:00.000Z',
};
const scopedAvailability = {
  ...availability, organization_id: 'org-1', tenant_id: 'tenant-1', chat_id: 'chat-1',
  status: 'ACTIVE', starts_at: '2026-11-26T07:00:00.000Z', ends_at: '2026-11-26T14:00:00.000Z',
};
const bookingWindow = {
  organization_id: 'org-1', chat_id: 'chat-1',
  requested_start: '2026-11-26T08:00:00.000Z',
  requested_end: '2026-11-26T09:00:00.000Z',
  service_resource_id: 'resource-1', resource_location_id: 'location-1',
};
assert.equal(isEligibleWorkforceMemberForBooking(scopedMember, scopedAssignment, scopedAvailability, bookingWindow), true);
assert.equal(isEligibleWorkforceMemberForBooking(scopedMember, {
  ...scopedAssignment, ends_at: '2026-11-26T08:30:00.000Z',
}, scopedAvailability, bookingWindow), false, 'assignment must cover the complete booking interval');
assert.equal(isEligibleWorkforceMemberForBooking(scopedMember, scopedAssignment, {
  ...scopedAvailability, starts_at: '2026-11-26T08:30:00.000Z',
}, bookingWindow), false, 'availability must cover the complete booking interval');
assert.equal(isEligibleWorkforceMemberForBooking(scopedMember, scopedAssignment, scopedAvailability, {
  ...bookingWindow, organization_id: 'org-2',
}), false, 'cross-organization booking linkage must be denied');

const inactiveMember = { ...member, status: 'SUSPENDED' };
assert.equal(isEligibleWorkforceMemberForBooking(inactiveMember, assignment, availability), false);

const inactiveAssignment = { ...assignment, status: 'SUSPENDED' };
assert.equal(isEligibleWorkforceMemberForBooking(member, inactiveAssignment, availability), false);

const unavailableAvailability = { ...availability, availability: 'UNAVAILABLE' };
assert.equal(isEligibleWorkforceMemberForBooking(member, assignment, unavailableAvailability), false);

const mismatchedResourceAvailability = { ...availability, resource_id: 'resource-2' };
assert.equal(isEligibleWorkforceMemberForBooking(member, assignment, mismatchedResourceAvailability), false);

const mismatchedLocationAvailability = { ...availability, location_id: 'location-2' };
assert.equal(isEligibleWorkforceMemberForBooking(member, assignment, mismatchedLocationAvailability), false);

const validLinkage = validateWorkforceBookingLinkage({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  booking_id: 'booking-1',
  commitment_id: 'commitment-1',
});
assert.equal(validLinkage.valid, true);
assert.deepEqual(validLinkage.errors, []);

const invalidLinkage = validateWorkforceBookingLinkage({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  booking_id: '',
  commitment_id: '',
});
assert.equal(invalidLinkage.valid, false);
assert.ok(invalidLinkage.errors.includes('booking_id must be a non-empty string'));
assert.ok(invalidLinkage.errors.includes('commitment_id must be a non-empty string'));

assert.equal(
  canCreateWorkforceCommitment({
    booking_id: 'booking-1',
    commitment_id: 'commitment-1',
    commitment_source: 'EXISTING_RESOURCE_COMMITMENT_MODEL',
    provider_isolation: 'INTACT',
    logistics_boundary: 'REQUEST_ONLY',
  }),
  true
);

assert.equal(
  canCreateWorkforceCommitment({
    booking_id: 'booking-1',
    commitment_id: 'commitment-1',
    commitment_source: 'WORKFORCE_DIRECT',
    provider_isolation: 'INTACT',
    logistics_boundary: 'REQUEST_ONLY',
  }),
  false
);

assert.equal(
  canCreateWorkforceCommitment({
    booking_id: 'booking-1',
    commitment_id: 'commitment-1',
    commitment_source: 'EXISTING_RESOURCE_COMMITMENT_MODEL',
    provider_isolation: 'BROKEN',
    logistics_boundary: 'REQUEST_ONLY',
  }),
  false
);

assert.equal(
  canCreateWorkforceCommitment({
    booking_id: 'booking-1',
    commitment_id: 'commitment-1',
    commitment_source: 'EXISTING_RESOURCE_COMMITMENT_MODEL',
    provider_isolation: 'INTACT',
    logistics_boundary: 'DIRECT_WRITE',
  }),
  false
);

const decision = workforceBookingIntegrationDecision({
  member,
  assignment,
  availability,
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  booking_id: 'booking-1',
  commitment_id: 'commitment-1',
  commitment_source: 'EXISTING_RESOURCE_COMMITMENT_MODEL',
  provider_isolation: 'INTACT',
  logistics_boundary: 'REQUEST_ONLY',
});

assert.equal(decision.eligible, true);
assert.equal(decision.linkage_valid, true);
assert.equal(decision.commitment_allowed, true);
assert.equal(decision.provider_isolation, 'INTACT');
assert.equal(decision.logistics_boundary, 'REQUEST_ONLY');

const blockedDecision = workforceBookingIntegrationDecision({
  member: inactiveMember,
  assignment,
  availability,
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  booking_id: 'booking-1',
  commitment_id: 'commitment-1',
  commitment_source: 'EXISTING_RESOURCE_COMMITMENT_MODEL',
  provider_isolation: 'INTACT',
  logistics_boundary: 'REQUEST_ONLY',
});

assert.equal(blockedDecision.eligible, false);
assert.equal(blockedDecision.linkage_valid, true);
assert.equal(blockedDecision.commitment_allowed, true);
assert.equal(blockedDecision.provider_isolation, 'INTACT');
assert.equal(blockedDecision.logistics_boundary, 'REQUEST_ONLY');

console.log('Workforce booking integration regression: PASS');

import assert from 'node:assert/strict';
import {
  WORKFORCE_BOOKING_INTEGRATION_VERSION,
  workforceBookingIntegrationContract,
  isEligibleWorkforceMemberForBooking,
  validateWorkforceBookingLinkage,
  canCreateWorkforceCommitment,
  workforceBookingIntegrationDecision,
} from '../backend/lib/workforce-booking-integration.js';

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
  resource_id: 'resource-1',
  location_id: 'location-1',
};

assert.equal(isEligibleWorkforceMemberForBooking(member, assignment, availability), true);

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

/**
 * Canonical Workforce Service Booking integration service.
 *
 * This service provides eligibility and commitment-linkage logic for
 * workforce members in the context of an existing Service Booking authority.
 *
 * It does not create bookings, bypass Service Booking authorization, create
 * logistics tasks, or replace the existing resource-commitment model.
 */

import {
  isValidWorkforceMemberStatus,
} from './workforce-contract.js';
import { workforceAvailabilityCoversBooking } from './workforce-recurrence-contract.js';

export const WORKFORCE_BOOKING_INTEGRATION_VERSION = '1.0';

export function workforceBookingIntegrationContract() {
  return Object.freeze({
    contract_version: WORKFORCE_BOOKING_INTEGRATION_VERSION,
    capability: 'workforce.membership',
    integration: 'service_booking',
    organization_scoped: true,
    member_scoped: true,
    resource_scoped: true,
    booking_scoped: true,
    reuses_existing_service_booking_authority: true,
    reuses_existing_resource_commitment_model: true,
    creates_duplicate_booking_authority: false,
    creates_duplicate_commitment_authority: false,
    provider_appointment_isolation: true,
    logistics_request_only: true,
  });
}

export function isEligibleWorkforceMemberForBooking(member, assignment, availability, booking = null) {
  if (!member || !assignment || !availability) return false;
  if (!isValidWorkforceMemberStatus(member.status) || member.status !== 'ACTIVE') return false;
  if (assignment.status !== 'ACTIVE' || assignment.member_id !== member.id) return false;
  if (availability.availability !== 'AVAILABLE' || availability.status !== 'ACTIVE'
    || availability.member_id !== member.id) return false;
  if (String(member.organization_id) !== String(assignment.organization_id)
    || String(member.tenant_id) !== String(assignment.tenant_id)
    || String(member.chat_id) !== String(assignment.chat_id)
    || String(member.organization_id) !== String(availability.organization_id)
    || String(member.tenant_id) !== String(availability.tenant_id)
    || String(member.chat_id) !== String(availability.chat_id)) return false;
  if (assignment.resource_id && availability.resource_id
    && assignment.resource_id !== availability.resource_id) return false;
  if (assignment.location_id && availability.location_id
    && assignment.location_id !== availability.location_id) return false;

  if (booking) {
    const requestedStart = Date.parse(booking.requested_start);
    const requestedEnd = Date.parse(booking.requested_end);
    const assignmentStart = Date.parse(assignment.starts_at);
    const assignmentEnd = Date.parse(assignment.ends_at);
    if (![requestedStart,requestedEnd,assignmentStart,assignmentEnd].every(Number.isFinite)) return false;
    if (requestedStart >= requestedEnd || assignmentStart > requestedStart || assignmentEnd < requestedEnd
      || !workforceAvailabilityCoversBooking(availability, booking)) return false;
    if (booking.organization_id && String(booking.organization_id) !== String(member.organization_id)) return false;
    if (booking.chat_id && String(booking.chat_id) !== String(member.chat_id)) return false;
    if (booking.service_resource_id && assignment.resource_id
      && String(booking.service_resource_id) !== String(assignment.resource_id)) return false;
    if (booking.resource_location_id && assignment.location_id
      && String(booking.resource_location_id) !== String(assignment.location_id)) return false;
    if (booking.resource_location_id && availability.location_id
      && String(booking.resource_location_id) !== String(availability.location_id)) return false;
    if (availability.resource_id && booking.service_resource_id
      && String(availability.resource_id) !== String(booking.service_resource_id)) return false;
  }
  return true;
}

export function validateWorkforceBookingLinkage(input = {}) {
  const errors = [];
  for (const field of ['organization_id','chat_id','member_id','booking_id','commitment_id']) {
    if (typeof input[field] !== 'string' || input[field].trim() === '') {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  return Object.freeze({ valid: errors.length === 0, errors });
}

export function canCreateWorkforceCommitment(input = {}) {
  if (!input.booking_id) return false;
  if (!input.commitment_id) return false;
  if (!input.commitment_source || input.commitment_source !== 'EXISTING_RESOURCE_COMMITMENT_MODEL') return false;
  if (!input.provider_isolation || input.provider_isolation !== 'INTACT') return false;
  if (!input.logistics_boundary || input.logistics_boundary !== 'REQUEST_ONLY') return false;
  return true;
}

export function workforceBookingIntegrationDecision(input = {}) {
  const eligible = isEligibleWorkforceMemberForBooking(
    input.member,
    input.assignment,
    input.availability
  );

  const linkage = validateWorkforceBookingLinkage(input);
  const commitmentAllowed = canCreateWorkforceCommitment(input);

  return Object.freeze({
    eligible,
    linkage_valid: linkage.valid,
    linkage_errors: linkage.errors,
    commitment_allowed: commitmentAllowed,
    provider_isolation: 'INTACT',
    logistics_boundary: 'REQUEST_ONLY',
  });
}

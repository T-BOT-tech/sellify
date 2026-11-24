import { WORKFORCE_MEMBER_TYPES } from './workforce-contract.js';
import { WORKFORCE_PROFILE_VISIBILITY } from './workforce-profile-contract.js';
import { WORKFORCE_ENGAGEMENT_TYPES } from './workforce-engagement-contract.js';
import { WORKFORCE_CALENDAR_EXCEPTION_TYPES } from './workforce-calendar-contract.js';
import { WORKFORCE_AVAILABILITY_STATES } from './workforce-availability-contract.js';
import { WORKFORCE_ASSIGNMENT_TYPES } from './workforce-assignment-contract.js';
import { WORKFORCE_UTILIZATION_STATUSES } from './workforce-utilization-contract.js';

const ENUM_FIELDS = Object.freeze({
  member_type: WORKFORCE_MEMBER_TYPES,
  visibility: WORKFORCE_PROFILE_VISIBILITY,
  engagement_type: WORKFORCE_ENGAGEMENT_TYPES,
  exception_type: WORKFORCE_CALENDAR_EXCEPTION_TYPES,
  availability: WORKFORCE_AVAILABILITY_STATES,
  assignment_type: WORKFORCE_ASSIGNMENT_TYPES,
  status: WORKFORCE_UTILIZATION_STATUSES,
});

const DATE_PAIRS = Object.freeze({
  engagement: [['starts_at','ends_at']],
  profile: [['effective_from','effective_until']],
  calendar: [['effective_from','effective_until']],
  calendar_exception: [['starts_at','ends_at']],
  availability: [['starts_at','ends_at'],['effective_from','effective_until']],
  assignment: [['starts_at','ends_at']],
  shift: [['starts_at','ends_at']],
  allocation: [['starts_at','ends_at']],
  utilization: [['planned_starts_at','planned_ends_at'],['actual_starts_at','actual_ends_at']],
});

export function validateWorkforceApiPayload(entity, operation, input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return Object.freeze({ valid: false, errors: ['Request body must be a JSON object'] });
  }

  for (const [field, values] of Object.entries(ENUM_FIELDS)) {
    if (input[field] !== undefined && !values.includes(input[field])) {
      errors.push(`Invalid ${field}: ${input[field]}`);
    }
  }

  for (const [startField, endField] of DATE_PAIRS[entity] || []) {
    const start = input[startField], end = input[endField];
    if (start !== undefined && start !== null && Number.isNaN(Date.parse(start))) {
      errors.push(`${startField} must be a valid date/time`);
    }
    if (end !== undefined && end !== null && Number.isNaN(Date.parse(end))) {
      errors.push(`${endField} must be a valid date/time`);
    }
    if (start && end && Date.parse(start) >= Date.parse(end)) {
      errors.push(`${startField} must be before ${endField}`);
    }
  }

  for (const field of ['skills','qualifications','languages','service_capabilities','weekly_schedule','holiday_calendar','break_rules']) {
    if (input[field] !== undefined &&
      (!Array.isArray(input[field]) || input[field].some((value) => typeof value !== 'string'))) {
      errors.push(`${field} must be an array of strings`);
    }
  }

  if (input.all_day !== undefined && typeof input.all_day !== 'boolean') {
    errors.push('all_day must be a boolean');
  }
  if (input.timezone !== undefined &&
    (typeof input.timezone !== 'string' || !input.timezone.trim())) {
    errors.push('timezone must be a non-empty IANA timezone string');
  }
  if (input.expected_version !== undefined &&
    (!Number.isInteger(Number(input.expected_version)) || Number(input.expected_version) < 1)) {
    errors.push('expected_version must be a positive integer');
  }
  if (entity === 'utilization' && operation === 'create' && input.status !== 'PLANNED') {
    errors.push('Utilization events must be created in PLANNED state');
  }

  return Object.freeze({ valid: errors.length === 0, errors });
}

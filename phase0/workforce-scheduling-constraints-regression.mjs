import assert from 'node:assert/strict';
import {
  validateWorkforceSchedulingPolicyRules,
  validateWorkforceSchedulingPolicy,
  evaluateWorkforceSchedulingConstraints,
  workforceSchedulingConstraintsContract,
} from '../backend/lib/workforce-scheduling-constraints-contract.js';

const contract = workforceSchedulingConstraintsContract();
assert.equal(contract.entity, 'workforce_scheduling_policy');
assert.equal(contract.organization_scoped, true);
assert.equal(contract.tenant_scoped, true);
assert.equal(contract.policy_versioned, true);
assert.deepEqual(contract.evaluation_states, ['PASS','WARNING','BLOCKING_CONFLICT','UNKNOWN']);

const validRules = validateWorkforceSchedulingPolicyRules({
  max_shift_minutes: 600, max_daily_minutes: 600, max_weekly_minutes: 2400,
  minimum_rest_minutes: 660, minimum_break_after_minutes: 360,
  minimum_break_duration_minutes: 30, max_consecutive_days: 6,
  required_qualifications: ['First Aid'], location_policy: 'ASSIGNED_ONLY', allow_overrides: true, allow_unknown_overrides: false,
  enforcement: { max_daily_minutes: 'WARN' },
});
assert.equal(validRules.valid, true);
const invalidRules = validateWorkforceSchedulingPolicyRules({
  max_shift_minutes: 0, max_daily_minutes: 2000, unsupported_rule: true, allow_overrides: 'yes',
  required_qualifications: ['First Aid','first aid'], location_policy: 'ANYWHERE',
});
assert.equal(invalidRules.valid, false);
assert.ok(invalidRules.errors.some(error => error.includes('max_shift_minutes')));
assert.ok(invalidRules.errors.some(error => error.includes('Unsupported scheduling rule')));
assert.ok(invalidRules.errors.some(error => error.includes('unique')));
assert.ok(invalidRules.errors.some(error => error.includes('allow_overrides must be a boolean')));
assert.equal(validateWorkforceSchedulingPolicy({
  name: 'Operations', effective_from: '2026-11-25', effective_until: '2026-11-24',
  rules: { max_shift_minutes: 600 },
}).valid, false);

const policy = {
  id: 'policy-a', version: 3, status: 'ACTIVE',
  rules: {
    max_shift_minutes: 600, max_daily_minutes: 600, max_weekly_minutes: 2400,
    minimum_rest_minutes: 660, minimum_break_after_minutes: 360,
    minimum_break_duration_minutes: 30, max_consecutive_days: 6,
    required_qualifications: ['First Aid'], location_policy: 'ASSIGNED_ONLY',
  },
};
const candidate = {
  id: 'candidate-a', member_id: 'member-a',
  starts_at: '2026-11-26T05:00:00.000Z', ends_at: '2026-11-26T13:00:00.000Z',
  timezone: 'Africa/Addis_Ababa', location_id: 'location-a',
  break_rules: [{ start_local_time: '12:00', end_local_time: '12:30' }],
};
const pass = evaluateWorkforceSchedulingConstraints({
  policy, candidate, existing_shifts: [], qualifications: ['First Aid'],
  eligible_location_ids: ['location-a'],
});
assert.equal(pass.state, 'PASS');
assert.equal(pass.policy_id, 'policy-a');
assert.equal(pass.policy_version, 3);
assert.deepEqual(pass.findings, []);

const maxShiftConflict = evaluateWorkforceSchedulingConstraints({
  policy: { ...policy, rules: { max_shift_minutes: 360 } },
  candidate, existing_shifts: [],
});
assert.equal(maxShiftConflict.state, 'BLOCKING_CONFLICT');
assert.ok(maxShiftConflict.findings.some(item => item.code === 'MAX_SHIFT_DURATION'));

const weeklyConflict = evaluateWorkforceSchedulingConstraints({
  policy: { ...policy, rules: { max_weekly_minutes: 900 } },
  candidate,
  existing_shifts: [{ id: 'shift-weekly', starts_at: '2026-11-25T05:00:00.000Z',
    ends_at: '2026-11-25T13:00:00.000Z', status: 'COMPLETED' }],
});
assert.equal(weeklyConflict.state, 'BLOCKING_CONFLICT');
assert.ok(weeklyConflict.findings.some(item => item.code === 'MAX_WEEKLY_HOURS'));

const invalidTimezone = evaluateWorkforceSchedulingConstraints({
  policy, candidate: { ...candidate, timezone: 'Not/A_Real_Zone' }, existing_shifts: [],
});
assert.equal(invalidTimezone.state, 'UNKNOWN');
const overlap = evaluateWorkforceSchedulingConstraints({
  policy, candidate,
  existing_shifts: [{ id: 'shift-overlap', starts_at: '2026-11-26T08:00:00.000Z',
    ends_at: '2026-11-26T09:00:00.000Z', status: 'CONFIRMED' }],
  qualifications: ['First Aid'], eligible_location_ids: ['location-a'],
});
assert.equal(overlap.state, 'BLOCKING_CONFLICT');
assert.ok(overlap.findings.some(item => item.code === 'SHIFT_OVERLAP'));

const dailyWarning = evaluateWorkforceSchedulingConstraints({
  policy: { ...policy, rules: { max_daily_minutes: 540, enforcement: { max_daily_minutes: 'WARN' } } },
  candidate,
  existing_shifts: [{ id: 'shift-evening', starts_at: '2026-11-26T14:00:00.000Z',
    ends_at: '2026-11-26T16:00:00.000Z', status: 'CONFIRMED' }],
});
assert.equal(dailyWarning.state, 'WARNING');
assert.ok(dailyWarning.findings.some(item => item.code === 'MAX_DAILY_HOURS' && item.status === 'WARNING'));

const restConflict = evaluateWorkforceSchedulingConstraints({
  policy: { ...policy, rules: { minimum_rest_minutes: 660 } },
  candidate,
  existing_shifts: [{ id: 'shift-previous', starts_at: '2026-11-25T18:00:00.000Z',
    ends_at: '2026-11-26T00:00:00.000Z', status: 'COMPLETED' }],
});
assert.equal(restConflict.state, 'BLOCKING_CONFLICT');
assert.ok(restConflict.findings.some(item => item.code === 'MINIMUM_REST'));

const breakUnknown = evaluateWorkforceSchedulingConstraints({
  policy: { ...policy, rules: { minimum_break_after_minutes: 360, minimum_break_duration_minutes: 30 } },
  candidate: { ...candidate, break_rules: undefined }, existing_shifts: [],
});
assert.equal(breakUnknown.state, 'UNKNOWN');
assert.ok(breakUnknown.findings.some(item => item.code === 'BREAK_EVIDENCE_UNKNOWN'));

const qualificationConflict = evaluateWorkforceSchedulingConstraints({
  policy: { ...policy, rules: { required_qualifications: ['First Aid'] } },
  candidate, existing_shifts: [], qualifications: [], eligible_location_ids: ['location-a'],
});
assert.equal(qualificationConflict.state, 'BLOCKING_CONFLICT');
assert.ok(qualificationConflict.findings.some(item => item.code === 'QUALIFICATION_REQUIRED'));

const qualificationUnknown = evaluateWorkforceSchedulingConstraints({
  policy: { ...policy, rules: { required_qualifications: ['First Aid'] } },
  candidate, existing_shifts: [],
});
assert.equal(qualificationUnknown.state, 'UNKNOWN');

const locationConflict = evaluateWorkforceSchedulingConstraints({
  policy: { ...policy, rules: { location_policy: 'ASSIGNED_ONLY' } },
  candidate, existing_shifts: [], eligible_location_ids: ['location-b'],
});
assert.equal(locationConflict.state, 'BLOCKING_CONFLICT');
assert.ok(locationConflict.findings.some(item => item.code === 'LOCATION_NOT_ASSIGNED'));

const consecutiveConflict = evaluateWorkforceSchedulingConstraints({
  policy: { ...policy, rules: { max_consecutive_days: 2 } },
  candidate: { ...candidate, starts_at: '2026-11-26T05:00:00.000Z', ends_at: '2026-11-26T13:00:00.000Z' },
  existing_shifts: [
    { id: 'shift-day-24', starts_at: '2026-11-24T05:00:00.000Z', ends_at: '2026-11-24T13:00:00.000Z', status: 'COMPLETED' },
    { id: 'shift-day-25', starts_at: '2026-11-25T05:00:00.000Z', ends_at: '2026-11-25T13:00:00.000Z', status: 'COMPLETED' },
  ],
});
assert.equal(consecutiveConflict.state, 'BLOCKING_CONFLICT');
assert.ok(consecutiveConflict.findings.some(item => item.code === 'MAX_CONSECUTIVE_DAYS'));

const noPolicy = evaluateWorkforceSchedulingConstraints({ candidate, existing_shifts: [] });
assert.equal(noPolicy.state, 'UNKNOWN');

console.log('Workforce scheduling constraints contract regression: PASS');
console.log('Policy validation, policy version provenance, overlap, duration, daily load, rest, breaks, qualifications, location eligibility, consecutive days and four-state evaluation: VERIFIED');

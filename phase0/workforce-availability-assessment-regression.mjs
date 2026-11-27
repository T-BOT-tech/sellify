import assert from 'node:assert/strict';
import {
  WORKFORCE_AVAILABILITY_ASSESSMENT_SOURCES,
  assessWorkforceAvailability,
  validateWorkforceAvailabilityAssessmentCandidate,
  workforceAvailabilityAssessmentContract,
} from '../backend/lib/workforce-availability-assessment-contract.js';

const candidate = {
  organization_id: 'org-test', tenant_id: 'tenant-test', chat_id: 'chat-test', member_id: 'member-test',
  starts_at: '2026-12-01T06:00:00.000Z', ends_at: '2026-12-01T14:00:00.000Z',
  timezone: 'Africa/Addis_Ababa',
};
const completeSources = Object.fromEntries(WORKFORCE_AVAILABILITY_ASSESSMENT_SOURCES.map(source => [source, {
  status: 'COMPLETE', version: 'v1', records: [],
}]));
const evaluate = (overrides = {}) => assessWorkforceAvailability({
  candidate, sources: structuredClone(completeSources), evaluated_at: '2026-11-25T12:00:00.000Z', ...overrides,
});

assert.equal(workforceAvailabilityAssessmentContract().persists_derived_result, false);
assert.equal(validateWorkforceAvailabilityAssessmentCandidate(candidate).valid, true);
assert.equal(validateWorkforceAvailabilityAssessmentCandidate({ ...candidate, ends_at: candidate.starts_at }).valid, false);
assert.equal(validateWorkforceAvailabilityAssessmentCandidate({ ...candidate, timezone: 'Not/A_Timezone' }).valid, false);
assert.equal(evaluate().state, 'AVAILABLE');
assert.equal(evaluate({ findings: [{ code: 'APPROVED_LEAVE', state: 'UNAVAILABLE', source: 'leave_requests', message: 'Approved leave overlaps the requested period' }] }).state, 'UNAVAILABLE');
assert.equal(evaluate({ findings: [{ code: 'SHIFT_OVERLAP', state: 'CONFLICT', source: 'shifts', message: 'A confirmed shift overlaps the requested period' }] }).state, 'CONFLICT');
assert.equal(evaluate({ findings: [{ code: 'SHIFT_OVERLAP', state: 'CONFLICT', source: 'shifts', message: 'A confirmed shift overlaps the requested period' }], sources: { ...structuredClone(completeSources), calendar: { status: 'STALE', version: 'v0' } } }).state, 'UNKNOWN');
assert.equal(evaluate({ sources: { ...structuredClone(completeSources), allocations: { status: 'MISSING' } } }).state, 'UNKNOWN');
assert.equal(evaluate({ sources: { ...structuredClone(completeSources), operational_commitments: { status: 'NOT_APPLICABLE', reason: 'No operational commitment provider is configured for this member' } } }).state, 'AVAILABLE');
assert.equal(evaluate({ sources: { ...structuredClone(completeSources), operational_commitments: { status: 'NOT_APPLICABLE' } } }).state, 'UNKNOWN');
assert.equal(evaluate({ findings: [{ code: 'UNKNOWN_QUALIFICATION', state: 'UNKNOWN', source: 'profile', message: 'Qualification evidence is incomplete' }] }).state, 'UNKNOWN');
assert.equal(evaluate().source_versions.length, WORKFORCE_AVAILABILITY_ASSESSMENT_SOURCES.length);
assert.equal(evaluate().is_booking, false);
console.log('Workforce availability assessment contract regression passed');

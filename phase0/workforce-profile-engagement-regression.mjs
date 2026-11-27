import assert from 'node:assert/strict';
import {
  WORKFORCE_PROFILE_CONTRACT_VERSION,
  WORKFORCE_PROFILE_PERMISSIONS,
  WORKFORCE_PROFILE_VISIBILITY,
  workforceProfileContract,
  isValidWorkforceProfileVisibility,
  validateWorkforceProfile,
  workforceProfilePermission,
} from '../backend/lib/workforce-profile-contract.js';
import {
  WORKFORCE_ENGAGEMENT_CONTRACT_VERSION,
  WORKFORCE_ENGAGEMENT_PERMISSIONS,
  WORKFORCE_ENGAGEMENT_TRANSITIONS,
  workforceEngagementContract,
  canTransitionWorkforceEngagementStatus,
  validateWorkforceEngagement,
  workforceEngagementPermission,
} from '../backend/lib/workforce-engagement-contract.js';

const profileContract = workforceProfileContract();

assert.equal(profileContract.contract_version, WORKFORCE_PROFILE_CONTRACT_VERSION);
assert.equal(profileContract.capability, 'workforce.membership');
assert.equal(profileContract.entity, 'workforce_profile');
assert.equal(profileContract.organization_scoped, true);
assert.equal(profileContract.member_scoped, true);
assert.equal(profileContract.reuses_existing_user_identity, true);
assert.equal(profileContract.reuses_existing_organization_authority, true);
assert.equal(profileContract.creates_duplicate_user_identity, false);
assert.deepEqual(profileContract.visibility, WORKFORCE_PROFILE_VISIBILITY);
assert.deepEqual(profileContract.permissions, WORKFORCE_PROFILE_PERMISSIONS);

assert.equal(isValidWorkforceProfileVisibility('PRIVATE'), true);
assert.equal(isValidWorkforceProfileVisibility('ORGANIZATION'), true);
assert.equal(isValidWorkforceProfileVisibility('LOCATION'), true);
assert.equal(isValidWorkforceProfileVisibility('PUBLIC'), true);
assert.equal(isValidWorkforceProfileVisibility('SECRET'), false);

const validProfile = validateWorkforceProfile({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  effective_from: '2026-01-01T00:00:00.000Z',
  expected_version: 1,
  visibility: 'ORGANIZATION',
  skills: ['plumbing'],
  qualifications: ['license'],
  languages: ['en'],
  service_capabilities: ['emergency-repair'],
});
assert.equal(validProfile.valid, true);
assert.deepEqual(validProfile.errors, []);

const invalidProfile = validateWorkforceProfile({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  effective_from: '2026-01-01T00:00:00.000Z',
  expected_version: 0,
  visibility: 'SECRET',
  skills: 'plumbing',
});
assert.equal(invalidProfile.valid, false);
assert.ok(invalidProfile.errors.includes('expected_version must be a positive integer'));
assert.ok(invalidProfile.errors.includes('Invalid visibility: SECRET'));
assert.ok(invalidProfile.errors.includes('skills must be an array of strings'));

assert.equal(workforceProfilePermission('view'), 'workforce:profile:view');
assert.equal(workforceProfilePermission('update'), 'workforce:profile:manage');

const engagementContract = workforceEngagementContract();

assert.equal(engagementContract.contract_version, WORKFORCE_ENGAGEMENT_CONTRACT_VERSION);
assert.equal(engagementContract.capability, 'workforce.membership');
assert.equal(engagementContract.entity, 'workforce_engagement');
assert.equal(engagementContract.organization_scoped, true);
assert.equal(engagementContract.member_scoped, true);
assert.equal(engagementContract.reuses_existing_user_identity, true);
assert.equal(engagementContract.reuses_existing_organization_authority, true);
assert.equal(engagementContract.creates_duplicate_user_identity, false);
assert.deepEqual(engagementContract.transitions, WORKFORCE_ENGAGEMENT_TRANSITIONS);
assert.deepEqual(engagementContract.permissions, WORKFORCE_ENGAGEMENT_PERMISSIONS);

assert.equal(canTransitionWorkforceEngagementStatus('DRAFT', 'PENDING_APPROVAL'), true);
assert.equal(canTransitionWorkforceEngagementStatus('DRAFT', 'ENDED'), true);
assert.equal(canTransitionWorkforceEngagementStatus('PENDING_APPROVAL', 'ACTIVE'), true);
assert.equal(canTransitionWorkforceEngagementStatus('PENDING_APPROVAL', 'ENDED'), true);
assert.equal(canTransitionWorkforceEngagementStatus('ACTIVE', 'SUSPENDED'), true);
assert.equal(canTransitionWorkforceEngagementStatus('ACTIVE', 'ENDED'), true);
assert.equal(canTransitionWorkforceEngagementStatus('SUSPENDED', 'ACTIVE'), true);
assert.equal(canTransitionWorkforceEngagementStatus('SUSPENDED', 'ENDED'), true);
assert.equal(canTransitionWorkforceEngagementStatus('ENDED', 'ACTIVE'), false);
assert.equal(canTransitionWorkforceEngagementStatus('DRAFT', 'ACTIVE'), false);
assert.equal(canTransitionWorkforceEngagementStatus('UNKNOWN', 'ACTIVE'), false);
assert.equal(canTransitionWorkforceEngagementStatus('ACTIVE', 'UNKNOWN'), false);

const validEngagement = validateWorkforceEngagement({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  engagement_type: 'EMPLOYMENT',
  starts_at: '2026-01-01T00:00:00.000Z',
  expected_version: 1,
});
assert.equal(validEngagement.valid, true);
assert.deepEqual(validEngagement.errors, []);

const invalidEngagement = validateWorkforceEngagement({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  engagement_type: 'FREELANCE',
  starts_at: '2026-01-01T00:00:00.000Z',
  expected_version: 0,
});
assert.equal(invalidEngagement.valid, false);
assert.ok(invalidEngagement.errors.includes('Invalid engagement_type: FREELANCE'));
assert.ok(invalidEngagement.errors.includes('expected_version must be a positive integer'));

assert.equal(workforceEngagementPermission('view'), 'workforce:engagement:view');
assert.equal(workforceEngagementPermission('update'), 'workforce:engagement:manage');

console.log('Workforce profile and engagement contract regression: PASS');

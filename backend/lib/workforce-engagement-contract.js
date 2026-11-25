/**
 * Canonical Workforce engagement contract.
 *
 * A workforce engagement represents an organization-scoped relationship
 * between an existing workforce member and an organization. It does not
 * create a second user, organization, tenant, booking, supplier-network,
 * logistics, inventory, payment, fulfillment, or catalog authority.
 */

export const WORKFORCE_ENGAGEMENT_CONTRACT_VERSION = '1.0';

export const WORKFORCE_ENGAGEMENT_PERMISSIONS = Object.freeze({
  view: 'workforce:engagement:view',
  manage: 'workforce:engagement:manage',
});

export const WORKFORCE_ENGAGEMENT_TYPES = Object.freeze([
  'EMPLOYMENT',
  'CONTRACT',
  'PROVIDER_RELATIONSHIP',
  'VOLUNTEER',
  'INTERNAL_ASSIGNMENT',
]);

export const WORKFORCE_ENGAGEMENT_STATUSES = Object.freeze([
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
  'ENDED',
]);

export const WORKFORCE_ENGAGEMENT_TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze(['PENDING_APPROVAL', 'ENDED']),
  PENDING_APPROVAL: Object.freeze(['ACTIVE', 'ENDED']),
  ACTIVE: Object.freeze(['SUSPENDED', 'ENDED']),
  SUSPENDED: Object.freeze(['ACTIVE', 'ENDED']),
  ENDED: Object.freeze([]),
});

export const WORKFORCE_ENGAGEMENT_REQUIRED_FIELDS = Object.freeze([
  'organization_id',
  'chat_id',
  'member_id',
  'engagement_type',
  'starts_at',
  'expected_version',
]);

export function workforceEngagementContract() {
  return Object.freeze({
    contract_version: WORKFORCE_ENGAGEMENT_CONTRACT_VERSION,
    capability: 'workforce.membership',
    entity: 'workforce_engagement',
    organization_scoped: true,
    member_scoped: true,
    reuses_existing_user_identity: true,
    reuses_existing_organization_authority: true,
    creates_duplicate_user_identity: false,
    permissions: WORKFORCE_ENGAGEMENT_PERMISSIONS,
    engagement_types: WORKFORCE_ENGAGEMENT_TYPES,
    statuses: WORKFORCE_ENGAGEMENT_STATUSES,
    transitions: WORKFORCE_ENGAGEMENT_TRANSITIONS,
    required_fields: WORKFORCE_ENGAGEMENT_REQUIRED_FIELDS,
  });
}

export function isValidWorkforceEngagementType(value) {
  return WORKFORCE_ENGAGEMENT_TYPES.includes(value);
}

export function isValidWorkforceEngagementStatus(value) {
  return WORKFORCE_ENGAGEMENT_STATUSES.includes(value);
}

export function canTransitionWorkforceEngagementStatus(currentStatus, nextStatus) {
  if (!isValidWorkforceEngagementStatus(currentStatus)) return false;
  if (!isValidWorkforceEngagementStatus(nextStatus)) return false;
  return WORKFORCE_ENGAGEMENT_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function validateWorkforceEngagement(input = {}) {
  const errors = [];

  for (const field of WORKFORCE_ENGAGEMENT_REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (
    input.engagement_type !== undefined &&
    !isValidWorkforceEngagementType(input.engagement_type)
  ) {
    errors.push(`Invalid engagement_type: ${input.engagement_type}`);
  }

  if (
    input.expected_version !== undefined &&
    (!Number.isInteger(input.expected_version) || input.expected_version < 1)
  ) {
    errors.push('expected_version must be a positive integer');
  }

  return Object.freeze({ valid: errors.length === 0, errors });
}

export function workforceEngagementPermission(action) {
  if (action === 'view') return WORKFORCE_ENGAGEMENT_PERMISSIONS.view;
  return WORKFORCE_ENGAGEMENT_PERMISSIONS.manage;
}

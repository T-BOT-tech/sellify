/**
 * Canonical Workforce profile contract.
 *
 * A workforce profile describes organization-scoped skills, qualifications,
 * languages, service capabilities, and visibility for an existing workforce
 * member. It does not create a second user, organization, tenant, booking,
 * supplier-network, logistics, inventory, payment, fulfillment, or catalog
 * authority.
 */

export const WORKFORCE_PROFILE_CONTRACT_VERSION = '1.0';

export const WORKFORCE_PROFILE_PERMISSIONS = Object.freeze({
  view: 'workforce:profile:view',
  manage: 'workforce:profile:manage',
});

export const WORKFORCE_PROFILE_VISIBILITY = Object.freeze([
  'PRIVATE',
  'ORGANIZATION',
  'LOCATION',
  'PUBLIC',
]);

export const WORKFORCE_PROFILE_REQUIRED_FIELDS = Object.freeze([
  'organization_id',
  'chat_id',
  'member_id',
  'effective_from',
  'expected_version',
]);

export const WORKFORCE_PROFILE_STRUCTURED_FIELDS = Object.freeze([
  'skills',
  'qualifications',
  'languages',
  'service_capabilities',
]);

export function workforceProfileContract() {
  return Object.freeze({
    contract_version: WORKFORCE_PROFILE_CONTRACT_VERSION,
    capability: 'workforce.membership',
    entity: 'workforce_profile',
    organization_scoped: true,
    member_scoped: true,
    reuses_existing_user_identity: true,
    reuses_existing_organization_authority: true,
    creates_duplicate_user_identity: false,
    permissions: WORKFORCE_PROFILE_PERMISSIONS,
    visibility: WORKFORCE_PROFILE_VISIBILITY,
    required_fields: WORKFORCE_PROFILE_REQUIRED_FIELDS,
    structured_fields: WORKFORCE_PROFILE_STRUCTURED_FIELDS,
  });
}

export function isValidWorkforceProfileVisibility(value) {
  return WORKFORCE_PROFILE_VISIBILITY.includes(value);
}

export function validateWorkforceProfile(input = {}) {
  const errors = [];

  for (const field of WORKFORCE_PROFILE_REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (
    input.visibility !== undefined &&
    !isValidWorkforceProfileVisibility(input.visibility)
  ) {
    errors.push(`Invalid visibility: ${input.visibility}`);
  }

  if (
    input.expected_version !== undefined &&
    (!Number.isInteger(input.expected_version) || input.expected_version < 1)
  ) {
    errors.push('expected_version must be a positive integer');
  }

  for (const field of WORKFORCE_PROFILE_STRUCTURED_FIELDS) {
    if (
      input[field] !== undefined &&
      (!Array.isArray(input[field]) || input[field].some((item) => typeof item !== 'string'))
    ) {
      errors.push(`${field} must be an array of strings`);
    }
  }

  return Object.freeze({ valid: errors.length === 0, errors });
}

export function workforceProfilePermission(action) {
  if (action === 'view') return WORKFORCE_PROFILE_PERMISSIONS.view;
  return WORKFORCE_PROFILE_PERMISSIONS.manage;
}

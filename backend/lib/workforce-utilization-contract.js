/**
 * Canonical Workforce utilization contract.
 *
 * Workforce utilization records actual work performed. It is separate from
 * declared availability and from a confirmed commitment.
 */

export const WORKFORCE_UTILIZATION_CONTRACT_VERSION = '1.0';

export const WORKFORCE_UTILIZATION_PERMISSIONS = Object.freeze({
  view: 'workforce:utilization:view',
  manage: 'workforce:utilization:manage',
});

export const WORKFORCE_UTILIZATION_STATUSES = Object.freeze([
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const WORKFORCE_UTILIZATION_REQUIRED_FIELDS = Object.freeze([
  'organization_id',
  'chat_id',
  'member_id',
  'planned_starts_at',
  'planned_ends_at',
  'status',
  'evidence_source',
]);

export function workforceUtilizationContract() {
  return Object.freeze({
    contract_version: WORKFORCE_UTILIZATION_CONTRACT_VERSION,
    capability: 'workforce.membership',
    entity: 'workforce_utilization_event',
    organization_scoped: true,
    member_scoped: true,
    resource_scoped: true,
    booking_scoped: true,
    operational_task_scoped: true,
    reuses_existing_user_identity: true,
    reuses_existing_organization_authority: true,
    creates_duplicate_user_identity: false,
    permissions: WORKFORCE_UTILIZATION_PERMISSIONS,
    statuses: WORKFORCE_UTILIZATION_STATUSES,
    required_fields: WORKFORCE_UTILIZATION_REQUIRED_FIELDS,
  });
}

export function isValidWorkforceUtilizationStatus(value) {
  return WORKFORCE_UTILIZATION_STATUSES.includes(value);
}

export function validateWorkforceUtilization(input = {}) {
  const errors = [];

  for (const field of WORKFORCE_UTILIZATION_REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (
    input.status !== undefined &&
    !isValidWorkforceUtilizationStatus(input.status)
  ) {
    errors.push(`Invalid status: ${input.status}`);
  }

  for (const field of [
    'planned_starts_at', 'planned_ends_at', 'actual_starts_at', 'actual_ends_at',
  ]) {
    const value = input[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
      errors.push(`${field} must be a valid ISO-8601 timestamp`);
      continue;
    }
    if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
      errors.push(`${field} must include an explicit timezone`);
    }
  }

  if (
    Number.isFinite(Date.parse(input.planned_starts_at)) &&
    Number.isFinite(Date.parse(input.planned_ends_at)) &&
    Date.parse(input.planned_starts_at) >= Date.parse(input.planned_ends_at)
  ) {
    errors.push('planned_starts_at must be before planned_ends_at');
  }

  if (
    input.actual_starts_at !== undefined &&
    input.actual_starts_at !== null &&
    input.actual_ends_at !== undefined &&
    input.actual_ends_at !== null &&
    Number.isFinite(Date.parse(input.actual_starts_at)) &&
    Number.isFinite(Date.parse(input.actual_ends_at)) &&
    Date.parse(input.actual_starts_at) >= Date.parse(input.actual_ends_at)
  ) {
    errors.push('actual_starts_at must be before actual_ends_at');
  }

  if (typeof input.evidence_source !== 'string' || !input.evidence_source.trim()) {
    errors.push('evidence_source must be a non-empty string');
  }

  if (
    input.expected_version !== undefined &&
    (!Number.isInteger(input.expected_version) || input.expected_version < 1)
  ) {
    errors.push('expected_version must be a positive integer');
  }

  return Object.freeze({ valid: errors.length === 0, errors });
}

export function workforceUtilizationPermission(action) {
  if (action === 'view') return WORKFORCE_UTILIZATION_PERMISSIONS.view;
  return WORKFORCE_UTILIZATION_PERMISSIONS.manage;
}

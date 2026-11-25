/**
 * Canonical Workforce persistence repository contract.
 *
 * The contract deliberately describes entity-specific lifecycle operations.
 * A single generic lifecycle is unsafe because shifts, allocations,
 * engagements, and members have different approval and terminal states.
 */
export const WORKFORCE_REPOSITORY_CONTRACT_VERSION = '1.7';

export const WORKFORCE_REPOSITORY_ENTITIES = Object.freeze([
  'department','position','shift_template',
  'member',
  'profile',
  'engagement',
  'calendar',
  'calendar_exception',
  'availability',
  'assignment',
  'shift',
  'allocation',
  'utilization',
  'leave_request',
  'absence','scheduling_policy',
]);

export const WORKFORCE_REPOSITORY_BASE_OPERATIONS = Object.freeze([
  'create',
  'get',
  'list',
  'update',
]);

export const WORKFORCE_REPOSITORY_ENTITY_OPERATIONS = Object.freeze({
  department: Object.freeze(['create','get','list','update','activate','deactivate']),
  position: Object.freeze(['create','get','list','update','activate','deactivate']),
  shift_template: Object.freeze(['create','get','list','update','activate','deactivate','generate']),
  member: Object.freeze(['create', 'get', 'list', 'update', 'activate', 'suspend', 'deactivate', 'link_account', 'unlink_account']),
  profile: Object.freeze(['create', 'get', 'list', 'update']),
  engagement: Object.freeze(['create', 'get', 'list', 'update', 'submit', 'activate', 'suspend', 'end']),
  calendar: Object.freeze(['create', 'get', 'list', 'update']),
  calendar_exception: Object.freeze(['create', 'get', 'list', 'update', 'cancel']),
  availability: Object.freeze(['create', 'get', 'list', 'update']),
  assignment: Object.freeze(['create', 'get', 'list', 'update', 'activate', 'suspend', 'end']),
  shift: Object.freeze(['create', 'get', 'list', 'update', 'confirm', 'start', 'complete', 'cancel', 'reassign']),
  allocation: Object.freeze(['create', 'get', 'list', 'update', 'submit', 'approve', 'release', 'cancel']),
  utilization: Object.freeze(['create', 'get', 'list', 'update', 'start', 'complete', 'cancel']),
  leave_request: Object.freeze(['create','get','list','update','submit','approve','reject','withdraw','cancel']),
  absence: Object.freeze(['create','get','list','update','void']),
  scheduling_policy: Object.freeze(['create','get','list','update','activate','deactivate']),
});

export const WORKFORCE_REPOSITORY_OPERATIONS = Object.freeze([
  ...new Set(Object.values(WORKFORCE_REPOSITORY_ENTITY_OPERATIONS).flat()),
]);

export const WORKFORCE_REPOSITORY_REQUIRED_CONTEXT = Object.freeze([
  'organization_id',
  'tenant_id',
]);

export const WORKFORCE_REPOSITORY_IDEMPOTENT_OPERATIONS = Object.freeze(['create']);

export const WORKFORCE_REPOSITORY_VERSIONED_OPERATIONS = Object.freeze(
  WORKFORCE_REPOSITORY_OPERATIONS.filter((operation) => !['create', 'get', 'list'].includes(operation)),
);

export function workforceRepositoryContract() {
  return Object.freeze({
    contract_version: WORKFORCE_REPOSITORY_CONTRACT_VERSION,
    capability: 'workforce.membership',
    persistence_ready: true,
    organization_scoped: true,
    tenant_scoped: true,
    resource_scoped_assignments: true,
    entity_specific_lifecycle: true,
    reuses_existing_user_identity: true,
    supports_optional_identity_link: true,
    supports_leave_request_approval: true,
    supports_unplanned_absence_recording: true,
    supports_versioned_scheduling_policies: true,
    pending_leave_blocks_availability: false,
    approved_leave_blocks_availability: true,
    recorded_absence_blocks_availability: true,
    supports_account_linking: true,
    reuses_existing_organization_authority: true,
    creates_duplicate_user_identity: false,
    entities: WORKFORCE_REPOSITORY_ENTITIES,
    operations: WORKFORCE_REPOSITORY_OPERATIONS,
    entity_operations: WORKFORCE_REPOSITORY_ENTITY_OPERATIONS,
    required_context: WORKFORCE_REPOSITORY_REQUIRED_CONTEXT,
    idempotent_operations: WORKFORCE_REPOSITORY_IDEMPOTENT_OPERATIONS,
    versioned_operations: WORKFORCE_REPOSITORY_VERSIONED_OPERATIONS,
  });
}

export function validateWorkforceRepositoryContext(context = {}) {
  const errors = [];
  for (const field of WORKFORCE_REPOSITORY_REQUIRED_CONTEXT) {
    if (typeof context[field] !== 'string' || context[field].trim() === '') {
      errors.push(`Missing required context: ${field}`);
    }
  }
  return Object.freeze({ valid: errors.length === 0, errors });
}

export function validateWorkforceRepositoryOperation(entity, operation, input = {}) {
  const errors = [];

  if (!WORKFORCE_REPOSITORY_ENTITIES.includes(entity)) {
    errors.push(`Invalid entity: ${entity}`);
  }

  if (!WORKFORCE_REPOSITORY_OPERATIONS.includes(operation)) {
    errors.push(`Invalid operation: ${operation}`);
  } else if (
    WORKFORCE_REPOSITORY_ENTITY_OPERATIONS[entity] &&
    !WORKFORCE_REPOSITORY_ENTITY_OPERATIONS[entity].includes(operation)
  ) {
    errors.push(`Operation ${operation} is not supported for entity: ${entity}`);
  }

  errors.push(...validateWorkforceRepositoryContext(input).errors);

  if (WORKFORCE_REPOSITORY_IDEMPOTENT_OPERATIONS.includes(operation)) {
    if (typeof input.idempotency_key !== 'string' || input.idempotency_key.trim() === '') {
      errors.push(`Missing required idempotency_key for ${operation}`);
    }
  }

  if (WORKFORCE_REPOSITORY_VERSIONED_OPERATIONS.includes(operation)) {
    if (input.expected_version === undefined || input.expected_version === null) {
      errors.push(`Missing required expected_version for ${operation}`);
    } else if (!Number.isInteger(input.expected_version) || input.expected_version < 1) {
      errors.push('expected_version must be a positive integer');
    }
  }

  return Object.freeze({ valid: errors.length === 0, errors });
}

export function workforceRepositoryCapability() {
  return Object.freeze({
    supports_organization_scope: true,
    supports_tenant_scope: true,
    supports_resource_scope: true,
    supports_entity_specific_lifecycle: true,
    supports_idempotency: true,
    supports_optimistic_concurrency: true,
    supports_authorization: true,
    supports_audit_provenance: true,
    supports_leave_request_approval: true,
    supports_unplanned_absence_recording: true,
    pending_leave_blocks_availability: false,
    approved_leave_blocks_availability: true,
    recorded_absence_blocks_availability: true,
  });
}

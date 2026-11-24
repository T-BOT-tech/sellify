/**
 * Canonical Workforce persistence-ready repository contract.
 *
 * This contract defines the repository interface for Workforce entities.
 * It is persistence-ready but does not implement SQLite, migrations, APIs,
 * or production runtime behavior.
 */

export const WORKFORCE_REPOSITORY_CONTRACT_VERSION = '1.0';

export const WORKFORCE_REPOSITORY_ENTITIES = Object.freeze([
  'member',
  'profile',
  'engagement',
  'calendar',
  'availability',
  'assignment',
  'shift',
  'allocation',
  'utilization',
]);

export const WORKFORCE_REPOSITORY_OPERATIONS = Object.freeze([
  'create',
  'get',
  'list',
  'update',
  'activate',
  'suspend',
  'deactivate',
  'release',
  'cancel',
]);

export const WORKFORCE_REPOSITORY_REQUIRED_CONTEXT = Object.freeze([
  'organization_id',
  'tenant_id',
]);

export const WORKFORCE_REPOSITORY_IDEMPOTENT_OPERATIONS = Object.freeze([
  'create',
]);

export const WORKFORCE_REPOSITORY_VERSIONED_OPERATIONS = Object.freeze([
  'update',
  'activate',
  'suspend',
  'deactivate',
  'release',
  'cancel',
]);

export function workforceRepositoryContract() {
  return Object.freeze({
    contract_version: WORKFORCE_REPOSITORY_CONTRACT_VERSION,
    capability: 'workforce.membership',
    persistence_ready: true,
    organization_scoped: true,
    tenant_scoped: true,
    reuses_existing_user_identity: true,
    reuses_existing_organization_authority: true,
    creates_duplicate_user_identity: false,
    entities: WORKFORCE_REPOSITORY_ENTITIES,
    operations: WORKFORCE_REPOSITORY_OPERATIONS,
    required_context: WORKFORCE_REPOSITORY_REQUIRED_CONTEXT,
    idempotent_operations: WORKFORCE_REPOSITORY_IDEMPOTENT_OPERATIONS,
    versioned_operations: WORKFORCE_REPOSITORY_VERSIONED_OPERATIONS,
  });
}

export function validateWorkforceRepositoryContext(context = {}) {
  const errors = [];

  for (const field of WORKFORCE_REPOSITORY_REQUIRED_CONTEXT) {
    if (!context[field]) {
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
  }

  const context = validateWorkforceRepositoryContext(input);
  errors.push(...context.errors);

  if (WORKFORCE_REPOSITORY_IDEMPOTENT_OPERATIONS.includes(operation) && !input.idempotency_key) {
    errors.push(`Missing required idempotency_key for ${operation}`);
  }

  if (WORKFORCE_REPOSITORY_VERSIONED_OPERATIONS.includes(operation)) {
    if (!input.expected_version) {
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
    supports_idempotency: true,
    supports_optimistic_concurrency: true,
    supports_authorization: true,
    supports_audit_provenance: true,
  });
}

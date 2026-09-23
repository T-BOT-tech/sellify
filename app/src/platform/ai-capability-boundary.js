// Phase 16.10 — AI Capability Boundary.
//
// AI may express a structured intent and request capability discovery/resolution,
// but it never receives direct persistence, database, credential, transaction,
// ledger, authorization, or domain execution authority.
//
// Flow:
// AI → Structured Intent → Capability Contract → Existing Authorization → Existing Authority
// Execution remains outside this module.

import { getPlatformCapability, resolveCapabilityAction } from './capability-contract.js';
import { resolveAuthorityForCapability } from './authority-registry.js';

export const PLATFORM_AI_CAPABILITY_BOUNDARY_VERSION = '1.0';

const FORBIDDEN_INTENT_FIELDS = Object.freeze([
  'sql', 'query', 'database', 'store', 'persistence', 'credentials', 'secrets',
  'token', 'authorizationGrant', 'transactionHandle', 'ledger', 'eventStore',
  'broker', 'rawCommand', 'directExecution', 'providerCredentials',
]);

const MUTATION_ACTIONS = new Set(['create', 'delete', 'manage', 'add', 'edit', 'accept', 'reconcile']);

function invalid(message) {
  const error = new Error(`Invalid AI capability boundary request: ${message}`);
  error.code = 'PLATFORM_AI_INTENT_INVALID';
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}

function assertPlainObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be an object`);
}

function assertNoForbiddenFields(input) {
  for (const field of FORBIDDEN_INTENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) invalid(`AI intent cannot contain ${field}`);
  }
}

function normalizeScope(scope) {
  if (scope === undefined || scope === null) return Object.freeze({});
  assertPlainObject(scope, 'scope');
  const allowed = ['organizationId', 'locationId', 'countryCode', 'vertical'];
  for (const key of Object.keys(scope)) if (!allowed.includes(key)) invalid(`unsupported scope field: ${key}`);
  const result = {};
  for (const key of allowed) if (scope[key] !== undefined && scope[key] !== null) result[key] = text(String(scope[key]), `scope.${key}`);
  return Object.freeze(result);
}

export function defineAiCapabilityIntent(input) {
  assertPlainObject(input, 'intent');
  assertNoForbiddenFields(input);
  const capability = text(input.capability, 'capability').toLowerCase();
  const action = text(input.action, 'action').toLowerCase();
  const reason = input.reason === undefined ? null : text(input.reason, 'reason');
  const scope = normalizeScope(input.scope);
  const resolved = resolveCapabilityAction(capability, action);
  return Object.freeze({
    intent_version: PLATFORM_AI_CAPABILITY_BOUNDARY_VERSION,
    capability: resolved.capability,
    action: resolved.action,
    resource: resolved.resource,
    reason,
    scope,
    mode: 'request_only',
    execution: 'none',
    authorization: 'existing_authorization',
    persistence: 'none',
  });
}

export function resolveAiCapabilityIntent(intent) {
  const normalized = defineAiCapabilityIntent(intent);
  const capability = getPlatformCapability(normalized.capability);
  const authority = resolveAuthorityForCapability(normalized.capability);
  const mutation = MUTATION_ACTIONS.has(normalized.action);
  return Object.freeze({
    ...normalized,
    capabilityStatus: capability.status,
    authority: authority.authority,
    authorityModule: authority.authorityModule,
    risk: mutation ? 'mutation' : 'read',
    requiresExistingAuthorization: true,
    approvalBoundary: mutation ? 'existing_approval_policy' : 'none',
    executable: false,
  });
}

export function assertAiCapabilityBoundary(input) {
  const resolved = resolveAiCapabilityIntent(input);
  if (resolved.execution !== 'none' || resolved.persistence !== 'none' || !resolved.requiresExistingAuthorization) {
    invalid('AI boundary invariants violated');
  }
  return true;
}

export function platformAiCapabilityBoundaryContract() {
  return Object.freeze({
    version: PLATFORM_AI_CAPABILITY_BOUNDARY_VERSION,
    input: 'structured_intent_only',
    discovery: 'canonical_capability_contracts',
    authorization: 'existing_authorization',
    execution: 'none',
    persistence: 'none',
    transactionAuthority: 'existing_domain_transaction',
    eventAuthority: 'existing_versioned_event_outbox',
    directDatabaseAccess: false,
    directCredentialsAccess: false,
    directExecution: false,
    approval: 'existing_approval_policy',
  });
}

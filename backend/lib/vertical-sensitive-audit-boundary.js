// Phase 13.12.10 — Sensitive-action audit boundary.
//
// Persistence-neutral adapter over the existing audit authority. Sensitive
// vertical authorization/mutation outcomes must have audit evidence, but this
// module never creates an audit store, logger, event store, or authorization
// policy.

import { AUTHZ } from './authorization.js';
import { getResourceAction } from './resource-action-registry.js';
import { buildAuditRecord, recordAudit } from '../../app/src/audit/audit-boundary.js';

const SENSITIVE_ACTIONS = new Set(['manage']);
const AUDIT_RESULTS = new Set(['success', 'failure', 'denied', 'rejected']);

export function isSensitiveVerticalAction(packId, resource, action) {
  const entry = getResourceAction(packId, resource, action);
  return Boolean(entry && SENSITIVE_ACTIONS.has(entry.action));
}

function requireSensitiveEntry(packId, resource, action) {
  const entry = getResourceAction(packId, resource, action);
  if (!entry) throw new TypeError(`Unknown vertical capability: ${packId}:${resource}:${action}`);
  if (!SENSITIVE_ACTIONS.has(entry.action)) return null;
  return entry;
}

export function buildSensitiveActionAuditRecord({
  session,
  tenant,
  location = null,
  packId,
  resource,
  action,
  decision,
  result,
  entityId = null,
  reason = '',
  correlationId = null,
  causationId = null,
  eventId = null,
  metadata = {},
  occurredAt = null,
} = {}) {
  const entry = requireSensitiveEntry(packId, resource, action);
  if (!entry) return null;
  if (!Object.values(AUTHZ).includes(decision)) {
    throw new TypeError('Audit authorization decision is invalid');
  }
  const normalizedResult = String(result || '').trim().toLowerCase();
  if (!AUDIT_RESULTS.has(normalizedResult)) {
    throw new TypeError('Audit result is invalid');
  }

  return buildAuditRecord({
    organizationId: tenant?.organizationId ?? session?.organizationId ?? null,
    chatId: tenant?.chatId ?? session?.chatId ?? null,
    locationId: location?.id ?? session?.locationId ?? null,
    actorId: session?.userId ?? null,
    deviceId: session?.deviceId ?? null,
    action: `vertical.${entry.packId}.${entry.resource}.${entry.action}`,
    entityType: `${entry.packId}.${entry.resource}`,
    entityId,
    reason: reason || `authorization=${decision}`,
    result: normalizedResult,
    correlationId,
    causationId,
    eventId,
    metadata: {
      ...metadata,
      packId: entry.packId,
      resource: entry.resource,
      action: entry.action,
      authorizationDecision: decision,
    },
    occurredAt,
  });
}

export function recordSensitiveActionAudit(record, persist) {
  return recordAudit(record, persist);
}

export function sensitiveActionAuditBoundaryContract() {
  return Object.freeze({
    audit_authority: 'existing backend audit_events / recordAuditEvent()',
    sensitive_actions: Object.freeze(['manage']),
    authorization_authority: 'backend/lib/authorization.js',
    registry_authority: 'backend/lib/resource-action-registry.js',
    record_contract: 'app/src/audit/audit-boundary.js',
    persistence: 'existing audit_events only',
    audit_store: 'none',
    logger_authority: 'none',
    telemetry_backend: 'none',
    event_store: 'none',
    policy_authority: 'none',
  });
}

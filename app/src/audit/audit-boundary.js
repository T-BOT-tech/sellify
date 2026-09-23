// Phase 13.11.15 — canonical audit / observability boundary.
//
// Persistence-neutral contract over the existing Core audit authority. This
// module normalizes correlation and tenant context for authoritative actions;
// it does not create an audit store, logger, telemetry backend, or event bus.

const RESULT_VALUES = new Set(['success', 'failure', 'denied', 'rejected']);

function text(value, field, required = false) {
  if (value == null || String(value).trim() === '') {
    if (required) throw new TypeError(`Audit ${field} must be a non-empty string`);
    return null;
  }
  return String(value).trim();
}

function object(value, field) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Audit ${field} must be an object`);
  }
  return value;
}

export function buildAuditRecord({
  organizationId,
  chatId = null,
  locationId = null,
  actorId = null,
  deviceId = null,
  action,
  entityType,
  entityId = null,
  reason = '',
  result = 'success',
  correlationId = null,
  causationId = null,
  eventId = null,
  metadata = {},
  occurredAt = null,
} = {}) {
  const normalizedResult = String(result || 'success').trim().toLowerCase();
  if (!RESULT_VALUES.has(normalizedResult)) throw new TypeError('Audit result is invalid');

  const record = {
    organization_id: text(organizationId, 'organization_id', true),
    chat_id: text(chatId, 'chat_id'),
    location_id: text(locationId, 'location_id'),
    actor_id: text(actorId, 'actor_id'),
    device_id: text(deviceId, 'device_id'),
    action: text(action, 'action', true),
    entity_type: text(entityType, 'entity_type', true),
    entity_id: text(entityId, 'entity_id'),
    reason: String(reason || ''),
    result: normalizedResult,
    correlation_id: text(correlationId, 'correlation_id'),
    causation_id: text(causationId, 'causation_id'),
    event_id: text(eventId, 'event_id'),
    metadata: object(metadata, 'metadata'),
    occurred_at: occurredAt == null ? new Date().toISOString() : text(occurredAt, 'occurred_at', true),
  };

  return Object.freeze(record);
}

export function isAuditRecord(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.organization_id === 'string' &&
    typeof value.action === 'string' &&
    typeof value.entity_type === 'string' &&
    typeof value.reason === 'string' &&
    RESULT_VALUES.has(value.result) &&
    value.metadata && typeof value.metadata === 'object' && !Array.isArray(value.metadata) &&
    typeof value.occurred_at === 'string');
}

// The existing backend recordAuditEvent() remains the only persistence path.
export function recordAudit(record, persist) {
  if (!isAuditRecord(record)) throw new TypeError('Valid audit record is required');
  if (typeof persist !== 'function') throw new TypeError('Existing audit persistence capability is required');
  return persist({
    chatId: record.chat_id,
    organizationId: record.organization_id,
    locationId: record.location_id,
    actorId: record.actor_id,
    deviceId: record.device_id,
    action: record.action,
    entityType: record.entity_type,
    entityId: record.entity_id,
    reason: record.reason,
    result: record.result,
    metadata: {
      ...record.metadata,
      ...(record.correlation_id ? { correlationId: record.correlation_id } : {}),
      ...(record.causation_id ? { causationId: record.causation_id } : {}),
      ...(record.event_id ? { eventId: record.event_id } : {}),
      occurredAt: record.occurred_at,
    },
  });
}

export function auditBoundaryContract() {
  return Object.freeze({
    audit_authority: 'existing backend audit_events / recordAuditEvent()',
    tenant_scope: 'organization_id is required and authoritative',
    correlation: 'correlation_id / causation_id / event_id carried as audit metadata',
    observability: 'audit actions, result, actor, device, location and timestamps',
    persistence: 'existing audit_events only',
    append_only: true,
    duplicate_audit_store: false,
    duplicate_event_store: false,
    telemetry_backend: false,
    logger_authority: 'application/runtime logs remain operational diagnostics; audit_events remains compliance history',
  });
}

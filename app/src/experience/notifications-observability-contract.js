// FUX-17/FUX-18 — Notifications + Product Observability experience contract.
//
// Experience-only boundary. This module normalizes notification presentation,
// deduplication and observability envelopes without creating a notification
// store, messaging authority, telemetry backend, analytics store, or event
// bus. Existing canonical event/audit/outbox infrastructure remains the
// source of durable evidence and delivery is delegated to provider adapters.

export const FUX17_18_CONTRACT_VERSION = '1.0';

export const NOTIFICATION_TYPES = Object.freeze([
  'INFORMATIONAL',
  'ACTION_REQUIRED',
  'APPROVAL_REQUIRED',
  'FAILURE_RECOVERY',
  'SECURITY',
  'OPERATIONAL',
]);

export const NOTIFICATION_PRIORITIES = Object.freeze([
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);

export const NOTIFICATION_READ_STATES = Object.freeze([
  'UNREAD',
  'READ',
  'ACKNOWLEDGED',
  'UNKNOWN',
]);

export const NOTIFICATION_DELIVERY_STATES = Object.freeze([
  'PENDING',
  'DELIVERED',
  'FAILED',
  'UNAVAILABLE',
  'UNKNOWN',
]);

export const OBSERVABILITY_SIGNALS = Object.freeze([
  'ACTIVATION',
  'WORKFLOW_COMPLETION',
  'ERROR',
  'LATENCY',
  'ABANDONMENT',
  'RETRY',
  'OFFLINE_QUEUE_DEPTH',
  'SYNC_FAILURE',
  'PERMISSION_FRICTION',
  'RECOVERY',
]);

const FORBIDDEN_AUTHORITIES = Object.freeze([
  'notificationStore',
  'messageStore',
  'telemetryBackend',
  'analyticsStore',
  'eventStore',
  'broker',
  'authorization',
  'transactionEngine',
]);

function text(value, field, required = true) {
  const normalized = String(value ?? '').trim();
  if (!normalized && required) throw new TypeError(`${field} must be a non-empty string`);
  return normalized || null;
}

function enumValue(value, values, field, fallback) {
  const normalized = String(value ?? fallback).trim().toUpperCase();
  if (!values.includes(normalized)) throw new TypeError(`Unsupported ${field}: ${value}`);
  return normalized;
}

function object(value, field) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function bool(value, fallback = false) {
  return value == null ? fallback : value === true;
}

function stablePart(value) {
  if (value == null) return '';
  return String(value).trim();
}

export function notificationDeduplicationKey(notification = {}) {
  const explicit = stablePart(notification.deduplicationKey || notification.deduplication_key);
  if (explicit) return explicit;
  const parts = [
    stablePart(notification.organizationId || notification.organization_id),
    stablePart(notification.type).toUpperCase(),
    stablePart(notification.code || notification.eventType || notification.event_type),
    stablePart(notification.entityType || notification.entity_type),
    stablePart(notification.entityId || notification.entity_id),
  ];
  const stableParts = parts.filter(Boolean);
  if (stableParts.length >= 4) return stableParts.join(':');
  return null;
}

export function buildNotificationExperience(input = {}) {
  const notification = object(input, 'notification');
  const type = enumValue(notification.type, NOTIFICATION_TYPES, 'notification type', 'INFORMATIONAL');
  const priority = enumValue(notification.priority, NOTIFICATION_PRIORITIES, 'notification priority', 'NORMAL');
  const readState = enumValue(notification.readState || notification.read_state, NOTIFICATION_READ_STATES, 'notification read state', 'UNREAD');
  const deliveryState = enumValue(notification.deliveryState || notification.delivery_state, NOTIFICATION_DELIVERY_STATES, 'notification delivery state', 'UNKNOWN');
  const key = notificationDeduplicationKey(notification);

  return Object.freeze({
    contractVersion: FUX17_18_CONTRACT_VERSION,
    id: text(notification.id, 'notification.id', false),
    type,
    priority,
    title: text(notification.title, 'notification.title'),
    body: text(notification.body, 'notification.body', false),
    readState,
    deliveryState,
    deduplicationKey: key,
    requiresAcknowledgement: bool(notification.requiresAcknowledgement || notification.requires_acknowledgement),
    actionRequired: type === 'ACTION_REQUIRED' || type === 'APPROVAL_REQUIRED' || type === 'FAILURE_RECOVERY',
    authority: 'existing canonical domain/event/audit authorities',
    deliveryAuthority: 'provider adapter only',
    persistenceAuthority: null,
    unknownIsSuccess: false,
  });
}

export function deduplicateNotifications(notifications = []) {
  if (!Array.isArray(notifications)) throw new TypeError('notifications must be an array');
  const seen = new Set();
  const result = [];
  for (const item of notifications) {
    const model = buildNotificationExperience(item);
    const key = model.deduplicationKey || model.id;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    result.push(model);
  }
  return Object.freeze(result);
}

export function evaluateQuietPeriod({ now = new Date(), quietPeriod = null } = {}) {
  if (!quietPeriod) return Object.freeze({ supported: false, active: false, reason: 'No quiet period supplied.' });
  const start = text(quietPeriod.start, 'quietPeriod.start');
  const end = text(quietPeriod.end, 'quietPeriod.end');
  const startParts = start.split(':').map(Number);
  const endParts = end.split(':').map(Number);
  if (startParts.length !== 2 || endParts.length !== 2 || startParts.some(Number.isNaN) || endParts.some(Number.isNaN)) {
    throw new TypeError('quiet period must use HH:MM boundaries');
  }
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) throw new TypeError('now must be a valid Date');
  const minutes = current.getHours() * 60 + current.getMinutes();
  const startMinutes = startParts[0] * 60 + startParts[1];
  const endMinutes = endParts[0] * 60 + endParts[1];
  const active = startMinutes === endMinutes
    ? true
    : startMinutes < endMinutes
      ? minutes >= startMinutes && minutes < endMinutes
      : minutes >= startMinutes || minutes < endMinutes;
  return Object.freeze({ supported: true, active, start, end });
}

export function resolveNotificationPreference({ type, enabled = true, quietPeriod = null, now = new Date() } = {}) {
  const normalizedType = enumValue(type, NOTIFICATION_TYPES, 'notification type', 'INFORMATIONAL');
  const quiet = evaluateQuietPeriod({ now, quietPeriod });
  return Object.freeze({
    type: normalizedType,
    enabled: enabled === true,
    quietPeriod: quiet,
    deliveryAllowed: enabled === true && !quiet.active,
    reason: enabled !== true ? 'DISABLED_BY_USER_PREFERENCE' : quiet.active ? 'QUIET_PERIOD' : 'ALLOWED',
  });
}

export function buildNotificationAdapterContract(input = {}) {
  const provider = text(input.provider, 'provider');
  if (input.persistence !== undefined && input.persistence !== 'none') throw new TypeError('notification adapter persistence must be none');
  for (const key of FORBIDDEN_AUTHORITIES) {
    const claim = `owns${key[0].toUpperCase()}${key.slice(1)}`;
    if (Object.prototype.hasOwnProperty.call(input, claim)) throw new TypeError(`forbidden authority claim: ${claim}`);
  }
  return Object.freeze({
    contractVersion: FUX17_18_CONTRACT_VERSION,
    provider,
    adapter: true,
    persistence: 'none',
    deliveryOnly: true,
    notificationAuthority: 'canonical domain/event/audit source',
    providerSchemaIsCanonical: false,
    forbiddenAuthorities: [...FORBIDDEN_AUTHORITIES],
  });
}

export function buildObservabilitySignal(input = {}) {
  const signal = object(input, 'observability signal');
  const kind = enumValue(signal.signal, OBSERVABILITY_SIGNALS, 'observability signal', null);
  const status = text(signal.status, 'status');
  const envelope = {
    contractVersion: FUX17_18_CONTRACT_VERSION,
    signal: kind,
    requestId: text(signal.requestId || signal.request_id, 'requestId', false),
    correlationId: text(signal.correlationId || signal.correlation_id, 'correlationId', false),
    operation: text(signal.operation, 'operation', false),
    capability: text(signal.capability, 'capability', false),
    actorId: text(signal.actorId || signal.actor_id, 'actorId', false),
    organizationId: text(signal.organizationId || signal.organization_id, 'organizationId', false),
    status,
    latencyMs: signal.latencyMs == null ? null : Number(signal.latencyMs),
    errorCategory: text(signal.errorCategory || signal.error_category, 'errorCategory', false),
    evidenceAuthority: 'existing canonical event/audit infrastructure',
    persistenceAuthority: 'existing event outbox and audit_events only',
    telemetryBackend: false,
    analyticsAuthority: false,
  };
  if (envelope.latencyMs != null && (!Number.isFinite(envelope.latencyMs) || envelope.latencyMs < 0)) {
    throw new TypeError('latencyMs must be a non-negative finite number');
  }
  return Object.freeze(envelope);
}

export function buildOfflineQueueObservability({ pending = 0, failed = 0, synced = 0 } = {}) {
  const values = [pending, failed, synced].map(Number);
  if (values.some(value => !Number.isInteger(value) || value < 0)) throw new TypeError('offline queue counts must be non-negative integers');
  return buildObservabilitySignal({
    signal: 'OFFLINE_QUEUE_DEPTH',
    status: values[1] ? 'FAILURE' : values[0] ? 'QUEUED' : 'CLEAR',
    operation: 'offline.queue',
    latencyMs: null,
    errorCategory: values[1] ? 'SYNC_FAILURE' : null,
    metadata: { pending, failed, synced },
  });
}

export function notificationObservabilityContract() {
  return Object.freeze({
    version: FUX17_18_CONTRACT_VERSION,
    notificationTypes: [...NOTIFICATION_TYPES],
    priorities: [...NOTIFICATION_PRIORITIES],
    readStates: [...NOTIFICATION_READ_STATES],
    deliveryStates: [...NOTIFICATION_DELIVERY_STATES],
    observabilitySignals: [...OBSERVABILITY_SIGNALS],
    notificationAuthority: 'canonical domain/event/audit sources',
    deliveryAuthority: 'provider adapters',
    evidenceAuthority: 'existing event outbox + audit_events',
    auditAuthority: 'existing backend audit_events / recordAuditEvent()',
    telemetryBackend: false,
    duplicateEventStore: false,
    duplicateAuditStore: false,
    duplicateAnalyticsStore: false,
    duplicateMessagingAuthority: false,
    offlineQueueAuthority: 'existing app/src/sync/outbox.js',
    correlationAuthority: 'existing request/correlation/event/audit identifiers',
    unknownIsSuccess: false,
  });
}

export function assertNotificationObservabilityBoundary() {
  const contract = notificationObservabilityContract();
  if (contract.telemetryBackend || contract.duplicateEventStore || contract.duplicateAuditStore || contract.duplicateAnalyticsStore || contract.duplicateMessagingAuthority) {
    throw new Error('FUX-17/FUX-18 boundary cannot create duplicate infrastructure');
  }
  if (contract.offlineQueueAuthority !== 'existing app/src/sync/outbox.js') {
    throw new Error('Unexpected offline queue authority');
  }
  return contract;
}

// Phase 13.12.2 — canonical security context contract.
//
// This module is deliberately persistence-neutral and policy-neutral. It does
// not authenticate users, resolve sessions, evaluate permissions, or persist
// security state. Existing session/membership/device, tenant/location,
// authorization and audit authorities remain canonical.

const TEXT_FIELDS = [
  'actorId', 'sessionId', 'deviceId', 'role', 'chatId', 'organizationId',
  'locationId', 'requestId', 'correlationId', 'causationId', 'eventId',
  'idempotencyKey', 'externalSystem', 'externalObjectId',
];

function text(value) {
  if (value == null || String(value).trim() === '') return null;
  return String(value).trim();
}

function pick(source, ...keys) {
  for (const key of keys) {
    if (source?.[key] != null) return source[key];
  }
  return null;
}

/**
 * Build the security context consumed by the existing authorization boundary.
 * The session remains the identity source; this is only a normalized contract.
 */
export function buildSecurityContext(session, {
  tenant = null,
  organization = null,
  location = null,
  requestId = null,
  correlationId = null,
  causationId = null,
  eventId = null,
  idempotencyKey = null,
  externalSystem = null,
  externalObjectId = null,
} = {}) {
  const actorId = pick(session, 'userId', 'actorId');
  const organizationId = pick(session, 'organizationId')
    ?? pick(organization, 'id', 'organizationId', 'organization_id')
    ?? pick(tenant, 'organizationId', 'organization_id');
  const locationId = pick(location, 'id', 'locationId', 'location_id')
    ?? pick(session, 'locationId');

  const context = {
    actorId: text(actorId),
    sessionId: text(pick(session, 'sessionId')),
    deviceId: text(pick(session, 'deviceId')),
    role: text(pick(session, 'role')),
    chatId: text(pick(session, 'chatId') ?? pick(tenant, 'chatId', 'chat_id')),
    organizationId: text(organizationId),
    locationId: text(locationId),
    requestId: text(requestId),
    correlationId: text(correlationId),
    causationId: text(causationId),
    eventId: text(eventId),
    idempotencyKey: text(idempotencyKey),
    externalSystem: text(externalSystem),
    externalObjectId: text(externalObjectId),
  };

  return Object.freeze(context);
}

/**
 * Validate the minimum security identity/scope needed before authorization.
 * Observability identifiers are optional and must never substitute for actor
 * identity or organization scope.
 */
export function validateSecurityContext(context, { requireLocation = false } = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return false;
  if (!context.actorId || !context.sessionId || !context.chatId || !context.organizationId) return false;
  if (!context.role) return false;
  if (requireLocation && !context.locationId) return false;

  for (const field of TEXT_FIELDS) {
    if (context[field] != null && typeof context[field] !== 'string') return false;
  }
  return true;
}

export function securityContextContract() {
  return Object.freeze({
    identity_authority: 'existing authenticated sessions + memberships + devices',
    organization_authority: 'existing organizations / tenant mapping',
    location_authority: 'existing locations.organization_id',
    authorization_authority: 'backend/lib/authorization.js authorize(actor, organization, location, resource, action)',
    audit_authority: 'existing backend audit_events / recordAuditEvent()',
    persistence: 'none',
    evaluator: 'none',
    fields: Object.freeze({
      security: ['actorId', 'sessionId', 'deviceId', 'role', 'chatId', 'organizationId', 'locationId'],
      observability: ['requestId', 'correlationId', 'causationId', 'eventId', 'idempotencyKey', 'externalSystem', 'externalObjectId'],
    }),
    required_identity: ['actorId', 'sessionId', 'chatId', 'organizationId', 'role'],
    optional_scope: ['locationId'],
    duplicate_identity_authority: false,
    duplicate_authorization_authority: false,
    duplicate_audit_authority: false,
  });
}

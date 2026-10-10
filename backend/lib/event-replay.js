// Phase 13.11.11 — deterministic event replay / idempotency decision helper.
// This module owns no persistence. The existing sync_events table remains the
// durable event identity authority; this helper only compares a retried event
// with the previously accepted canonical payload.
import crypto from 'node:crypto';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

export function eventReplayFingerprint({ organizationId, eventType, aggregateType, aggregateId, payload }) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize({
    organizationId: String(organizationId || ''),
    eventType: String(eventType || ''),
    aggregateType: String(aggregateType || ''),
    aggregateId: aggregateId == null ? null : String(aggregateId),
    payload: payload && typeof payload === 'object' ? payload : null,
  }))).digest('hex');
}

// Reject tenant/organization claims that conflict with the authenticated route scope.
// Missing claims remain compatible with legacy unscoped events; the route session
// still determines the authoritative tenant and organization.
export function assertEventTenantScope(event, { chatId, organizationId } = {}) {
  const tenantClaims = [event?.tenantChatId, event?.tenant_chat_id, event?.payload?.tenantChatId, event?.payload?.tenant_chat_id];
  for (const claim of tenantClaims) {
    if (claim == null || String(claim).trim() === '') continue;
    if (String(claim) !== String(chatId)) {
      throw Object.assign(new Error('Event tenant does not match the authenticated tenant'), {
        statusCode: 403,
        code: 'EVENT_TENANT_SCOPE_MISMATCH',
      });
    }
  }

  const organizationClaims = [event?.organizationId, event?.organization_id, event?.payload?._event?.organization_id];
  for (const claim of organizationClaims) {
    if (claim == null || String(claim).trim() === '') continue;
    if (String(claim) !== String(organizationId)) {
      throw Object.assign(new Error('Event organization does not match the authenticated organization'), {
        statusCode: 403,
        code: 'EVENT_ORGANIZATION_SCOPE_MISMATCH',
      });
    }
  }
  return true;
}

export function decideEventReplay(existing, incoming) {
  if (!existing) return Object.freeze({ decision: 'new', duplicate: false, conflict: false });

  const existingFingerprint = eventReplayFingerprint({
    organizationId: existing.organization_id,
    eventType: existing.event_type,
    aggregateType: existing.aggregate_type,
    aggregateId: existing.aggregate_id,
    payload: JSON.parse(existing.payload_json),
  });
  const incomingFingerprint = eventReplayFingerprint(incoming);

  if (existingFingerprint !== incomingFingerprint) {
    return Object.freeze({ decision: 'conflict', duplicate: false, conflict: true });
  }

  return Object.freeze({ decision: 'duplicate', duplicate: true, conflict: false });
}

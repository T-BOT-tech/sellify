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

const QUALITY_STATES = new Set([
  'SELF_REPORTED', 'OBSERVED', 'VERIFIED', 'STALE', 'UNKNOWN', 'CONFLICTING',
]);

function parseInstant(value) {
  if (value == null || value === '') return NaN;
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

/** Read-only presentation projection; it never authorizes or reserves capacity. */
export function projectCapacityEvidenceDisplay(signal = {}, evaluatedAt = Date.now()) {
  const now = Number(evaluatedAt);
  const observedAt = parseInstant(signal.observedAt);
  const validUntil = parseInstant(signal.validUntil);
  const rawQuality = String(signal.quality ?? 'UNKNOWN').trim().toUpperCase();
  const quality = QUALITY_STATES.has(rawQuality) ? rawQuality : 'UNKNOWN';
  const hasUsableWindow = Number.isFinite(now)
    && Number.isFinite(observedAt)
    && Number.isFinite(validUntil)
    && observedAt <= now
    && validUntil >= observedAt;
  const freshness = !hasUsableWindow ? 'UNKNOWN' : validUntil < now ? 'STALE' : 'CURRENT';
  const recordedLabel = Number.isFinite(observedAt)
    ? `Declaration recorded ${new Date(observedAt).toISOString()}`
    : 'Declaration record time unknown';
  const validityLabel = freshness === 'CURRENT'
    ? `Declared valid until ${new Date(validUntil).toISOString()}`
    : freshness === 'STALE'
      ? `Declared validity expired ${new Date(validUntil).toISOString()}`
      : 'Freshness UNKNOWN · no usable observation and validity window';
  return Object.freeze({ quality, freshness, recordedLabel, validityLabel });
}

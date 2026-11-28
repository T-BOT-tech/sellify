/**
 * Canonical, on-demand Workforce availability assessment contract.
 *
 * This is an eligibility assessment, not a booking, reservation, allocation,
 * payment, or delivery commitment. The caller must gather organization-scoped
 * evidence from each authoritative source before an AVAILABLE result is possible.
 */
export const WORKFORCE_AVAILABILITY_ASSESSMENT_CONTRACT_VERSION = '1.0';
export const WORKFORCE_AVAILABILITY_ASSESSMENT_STATES = Object.freeze(['AVAILABLE', 'UNAVAILABLE', 'CONFLICT', 'UNKNOWN']);
export const WORKFORCE_AVAILABILITY_ASSESSMENT_SOURCES = Object.freeze([
  'member', 'engagement', 'calendar', 'calendar_exceptions', 'availability_windows',
  'leave_requests', 'absences', 'shifts', 'allocations', 'scheduling_policy', 'operational_commitments',
]);
export const WORKFORCE_AVAILABILITY_EVIDENCE_STATUSES = Object.freeze(['COMPLETE', 'NOT_APPLICABLE', 'MISSING', 'STALE', 'ERROR']);

const REQUIRED_CANDIDATE_FIELDS = Object.freeze([
  'organization_id', 'tenant_id', 'chat_id', 'member_id', 'starts_at', 'ends_at', 'timezone',
]);
const FINDING_STATES = new Set(['UNAVAILABLE', 'CONFLICT', 'UNKNOWN']);

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    && /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
}
function validTimezone(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0)); return true; }
  catch { return false; }
}
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function workforceAvailabilityAssessmentContract() {
  return Object.freeze({
    contract_version: WORKFORCE_AVAILABILITY_ASSESSMENT_CONTRACT_VERSION,
    capability: 'workforce.membership', entity: 'workforce_availability_assessment',
    states: WORKFORCE_AVAILABILITY_ASSESSMENT_STATES,
    required_evidence_sources: WORKFORCE_AVAILABILITY_ASSESSMENT_SOURCES,
    evidence_statuses: WORKFORCE_AVAILABILITY_EVIDENCE_STATUSES,
    organization_scoped: true, tenant_scoped: true, member_scoped: true, time_zone_aware: true,
    evaluated_on_demand: true, persists_derived_result: false,
    creates_booking: false, creates_reservation: false, commits_resource: false,
    confirms_payment: false, commits_delivery: false,
  });
}

export function validateWorkforceAvailabilityAssessmentCandidate(candidate = {}) {
  const errors = [];
  for (const field of REQUIRED_CANDIDATE_FIELDS) {
    if (candidate[field] === undefined || candidate[field] === null || candidate[field] === '') errors.push(`Missing required field: ${field}`);
  }
  if (candidate.starts_at !== undefined && !validTimestamp(candidate.starts_at)) errors.push('starts_at must be a timezone-qualified ISO-8601 timestamp');
  if (candidate.ends_at !== undefined && !validTimestamp(candidate.ends_at)) errors.push('ends_at must be a timezone-qualified ISO-8601 timestamp');
  if (validTimestamp(candidate.starts_at) && validTimestamp(candidate.ends_at)
    && Date.parse(candidate.starts_at) >= Date.parse(candidate.ends_at)) errors.push('starts_at must be before ends_at');
  if (candidate.timezone !== undefined && !validTimezone(candidate.timezone)) errors.push('timezone must be a valid IANA timezone');
  for (const field of ['organization_id', 'tenant_id', 'chat_id', 'member_id']) {
    if (candidate[field] !== undefined && typeof candidate[field] !== 'string') errors.push(`${field} must be a string`);
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

function validateEvidence(sources) {
  const errors = [];
  const sourceVersions = [];
  for (const source of WORKFORCE_AVAILABILITY_ASSESSMENT_SOURCES) {
    const item = sources?.[source];
    if (!isPlainObject(item)) {
      errors.push({ code: 'EVIDENCE_SOURCE_MISSING', source, message: `Evidence source ${source} was not supplied` });
      continue;
    }
    if (!WORKFORCE_AVAILABILITY_EVIDENCE_STATUSES.includes(item.status)) {
      errors.push({ code: 'EVIDENCE_STATUS_INVALID', source, message: `Evidence source ${source} has an invalid status` });
      continue;
    }
    if (item.status === 'NOT_APPLICABLE' && (typeof item.reason !== 'string' || !item.reason.trim())) {
      errors.push({ code: 'EVIDENCE_NOT_APPLICABLE_UNEXPLAINED', source, message: `Evidence source ${source} must explain why it is not applicable` });
    } else if (item.status !== 'COMPLETE' && item.status !== 'NOT_APPLICABLE') {
      errors.push({
        code: item.status === 'STALE' ? 'EVIDENCE_STALE' : item.status === 'ERROR' ? 'EVIDENCE_ERROR' : 'EVIDENCE_INCOMPLETE',
        source,
        message: typeof item.reason === 'string' && item.reason.trim() ? item.reason.trim() : `Evidence source ${source} is ${item.status.toLowerCase()}`,
      });
    }
    const version = item.version === undefined || item.version === null || item.version === '' ? null : String(item.version);
    const asOf = item.evaluated_at ?? item.as_of ?? null;
    if (asOf !== null && !validTimestamp(asOf)) errors.push({
      code: 'EVIDENCE_TIMESTAMP_INVALID', source, message: `Evidence source ${source} has an invalid evaluated_at timestamp`,
    });
    if (item.status === 'COMPLETE' && !version && !asOf) errors.push({
      code: 'EVIDENCE_PROVENANCE_MISSING', source, message: `Evidence source ${source} must provide a version or evaluated_at timestamp`,
    });
    sourceVersions.push(Object.freeze({
      source, status: item.status, version,
      ...(asOf === null ? {} : { evaluated_at: new Date(asOf).toISOString() }),
    }));
  }
  return { errors, sourceVersions };
}

/**
 * Resolve normalized assessment findings. Findings must be produced by the
 * trusted server-side evidence aggregator, never by a browser client.
 */
export function assessWorkforceAvailability({ candidate, sources, findings = [], evaluated_at = new Date().toISOString() } = {}) {
  const candidateValidation = validateWorkforceAvailabilityAssessmentCandidate(candidate);
  const evidence = validateEvidence(sources);
  const normalizedFindings = [];
  if (!candidateValidation.valid) normalizedFindings.push(...candidateValidation.errors.map(message => Object.freeze({
    code: 'ASSESSMENT_INPUT_INVALID', state: 'UNKNOWN', source: 'assessment', message,
  })));
  normalizedFindings.push(...evidence.errors.map(item => Object.freeze({ ...item, state: 'UNKNOWN' })));
  if (!Array.isArray(findings)) {
    normalizedFindings.push(Object.freeze({
      code: 'ASSESSMENT_FINDINGS_INVALID', state: 'UNKNOWN', source: 'assessment',
      message: 'Assessment findings must be an array',
    }));
  } else {
    for (const finding of findings) {
      if (!isPlainObject(finding) || !FINDING_STATES.has(finding.state)
        || typeof finding.code !== 'string' || !finding.code.trim()
        || typeof finding.message !== 'string' || !finding.message.trim()) {
        normalizedFindings.push(Object.freeze({
          code: 'ASSESSMENT_FINDING_INVALID', state: 'UNKNOWN', source: 'assessment',
          message: 'An assessment finding is incomplete or invalid',
        }));
        continue;
      }
      normalizedFindings.push(Object.freeze({
        code: finding.code.trim(), state: finding.state,
        source: typeof finding.source === 'string' ? finding.source : 'assessment',
        message: finding.message.trim(),
        ...(finding.record_id == null ? {} : { record_id: String(finding.record_id) }),
      }));
    }
  }
  if (!validTimestamp(evaluated_at)) normalizedFindings.push(Object.freeze({
    code: 'ASSESSMENT_TIMESTAMP_INVALID', state: 'UNKNOWN', source: 'assessment',
    message: 'evaluated_at must be a timezone-qualified ISO-8601 timestamp',
  }));
  const state = normalizedFindings.some(item => item.state === 'UNKNOWN') ? 'UNKNOWN'
    : normalizedFindings.some(item => item.state === 'CONFLICT') ? 'CONFLICT'
      : normalizedFindings.some(item => item.state === 'UNAVAILABLE') ? 'UNAVAILABLE' : 'AVAILABLE';
  const timestamp = validTimestamp(evaluated_at) ? new Date(evaluated_at).toISOString() : new Date().toISOString();
  return Object.freeze({
    contract_version: WORKFORCE_AVAILABILITY_ASSESSMENT_CONTRACT_VERSION,
    state, candidate: candidateValidation.valid ? Object.freeze({ ...candidate }) : null,
    evaluated_at: timestamp, source_versions: Object.freeze(evidence.sourceVersions),
    findings: Object.freeze(normalizedFindings),
    is_booking: false, is_reservation: false, is_resource_commitment: false,
  });
}

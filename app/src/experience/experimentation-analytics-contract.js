// FUX-19/FUX-20 — UX Experimentation + Product Analytics experience contract.
// Experience-only contract: experimentation never becomes an authorization,
// transaction, event-store, audit-store, or telemetry authority; analytics is
// a read-only projection over existing canonical evidence.

export const EXPERIMENTATION_STATES = Object.freeze([
  'NOT_ESTABLISHED',
  'NOT_ASSIGNED',
  'ELIGIBLE',
  'ASSIGNED',
  'ACTIVE',
  'HOLDOUT',
  'COMPLETED',
  'BLOCKED',
  'UNKNOWN',
]);

export const EXPERIMENT_GUARDRAILS = Object.freeze([
  'authorization',
  'security_policy',
  'scope',
  'canonical_assignment',
  'canonical_rollout',
  'audit_evidence',
  'rollback',
]);

export const ANALYTICS_TAXONOMY = Object.freeze([
  'activation',
  'pack_adoption',
  'funnel',
  'completion',
  'efficiency',
  'reliability',
]);

export const ANALYTICS_IDENTIFIERS = Object.freeze([
  'requestCorrelationId',
  'operation',
  'capability',
  'actorId',
  'organizationId',
  'scope',
  'status',
  'latencyMs',
  'errorCategory',
]);

const PACK_TERMS = /pack|entitlement|readiness|capability/i;

export function evaluateExperimentGuardrails(input = {}) {
  const checks = {};
  for (const guardrail of EXPERIMENT_GUARDRAILS) {
    const value = input[guardrail];
    checks[guardrail] = value === true ? 'PASS' : value === false ? 'BLOCKED' : 'UNKNOWN';
  }

  const failed = Object.values(checks).some(value => value === 'BLOCKED');
  const unknown = Object.values(checks).some(value => value === 'UNKNOWN');

  return Object.freeze({
    state: failed ? 'BLOCKED' : unknown ? 'UNKNOWN' : 'ELIGIBLE',
    checks: Object.freeze(checks),
    canMutateProduction: false,
    assignmentAuthority: 'canonical experimentation service only',
    rolloutAuthority: 'canonical experimentation service only',
    authorizationAuthority: 'canonical authorization authority',
  });
}

export function classifyProductAnalyticsEvent(event = {}) {
  const text = [event.action, event.entityType, event.entityId, JSON.stringify(event.metadata || {})]
    .join(' ')
    .toLowerCase();

  let taxonomy = 'reliability';
  if (/activation|activate|install/.test(text)) taxonomy = 'activation';
  else if (PACK_TERMS.test(text)) taxonomy = 'pack_adoption';
  else if (/funnel|step|stage|entry|dropoff|abandon/.test(text)) taxonomy = 'funnel';
  else if (/complete|completed|success/.test(text)) taxonomy = 'completion';
  else if (/latency|duration|throughput|efficiency/.test(text)) taxonomy = 'efficiency';

  const status = String(event.result || event.status || 'UNKNOWN').toUpperCase();
  return Object.freeze({
    taxonomy,
    status: ['SUCCESS', 'FAILURE', 'DENIED', 'UNKNOWN'].includes(status) ? status : 'UNKNOWN',
    source: 'existing canonical event/audit evidence',
    writable: false,
  });
}

export function buildProductAnalyticsMetric(event = {}) {
  const classification = classifyProductAnalyticsEvent(event);
  return Object.freeze({
    ...classification,
    requestCorrelationId: event.requestCorrelationId || event.correlationId || null,
    operation: event.operation || event.action || null,
    capability: event.capability || null,
    actorId: event.actorId || null,
    organizationId: event.organizationId || null,
    scope: event.scope || null,
    latencyMs: Number.isFinite(event.latencyMs) ? event.latencyMs : null,
    errorCategory: event.errorCategory || null,
  });
}

export function experimentationAnalyticsContract() {
  return Object.freeze({
    experimentationAuthority: 'canonical experimentation service only',
    analyticsAuthority: 'existing canonical event/audit evidence only',
    telemetryAuthority: 'existing UX telemetry infrastructure',
    transactionAuthority: 'existing domain transaction authorities',
    authorizationAuthority: 'canonical authorization authority',
    taxonomy: ANALYTICS_TAXONOMY,
    identifiers: ANALYTICS_IDENTIFIERS,
    guardrails: EXPERIMENT_GUARDRAILS,
    duplicateExperimentStore: false,
    duplicateAnalyticsStore: false,
    duplicateEventStore: false,
    duplicateAuditStore: false,
    productionMutationFromExperience: false,
  });
}

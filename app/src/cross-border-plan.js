// Phase 20.10 — Cross-Border Plan / Action Routing.
// Derived coordination only. A plan may identify what an owning domain must
// do, but it never authorizes, executes, persists, or mutates that action.

import { CROSS_BORDER_FAILURE_STATES, CROSS_BORDER_RESULTS } from './cross-border-contract.js';

export const CROSS_BORDER_PLAN_VERSION = '1.0';

export const CROSS_BORDER_ACTION_TYPES = Object.freeze([
  'REVIEW_REQUIREMENT',
  'VERIFY_CAPABILITY',
  'REQUEST_PAYMENT',
  'REQUEST_FULFILLMENT',
  'REQUEST_DOCUMENT',
  'REQUEST_CUSTOMS_REVIEW',
  'REQUEST_COMPLIANCE_REVIEW',
  'REQUEST_FX_QUOTE',
]);

const RESULT_VALUES = new Set(Object.values(CROSS_BORDER_RESULTS));
const ACTION_VALUES = new Set(CROSS_BORDER_ACTION_TYPES);
const FORBIDDEN_KEYS = new Set([
  'execute', 'executeTransaction', 'authorize', 'authorizationDecision',
  'capturePayment', 'createOrder', 'createShipment', 'dispatch',
  'reserveInventory', 'settle', 'persist', 'database', 'store', 'ledger',
  'eventStore', 'providerCall', 'credentials', 'secrets', 'tokenStore',
]);

function fail(message, code = 'CROSS_BORDER_PLAN_INVALID') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim();
}

function ref(value, field) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field} must be an object`);
  return Object.freeze({ ...value });
}

function scanForbidden(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) fail(`Cross-border plan cannot contain ${key}`, 'CROSS_BORDER_PLAN_EXECUTION_FORBIDDEN');
    scanForbidden(nested);
  }
}

function normalizeAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) fail('action must be an object');
  scanForbidden(action);
  const type = text(action.type, 'action.type').toUpperCase();
  if (!ACTION_VALUES.has(type)) fail(`Unsupported action type: ${action.type}`);
  const targetAuthority = text(action.targetAuthority, 'action.targetAuthority');
  const status = action.status == null ? 'recommended' : text(action.status, 'action.status').toLowerCase();
  if (!['recommended', 'pending_authorization', 'not_applicable'].includes(status)) {
    fail(`Unsupported action status: ${action.status}`);
  }
  return Object.freeze({
    actionId: action.actionId == null ? null : text(action.actionId, 'action.actionId'),
    type,
    targetAuthority,
    targetReference: ref(action.targetReference, 'action.targetReference'),
    reason: action.reason == null ? null : text(action.reason, 'action.reason'),
    requiredAuthorization: true,
    status,
  });
}

export function buildCrossBorderPlan({
  opportunityReference,
  evaluation,
  tradeLaneReference = null,
  commercialReference = null,
  currencyReference = null,
  logisticsReference = null,
  requirementReferences = [],
  actions = [],
  provenance = null,
  generatedAt = null,
} = {}) {
  scanForbidden({ opportunityReference, evaluation, tradeLaneReference, commercialReference, currencyReference, logisticsReference, requirementReferences, actions });
  if (!evaluation || typeof evaluation !== 'object') fail('evaluation is required');
  if (!RESULT_VALUES.has(evaluation.result)) fail(`Unsupported evaluation result: ${evaluation.result}`);
  if (!Array.isArray(requirementReferences) || !Array.isArray(actions)) fail('requirementReferences and actions must be arrays');

  const normalizedActions = actions.map(normalizeAction);
  const blockers = Array.isArray(evaluation.blockers) ? evaluation.blockers.map(item => Object.freeze({ ...item })) : [];
  const unknown = Array.isArray(evaluation.unknown) ? evaluation.unknown.map(item => Object.freeze({ ...item })) : [];
  const review = Array.isArray(evaluation.review) ? evaluation.review.map(item => Object.freeze({ ...item })) : [];

  const recommended = evaluation.result === CROSS_BORDER_RESULTS.FEASIBLE ||
    evaluation.result === CROSS_BORDER_RESULTS.CONDITIONALLY_FEASIBLE;

  const failureState = evaluation.result === CROSS_BORDER_RESULTS.FEASIBLE
    ? CROSS_BORDER_FAILURE_STATES.SUCCESS
    : evaluation.result === CROSS_BORDER_RESULTS.CONDITIONALLY_FEASIBLE
      ? CROSS_BORDER_FAILURE_STATES.REVIEW_REQUIRED
      : evaluation.result === CROSS_BORDER_RESULTS.NOT_FEASIBLE
        ? CROSS_BORDER_FAILURE_STATES.BLOCKED
        : CROSS_BORDER_FAILURE_STATES.UNKNOWN;

  return Object.freeze({
    version: CROSS_BORDER_PLAN_VERSION,
    opportunityReference: ref(opportunityReference, 'opportunityReference'),
    tradeLaneReference: ref(tradeLaneReference, 'tradeLaneReference'),
    commercialReference: ref(commercialReference, 'commercialReference'),
    currencyReference: ref(currencyReference, 'currencyReference'),
    logisticsReference: ref(logisticsReference, 'logisticsReference'),
    requirementReferences: Object.freeze(requirementReferences.map(item => ref(item, 'requirementReference'))),
    evaluationResult: evaluation.result,
    blockers: Object.freeze(blockers),
    unknown: Object.freeze(unknown),
    review: Object.freeze(review),
    actions: Object.freeze(normalizedActions),
    actionable: recommended && normalizedActions.length > 0,
    requiresAuthorization: normalizedActions.length > 0,
    authorization: 'existing_authorization',
    execution: 'owning_domain_only',
    persistence: 'none',
    mutation: false,
    transactionCreation: false,
    providerExecution: false,
    failureState,
    provenance: ref(provenance, 'provenance'),
    generatedAt: generatedAt == null ? null : text(generatedAt, 'generatedAt'),
  });
}

export function routeCrossBorderAction(action, { authorize, handlers = {} } = {}) {
  const normalized = normalizeAction(action);
  if (typeof authorize !== 'function') fail('existing authorization function is required', 'CROSS_BORDER_PLAN_AUTHORIZATION_REQUIRED');
  if (normalized.status !== 'pending_authorization') {
    fail('action routing requires pending_authorization status', 'CROSS_BORDER_PLAN_AUTHORIZATION_REQUIRED');
  }
  if (typeof handlers[normalized.targetAuthority] !== 'function') {
    fail(`no existing handler for target authority ${normalized.targetAuthority}`, 'CROSS_BORDER_PLAN_HANDLER_REQUIRED');
  }
  // The handler receives a routing request only. Authorization and execution
  // remain explicitly owned by the existing domain boundary.
  return Object.freeze({
    action: normalized,
    authorization: 'existing_authorization',
    execution: 'owning_domain_only',
    persistence: 'none',
    delegated: true,
    handler: handlers[normalized.targetAuthority],
  });
}

export function crossBorderPlanContract() {
  return Object.freeze({
    version: CROSS_BORDER_PLAN_VERSION,
    owner: 'Phase 20 derived coordination only',
    persistence: 'none',
    mutation: false,
    transactionCreation: false,
    providerExecution: false,
    authorization: 'existing_authorization',
    execution: 'owning_domain_only',
    feasibilityIsAuthorization: false,
    authorizationIsExecution: false,
    unknownIsSuccess: false,
    actions: CROSS_BORDER_ACTION_TYPES,
    failureStates: Object.freeze([...Object.values(CROSS_BORDER_FAILURE_STATES)]),
  });
}

export const CROSS_BORDER_PLAN_CONTRACT = crossBorderPlanContract();

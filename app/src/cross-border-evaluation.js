// Phase 20.9 — Cross-Border Evaluation Engine.
// Deterministic, explainable composition over existing Phase 20 observations.
// This evaluator owns no transaction, regulatory, payment, inventory,
// logistics, pricing, ledger, persistence, or provider authority.

import { CROSS_BORDER_RESULTS, CROSS_BORDER_FAILURE_STATES } from './cross-border-contract.js';

export const CROSS_BORDER_EVALUATION_VERSION = '1.0';

export const CROSS_BORDER_DIMENSIONS = Object.freeze([
  'commercial',
  'capacity',
  'qualification',
  'requirements',
  'currency',
  'logistics',
  'payment',
]);

const DIMENSION_RESULTS = new Set(['FEASIBLE', 'CONDITIONALLY_FEASIBLE', 'NOT_FEASIBLE', 'UNKNOWN']);
const OUTCOMES = new Set(Object.values(CROSS_BORDER_RESULTS).map(value => value.toUpperCase()));

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw Object.assign(new TypeError(`${field} must be a non-empty string`), { code: 'CROSS_BORDER_EVALUATION_INVALID' });
  return result;
}

function normalizeDimension(value, field) {
  if (value == null) return { result: 'UNKNOWN', reason: `${field} evidence not supplied` };
  if (typeof value === 'string') {
    const result = value.trim().toUpperCase();
    if (!DIMENSION_RESULTS.has(result)) throw new TypeError(`Unsupported ${field} result: ${value}`);
    return { result, reason: null };
  }
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be a result string or object`);
  const result = String(value.result ?? 'UNKNOWN').trim().toUpperCase();
  if (!DIMENSION_RESULTS.has(result)) throw new TypeError(`Unsupported ${field} result: ${value.result}`);
  return {
    result,
    reason: value.reason == null ? null : text(value.reason, `${field}.reason`),
    source: value.source == null ? null : text(value.source, `${field}.source`),
    reference: value.reference == null ? null : Object.freeze({ ...value.reference }),
  };
}

function evaluateOverall(dimensions) {
  const values = Object.values(dimensions).map(item => item.result);
  if (values.includes('NOT_FEASIBLE')) return 'NOT_FEASIBLE';
  if (values.includes('UNKNOWN')) return 'UNKNOWN';
  if (values.includes('CONDITIONALLY_FEASIBLE')) return 'CONDITIONALLY_FEASIBLE';
  return 'FEASIBLE';
}

function assertNoExecution(input = {}) {
  const forbidden = [
    'execute', 'executeTransaction', 'authorize', 'payment', 'capturePayment',
    'createOrder', 'createShipment', 'dispatch', 'reserveInventory', 'settle',
    'persist', 'database', 'store', 'ledger', 'eventStore', 'providerCall',
  ];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
      if (forbidden.includes(key)) {
        throw Object.assign(new Error(`Cross-border evaluation cannot execute or own ${key}`), { code: 'CROSS_BORDER_EVALUATION_EXECUTION_FORBIDDEN' });
      }
      if (nested && typeof nested === 'object') visit(nested);
    }
  };
  visit(input);
}

/**
 * Evaluate a cross-border opportunity from already-derived observations.
 * Every dimension is explicit, deterministic, and explainable. Missing
 * evidence remains UNKNOWN rather than being promoted to success.
 */
export function evaluateCrossBorder({
  opportunityReference,
  origin,
  destination,
  commercial = null,
  capacity = null,
  qualification = null,
  requirements = null,
  currency = null,
  logistics = null,
  payment = null,
  provenance = null,
  evaluatedAt = null,
} = {}) {
  assertNoExecution({ opportunityReference });
  const from = text(origin, 'origin').toUpperCase();
  const to = text(destination, 'destination').toUpperCase();
  if (from === to) throw Object.assign(new Error('Cross-border evaluation requires different countries'), { code: 'CROSS_BORDER_SAME_COUNTRY' });

  const dimensions = Object.freeze({
    commercial: Object.freeze(normalizeDimension(commercial, 'commercial')),
    capacity: Object.freeze(normalizeDimension(capacity, 'capacity')),
    qualification: Object.freeze(normalizeDimension(qualification, 'qualification')),
    requirements: Object.freeze(normalizeDimension(requirements, 'requirements')),
    currency: Object.freeze(normalizeDimension(currency, 'currency')),
    logistics: Object.freeze(normalizeDimension(logistics, 'logistics')),
    payment: Object.freeze(normalizeDimension(payment, 'payment')),
  });

  const result = evaluateOverall(dimensions);
  const normalizedResult = result.toLowerCase();
  const blockers = Object.entries(dimensions)
    .filter(([, value]) => value.result === 'NOT_FEASIBLE')
    .map(([dimension, value]) => Object.freeze({ dimension, reason: value.reason ?? `${dimension} is not feasible` }));
  const unknown = Object.entries(dimensions)
    .filter(([, value]) => value.result === 'UNKNOWN')
    .map(([dimension, value]) => Object.freeze({ dimension, reason: value.reason ?? `${dimension} is unknown` }));
  const review = Object.entries(dimensions)
    .filter(([, value]) => value.result === 'CONDITIONALLY_FEASIBLE')
    .map(([dimension, value]) => Object.freeze({ dimension, reason: value.reason ?? `${dimension} requires review` }));

  return Object.freeze({
    version: CROSS_BORDER_EVALUATION_VERSION,
    origin: from,
    destination: to,
    opportunityReference: opportunityReference == null ? null : Object.freeze({ ...opportunityReference }),
    result: normalizedResult,
    dimensions,
    blockers: Object.freeze(blockers),
    unknown: Object.freeze(unknown),
    review: Object.freeze(review),
    deterministic: true,
    explainable: true,
    persistence: 'none',
    mutation: false,
    authorization: false,
    execution: false,
    transactionCreation: false,
    providerExecution: false,
    authority: 'phase20-derived-cross-border-evaluation',
    provenance: provenance == null ? null : Object.freeze({ ...provenance }),
    evaluatedAt: evaluatedAt == null ? null : text(evaluatedAt, 'evaluatedAt'),
    failureState: normalizedResult === 'unknown' ? CROSS_BORDER_FAILURE_STATES.UNKNOWN :
      normalizedResult === 'not_feasible' ? CROSS_BORDER_FAILURE_STATES.BLOCKED :
      normalizedResult === 'conditionally_feasible' ? CROSS_BORDER_FAILURE_STATES.REVIEW_REQUIRED :
      CROSS_BORDER_FAILURE_STATES.SUCCESS,
  });
}

export function isCrossBorderEvaluation(value) {
  return Boolean(value && typeof value === 'object' &&
    value.version === CROSS_BORDER_EVALUATION_VERSION &&
    typeof value.origin === 'string' && typeof value.destination === 'string' &&
    value.origin !== value.destination &&
    typeof value.result === 'string' &&
    new Set(Object.values(CROSS_BORDER_RESULTS)).has(value.result) &&
    value.deterministic === true && value.explainable === true &&
    value.persistence === 'none' && value.mutation === false &&
    value.authorization === false && value.execution === false &&
    value.transactionCreation === false && value.providerExecution === false &&
    value.authority === 'phase20-derived-cross-border-evaluation');
}

export function crossBorderEvaluationContract() {
  return Object.freeze({
    version: CROSS_BORDER_EVALUATION_VERSION,
    owner: 'Phase 20 derived coordination only',
    dimensions: CROSS_BORDER_DIMENSIONS,
    results: Object.freeze([...Object.values(CROSS_BORDER_RESULTS)]),
    persistence: 'none',
    mutation: false,
    authorization: false,
    execution: false,
    transactionCreation: false,
    providerExecution: false,
    deterministic: true,
    explainable: true,
    unknownIsSuccess: false,
    feasibilityIsAuthorization: false,
    authorizationIsExecution: false,
    failureStates: Object.freeze([...Object.values(CROSS_BORDER_FAILURE_STATES)]),
    authority: 'phase20-derived-cross-border-evaluation',
  });
}

export const CROSS_BORDER_EVALUATION_CONTRACT = crossBorderEvaluationContract();

// L11 — Logistics Scheduling Contract.
//
// Temporal coordination boundary only. This contract normalizes scheduling
// requests and outcomes over existing Commerce, Fulfillment, Movement, and
// Location authorities. It creates no calendar, capacity ledger, route
// engine, dispatch authority, provider registry, payment authority,
// inventory reservation, or duplicate fulfillment lifecycle.
//
// Scheduling semantics:
// requested != scheduled != confirmed != in_progress != completed.
// Feasibility is an evaluation outcome, not a persisted lifecycle state.
// UNKNOWN must never be inferred as SUCCESS.
//
// Future mutation/API layers must use the existing authorization, tenant/
// location, transaction, idempotency, and audit authorities.

export const LOGISTICS_SCHEDULING_CONTRACT_VERSION = '1.0';

export const SCHEDULING_MODES = Object.freeze([
  'ON_DEMAND',
  'SCHEDULED',
  'WINDOWED',
  'RECURRING',
]);

export const SCHEDULING_ACTIVITY_TYPES = Object.freeze([
  'PICKUP',
  'DELIVERY',
  'LOADING',
  'UNLOADING',
  'DEPARTURE',
  'ARRIVAL',
  'CHECKPOINT',
  'TRANSFER',
  'HANDOFF',
  'HUB_ARRIVAL',
  'HUB_DEPARTURE',
]);

export const SCHEDULING_STATUSES = Object.freeze([
  'REQUESTED',
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
  'MISSED',
  'EXPIRED',
]);

export const SCHEDULING_EVALUATION_OUTCOMES = Object.freeze([
  'FEASIBLE',
  'CONFLICT',
  'UNKNOWN',
]);

const MODES = new Set(SCHEDULING_MODES);
const ACTIVITIES = new Set(SCHEDULING_ACTIVITY_TYPES);
const STATUSES = new Set(SCHEDULING_STATUSES);
const EVALUATIONS = new Set(SCHEDULING_EVALUATION_OUTCOMES);

const FORBIDDEN_FIELDS = Object.freeze([
  'calendar',
  'capacity_ledger',
  'capacityLedger',
  'route_engine',
  'routeEngine',
  'dispatch_engine',
  'dispatchEngine',
  'gps',
  'payment',
  'payment_ledger',
  'paymentLedger',
  'inventory',
  'inventory_reservation',
  'inventoryReservation',
  'provider_registry',
  'providerRegistry',
  'credentials',
  'authorization',
  'event_store',
  'eventStore',
  'fulfillment_lifecycle',
  'fulfillmentLifecycle',
]);

function invalid(message, code = 'LOGISTICS_SCHEDULING_INVALID') {
  const error = new TypeError(`Invalid logistics scheduling contract: ${message}`);
  error.code = code;
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}

function optionalText(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field);
}

function normalized(value, field) {
  return text(value, field).toUpperCase();
}

function rejectForbidden(input) {
  for (const field of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      invalid(`scheduling input cannot contain ${field}`);
    }
  }
}

function normalizeReference(value, field) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`${field} must be an object`);
  }
  const id = optionalText(value.id, `${field}.id`);
  if (!id) invalid(`${field}.id is required`);
  const authority = optionalText(value.authority, `${field}.authority`);
  return Object.freeze({ id, authority });
}

function normalizeTime(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const result = text(value, field);
  if (Number.isNaN(Date.parse(result))) invalid(`${field} must be an ISO-8601 timestamp`);
  return result;
}

function normalizeWindow(start, end) {
  const requestedStart = normalizeTime(start, 'requested_start');
  const requestedEnd = normalizeTime(end, 'requested_end');
  if ((requestedStart === null) !== (requestedEnd === null)) {
    invalid('requested_start and requested_end must be supplied together');
  }
  if (requestedStart && Date.parse(requestedEnd) < Date.parse(requestedStart)) {
    invalid('requested_end must not precede requested_start');
  }
  return Object.freeze({
    requested_start: requestedStart,
    requested_end: requestedEnd,
  });
}

function normalizeRecurrence(input) {
  if (input === undefined || input === null) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    invalid('recurrence must be an object');
  }
  const frequency = normalized(input.frequency, 'recurrence.frequency');
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
    invalid(`unsupported recurrence frequency: ${frequency}`);
  }
  const interval = Number(input.interval ?? 1);
  if (!Number.isInteger(interval) || interval < 1) {
    invalid('recurrence.interval must be a positive integer');
  }
  return Object.freeze({ frequency, interval });
}

export function normalizeLogisticsSchedulingRequest(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    invalid('request must be an object');
  }
  rejectForbidden(input);

  const organizationId = text(input.organization_id, 'organization_id');
  const locationId = optionalText(input.location_id, 'location_id');
  const activityType = normalized(input.activity_type, 'activity_type');
  const mode = normalized(input.mode ?? 'ON_DEMAND', 'mode');

  if (!ACTIVITIES.has(activityType)) invalid(`unsupported activity_type: ${activityType}`);
  if (!MODES.has(mode)) invalid(`unsupported scheduling mode: ${mode}`);

  const window = normalizeWindow(input.requested_start, input.requested_end);
  const recurrence = normalizeRecurrence(input.recurrence);

  if (mode === 'WINDOWED' && !window.requested_start) {
    invalid('WINDOWED scheduling requires a requested time window');
  }
  if (mode === 'RECURRING' && !recurrence) {
    invalid('RECURRING scheduling requires recurrence');
  }
  if (mode !== 'RECURRING' && recurrence) {
    invalid('recurrence is only valid for RECURRING scheduling');
  }

  const related = Object.freeze({
    order: normalizeReference(input.related_order, 'related_order'),
    fulfillment: normalizeReference(input.related_fulfillment, 'related_fulfillment'),
    movement: normalizeReference(input.related_movement, 'related_movement'),
  });

  if (!related.order && !related.fulfillment && !related.movement) {
    invalid('at least one existing canonical reference is required');
  }

  const scheduled = normalizeWindow(input.scheduled_start, input.scheduled_end);
  if (scheduled.requested_start && scheduled.requested_end &&
      Date.parse(scheduled.requested_end) < Date.parse(scheduled.requested_start)) {
    invalid('scheduled_end must not precede scheduled_start');
  }

  return Object.freeze({
    contract_version: LOGISTICS_SCHEDULING_CONTRACT_VERSION,
    organization_id: organizationId,
    location_id: locationId,
    activity_type: activityType,
    mode,
    requested_start: window.requested_start,
    requested_end: window.requested_end,
    scheduled_start: scheduled.requested_start,
    scheduled_end: scheduled.requested_end,
    timezone: optionalText(input.timezone, 'timezone'),
    recurrence,
    related,
    status: normalized(input.status ?? 'REQUESTED', 'status'),
    persistence: 'none',
    mutation_authority: 'none',
    authorization_authority: 'backend/lib/authorization.js',
  });
}

export function evaluateLogisticsScheduling(input = {}) {
  const request = normalizeLogisticsSchedulingRequest(input);
  const status = request.status;
  if (!STATUSES.has(status)) invalid(`unsupported status: ${status}`);

  const requested = request.requested_start !== null;
  const scheduled = request.scheduled_start !== null;

  let outcome = 'UNKNOWN';
  if (scheduled) {
    outcome = 'FEASIBLE';
  } else if (requested) {
    outcome = 'UNKNOWN';
  }

  return Object.freeze({
    contract_version: request.contract_version,
    activity_type: request.activity_type,
    mode: request.mode,
    status,
    evaluation: outcome,
    requested,
    scheduled,
    confirmed: status === 'CONFIRMED' || status === 'IN_PROGRESS' || status === 'COMPLETED',
    executed: status === 'IN_PROGRESS' || status === 'COMPLETED',
    completed: status === 'COMPLETED',
    persistence: 'none',
    mutation_authority: 'none',
    unknown_state_policy: 'do_not_infer_success',
  });
}

export function isLogisticsSchedulingContract(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    value.contract_version === LOGISTICS_SCHEDULING_CONTRACT_VERSION &&
    typeof value.organization_id === 'string' &&
    ACTIVITIES.has(value.activity_type) &&
    MODES.has(value.mode) &&
    STATUSES.has(value.status) &&
    value.persistence === 'none' &&
    value.mutation_authority === 'none' &&
    value.authorization_authority === 'backend/lib/authorization.js'
  );
}

export function logisticsSchedulingContract() {
  return Object.freeze({
    version: LOGISTICS_SCHEDULING_CONTRACT_VERSION,
    purpose: 'temporal coordination of logistics activities',
    scheduling_modes: SCHEDULING_MODES,
    activity_types: SCHEDULING_ACTIVITY_TYPES,
    lifecycle: SCHEDULING_STATUSES,
    evaluation_outcomes: SCHEDULING_EVALUATION_OUTCOMES,
    scheduling_authority: 'logistics-pack-temporal-coordination',
    order_authority: 'commerce',
    fulfillment_authority: 'existing core fulfillment authority',
    movement_authority: 'existing logistics movement projection',
    location_authority: 'locations',
    capacity_authority: 'existing capacity evidence / source authority',
    discovery_authority: 'existing discovery and matching authority',
    authorization_authority: 'backend/lib/authorization.js',
    audit_authority: 'existing canonical audit authority',
    persistence: 'deferred to L11 mutation implementation',
    mutation_authority: 'deferred to L11 mutation service',
    feasibility_is_authorization: false,
    scheduled_is_confirmed: false,
    confirmed_is_executed: false,
    unknown_is_success: false,
    generic_calendar: false,
    capacity_ledger: false,
    route_engine: false,
    dispatch_engine: false,
    gps_authority: false,
    provider_registry: false,
    duplicate_order_authority: false,
    duplicate_fulfillment_authority: false,
    duplicate_inventory_authority: false,
    duplicate_payment_authority: false,
    adapter_boundary: 'Canonical Contract → Adapter → Provider',
  });
}

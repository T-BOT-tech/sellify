// Sellify Service Booking Contract — request and lifecycle semantics only.
// This contract defines booking vocabulary; it does not persist records or
// replace canonical Order, Payment Core, Fulfillment, or Logistics Scheduling.
// Durable mutations must be implemented through those existing authorities.

export const SERVICE_BOOKING_CONTRACT_VERSION = '1.0';

export const SERVICE_BOOKING_STATUSES = Object.freeze([
  'REQUESTED',
  'ACCEPTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'FAILED',
]);

export const SERVICE_BOOKING_TRANSITIONS = Object.freeze({
  REQUESTED: Object.freeze(['ACCEPTED', 'REJECTED', 'CANCELLED']),
  ACCEPTED: Object.freeze(['CONFIRMED', 'REJECTED', 'CANCELLED']),
  CONFIRMED: Object.freeze(['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED']),
  IN_PROGRESS: Object.freeze(['COMPLETED', 'FAILED']),
  COMPLETED: Object.freeze([]),
  REJECTED: Object.freeze([]),
  CANCELLED: Object.freeze([]),
  FAILED: Object.freeze([]),
});

const STATUS_SET = new Set(SERVICE_BOOKING_STATUSES);
const TERMINAL = new Set(['COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED']);
const FORBIDDEN_AUTHORITY_FIELDS = new Set([
  'payment_id', 'paymentId', 'order_status', 'orderStatus',
  'fulfillment_id', 'fulfillmentId', 'inventory_reservation_id',
  'inventoryReservationId', 'courier_id', 'courierId',
  'provider_id', 'providerId', 'organization_id', 'organizationId',
]);

function invalid(message, code = 'SERVICE_BOOKING_INVALID') {
  const error = new TypeError(message);
  error.code = code;
  throw error;
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') invalid(`${field} must be a string`);
  const result = value.trim();
  if (result.length > maxLength) invalid(`${field} must be at most ${maxLength} characters`);
  return result || null;
}

function timestamp(value, field) {
  const result = requiredText(value, field);
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(result) || Number.isNaN(Date.parse(result))) {
    invalid(`${field} must be an ISO-8601 timestamp with an explicit timezone`);
  }
  return new Date(result).toISOString();
}

/** Normalize a proposed appointment against an existing canonical service order. */
export function normalizeServiceBookingRequest(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    invalid('request must be an object');
  }
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_AUTHORITY_FIELDS.has(key)) {
      invalid(`booking input cannot set authority field: ${key}`, 'SERVICE_BOOKING_AUTHORITY_FIELD_FORBIDDEN');
    }
  }

  const orderId = requiredText(input.order_id ?? input.orderId, 'order_id');
  const serviceItemId = requiredText(input.service_item_id ?? input.serviceItemId, 'service_item_id');
  const start = timestamp(input.requested_start ?? input.requestedStart, 'requested_start');
  const end = timestamp(input.requested_end ?? input.requestedEnd, 'requested_end');
  if (Date.parse(end) <= Date.parse(start)) {
    invalid('requested_end must be later than requested_start', 'SERVICE_BOOKING_TIME_WINDOW_INVALID');
  }

  const mode = String(input.appointment_mode ?? input.appointmentMode ?? 'ON_SITE').trim().toUpperCase();
  if (!['ON_SITE', 'CUSTOMER_LOCATION', 'REMOTE'].includes(mode)) {
    invalid('appointment_mode must be ON_SITE, CUSTOMER_LOCATION, or REMOTE');
  }

  return Object.freeze({
    contract_version: SERVICE_BOOKING_CONTRACT_VERSION,
    order_id: orderId,
    service_item_id: serviceItemId,
    requested_start: start,
    requested_end: end,
    appointment_mode: mode,
    customer_note: optionalText(input.customer_note ?? input.customerNote, 'customer_note', 500),
    status: 'REQUESTED',
    scheduling_authority: 'existing_logistics_scheduling_when_applicable',
    order_authority: 'canonical_commerce_order',
    payment_authority: 'payment_core',
    persistence: 'none',
  });
}

export function canTransitionServiceBooking(fromStatus, toStatus) {
  const from = String(fromStatus || '').trim().toUpperCase();
  const to = String(toStatus || '').trim().toUpperCase();
  if (!STATUS_SET.has(from) || !STATUS_SET.has(to)) return false;
  return SERVICE_BOOKING_TRANSITIONS[from].includes(to);
}

export function assertServiceBookingTransition(fromStatus, toStatus) {
  const from = String(fromStatus || '').trim().toUpperCase();
  const to = String(toStatus || '').trim().toUpperCase();
  if (!STATUS_SET.has(from) || !STATUS_SET.has(to)) {
    invalid('unknown booking status', 'SERVICE_BOOKING_STATUS_INVALID');
  }
  if (!canTransitionServiceBooking(from, to)) {
    invalid(`transition ${from} -> ${to} is not allowed`, 'SERVICE_BOOKING_TRANSITION_INVALID');
  }
  return Object.freeze({ from, to, terminal: TERMINAL.has(to) });
}

export function serviceBookingContract() {
  return Object.freeze({
    version: SERVICE_BOOKING_CONTRACT_VERSION,
    statuses: SERVICE_BOOKING_STATUSES,
    transitions: SERVICE_BOOKING_TRANSITIONS,
    order_authority: 'canonical_commerce_order',
    payment_authority: 'payment_core',
    scheduling_authority: 'existing_logistics_scheduling_when_applicable',
    persists: false,
    creates_order: false,
    creates_payment: false,
    reserves_inventory: false,
    assigns_courier: false,
  });
}

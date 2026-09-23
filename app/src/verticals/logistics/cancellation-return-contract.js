// Phase 13.11.13 — Cancellation / Returns cross-boundary contract.
//
// Composes the existing Logistics Return workflow with the canonical Core
// Order / Fulfillment projection and the versioned event envelope. This
// module owns no Return store, Order state, Fulfillment lifecycle, Inventory
// mutation, Payment mutation, event persistence, dispatch, or routing.

import {
  normalizeLogisticsReturn,
  transitionLogisticsReturn,
} from './proof-return-contract.js';
import {
  buildUnifiedFulfillmentContext,
  isUnifiedFulfillmentContext,
} from '../../logistics/unified-fulfillment-contract.js';
import { buildVersionedEvent, isVersionedEvent } from '../../events/event-boundary.js';

const VERSION = '1.0';
const RETURN_TERMINALS = new Set(['received', 'rejected', 'cancelled']);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Cancellation / Return ${field} must be a non-empty string`);
  return result;
}

function organizationOf(value) {
  return text(value?.organization_id ?? value?.organizationId, 'organization_id');
}

function assertOrderScope(order, organizationId, locationId) {
  const organization_id = organizationOf(order);
  if (String(organizationId) !== organization_id) {
    throw new TypeError('Cancellation / Return order belongs to a different organization');
  }
  const orderLocation = order?.location_id ?? order?.locationId ?? null;
  if (locationId != null && orderLocation != null && String(locationId) !== String(orderLocation)) {
    throw new TypeError('Cancellation / Return order belongs to a different location');
  }
  return Object.freeze({ organization_id, location_id: orderLocation == null ? null : String(orderLocation) });
}

/**
 * Build the canonical cancellation handoff. Cancellation is represented as a
 * domain intent over the existing Core Order; this contract deliberately does
 * not invent a cancelled fulfillment status or mutate the order.
 */
export function buildCancellationHandoff({ order, organizationId, locationId, reason = null } = {}) {
  if (!order || typeof order !== 'object') throw new TypeError('Core Order is required');
  const order_id = text(order.id, 'order_id');
  const scope = assertOrderScope(order, organizationId, locationId);
  return Object.freeze({
    version: VERSION,
    kind: 'cancellation',
    order_id,
    organization_id: scope.organization_id,
    location_id: scope.location_id,
    current_order_status: order.status ?? null,
    fulfillment_status: order.fulfillment_status ?? null,
    reason: reason == null ? null : String(reason),
    mutation_authority: 'commerce',
    fulfillment_mutation_authority: null,
    persistence: 'existing_core_order_authority_only',
    inventory_mutation: 'none',
    payment_mutation: 'none',
  });
}

/**
 * Build a return handoff over an existing Core Order and the existing
 * Logistics Return state machine. A return reaching received does not itself
 * restock inventory; any disposition remains an explicit Inventory-owned
 * operation supplied by the canonical inventory capability.
 */
export function buildReturnHandoff({ order, logisticsReturn, organizationId, locationId } = {}) {
  if (!order || typeof order !== 'object') throw new TypeError('Core Order is required');
  const order_id = text(order.id, 'order_id');
  const scope = assertOrderScope(order, organizationId, locationId);
  const normalized = normalizeLogisticsReturn(logisticsReturn);
  if (normalized.order_id !== order_id) {
    throw new TypeError('Logistics Return does not reference the Core Order');
  }
  return Object.freeze({
    version: VERSION,
    kind: 'return',
    return: normalized,
    order_id,
    organization_id: scope.organization_id,
    location_id: scope.location_id,
    fulfillment_status: order.fulfillment_status ?? null,
    return_authority: 'logistics-pack',
    order_authority: 'commerce',
    inventory_authority: 'inventory',
    inventory_mutation: 'explicit_injected_capability_only',
    persistence: 'existing_core_state_only',
  });
}

export function transitionReturnHandoff({ current, nextStatus, order, organizationId, locationId } = {}) {
  const handoff = buildReturnHandoff({ order, logisticsReturn: current, organizationId, locationId });
  const transition = transitionLogisticsReturn({ current: handoff.return, nextStatus });
  return Object.freeze({
    ...handoff,
    return: transition,
    terminal: RETURN_TERMINALS.has(transition.status),
    inventory_disposition_required: transition.status === 'received',
  });
}

/**
 * Compose the handoff with the already-canonical Unified Fulfillment context.
 * The unified context is projection-only and remains the lifecycle authority.
 */
export function buildCancellationReturnContext({
  order,
  organizationId,
  locationId,
  agriculture,
  restaurant,
  cancellation = null,
  logisticsReturn = null,
} = {}) {
  const fulfillment = buildUnifiedFulfillmentContext({
    order,
    organizationId,
    locationId,
    agriculture,
    restaurant,
  });

  const cancellation_handoff = cancellation == null
    ? null
    : buildCancellationHandoff({ order, organizationId, locationId, reason: cancellation.reason });
  const return_handoff = logisticsReturn == null
    ? null
    : buildReturnHandoff({ order, logisticsReturn, organizationId, locationId });

  return Object.freeze({
    version: VERSION,
    order_id: fulfillment.order.order_id,
    organization_id: fulfillment.organization_id,
    location_id: fulfillment.location_id,
    fulfillment,
    cancellation: cancellation_handoff,
    return: return_handoff,
    authorities: Object.freeze({
      order: 'commerce',
      fulfillment: 'app/src/logistics/fulfillment.js',
      return: 'logistics-pack',
      inventory: 'inventory',
      stock_mutation: 'app/src/warehouse/inventory.js#applyStockChange',
      payment: 'payments',
    }),
    persistence: 'none',
    dispatch: Object.freeze({ implemented: false, authority: null, persistence: 'none' }),
    route_implementation: false,
    duplicate_order_authority: false,
    duplicate_fulfillment_authority: false,
    duplicate_return_authority: false,
    duplicate_inventory_authority: false,
  });
}

/**
 * Build an event envelope for a cancellation/return transition. This is an
 * envelope only: the current backend accepts only its existing sync event
 * handlers, so this phase does not enqueue or publish unsupported event types.
 */
export function buildCancellationReturnEvent({
  handoff,
  eventId,
  eventType = null,
  correlationId = null,
  causationId = null,
  occurredAt = null,
} = {}) {
  if (!handoff || typeof handoff !== 'object') throw new TypeError('Cancellation / Return handoff is required');
  const kind = handoff.kind === 'cancellation' || handoff.kind === 'return' ? handoff.kind : null;
  if (!kind) throw new TypeError('Cancellation / Return event requires a canonical handoff');
  const resolvedEventType = eventType || `logistics.${kind}.transitioned`;
  const aggregateId = kind === 'return' ? handoff.return.id : handoff.order_id;
  const payload = kind === 'return'
    ? { order_id: handoff.order_id, return: handoff.return }
    : { order_id: handoff.order_id, reason: handoff.reason, current_order_status: handoff.current_order_status };
  return buildVersionedEvent({
    eventId,
    eventType: resolvedEventType,
    aggregateType: kind === 'return' ? 'logistics_return' : 'commerce_order',
    aggregateId,
    organizationId: handoff.organization_id,
    payload,
    occurredAt,
    correlationId,
    causationId,
    idempotencyKey: eventId,
    metadata: { source: 'phase13.11.13-cancellation-return-contract', publish_supported: false },
  });
}

export function isCancellationReturnContext(value) {
  return Boolean(value && typeof value === 'object' &&
    value.version === VERSION &&
    typeof value.order_id === 'string' &&
    typeof value.organization_id === 'string' &&
    isUnifiedFulfillmentContext(value.fulfillment) &&
    value.fulfillment.order.order_id === value.order_id &&
    value.authorities?.order === 'commerce' &&
    value.authorities?.return === 'logistics-pack' &&
    value.authorities?.inventory === 'inventory' &&
    value.persistence === 'none' &&
    value.dispatch?.implemented === false &&
    value.route_implementation === false &&
    value.duplicate_return_authority === false);
}

export function cancellationReturnContract() {
  return Object.freeze({
    version: VERSION,
    cancellation_authority: 'commerce',
    cancellation_representation: 'existing_core_order_authority_only',
    return_authority: 'logistics-pack',
    return_transition_authority: 'logistics-pack',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    inventory_authority: 'inventory',
    stock_mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
    return_received_stock_behavior: 'explicit_injected_capability_only',
    event_envelope_authority: 'app/src/events/event-boundary.js',
    event_persistence: 'existing_outbox_and_sync_events_only',
    event_publication: 'not_supported_by_current_backend_handlers',
    persistence: 'none',
    duplicate_order_authority: false,
    duplicate_fulfillment_authority: false,
    duplicate_return_authority: false,
    duplicate_inventory_authority: false,
    dispatch_implemented: false,
    route_implementation: false,
  });
}

export const CANCELLATION_RETURN_CONTRACT = cancellationReturnContract();

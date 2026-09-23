// Phase 13.10 — Delivery proof / return boundary.
// Proof and return are logistics-domain semantics over existing Core orders;
// this module deliberately does not persist a second fulfillment/return store.

const PROOF_TYPES = new Set(['photo', 'signature', 'code', 'document', 'other']);
const RETURN_STATUSES = new Set(['requested', 'approved', 'in_transit', 'received', 'rejected', 'cancelled']);

function requiredText(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
}

export function normalizeDeliveryProof(proof) {
  if (!proof || typeof proof !== 'object') throw new TypeError('Delivery proof is required');
  const type = requiredText(proof.type, 'proof.type').toLowerCase();
  if (!PROOF_TYPES.has(type)) throw new TypeError(`Unsupported proof type: ${type}`);
  return Object.freeze({
    type,
    ref: requiredText(proof.ref, 'proof.ref'),
    captured_at: proof.captured_at ?? null,
  });
}

export function normalizeLogisticsReturn(value) {
  if (!value || typeof value !== 'object') throw new TypeError('Logistics return is required');
  const orderId = requiredText(value.order_id, 'return.order_id');
  const status = requiredText(value.status, 'return.status').toLowerCase();
  if (!RETURN_STATUSES.has(status)) throw new TypeError(`Unsupported return status: ${status}`);
  return Object.freeze({
    id: value.id ? String(value.id) : `return:${orderId}`,
    order_id: orderId,
    status,
    reason: value.reason ? String(value.reason) : null,
    proof: value.proof ? normalizeDeliveryProof(value.proof) : null,
  });
}



const RETURN_TRANSITIONS = Object.freeze({
  requested: new Set(['approved', 'rejected', 'cancelled']),
  approved: new Set(['in_transit', 'cancelled']),
  in_transit: new Set(['received']),
  received: new Set(),
  rejected: new Set(),
  cancelled: new Set(),
});

/**
 * Advance an existing Logistics Return through the bounded return workflow.
 * The workflow is coordination-only: it does not mutate Core Inventory,
 * Commerce Orders, or Payment state, and it does not create a return store.
 * Replaying the current status is safe and returns the same canonical state.
 */
export function transitionLogisticsReturn({ current, nextStatus } = {}) {
  const existing = normalizeLogisticsReturn(current);
  const next = requiredText(nextStatus, 'return.next_status').toLowerCase();
  if (!RETURN_STATUSES.has(next)) throw new TypeError(`Unsupported return status: ${next}`);
  if (existing.status === next) {
    return Object.freeze({
      ...existing,
      replay: true,
      transition: `${existing.status}->${next}`,
      persistence: 'existing_core_state_only',
    });
  }
  if (!RETURN_TRANSITIONS[existing.status]?.has(next)) {
    throw new TypeError(`Invalid return transition: ${existing.status}->${next}`);
  }
  return Object.freeze({
    ...existing,
    status: next,
    replay: false,
    transition: `${existing.status}->${next}`,
    persistence: 'existing_core_state_only',
  });
}

export function logisticsProofReturnContract() {
  return Object.freeze({
    proof_authority: 'logistics-pack',
    return_semantics_authority: 'logistics-pack',
    order_authority: 'commerce',
    stock_authority: 'inventory',
    stock_mutation: 'app/src/warehouse/inventory.js#applyStockChange',
    persistence: 'none',
    duplicate_inventory_authority: false,
    duplicate_order_authority: false,
    return_transition_authority: 'logistics-pack',
    return_persistence: 'existing_core_state_only',
  });
}

/**
 * Build the canonical Core Order update for proof captured after delivery.
 * This function is intentionally persistence-neutral: callers must persist
 * the returned field through the existing Core Order authority.
 *
 * Replaying the same proof reference is safe. Replacing an existing proof
 * with a different reference is rejected to prevent silent history loss.
 */
export function captureDeliveryProof({ order, proof } = {}) {
  if (!order || typeof order !== 'object') throw new TypeError('Core Order is required');
  const orderId = requiredText(order.id, 'order_id');
  const fulfillmentType = requiredText(order.fulfillment_type, 'fulfillment_type').toLowerCase();
  if (fulfillmentType !== 'delivery') throw new TypeError('Delivery proof requires a delivery fulfillment');
  const fulfillmentStatus = requiredText(order.fulfillment_status, 'fulfillment_status').toLowerCase();
  if (fulfillmentStatus !== 'delivered') throw new TypeError('Delivery proof requires delivered fulfillment status');

  const normalized = normalizeDeliveryProof(proof);
  const existing = order.fulfillment_proof && typeof order.fulfillment_proof === 'object'
    ? normalizeDeliveryProof(order.fulfillment_proof)
    : null;

  if (existing && existing.ref !== normalized.ref) {
    throw new TypeError('Delivery proof conflicts with existing fulfillment_proof');
  }

  const canonicalProof = existing || normalized;
  return Object.freeze({
    order_id: orderId,
    fulfillment_proof: canonicalProof,
    mutation_authority: 'commerce_order',
    persistence: 'existing_core_order_fields_only',
    replay: Boolean(existing),
  });
}

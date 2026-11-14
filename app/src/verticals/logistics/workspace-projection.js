// Phase 13.10.24 — Assignment-aware Logistics Operational Workspace Projection.
//
// Read-only projection over existing Order/Fulfillment and Delivery Assignment
// state. It introduces no authorization, persistence, mutation, tracking,
// proof, routing, or assignment authority.

const ACTIVE_ASSIGNMENT = new Set(['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY']);
function list(value) { return Array.isArray(value) ? value : []; }
function id(value) { return value == null ? null : String(value); }
function trackingReference(order) { return order?.tracking_reference ?? order?.trackingReference ?? null; }
function shipmentId(order) { return order?.shipment_id ?? order?.shipmentId ?? null; }

function assignmentFor(order, assignments) {
  const serverId = id(order?.server_order_id);
  const localId = id(order?.id);
  return list(assignments).find(a =>
    (serverId && id(a?.server_order_id) === serverId) ||
    (localId && id(a?.order_id) === localId)
  ) || null;
}

function recordFromOrder(order, assignment) {
  const status = String(order.fulfillment_status ?? '').toLowerCase() || null;
  const assignmentStatus = assignment?.status ? String(assignment.status).toUpperCase() : null;
  return Object.freeze({
    order_id: id(order.id),
    server_order_id: id(order.server_order_id),
    unresolved_order: false,
    fulfillment_type: order.fulfillment_type ?? assignment?.fulfillment_type ?? null,
    fulfillment_status: status,
    shipment_id: shipmentId(order),
    tracking_reference: trackingReference(order),
    assignment_id: id(assignment?.id),
    courier_user_id: id(assignment?.courier_user_id),
    assignment_status: assignmentStatus,
    proof_reference: assignment?.proof ?? order?.fulfillment_proof?.ref ?? null,
    exception: assignmentStatus === 'FAILED' || status === 'failed' ? 'FAILED' : null,
  });
}

function recordFromAssignment(assignment) {
  const assignmentStatus = String(assignment?.status || '').toUpperCase() || null;
  return Object.freeze({
    order_id: id(assignment?.order_id),
    server_order_id: id(assignment?.server_order_id),
    unresolved_order: true,
    fulfillment_type: assignment?.fulfillment_type ?? 'delivery',
    fulfillment_status: String(assignment?.fulfillment_status || '').toLowerCase() || null,
    shipment_id: id(assignment?.shipment_id),
    tracking_reference: assignment?.tracking_reference ?? null,
    assignment_id: id(assignment?.id),
    courier_user_id: id(assignment?.courier_user_id),
    assignment_status: assignmentStatus,
    proof_reference: assignment?.proof ?? assignment?.proof_reference ?? null,
    exception: assignmentStatus === 'FAILED' ? 'FAILED' : null,
  });
}

export function buildLogisticsOperationalWorkspaceProjection({ orders = [], assignments = [] } = {}) {
  const orderList = list(orders).filter(order => order && typeof order === 'object');
  const assignmentList = list(assignments).filter(assignment => assignment && typeof assignment === 'object');
  const matchedIds = new Set();
  const records = orderList.map(order => {
    const assignment = assignmentFor(order, assignmentList);
    if (assignment?.id != null) matchedIds.add(String(assignment.id));
    return recordFromOrder(order, assignment);
  });

  // Keep canonical assignment evidence visible if its Order projection is absent.
  // Do not fabricate customer, item, destination, or fulfillment details.
  for (const assignment of assignmentList) {
    if (assignment.id != null && matchedIds.has(String(assignment.id))) continue;
    const hasOrder = orderList.some(order =>
      (order.server_order_id != null && id(order.server_order_id) === id(assignment.server_order_id)) ||
      (order.id != null && id(order.id) === id(assignment.order_id))
    );
    if (!hasOrder) records.push(recordFromAssignment(assignment));
  }

  const active = records.filter(record =>
    ACTIVE_ASSIGNMENT.has(record.assignment_status) ||
    (record.fulfillment_status && !['delivered', 'picked_up', 'cancelled', 'failed'].includes(record.fulfillment_status))
  );
  const exceptions = records.filter(record => record.exception);
  const proof = records.filter(record => record.proof_reference);
  const tracking = records.filter(record =>
    record.shipment_id || record.tracking_reference || record.fulfillment_status || record.assignment_status
  );
  const workloadByCourier = Object.freeze(Object.fromEntries(Object.entries(active.reduce((counts, record) => {
    const key = record.courier_user_id || 'unassigned';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {}))));

  return Object.freeze({
    contract_version: '1.1',
    dispatch: Object.freeze(active),
    tracking: Object.freeze(tracking),
    proof: Object.freeze(proof),
    exceptions: Object.freeze(exceptions),
    workload: Object.freeze({
      active_count: active.length,
      assigned_count: active.filter(r => r.assignment_status === 'ASSIGNED').length,
      accepted_count: active.filter(r => r.assignment_status === 'ACCEPTED').length,
      out_for_delivery_count: active.filter(r => r.assignment_status === 'OUT_FOR_DELIVERY').length,
      by_courier: workloadByCourier,
    }),
    authority: 'existing_core_order_and_logistics_assignment_projection',
    authorization: 'backend/lib/authorization.js',
    persistence: 'none',
    mutation_authority: 'none',
    tracking_authority: 'existing_shipment_tracking_and_domain_state',
    proof_authority: 'existing_logistics_proof_contract',
    assignment_authority: 'app/src/logistics/fulfillment.js',
  });
}

export function logisticsOperationalWorkspaceProjectionContract() {
  return Object.freeze({
    version: '1.1',
    input: 'existing Core Order + existing Delivery Assignment projections',
    views: Object.freeze(['dispatch', 'tracking', 'proof', 'exceptions', 'workload']),
    authority: 'existing_core_order_and_logistics_assignment_projection',
    authorization: 'backend/lib/authorization.js',
    persistence: 'none',
    mutation_authority: 'none',
    duplicate_tracking_store: false,
    duplicate_proof_store: false,
    duplicate_assignment_authority: false,
    preserves_unmatched_assignments: true,
  });
}

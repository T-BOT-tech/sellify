import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildLogisticsOperationalWorkspaceProjection,
  logisticsOperationalWorkspaceProjectionContract,
} from '../app/src/verticals/logistics/workspace-projection.js';

const assignment = {
  id: 'assignment-1',
  server_order_id: 'server-order-1',
  courier_user_id: 'courier-1',
  status: 'OUT_FOR_DELIVERY',
  tracking_reference: 'TRACK-1',
};
const assignmentOnly = buildLogisticsOperationalWorkspaceProjection({ orders: [], assignments: [assignment] });
assert.equal(assignmentOnly.dispatch.length, 1);
assert.equal(assignmentOnly.tracking.length, 1);
assert.equal(assignmentOnly.dispatch[0].server_order_id, 'server-order-1');
assert.equal(assignmentOnly.dispatch[0].unresolved_order, true);
assert.equal(assignmentOnly.dispatch[0].fulfillment_status, null);
assert.equal(assignmentOnly.dispatch[0].assignment_status, 'OUT_FOR_DELIVERY');
assert.equal(assignmentOnly.workload.by_courier['courier-1'], 1);

const matched = buildLogisticsOperationalWorkspaceProjection({
  orders: [{ id: 'local-1', server_order_id: 'server-order-1', fulfillment_type: 'delivery', fulfillment_status: 'out_for_delivery' }],
  assignments: [assignment],
});
assert.equal(matched.dispatch.length, 1, 'matched assignment must not be duplicated');
assert.equal(matched.dispatch[0].unresolved_order, false);

for (const status of ['CANCELLED', 'REASSIGNED']) {
  const result = buildLogisticsOperationalWorkspaceProjection({
    orders: [], assignments: [{ ...assignment, id: status, status }],
  });
  assert.equal(result.exceptions.length, 0, status + ' is not a delivery exception');
  assert.equal(result.dispatch.length, 0);
}
const failed = buildLogisticsOperationalWorkspaceProjection({
  orders: [], assignments: [{ ...assignment, id: 'failed', status: 'FAILED' }],
});
assert.equal(failed.exceptions.length, 1);
assert.equal(failed.exceptions[0].exception, 'FAILED');

const contract = logisticsOperationalWorkspaceProjectionContract();
assert.equal(contract.preserves_unmatched_assignments, true);
assert.equal(contract.duplicate_assignment_authority, false);

const ui = fs.readFileSync(new URL('../app/src/logistics/ui.js', import.meta.url), 'utf8');
assert.ok(ui.indexOf('const visibleAssignments =') < ui.indexOf('const workspace = buildLogisticsOperationalWorkspaceProjection('),
  'visible assignments must be declared before workspace projection');
assert.match(ui, /data-assignment-only="1"/, 'assignment-only records must render actionable Logistics cards');
assert.doesNotMatch(ui, /if \(pending\.length === 0 && done\.length === 0\)[\s\S]{0,120}return;/,
  'assignment workspace must not be hidden by the legacy order-only empty state');

const fulfillment = fs.readFileSync(new URL('../app/src/logistics/fulfillment.js', import.meta.url), 'utf8');
assert.match(fulfillment, /deliveryAssignmentRefreshSequence/);
assert.match(fulfillment, /String\(config\.chatId\) !== tenantId/);
assert.match(fulfillment, /String\(config\.sessionToken\) !== sessionToken/);

const serviceBookings = fs.readFileSync(new URL('../app/src/logistics/service-bookings.js', import.meta.url), 'utf8');
assert.match(serviceBookings, /workspace\.dataset\.refreshSequence/);
assert.match(serviceBookings, /String\(config\.chatId\) !== tenantId/);
assert.match(serviceBookings, /String\(config\.sessionToken\) !== sessionToken/);
assert.match(serviceBookings, /serviceBookingsTenant/,
  'Service Booking refresh must not be coupled to every Logistics list render');
const applyLogistics = ui.slice(ui.indexOf('export function applyLogisticsUI'), ui.indexOf('export function renderOrderFulfillmentPicker'));
assert.doesNotMatch(applyLogistics, /refreshDeliveryAssignments\(/,
  'general app renders must not trigger assignment network requests');
assert.match(ui, /assignmentRefreshTenant/,
  'opening Logistics must trigger a tenant-scoped initial assignment refresh');

console.log('Phase 13.10.24 Logistics workspace projection regression: PASS');

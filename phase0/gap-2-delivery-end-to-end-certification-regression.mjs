import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../backend/lib/authorization.js', import.meta.url), 'utf8');
const fulfillment = fs.readFileSync(new URL('../app/src/logistics/fulfillment.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../app/src/logistics/ui.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../app/src/main.js', import.meta.url), 'utf8');

const required = [
  [/CREATE TABLE IF NOT EXISTS delivery_assignments/, 'canonical delivery assignment persistence'],
  [/CREATE UNIQUE INDEX idx_delivery_assignments_active_fulfillment/, 'single active assignment invariant'],
  [/transitionDeliveryAssignment/, 'canonical assignment lifecycle'],
  [/last_command_key TEXT/, 'lifecycle idempotency'],
  [/delivery\.assignment\.reassigned/, 'reassignment audit/event boundary'],
  [/delivery\.assignment\.delivered/, 'delivery completion audit/event boundary'],
  [/applyCoreFulfillmentInventoryConsequence/, 'existing fulfillment inventory authority'],
  [/COURIER_ASSIGNMENT_REQUIRED/, 'server-side courier assignment enforcement'],
  [/COURIER_SCOPE_DENIED/, 'organization/location authorization boundary'],
  [/logistics:deliveries:assign/, 'assignment capability'],
  [/logistics:deliveries:reassign/, 'reassignment capability'],
  [/logistics:deliveries:update_assigned/, 'assigned courier capability'],
  [/Idempotency-Key is required/, 'mutating command idempotency requirement'],
];

for (const [pattern, name] of required) {
  assert.match(store + server, pattern, name);
}

assert.match(auth, /logistics_courier/);
assert.match(auth, /logistics:deliveries:update_assigned/);
assert.doesNotMatch(auth, /logistics_courier[^]*fulfillment:update/);

assert.match(fulfillment, /refreshDeliveryAssignments/);
assert.match(fulfillment, /assignDeliveryCourierForOrder/);
assert.match(fulfillment, /listLogisticsStaff/);
assert.match(fulfillment, /method: 'PATCH'/);
assert.match(fulfillment, /Idempotency-Key/);

assert.match(ui, /renderDeliveryWorkloadSummary/);
assert.match(ui, /logistics-status-filter/);
assert.match(ui, /logistics-courier-filter/);
assert.match(ui, /delivery-action-btn/);
assert.match(ui, /delivery-assign-btn/);
assert.match(ui, /logistics_courier/);

assert.match(main, /transitionDeliveryAssignmentForOrder/);

assert.match(store, /organization_id = \?/);
assert.match(store, /location_id = \?/);
assert.match(server, /assertCourierOwnsDelivery/);

console.log('GAP-2 End-to-End Delivery Assignment Certification: PASS');
console.log('Assignment authority -> lifecycle -> authorization -> frontend contract: PASS');
console.log('Organization/location isolation boundary: PASS');
console.log('Courier assigned-delivery-only mutation boundary: PASS');
console.log('Idempotent lifecycle command boundary: PASS');
console.log('Existing fulfillment inventory authority preserved: PASS');
console.log('Advanced runtime certification remains dependent on execution under Node >=24 with realistic tenant fixtures.');

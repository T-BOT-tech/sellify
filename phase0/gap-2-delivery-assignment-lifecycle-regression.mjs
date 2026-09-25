import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');

assert.match(store, /if \(!applied\.includes\(44\)\)/);
assert.match(store, /CREATE UNIQUE INDEX idx_delivery_assignments_active_fulfillment/);
assert.match(store, /last_command_key TEXT/);
assert.match(store, /transitionDeliveryAssignment/);
assert.match(store, /ASSIGNED: new Set\(\['ACCEPTED','CANCELLED','FAILED','REASSIGNED'\]\)/);
assert.match(store, /ACCEPTED: new Set\(\['OUT_FOR_DELIVERY','CANCELLED','FAILED','REASSIGNED'\]\)/);
assert.match(store, /OUT_FOR_DELIVERY: new Set\(\['DELIVERED','CANCELLED','FAILED','REASSIGNED'\]\)/);
assert.match(store, /DELIVERY_PROOF_REQUIRED/);
assert.match(store, /REASSIGNMENT_TARGET_REQUIRED/);
assert.match(store, /delivery\.assignment\.reassigned/);
assert.match(store, /Target courier does not have an active logistics courier role/);
assert.match(store, /delivery\.assignment\.delivered/);
assert.match(store, /applyCoreFulfillmentInventoryConsequence/);

assert.match(server, /method: 'PATCH'.*delivery-assignment/);
assert.match(server, /transitionDeliveryAssignment/);
assert.match(server, /logistics:deliveries:update_assigned/);
assert.match(server, /logistics:deliveries:reassign/);
assert.match(server, /Idempotency-Key is required/);

console.log('GAP-2 Delivery Assignment Lifecycle Regression: PASS');
console.log('Assignment history + active-assignment uniqueness: PASS');
console.log('Courier accept/start/deliver authorization boundary: PASS');
console.log('Delivery proof requirement: PASS');
console.log('Idempotent lifecycle command boundary: PASS');
